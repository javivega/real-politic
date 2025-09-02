/**
 * AI Analysis Service with Evidence Context Integration
 * 
 * This service enhances AI analysis by automatically including:
 * - News articles and snippets related to initiatives
 * - Social media posts from political parties
 * - Official legal documents (BOCG, DS)
 * 
 * Evidence is loaded from /evidence-context.json and injected into prompts
 * to provide more informed, data-driven analysis.
 */

import OpenAI from 'openai';
import { CongressInitiative } from '../lib/supabase';
import { ServerCacheService, CachedAnalysis } from './serverCacheService';

export interface AIAnalysisResult {
  analysis: string;
  confidence: number;
}

export interface EvidenceContext {
  initiative_id: string;
  news?: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
  x?: {
    [party: string]: Array<{
      url: string;
      source: string;
      type: string;
    }>;
  };
  legal?: {
    bocg?: string;
    ds?: string;
  };
}

/**
 * AI Analysis Service with evidence context integration
 * 
 * This service provides AI-powered analysis of legislative initiatives with:
 * - Problem analysis and enhanced titles
 * - Technical pros/cons analysis
 * - Server-side caching for cost optimization
 * - Evidence context integration from news, social media, and legal documents
 * 
 * Evidence context is automatically loaded from /evidence-context.json and
 * injected into AI prompts to provide richer, more informed analysis.
 */
export class AIAnalysisService {
  private openai: OpenAI | null = null;
  // Cache for short legal summaries per initiative id or num_expediente
  private legalSummaries: Map<string, { bocgSummary?: string; dsSummary?: string }> = new Map();
  // Cache for news/external summaries per initiative key
  private newsSummaries: Map<string, Record<string, string>> = new Map();

  /**
   * Cleans AI response content by removing JSON artifacts and normalizing text
   */
  private cleanAIResponse(content: string): string {
    if (!content) return '';

    // DEBUG MODE: Skip cleaning temporarily to see raw content
    const DEBUG_MODE = false;
    if (DEBUG_MODE) {
      console.log('🔍 DEBUG MODE: Returning raw content without cleaning');
      return content.trim();
    }

    console.log('🔍 cleanAIResponse input:', content);
    let cleaned = content.trim();

    // Remove JSON content if present - handle multiple formats
    if (cleaned.includes('```json')) {
      const jsonStart = cleaned.indexOf('```json');
      if (jsonStart > 0) {
        cleaned = cleaned.substring(0, jsonStart).trim();
        console.log('🔍 Removed ```json, result:', cleaned);
      } else {
        // If ```json is at the beginning, try to find content after it
        const afterJson = cleaned.substring(6).trim(); // Remove ```json
        if (afterJson && afterJson.length > 10) {
          cleaned = afterJson;
          console.log('🔍 Found content after ```json:', cleaned);
        } else {
          // If no content after ```json, return the original content before cleaning
          console.log('🔍 No content after ```json, returning original content');
          return content.trim();
        }
      }
    } else if (cleaned.includes('```')) {
      const codeStart = cleaned.indexOf('```');
      if (codeStart > 0) {
        cleaned = cleaned.substring(0, codeStart).trim();
        console.log('🔍 Removed ```, result:', cleaned);
      } else {
        // If ``` is at the beginning, try to find content after it
        const afterCode = cleaned.substring(3).trim(); // Remove ```
        if (afterCode && afterCode.length > 10) {
          cleaned = afterCode;
          console.log('🔍 Found content after ```:', cleaned);
        } else {
          // If no content after ```, return the original content before cleaning
          console.log('🔍 No content after ```, returning original content');
          return content.trim();
        }
      }
    } else if (cleaned.includes('{') && cleaned.includes('}')) {
      const braceStart = cleaned.indexOf('{');
      if (braceStart > 0) {
        cleaned = cleaned.substring(0, braceStart).trim();
        console.log('🔍 Removed {, result:', cleaned);
      } else {
        // If { is at the beginning, try to find content after it
        const afterBrace = cleaned.substring(1).trim(); // Remove {
        if (afterBrace && afterBrace.length > 10) {
          cleaned = afterBrace;
          console.log('🔍 Found content after {:', cleaned);
        } else {
          // If no content after {, return the original content before cleaning
          console.log('🔍 No content after {, returning original content');
          return content.trim();
        }
      }
    }

    // Remove any remaining JSON-like artifacts
    cleaned = cleaned.replace(/\s*\{[^}]*$/, ''); // Remove incomplete JSON objects
    cleaned = cleaned.replace(/\s*\[[^\]]*$/, ''); // Remove incomplete JSON arrays
    cleaned = cleaned.replace(/\s*"[^"]*$/, ''); // Remove incomplete JSON strings

    // Remove any trailing ```json or ``` without content
    cleaned = cleaned.replace(/\s*```json\s*$/, '');
    cleaned = cleaned.replace(/\s*```\s*$/, '');
    cleaned = cleaned.replace(/\s*\{\s*$/, '');
    cleaned = cleaned.replace(/\s*\[\s*$/, '');

    // Remove extra whitespace and normalize
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Ensure it ends with proper punctuation
    if (cleaned && !cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.';
    }

    console.log('🔍 cleanAIResponse final output:', cleaned);
    return cleaned;
  }
  private isAvailable: boolean = false;
  public serverCache: ServerCacheService;
  private evidenceContext: Map<string, EvidenceContext> = new Map();

  constructor() {
    console.log('🔍 AIAnalysisService constructor called');
    this.serverCache = new ServerCacheService();
    
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (apiKey) {
      try {
        this.openai = new OpenAI({ 
          apiKey,
          dangerouslyAllowBrowser: true
        });
        this.isAvailable = true;
        console.log('OpenAI service initialized successfully');
      } catch (error) {
        console.error('Error initializing OpenAI:', error);
        this.isAvailable = false;
      }
    } else {
      console.warn('OpenAI API key not found');
      this.isAvailable = false;
    }

    // Load evidence context on initialization
    this.loadEvidenceContext();
  }

  /**
   * Attempts to fetch and summarize legal documents (BOCG / DS) linked in evidence.
   * - Tries HTML first (no PDF parsing dependency). If URL seems to be a PDF, we skip fetching and
   *   just note the link; optionally we could add a light-weight PDF extraction later.
   * - Summaries are short, capped, and cached in-memory during the app session.
   */
  private async ensureLegalSummaries(initiative: CongressInitiative): Promise<void> {
    try {
      const evidence = this.getEvidenceContext(initiative);
      if (!evidence || !evidence.legal) return;

      const key = initiative.num_expediente || initiative.id;
      const existing = this.legalSummaries.get(key) || {};

      const fetchAndSummarize = async (url: string): Promise<string | undefined> => {
        try {
          // Skip obvious PDFs to avoid heavy parsing client-side
          if (/\.pdf(\b|$)/i.test(url)) return undefined;

          const res = await fetch(url, { method: 'GET' });
          if (!res.ok) return undefined;
          const contentType = res.headers.get('content-type') || '';
          // Only process HTML
          if (!contentType.includes('text/html')) return undefined;
          const html = await res.text();
          const text = this.extractReadableTextFromHtml(html).slice(0, 12000); // cap raw text size
          if (!text || text.length < 200) return undefined;

          if (!this.openai) return undefined;
          const prompt = `Resume de forma muy concisa el contenido del siguiente documento oficial (máx 3 frases claras).\n\nTEXTO:\n${text}`;
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Eres un asistente que crea resúmenes breves y técnicos en español.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 200
          });
          const summary = (completion.choices[0]?.message?.content || '').trim();
          return summary ? summary.substring(0, 600) : undefined;
        } catch (e) {
          console.warn('⚠️ Error summarizing legal URL:', url, (e as Error)?.message);
          return undefined;
        }
      };

      // Fetch/summarize BOCG if missing
      if (evidence.legal.bocg && !existing.bocgSummary) {
        existing.bocgSummary = await fetchAndSummarize(evidence.legal.bocg);
      }

      // Fetch/summarize DS if missing
      if (evidence.legal.ds && !existing.dsSummary) {
        existing.dsSummary = await fetchAndSummarize(evidence.legal.ds);
      }

      this.legalSummaries.set(key, existing);
    } catch (e) {
      console.warn('⚠️ Error ensuring legal summaries:', (e as Error)?.message);
    }
  }

  /**
   * Attempts to fetch and summarize external news (URLs in evidence.news).
   * - Only processes up to 3 items, HTML-only, caches summaries in-memory.
   */
  private async ensureNewsSummaries(initiative: CongressInitiative): Promise<void> {
    try {
      const evidence = this.getEvidenceContext(initiative);
      if (!evidence || !evidence.news || evidence.news.length === 0) return;
      const key = initiative.num_expediente || initiative.id;
      const cache = this.newsSummaries.get(key) || {};

      const fetchAndSummarize = async (url: string, title?: string, snippet?: string): Promise<string | undefined> => {
        try {
          const res = await fetch(url, { method: 'GET' });
          if (!res.ok) return undefined;
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('text/html')) return undefined;
          const html = await res.text();
          const text = this.extractReadableTextFromHtml(html).slice(0, 12000);
          if (!text || text.length < 200) return undefined;
          if (!this.openai) return undefined;
          const header = `${title ? `TÍTULO: ${title}\n` : ''}${snippet ? `ADELANTO: ${snippet}\n` : ''}`;
          const prompt = `Resume en 2-3 frases claras y neutrales el siguiente artículo relacionado con una iniciativa legislativa.\n${header}\nTEXTO:\n${text}`;
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Eres un asistente que crea resúmenes breves y neutrales en español.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 220
          });
          const summary = (completion.choices[0]?.message?.content || '').trim();
          return summary ? summary.substring(0, 600) : undefined;
        } catch {
          return undefined;
        }
      };

      for (const item of evidence.news.slice(0, 3)) {
        if (!cache[item.url]) {
          cache[item.url] = (await fetchAndSummarize(item.url, item.title, item.snippet)) || '';
        }
      }

      this.newsSummaries.set(key, cache);
    } catch (e) {
      console.warn('⚠️ Error ensuring news summaries:', (e as Error)?.message);
    }
  }

  // Minimal HTML -> text extraction (client-side)
  private extractReadableTextFromHtml(html: string): string {
    try {
      // Remove scripts/styles
      let clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
      // Replace tags with spaces, decode entities roughly
      clean = clean.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      // Collapse whitespace
      clean = clean.replace(/\s+/g, ' ').trim();
      return clean;
    } catch {
      return '';
    }
  }

  /**
   * Loads evidence context from the public directory
   */
  private async loadEvidenceContext(): Promise<void> {
    try {
      console.log('🔍 Loading evidence context from /evidence-context.json...');
      const response = await fetch('/evidence-context.json?t=' + Date.now());
      console.log('🔍 Fetch response status:', response.status, response.statusText);
      
      if (response.ok) {
        const evidenceData = await response.json();
        console.log('🔍 Evidence data loaded, length:', evidenceData.length);
        console.log('🔍 First few initiative IDs:', evidenceData.slice(0, 5).map((item: any) => item.initiative_id));
        
        // Convert array to Map for faster lookups
        this.evidenceContext.clear(); // Clear existing data
        evidenceData.forEach((item: EvidenceContext) => {
          this.evidenceContext.set(item.initiative_id, item);
        });
        console.log(`✅ Loaded evidence context for ${this.evidenceContext.size} initiatives`);
        
        // Debug: check if specific initiative exists
        const testInitiative = this.evidenceContext.get('122/000206/0000');
        console.log('🔍 Test initiative 122/000206/0000 exists:', !!testInitiative);
        if (testInitiative) {
          console.log('🔍 Test initiative data:', testInitiative);
        }
      } else {
        console.warn(`⚠️ Could not load evidence-context.json (${response.status}: ${response.statusText}), proceeding without evidence context`);
      }
    } catch (error) {
      console.warn('⚠️ Error loading evidence context:', error);
      // Don't throw, just log the warning
    }
  }

  /**
   * Gets evidence context for a specific initiative
   */
  private getEvidenceContext(initiative: CongressInitiative): EvidenceContext | null {
    console.log('🔍 getEvidenceContext called for:', {
      id: initiative.id,
      num_expediente: initiative.num_expediente,
      evidenceContextSize: this.evidenceContext.size
    });
    
    // Try to match by initiative ID
    const evidence = this.evidenceContext.get(initiative.id);
    if (evidence) {
      console.log('🔍 Found evidence by initiative ID');
      return evidence;
    }

    // Try to match by num_expediente if available
    if (initiative.num_expediente) {
      const evidence = this.evidenceContext.get(initiative.num_expediente);
      if (evidence) {
        console.log('🔍 Found evidence by num_expediente');
        return evidence;
      }
    }

    console.log('🔍 No evidence found for initiative');
    return null;
  }

  /**
   * Builds evidence context text for AI prompts
   */
  private buildEvidenceContextText(initiative: CongressInitiative): string {
    const evidence = this.getEvidenceContext(initiative);
    if (!evidence) return '';

    let contextText = '\n🔍 EVIDENCIA EXTERNA DISPONIBLE:\n\n';

    // Add news evidence
    if (evidence.news && evidence.news.length > 0) {
      contextText += '📰 NOTICIAS RECIENTES:\n';
      const key = initiative.num_expediente || initiative.id;
      const summaries = this.newsSummaries.get(key) || {};
      evidence.news.slice(0, 3).forEach((news, index) => {
        contextText += `${index + 1}. ${news.title}\n`;
        if (news.snippet) {
          contextText += `   ${news.snippet.substring(0, 150)}${news.snippet.length > 150 ? '...' : ''}\n`;
        }
        if (summaries[news.url]) {
          contextText += `   Resumen: ${summaries[news.url]}\n`;
        }
        contextText += `   Fuente: ${news.url}\n\n`;
      });
    }

    // Add social media evidence
    if (evidence.x && Object.keys(evidence.x).length > 0) {
      contextText += '🐦 POSICIONES EN REDES SOCIALES:\n';
      Object.entries(evidence.x).forEach(([party, posts]) => {
        contextText += `• ${party}: ${posts.length} publicaciones encontradas\n`;
        posts.slice(0, 2).forEach(post => {
          contextText += `  - ${post.type}: ${post.url}\n`;
        });
      });
      contextText += '\n';
    }

    // Add legal document evidence
    if (evidence.legal) {
      contextText += '📋 DOCUMENTOS LEGALES OFICIALES:\n';
      if (evidence.legal.bocg) {
        contextText += `• BOCG (Boletín Oficial del Congreso): ${evidence.legal.bocg}\n`;
        // Include summary if available
        const key = initiative.num_expediente || initiative.id;
        const summaries = this.legalSummaries.get(key);
        if (summaries?.bocgSummary) {
          contextText += `   Resumen: ${summaries.bocgSummary}\n`;
        }
      }
      if (evidence.legal.ds) {
        contextText += `• DS (Diario de Sesiones): ${evidence.legal.ds}\n`;
        const key = initiative.num_expediente || initiative.id;
        const summaries = this.legalSummaries.get(key);
        if (summaries?.dsSummary) {
          contextText += `   Resumen: ${summaries.dsSummary}\n`;
        }
      }
      contextText += '\n';
    }

    return contextText;
  }

  /**
   * Analyzes an initiative with server cache integration
   */
  async analyzeInitiative(initiative: CongressInitiative): Promise<{ analysis: string }> {
    // First, check server cache
    const cachedAnalysis = await this.serverCache.getCachedAnalysis(initiative);
    if (cachedAnalysis && cachedAnalysis.problem_analysis) {
      console.log('Using server-cached problem analysis, cost saved:', cachedAnalysis.cost_saved);
      console.log('🔍 Cached analysis content:', cachedAnalysis.problem_analysis);
      console.log('🔍 Cached analysis length:', cachedAnalysis.problem_analysis.length);
      return { analysis: cachedAnalysis.problem_analysis };
    }

    // If no server cache, generate new analysis
    if (!this.openai) {
      throw new Error('OpenAI client no está disponible');
    }

    const startTime = Date.now();
    try {
      // Ensure evidence summaries (legal/news) before building the prompt
      await Promise.all([
        this.ensureLegalSummaries(initiative),
        this.ensureNewsSummaries(initiative)
      ]);
      const prompt = this.buildRichPrompt(initiative);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto analista político español especializado en análisis de iniciativas legislativas. Tu papel es puramente técnico y no político, por lo que no debes emitir juicios de valor, solamente analizar técnicamente la iniciativa. Debes analizar cada iniciativa de forma específica, técnica y neutral, considerando el contexto político actual de España. Debes explicar qué problema intenta resolver la iniciativa, qué solución se propone por parte del partido o grupo político que la propone, y qué efectos tendrá la iniciativa en la sociedad y en la economía. Responde: ¿es un problema real?, ¿es un problema importante de resolver?, ¿es la solución una respuesta real ante el problema?.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      console.log('🔍 Raw AI response:', content);
      console.log('🔍 Content length:', content.length);
      console.log('🔍 Content ends with:', content.substring(Math.max(0, content.length - 20)));

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        console.log('🔍 Parsed JSON successfully:', parsed);
        
        if (parsed.analysis && typeof parsed.analysis === 'string' && parsed.analysis.trim().length > 0) {
          console.log('🔍 Found analysis field:', parsed.analysis);
          const analysis = this.cleanAIResponse(parsed.analysis);
          console.log('🔍 Final cleaned analysis:', analysis);
          console.log('🔍 Analysis length after cleaning:', analysis.length);
          return { analysis };
        } else {
          console.log('🔍 JSON parsed but no valid analysis field, cleaning content directly');
          const analysis = this.cleanAIResponse(content);
          console.log('🔍 Final cleaned content:', analysis);
          console.log('🔍 Content length after cleaning:', analysis.length);
          return { analysis };
        }
      } catch (parseError: any) {
        console.log('🔍 JSON parsing failed:', parseError?.message || 'Unknown error');
        console.log('🔍 Attempting to extract partial content');
        
        // Try to extract content before any JSON artifacts
        let extractedContent = content;
        
        // Look for common JSON patterns and extract content before them
        const jsonPatterns = [
          /```json\s*\{/,
          /```\s*\{/,
          /\s*\{/,
          /\s*\[/
        ];
        
        for (const pattern of jsonPatterns) {
          const match = content.match(pattern);
          if (match && match.index && match.index > 0) {
            extractedContent = content.substring(0, match.index).trim();
            console.log('🔍 Extracted content before JSON pattern:', extractedContent);
            console.log('🔍 Extracted content length:', extractedContent.length);
            break;
          }
        }
        
        const analysis = this.cleanAIResponse(extractedContent);
        console.log('🔍 Final cleaned content:', analysis);
        console.log('🔍 Final content length:', analysis.length);
        
        return { analysis };
      }
    } catch (error) {
      console.error('Error analyzing initiative:', error);
      throw error;
    }
  }

  /**
   * Generates external research with server cache integration
   */
  async generateExternalResearch(initiative: CongressInitiative): Promise<string> {
    // First, check server cache
    const cachedAnalysis = await this.serverCache.getCachedAnalysis(initiative);
    if (cachedAnalysis && cachedAnalysis.external_research) {
      console.log('Using server-cached external research, cost saved:', cachedAnalysis.cost_saved);
      return cachedAnalysis.external_research;
    }

    // If no server cache, generate new analysis
    if (!this.openai) {
      throw new Error('OpenAI client no está disponible');
    }

    const startTime = Date.now();
    try {
      await Promise.all([
        this.ensureLegalSummaries(initiative),
        this.ensureNewsSummaries(initiative)
      ]);
      const prompt = this.buildExternalResearchPrompt(initiative);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto investigador español especializado en análisis de impacto de políticas públicas. Debes analizar iniciativas legislativas desde una perspectiva técnica, económica y social, usando datos reales y experiencias internacionales. Responde en español de España, sé específico y neutral.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 600
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      console.log('🔍 Raw AI response for external research:', content);

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        console.log('🔍 Parsed JSON for external research:', parsed);
        
        if (parsed.analysis && typeof parsed.analysis === 'string' && parsed.analysis.trim().length > 0) {
          const analysis = this.cleanAIResponse(parsed.analysis);
          console.log('🔍 Cleaned analysis from JSON:', analysis);
          return analysis;
        } else {
          console.log('🔍 JSON parsed but no valid analysis field, cleaning content directly');
          const analysis = this.cleanAIResponse(content);
          console.log('🔍 Cleaned content:', analysis);
          return analysis;
        }
      } catch (parseError) {
        console.log('🔍 Not valid JSON for external research, attempting to extract partial content');
        
        // Try to extract content before any JSON artifacts
        let extractedContent = content;
        
        // Look for common JSON patterns and extract content before them
        const jsonPatterns = [
          /```json\s*\{/,
          /```\s*\{/,
          /\s*\{/,
          /\s*\[/
        ];
        
        for (const pattern of jsonPatterns) {
          const match = content.match(pattern);
          if (match && match.index && match.index > 0) {
            extractedContent = content.substring(0, match.index).trim();
            console.log('🔍 Extracted content before JSON pattern:', extractedContent);
            break;
          }
        }
        
        const analysis = this.cleanAIResponse(extractedContent);
        console.log('🔍 Final cleaned content for external research:', analysis);
        
        return analysis;
      }
    } catch (error) {
      console.error('Error generating external research:', error);
      throw error;
    }
  }

  /**
   * Generates technical pros and cons with server cache integration
   */
  async generateTechnicalProsCons(initiative: CongressInitiative): Promise<{
    analysis: string;
    economic_impact: string;
    social_impact: string;
    societal_impact: string;
  }> {
    // First, check server cache
    const cachedAnalysis = await this.serverCache.getCachedAnalysis(initiative);
    if (cachedAnalysis && cachedAnalysis.technical_pros_cons) {
      console.log('Using server-cached technical pros/cons, cost saved:', cachedAnalysis.cost_saved);
      console.log('🔍 Cached technical pros/cons:', cachedAnalysis.technical_pros_cons);
      return cachedAnalysis.technical_pros_cons;
    }

    // If no server cache, generate new analysis
    if (!this.openai) {
      throw new Error('OpenAI client no está disponible');
    }

    const startTime = Date.now();
    try {
      await Promise.all([
        this.ensureLegalSummaries(initiative),
        this.ensureNewsSummaries(initiative)
      ]);
      const prompt = this.buildTechnicalProsConsPrompt(initiative);
      
      // Use a more powerful model for technical analysis since we now have richer context
      const model = 'gpt-4o-mini';
      
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto analista político español especializado en análisis de impacto de iniciativas legislativas. Tu trabajo es CRÍTICO: debes analizar cada iniciativa de forma EQUILIBRADA, identificando SIEMPRE tanto beneficios como riesgos en cada área, incluso si no son obvios. Para políticas restrictivas, busca beneficios como mayor control y protección. Para políticas expansivas, busca riesgos como costos y complejidad. Responde en español de España.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      console.log('🔍 Raw AI response for technical pros/cons:', content);
      console.log('🔍 Content length:', content.length);
      console.log('🔍 Content ends with:', content.substring(Math.max(0, content.length - 50)));
      console.log('🔍 Full content for debugging:');
      console.log('---START OF AI RESPONSE---');
      console.log(content);
      console.log('---END OF AI RESPONSE---');

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        console.log('🔍 Parsed JSON for technical pros/cons:', parsed);
        
        if (parsed.analysis && parsed.economic_impact && parsed.social_impact && parsed.societal_impact) {
          const result = {
            analysis: this.cleanAIResponse(parsed.analysis),
            economic_impact: this.cleanAIResponse(parsed.economic_impact),
            social_impact: this.cleanAIResponse(parsed.social_impact),
            societal_impact: this.cleanAIResponse(parsed.societal_impact)
          };
          
          console.log('🔍 Cleaned technical pros/cons result:', result);
          return result;
        } else {
          console.log('🔍 JSON parsed but missing fields:', Object.keys(parsed));
          console.log('🔍 Available fields:', parsed);
          
          const analysis = this.cleanAIResponse(parsed.analysis || content);
          const result = {
            analysis: analysis || 'Análisis general no disponible',
            economic_impact: this.cleanAIResponse(parsed.economic_impact) || 'Análisis económico no disponible',
            social_impact: this.cleanAIResponse(parsed.social_impact) || 'Análisis social no disponible',
            societal_impact: this.cleanAIResponse(parsed.societal_impact) || 'Análisis societal no disponible'
          };
          
          console.log('🔍 Final result with fallbacks:', result);
          return result;
        }
      } catch (parseError) {
        console.log('🔍 Not valid JSON for technical pros/cons, attempting to extract partial content');
        
        // Try to extract content before any JSON artifacts
        let extractedContent = content;
        
        // Look for common JSON patterns and extract content before them
        const jsonPatterns = [
          /```json\s*\{/,
          /```\s*\{/,
          /\s*\{/,
          /\s*\[/
        ];
        
        for (const pattern of jsonPatterns) {
          const match = content.match(pattern);
          if (match && match.index && match.index > 0) {
            extractedContent = content.substring(0, match.index).trim();
            console.log('🔍 Extracted content before JSON pattern:', extractedContent);
            break;
          }
        }
        
        const analysis = this.cleanAIResponse(extractedContent);
        console.log('🔍 Final cleaned content for technical pros/cons:', analysis);
        
        const result = {
          analysis: analysis || 'Análisis general no disponible',
          economic_impact: 'Análisis económico no disponible - formato AI incorrecto',
          social_impact: 'Análisis social no disponible - formato AI incorrecto',
          societal_impact: 'Análisis societal no disponible - formato AI incorrecto'
        };
        
        console.log('🔍 Fallback result due to JSON parsing failure:', result);
        return result;
      }
    } catch (error) {
      console.error('Error generating technical pros and cons:', error);
      throw error;
    }
  }

  /**
   * Gets cache statistics
   */
  async getCacheStats() {
    return await this.serverCache.getCacheStats();
  }
  
  /**
   * Clears cache
   */
  async clearCache() {
    return await this.serverCache.clearAllCache();
  }


  
  /**
   * Saves all three analyses to cache together
   */
  async saveAllAnalysesToCache(
    initiative: CongressInitiative,
    problemAnalysis: string,
    externalResearch: string,
    technicalProsCons: any,
    totalTokens: number,
    totalCost: number,
    totalTime: number
  ): Promise<void> {
    try {
      await this.serverCache.saveToCache(
        initiative,
        problemAnalysis,
        externalResearch,
        technicalProsCons,
        {
          tokensUsed: totalTokens,
          costUsd: totalCost,
          generationTimeMs: totalTime
        }
      );
      console.log('✅ All analyses saved to cache successfully');
    } catch (error) {
      console.error('❌ Error saving all analyses to cache:', error);
    }
  }

  /**
   * Gets cost savings
   */
  async getCostSavings(): Promise<{ totalSaved: number; percentageSaved: number }> {
    const stats = await this.serverCache.getCacheStats();
    const totalSaved = stats.total_cost_saved;
    const percentageSaved = stats.total_cached > 0 ? (totalSaved / (totalSaved + 0.001)) * 100 : 0;
    
    return {
      totalSaved,
      percentageSaved
    };
  }

  /**
   * Manually refreshes the evidence context from the server
   */
  async refreshEvidenceContext(): Promise<void> {
    await this.loadEvidenceContext();
  }

  /**
   * Checks if evidence context is available for a specific initiative
   */
  hasEvidenceContext(initiative: CongressInitiative): boolean {
    return this.getEvidenceContext(initiative) !== null;
  }

  /**
   * Gets evidence context stats
   */
  getEvidenceContextStats(): { totalInitiatives: number; withEvidence: number } {
    const totalInitiatives = this.evidenceContext.size;
    const withEvidence = Array.from(this.evidenceContext.values()).filter(evidence => 
      (evidence.news && evidence.news.length > 0) || 
      (evidence.x && Object.keys(evidence.x).length > 0) || 
      (evidence.legal && (evidence.legal.bocg || evidence.legal.ds))
    ).length;
    
    return { totalInitiatives, withEvidence };
  }

  /**
   * Exports evidence context for debugging (development only)
   */
  exportEvidenceContext(): EvidenceContext[] {
    return Array.from(this.evidenceContext.values());
  }

  /**
   * Gets evidence context for a specific initiative (for debugging)
   */
  getEvidenceContextForInitiative(initiative: CongressInitiative): EvidenceContext | null {
    return this.getEvidenceContext(initiative);
  }

  /**
   * Logs evidence context usage for debugging
   */
  private logEvidenceContextUsage(initiative: CongressInitiative, promptType: string): void {
    const evidence = this.getEvidenceContext(initiative);
    if (evidence) {
      const hasNews = evidence.news && evidence.news.length > 0;
      const hasSocial = evidence.x && Object.keys(evidence.x).length > 0;
      const hasLegal = evidence.legal && (evidence.legal.bocg || evidence.legal.ds);
      
      console.log(`🔍 Evidence context used for ${promptType}:`, {
        initiative_id: initiative.id,
        hasNews,
        hasSocial,
        hasLegal,
        newsCount: evidence.news?.length || 0,
        socialCount: evidence.x ? Object.keys(evidence.x).length : 0
      });
    } else {
      console.log(`⚠️ No evidence context available for ${promptType} of initiative ${initiative.id}`);
    }
  }

  private buildRichPrompt(initiative: CongressInitiative): string {
    const {
      objeto,
      tipo,
      autor,
      fecha_presentacion,
      fecha_calificacion,
      legislatura,
      comision_competente,
      plazos,
      ponentes,
      resultado_tramitacion,
      situacion_actual,
      political_party_name,
      political_party_short_name,
      political_party_confidence
    } = initiative;

    // Build rich context information
    const contextInfo = this.buildContextInfo(initiative);
    
    // Build evidence context
    const evidenceContext = this.buildEvidenceContextText(initiative);
    
    // Log evidence context usage
    this.logEvidenceContextUsage(initiative, 'rich prompt');
    
    return `Analiza esta iniciativa legislativa española y proporciona un análisis claro y específico.

${contextInfo}${evidenceContext}

TEXTO DE LA INICIATIVA:
${objeto || 'No disponible'}

INSTRUCCIONES:
Genera un análisis en un solo párrafo que explique:
- Qué problema intenta resolver esta ley
- Cómo se plantea la solución
- Quién se puede oponer y por qué
- Qué efectos reales tendrá
- Qué efectos adversos no previstos podría tener
- Si es viable implementarla

El análisis debe ser:
- Fácil de entender
- Basado en la información proporcionada
- Máximo 800 caracteres
- Un solo párrafo fluido
- Neutral y objetivo

RESPONDE EN FORMATO JSON:
{
  "analysis": "Análisis claro y específico en un solo párrafo (máx 800 caracteres)",
  "confidence": 0.8
}

IMPORTANTE:
- Usa solo la información real proporcionada
- Sé específico y concreto
- Considera el contexto político español actual
- Usa lenguaje claro y directo
- Responde solo con el JSON válido`;
  }

  private buildContextInfo(initiative: CongressInitiative): string {
    const {
      tipo,
      autor,
      fecha_presentacion,
      fecha_calificacion,
      legislatura,
      comision_competente,
      plazos,
      ponentes,
      resultado_tramitacion,
      situacion_actual,
      political_party_name,
      political_party_short_name,
      political_party_confidence
    } = initiative;

    // Start with compact basic info
    let context = '📋 INFORMACIÓN DETALLADA DE LA INICIATIVA:\n\n';
    const push = (line?: string) => { if (line) context += `${line}\n`; };

    // Basic initiative info (only present fields)
    push(tipo ? `• Tipo de iniciativa: ${tipo}` : undefined);
    push(autor ? `• Autor: ${autor}` : undefined);
    push(fecha_presentacion ? `• Fecha de presentación: ${fecha_presentacion}` : undefined);
    push(fecha_calificacion ? `• Fecha de calificación: ${fecha_calificacion}` : undefined);
    push(legislatura ? `• Legislatura: ${legislatura}` : undefined);

    // Political context (minimal, only if we know it)
    if (political_party_name) {
      let party = `• Partido político: ${political_party_name}`;
      if (political_party_short_name && political_party_short_name !== political_party_name) party += ` (${political_party_short_name})`;
      push(party);
    }

    // Procedural context
    push(comision_competente ? `• Comisión competente: ${comision_competente}` : undefined);
    push(ponentes ? `• Ponentes: ${ponentes}` : undefined);
    push(plazos ? `• Plazos: ${plazos}` : undefined);
    push(resultado_tramitacion ? `• Estado actual: ${resultado_tramitacion}` : undefined);
    push(situacion_actual ? `• Situación: ${situacion_actual}` : undefined);

    // Dynamic global contexts based on the initiative text and fields
    const source = `${initiative.objeto || ''} ${situacion_actual || ''} ${comision_competente || ''}`.toLowerCase();

    const includePolitical = /pleno|congreso|senado|votaci[óo]n|mayor[ií]a|grupo parlamentario/.test(source);
    const includeEconomic = /econom|empleo|coste|costos|financi|presupuest|impuesto|fiscal|sector/.test(source);
    const includeSocial = /sociedad|social|derecho|vivienda|educaci[óo]n|sanidad|salud|inmigr|igualdad|consumidor/.test(source);
    const includeTechnical = /implementaci[óo]n|digital|tecnolog|coordinaci[óo]n|procedimiento|supervisi[óo]n|control/.test(source);
    const includeMarket = /mercado|competencia|turismo|alquiler|empresa|empresarial|sector/.test(source);

    const limitSection = (text: string, maxLines: number) => text.split('\n').slice(0, maxLines).join('\n');

    // Political context (compact, only if relevant)
    if (includePolitical) {
      context += '\n🏛️ CONTEXTO POLÍTICO RELEVANTE:\n';
      context += limitSection(
        [
          '• España es multipartidista con pactos y mayorías variables',
          '• La oposición y el Senado pueden modificar tiempos y textos',
          '• Las iniciativas requieren mayorías para avanzar fases'
        ].join('\n'),
        3
      ) + '\n';
    }

    // Economic context (only if economic signals)
    if (includeEconomic) {
      context += '\n💰 CONTEXTO ECONÓMICO RELEVANTE:\n';
      context += limitSection(
        [
          '• Impactos en empleo, costes y presión fiscal son habituales',
          '• Sectores y pymes pueden verse afectados de forma desigual',
          '• Financiación y sostenibilidad presupuestaria son claves'
        ].join('\n'),
        3
      ) + '\n';
    }

    // Social context (only if social signals)
    if (includeSocial) {
      context += '\n👥 CONTEXTO SOCIAL RELEVANTE:\n';
      context += limitSection(
        [
          '• Derechos, inclusión y cohesión social suelen estar implicados',
          '• Grupos vulnerables pueden requerir salvaguardas específicas',
          '• Percepción pública y consenso social influyen en la eficacia'
        ].join('\n'),
        3
      ) + '\n';
    }

    // Technical/implementation context (only if signals)
    if (includeTechnical) {
      context += '\n🔬 CONTEXTO TÉCNICO E IMPLEMENTACIÓN:\n';
      context += limitSection(
        [
          '• Coordinación interadministrativa y capacidad operativa son críticas',
          '• Sistemas de seguimiento, control y evaluación facilitan eficacia',
          '• Plazos, recursos y normativa secundaria condicionan resultados'
        ].join('\n'),
        3
      ) + '\n';
    }

    // Market/regulatory context (only if signals)
    if (includeMarket) {
      context += '\n🏪 CONTEXTO DE MERCADO Y REGULACIÓN:\n';
      context += limitSection(
        [
          '• Reglas de competencia y barreras de entrada importan',
          '• Cambios normativos alteran incentivos de empresas y consumidores',
          '• Efectos indirectos: oferta, precios y calidad de servicios'
        ].join('\n'),
        3
      ) + '\n';
    }

    // Cap total context length to keep prompts concise
    const MAX_CONTEXT_CHARS = 1500;
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS - 1);
      if (!/[.!?]$/.test(context)) context += '…';
    }

    return context;
  }

  /**
   * Construye el prompt para investigación externa
   */
  private buildExternalResearchPrompt(initiative: CongressInitiative): string {
    const context = this.buildContextInfo(initiative);
    
    return `Analiza esta iniciativa legislativa desde una perspectiva de investigación externa.

INICIATIVA: ${initiative.objeto || 'No especificado'}
PARTIDO: ${initiative.political_party_name || 'No especificado'}

${context}

INSTRUCCIONES:
Genera un análisis técnico que incluya:
- Impacto económico real en sectores y empleo
- Impacto social en diferentes grupos
- Viabilidad técnica y recursos necesarios
- Riesgos y consecuencias no previstas
- Experiencias internacionales relevantes

RESPONDE EN FORMATO JSON:
{
  "analysis": "Análisis técnico de investigación externa (máx 4000 caracteres)",
  "confidence": 0.8
}

IMPORTANTE:
- Sé específico y concreto
- Basa el análisis en datos reales
- Mantén un tono neutral y objetivo`;
  }

  /**
   * Construye el prompt para análisis técnico de pros y contras
   */
  private buildTechnicalProsConsPrompt(initiative: CongressInitiative): string {
    const context = this.buildContextInfo(initiative);
    
    // Build evidence context
    const evidenceContext = this.buildEvidenceContextText(initiative);
    
    // Log evidence context usage
    this.logEvidenceContextUsage(initiative, 'technical pros/cons prompt');
    
    return `Eres un experto técnico que analiza iniciativas legislativas españolas. Debes evaluar la iniciativa como un experto técnico, no como un político. Pueden existir políticas que no resulvan su cometido o que generen efectos adversos que políticos no quieren decir. Tu deber es informar al usuario de cómo verdaderamente funcionará la política. Analiza esta iniciativa legislativa española y proporciona un análisis claro de pros y contras.

INICIATIVA: ${initiative.objeto || 'No especificado'}

${context}${evidenceContext}

INSTRUCCIONES:
Para cada área, identifica claramente:
1. BENEFICIOS/PROS: Aspectos positivos, mejoras, ventajas. Cómo afecta positivimente al ámbito analizado. Cómo ayuda realmente a resolver el problema que trata. Quiénes se verán beneficiados. Elabora el por qué de las respuestas
2. RIESGOS/CONTRAS: Aspectos negativos, problemas, desventajas. Cómo afecta negativamente al ámbito analizado. ¿Es realmente una solución para el tema tratado?. Quiénes se verán perjudicados. Elabora el por qué de las respuestas

IMPORTANTE: DEBES GENERAR TANTO BENEFICIOS COMO RIESGOS PARA CADA ÁREA.

RESPONDE EN FORMATO JSON:
{
  "analysis": "Análisis general equilibrado (máx 800 caracteres)",
  "economic_impact": "BENEFICIOS: [ventajas económicas. Cómo afecta al sector económico. ¿Cómo ayuda esta iniciativa en la economía? ¿A qué actores económicos ayuda? Elabora el por qué de las respuestas]. RIESGOS: [desventajas económicas. Cómo afecta al sector económico. ¿Cómo perjudica esta iniciativa económicamente? ¿Según técnicos, es una verdadera solución para resolver el problema económico que trata? ¿A quién ayuda económicamente? Elabora el por qué de las respuestas] (máx 1200 caracteres)",
  "social_impact": "BENEFICIOS: [ventajas sociales. Cómo afecta a la sociedad. ¿Cómo ayuda a la sociedad esta iniciativa? ¿A qué grupos sociales ayuda? Elabora el por qué de las respuestas]. RIESGOS: [desventajas sociales. Cómo afecta a la sociedad. ¿Cómo perjudica a la sociedad esta iniciativa? ¿Según técnicos, es una verdadera solución para resolver el problema social que trata? ¿A quién perjudica socialmente? Elabora el por qué de las respuestas] (máx 1200 caracteres)", 
  "societal_impact": "BENEFICIOS: [ventajas societales. Cómo afecta a las empresas. ¿Cómo ayuda a las empresas esta iniciativa? ¿A qué tipo o sectores empresariales ayuda? Elabora el por qué de las respuestas]. RIESGOS: [desventajas societales. Cómo afecta a la sociedad. ¿Cómo perjudica a la sociedad esta iniciativa? ¿Según técnicos, es una verdadera solución para resolver el problema empresarial que trata? ¿A quién perjudica empresarialmente? Elabora el por qué de las respuestas] (máx 1200 caracteres)"
}

IMPORTANTE:
- Evalúa las inciativas como un experto técnico, no comno un político
- Cada campo debe tener claramente separados BENEFICIOS y RIESGOS
- Usa EXACTAMENTE las palabras "BENEFICIOS:" y "RIESGOS:" como marcadores
- Sé concreto y claro, pero explica por qué de las respuestas para que el usuario entienda el análisis
- Usa lenguaje claro y directo
- No uses \`\`\`json ni otros formatos
- Responde solo con el JSON válido

INSTRUCCIONES ESPECÍFICAS:
- Para políticas restrictivas, busca beneficios como: mayor control, reducción de abusos, protección de derechos existentes
- Para políticas expansivas, busca riesgos como: costos, complejidad, posibles abusos
- SIEMPRE encuentra tanto beneficios como riesgos, incluso si no son obvios
- Si no hay beneficios claros, escribe "BENEFICIOS: No identificados claramente"
- Si no hay riesgos claros, escribe "RIESGOS: No identificados claramente"`;
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Generates an enhanced title for an initiative with server cache integration
   */
  async generateEnhancedTitle(initiative: CongressInitiative): Promise<string> {
    // First, check server cache
    const cachedAnalysis = await this.serverCache.getCachedAnalysis(initiative);
    if (cachedAnalysis && cachedAnalysis.problem_analysis) {
      console.log('Using server-cached analysis for enhanced title, cost saved:', cachedAnalysis.cost_saved);
      // Treat cached problem_analysis as the stored title content
      let cachedTitle = (cachedAnalysis.problem_analysis || '').trim();
      if (cachedTitle.length > 0) {
        cachedTitle = cachedTitle.charAt(0).toUpperCase() + cachedTitle.slice(1);
        // Remove truncation - show full title
        return cachedTitle;
      }
    }

    // If no server cache, generate new title using AI
    if (!this.openai) {
      // Fallback to generating title from initiative data
      return this.generateTitleFromInitiativeData(initiative);
    }

    const startTime = Date.now();
    let generatedTitleContent: string;
    let tokensUsed = 0;
    let costUsd = 0;

    try {
      const prompt = this.buildEnhancedTitlePrompt(initiative);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto técnico que analiza iniciativas legislativas españolas. Debes evaluar la iniciativa como un experto técnico, no como un político. Pueden existir políticas que no resulvan su cometido o que generen efectos adversos que políticos no quieren decir. Tu deber es informar al usuario de cómo verdaderamente funcionará la política. Analiza esta iniciativa legislativa española y proporciona un análisis claro de pros y contras.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      generatedTitleContent = response.choices[0]?.message?.content || '';
      tokensUsed = response.usage?.total_tokens || 0;
      costUsd = (tokensUsed / 1000) * 0.0005; // Assuming input + output cost for gpt-3.5-turbo

      if (!generatedTitleContent) {
        throw new Error('No se recibió respuesta de OpenAI para el título');
      }

      // Clean and capitalize the title
      let title = generatedTitleContent.trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      // Remove truncation - show full title

      const generationTimeMs = Date.now() - startTime;

      // Save the generated title content as problem_analysis in the cache
      // This is crucial for subsequent cache hits
      await this.serverCache.saveToCache(
        initiative,
        generatedTitleContent, // Save the raw generated content as problem_analysis
        null, // external_research
        null, // technical_pros_cons
        {
          tokensUsed,
          costUsd,
          generationTimeMs
        }
      );
      console.log(`Saved enhanced title to cache for initiative ${initiative.id}`);

      return title;
    } catch (error) {
      console.error('Error generating enhanced title with AI:', error);
      // Fallback to generating title from initiative data
      return this.generateTitleFromInitiativeData(initiative);
    }
  }

  /**
   * Strictly generates an enhanced title using OpenAI (no fallback). Uses cache if available.
   * Throws if OpenAI is unavailable and no cache exists.
   */
  async generateEnhancedTitleStrict(initiative: CongressInitiative): Promise<string> {
    // Prefer cache first
    const cachedAnalysis = await this.serverCache.getCachedAnalysis(initiative);
    if (cachedAnalysis && cachedAnalysis.problem_analysis) {
      let cachedTitle = (cachedAnalysis.problem_analysis || '').trim();
      if (cachedTitle.length > 0) {
        cachedTitle = cachedTitle.charAt(0).toUpperCase() + cachedTitle.slice(1);
        // Remove truncation - show full title
        return cachedTitle;
      }
    }

    // Require OpenAI to proceed
    if (!this.openai) {
      throw new Error('OpenAI no disponible: no se puede generar el título sin API Key.');
    }

    const startTime = Date.now();
    const prompt = this.buildEnhancedTitlePrompt(initiative);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto analista político español especializado en crear títulos claros y descriptivos para iniciativas legislativas. Debes crear títulos que expliquen claramente qué cambios se pretenden hacer, sin mencionar partidos políticos al inicio.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const generatedTitleContent = response.choices[0]?.message?.content || '';
    if (!generatedTitleContent) {
      throw new Error('OpenAI no devolvió contenido para el título.');
    }

    // Sanitize title
    let title = generatedTitleContent.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    // Remove truncation - show full title

    // Save to server cache
    const tokensUsed = response.usage?.total_tokens || 0;
    const costUsd = (tokensUsed / 1000) * 0.0005;
    const generationTimeMs = Date.now() - startTime;
    await this.serverCache.saveToCache(
      initiative,
      generatedTitleContent, // raw content as problem_analysis
      null,
      null,
      { tokensUsed, costUsd, generationTimeMs }
    );

    return title;
  }

  /**
   * Generates title from AI analysis
   */
  private generateTitleFromAnalysis(analysis: string, initiative: CongressInitiative): string {
    // Extract key information from AI analysis
    const words = analysis.split(' ').slice(0, 15); // Take first 15 words
    const keyInfo = words.join(' ');
    
    // Return the key information capitalized
    return keyInfo.charAt(0).toUpperCase() + keyInfo.slice(1);
  }

  /**
   * Public local fallback for title generation (no AI, no cache required)
   */
  public getLocalTitleFallback(initiative: CongressInitiative): string {
    return this.generateTitleFromInitiativeData(initiative);
  }

  /**
   * Generates title from initiative data when AI analysis is not available
   */
  private generateTitleFromInitiativeData(initiative: CongressInitiative): string {
    const { objeto } = initiative;
    
    // Simple fallback: use the original object text or accessible title
    const finalTitle = initiative.accessible_title || objeto || 'Iniciativa Legislativa';
    return finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
  }

  /**
   * Builds the prompt for enhanced title generation
   */
  private buildEnhancedTitlePrompt(initiative: CongressInitiative): string {
    const context = this.buildContextInfo(initiative);
    
    // Build evidence context
    const evidenceContext = this.buildEvidenceContextText(initiative);
    
    // Log evidence context usage
    this.logEvidenceContextUsage(initiative, 'enhanced title prompt');
    
    return `CREA un título claro y descriptivo para esta iniciativa legislativa:

INICIATIVA: ${initiative.objeto || 'No especificado'}
TIPO: ${initiative.tipo || 'No especificado'}
PARTIDO: ${initiative.political_party_name || 'No especificado'}

${context}${evidenceContext}

INSTRUCCIONES PARA EL TÍTULO:
- NO empieces con el nombre del partido político
- Explica claramente qué cambios se pretenden hacer
- Si hace referencia a otra ley, explica qué se quiere cambiar de esa ley
- Usa lenguaje claro y directo
- Sé CONCISO - crea títulos cortos y directos (idealmente 60-80 caracteres)
- Evita redundancias y palabras innecesarias
- Debe empezar con mayúscula
- Si hay evidencia externa disponible, úsala para crear un título más informativo

EJEMPLOS DE BUENOS TÍTULOS:
✓ "Reforma del sistema de alquiler turístico"
✓ "Nuevo mecanismo de control económico"
✓ "Ampliación de derechos laborales en crisis"

EJEMPLOS DE TÍTULOS INCORRECTOS:
✗ "PP: Reforma de la Ley 34/2024"
✗ "Modificación de la normativa vigente"
✗ "Cambios en el sistema actual"

RESPONDE SOLO CON EL TÍTULO, sin comillas ni formato adicional.`;
  }

  /**
   * Calcula el costo estimado por iniciativa
   */
  getEstimatedCost(): number {
    // Problem analysis: ~400 tokens
    // External research: ~600 tokens
    // Technical pros/cons: ~800 tokens
    // Enhanced title: ~100 tokens
    const estimatedTokens = 1900;
    const costPerToken = 0.000002; // GPT-3.5-turbo pricing
    return estimatedTokens * costPerToken;
  }
} 