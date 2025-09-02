import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CongressInitiative, PoliticalParty } from '../lib/supabase';
import ExternalResearchService, { ExternalResearchResult, ResearchQuery } from '../services/externalResearchService';
import { AIAnalysisService } from '../services/aiAnalysisService';
import { CongressService } from '../services/congressService';
import nlp from 'compromise';
import 'compromise-dates';
import 'compromise-numbers';
import 'compromise-sentences';
import 'compromise-stats';

interface LocationState {
  initiative: CongressInitiative;
  politicalParties: PoliticalParty[];
}

// Pre-vote types
type PrevotePartyPosition = { party: string; position: string; evidence: string };
type PrevoteRecord = { initiative_id: string; party_positions_prevote: PrevotePartyPosition[] };

const InitiativeDetailScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initiative, politicalParties } = location.state as LocationState;
  
  // State for AI analysis
  const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string } | null>(null);
  const [externalResearch, setExternalResearch] = useState<string | null>(null);
  const [technicalProsCons, setTechnicalProsCons] = useState<{
    analysis: string;
    economic_impact: string;
    social_impact: string;
    societal_impact: string;
  } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoadingResearch, setIsLoadingResearch] = useState(false);
  const [isLoadingProsCons, setIsLoadingProsCons] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  // Pre-vote state
  const [isLoadingPrevote, setIsLoadingPrevote] = useState(false);
  const [prevote, setPrevote] = useState<PrevoteRecord | null>(null);
  const [prevoteError, setPrevoteError] = useState<string | null>(null);
  // Political parties catalog with seats
  const [partyCatalog, setPartyCatalog] = useState<PoliticalParty[]>(politicalParties || []);
  
  // Cache information - HIDDEN (no longer needed)
  /*
  const [cacheInfo, setCacheInfo] = useState<{
    is_cached: boolean;
    cache_age_hours: number;
    cost_saved: number;
  } | null>(null);
  */
  
  // Initialize AI service
  const aiService = new AIAnalysisService();

  // Local state for enhanced title (same logic as list)
  const [enhancedTitle, setEnhancedTitle] = useState<string | null>(null);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState<boolean>(false);

  const sanitizeTitle = (text: string) => {
    let t = (text || '').trim();
    if (t.length === 0) return '';
    t = t.charAt(0).toUpperCase() + t.slice(1);
    // Remove truncation - show full title
    return t;
  };

  useEffect(() => {
    const loadEnhancedTitle = async () => {
      if (!initiative) return;
      try {
        // Try server cache first
        const cached = await aiService.serverCache.getCachedAnalysis(initiative);
        if (cached && cached.problem_analysis) {
          setEnhancedTitle(sanitizeTitle(cached.problem_analysis));
          return;
        }
        // If no cache, generate strictly (will save to server cache)
        const generated = await aiService.generateEnhancedTitleStrict(initiative);
        setEnhancedTitle(sanitizeTitle(generated));
      } catch (e) {
        console.error('Failed to load enhanced title:', e);
        setEnhancedTitle(null);
      }
    };
    loadEnhancedTitle();
  }, [initiative]);
  
  // Initialize external research service
  const externalResearchService = new ExternalResearchService();
  
  useEffect(() => {
    if (initiative) {
      loadAllAnalyses();
    }
  }, [initiative]);

  // Ensure we have parties with seats loaded
  useEffect(() => {
    const loadParties = async () => {
      try {
        // If provided parties already include seats, use them
        const hasSeats = (politicalParties || []).some(p => typeof p.seats === 'number' && p.seats > 0);
        if (hasSeats) {
          setPartyCatalog(politicalParties);
          return;
        }
        // Otherwise fetch from Supabase
        const fetched = await CongressService.getPoliticalParties();
        setPartyCatalog(fetched || []);
      } catch (e) {
        console.warn('No se pudieron cargar los partidos desde Supabase; usando valores por defecto.');
        setPartyCatalog(politicalParties || []);
      }
    };
    loadParties();
  }, [politicalParties]);

  // Load pre-vote positions from static JSON in /public
  useEffect(() => {
    const loadPrevote = async () => {
      try {
        setIsLoadingPrevote(true);
        setPrevoteError(null);
        const res = await fetch('/prevote-positions.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PrevoteRecord[] = await res.json();

        const exp = (initiative.num_expediente || '').toString();
        const normalize = (s: string) => s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const expNorm = normalize(exp);

        let found = data.find(r => (r.initiative_id || '').toString().trim() === exp.trim());
        if (!found) {
          found = data.find(r => (r.initiative_id || '').toString().toLowerCase().trim() === exp.toLowerCase().trim());
        }
        if (!found) {
          found = data.find(r => normalize(r.initiative_id || '') === expNorm);
        }
        if (!found) {
          // Some generators might have used a different key; try common alternatives defensively
          // @ts-ignore
          found = data.find((r: any) => normalize(r.numExpediente || r.NUMEXPEDIENTE || '') === expNorm);
        }

        if (!found) {
          console.warn('[Prevoto] No hay coincidencias para el expediente', exp, 'en prevote-positions.json');
          setPrevote(null);
          setPrevoteError('No disponible');
          return;
        }

        setPrevote(found || null);
      } catch (err: any) {
        console.warn('Archivo de prevoto no encontrado o error de parseo:', err?.message || err);
        setPrevote(null);
        setPrevoteError('No disponible');
      } finally {
        setIsLoadingPrevote(false);
      }
    };
    if (initiative?.num_expediente) {
      loadPrevote();
    }
  }, [initiative?.num_expediente]);

  const loadAllAnalyses = async () => {
    if (!initiative) return;
    
    const startTime = Date.now();
    setIsLoadingAI(true);
    setIsLoadingProsCons(true);
    
    try {
      // Check cache first to see what we already have
      const cachedAnalysis = await aiService.serverCache.getCachedAnalysis(initiative);
      const hasFullCache = cachedAnalysis && 
        cachedAnalysis.problem_analysis && 
        cachedAnalysis.technical_pros_cons;

      if (hasFullCache) {
        console.log('🎯 Full cache hit - loading all content from cache');
        // Load from cache - no need to save again
        setAiAnalysis({ analysis: cachedAnalysis.problem_analysis || '' });
        setTechnicalProsCons(cachedAnalysis.technical_pros_cons || null);
      } else {
        console.log('🔄 Partial or no cache - generating missing content');
        // Load all analyses in parallel (some may come from cache, some may be generated)
        const [analysisResult, technicalProsConsResult] = await Promise.all([
          aiService.analyzeInitiative(initiative),
          aiService.generateTechnicalProsCons(initiative)
        ]);

        // Set state with results
        setAiAnalysis(analysisResult);
        setTechnicalProsCons(technicalProsConsResult);

        // Only save to cache if we generated new content
        await saveAllAnalysesToCache(
          initiative,
          analysisResult.analysis,
          '',
          technicalProsConsResult,
          startTime
        );
      }

    } catch (error) {
      console.error('Error loading AI analyses:', error);
      // Fallback to NLP analysis for problem description
      const result = await generateSpecificProblemAnalysis(initiative);
      setAnalysisResult(result);
    } finally {
      setIsLoadingAI(false);
      setIsLoadingProsCons(false);
    }
  };

  const saveAllAnalysesToCache = async (
    initiative: CongressInitiative,
    problemAnalysis: string,
    externalResearch: string,
    technicalProsCons: any,
    startTime: number
  ) => {
    try {
      // Calculate total tokens and cost
      const totalTokens = 400 + 600 + 800; // problem + external + technical
      const totalCost = totalTokens * 0.000002;
      const totalTime = Date.now() - startTime;

      await aiService.saveAllAnalysesToCache(
        initiative,
        problemAnalysis,
        externalResearch,
        technicalProsCons,
        totalTokens,
        totalCost,
        totalTime
      );
    } catch (error) {
      console.error('Error saving analyses to cache:', error);
    }
  };

  const loadAnalysis = async () => {
    // This function is no longer needed - use loadAllAnalyses instead
    console.log('loadAnalysis is deprecated - use loadAllAnalyses');
  };

  const loadExternalResearch = async () => {
    // This function is no longer needed - use loadAllAnalyses instead
    console.log('loadExternalResearch is deprecated - use loadAllAnalyses');
  };

  const refreshResearch = async () => {
    await loadAllAnalyses();
  };

  const handleClearServerCache = async () => {
    try {
      await aiService.clearCache();
      setEnhancedTitle(null);
      await loadAllAnalyses();
      alert('Caché del servidor limpiado');
    } catch (error) {
      console.error('Error clearing server cache:', error);
      alert('Error al limpiar el caché del servidor');
    }
  };

  const loadTechnicalProsCons = async () => {
    // This function is no longer needed - use loadAllAnalyses instead
    console.log('loadTechnicalProsCons is deprecated - use loadAllAnalyses');
  };

  if (!initiative) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-gray-500">Iniciativa no encontrada</p>
        <button onClick={() => navigate('/congress')} className="btn-primary mt-4">
          Volver a Iniciativas
        </button>
      </div>
    );
  }

  const getInitiativeTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'tramitacion_ordinaria': '#3B82F6',
      'tramitacion_urgente': '#EF4444',
      'tramitacion_especial': '#8B5CF6',
      'tramitacion_iniciativas_autonomicas': '#10B981',
      'tramitacion_iniciativas_populares': '#F59E0B',
      'tramitacion_organos_constitucionales': '#6B7280'
    };
    return colors[type] || '#6B7280';
  };

  const getStatusColor = (initiative: CongressInitiative) => {
    // Use new stage classification from backend if available
    if (initiative.stage) {
      switch (initiative.stage) {
        case 'published': return 'bg-emerald-100 text-emerald-800';
        case 'passed': return 'bg-green-100 text-green-800';
        case 'voting': return 'bg-purple-100 text-purple-800';
        case 'committee': return 'bg-yellow-100 text-yellow-800';
        case 'debating': return 'bg-yellow-100 text-yellow-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        case 'withdrawn': return 'bg-orange-100 text-orange-800';
        case 'closed': return 'bg-gray-100 text-gray-700';
        case 'proposed': return 'bg-blue-100 text-blue-800';
        default: return 'bg-blue-100 text-blue-800';
      }
    }
    
    // Fallback to old logic
    if (initiative.nlp_urgency === 'alta') return 'bg-red-100 text-red-800';
    if (initiative.tipo_tramitacion === 'urgente') return 'bg-red-100 text-red-800';
    if (initiative.resultado_tramitacion === 'Aprobada') return 'bg-green-100 text-green-800';
    if (initiative.resultado_tramitacion === 'Rechazada') return 'bg-red-100 text-red-800';
    if (initiative.situacion_actual?.includes('Comisión')) return 'bg-yellow-100 text-yellow-800';
    if (initiative.situacion_actual?.includes('Pleno')) return 'bg-purple-100 text-purple-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getStatusLabel = (initiative: CongressInitiative) => {
    // Use new stage classification from backend if available
    if (initiative.stage) {
      switch (initiative.stage) {
        case 'published': return '📢 5. Publicación';
        case 'passed': return '✅ 4. Aprobación';
        case 'voting': return '✅ 4. Aprobación';
        case 'committee': return '🛠️ 3. Trabajo';
        case 'debating': return '🗣️ 2. Debate';
        case 'rejected': return 'Rechazada';
        case 'withdrawn': return 'Retirada';
        case 'closed': return 'Cerrada';
        case 'proposed': return '📄 1. Presentación';
        default: return '📄 1. Presentación';
      }
    }
    
    // Fallback to old logic
    if (initiative.nlp_urgency === 'alta') return 'Urgente';
    if (initiative.tipo_tramitacion === 'urgente') return 'Urgente';
    if (initiative.resultado_tramitacion === 'Aprobada') return 'Aprobada';
    if (initiative.resultado_tramitacion === 'Rechazada') return 'Rechazada';
    if (initiative.situacion_actual?.includes('Comisión')) return 'En Comisión';
    if (initiative.situacion_actual?.includes('Pleno')) return 'En Pleno';
    return 'Propuesta';
  };

  const getPartyName = (partyShortName: string) => {
    const party = politicalParties.find(p => p.short_name === partyShortName);
    return party?.name || partyShortName;
  };

  const getPartyColor = (partyShortName: string) => {
    const party = politicalParties.find(p => p.short_name === partyShortName);
    return party?.color || '#666666';
  };

  // Extract relative BOE path from absolute URL
  const getRelativeBoePath = (url?: string): string => {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}` || u.pathname || '';
    } catch (_e) {
      // Fallback: if it's already a relative-like string
      if (url.startsWith('/')) return url;
      return '';
    }
  };

  // Prefer stored URL; fallback to a canonical BOE link if only ID is present
  const getBoeHref = (boeUrl?: string, boeId?: string): string => {
    if (boeUrl && boeUrl.trim().length > 0) return boeUrl;
    if (boeId && boeId.trim().length > 0) return `https://www.boe.es/buscar/doc.php?id=${encodeURIComponent(boeId.trim())}`;
    return '';
  };

  const generateSpecificProblemAnalysis = async (initiative: CongressInitiative): Promise<string> => {
    console.log('🔍 Analyzing initiative with AI:', {
      id: initiative.id,
      objeto: initiative.objeto?.substring(0, 100) + '...',
      partido: initiative.political_party_short_name,
      resultado: initiative.resultado_tramitacion
    });
    
    // Try AI analysis first
    if (aiService.isServiceAvailable()) {
      try {
        setIsLoadingAI(true);
        const aiResult = await aiService.analyzeInitiative(initiative);

        if (aiResult && aiResult.analysis && typeof aiResult.analysis === 'string' && aiResult.analysis.trim().length > 0) {
          setAiAnalysis(aiResult);
          console.log('🤖 AI Analysis successful:', aiResult);

          // Return the single paragraph analysis
          return aiResult.analysis;
        }
      } catch (error) {
        console.error('AI analysis failed:', error);
      } finally {
        setIsLoadingAI(false);
      }
    }
    
    // Fallback to enhanced NLP if AI fails or is not available
    console.log('🔄 Falling back to NLP analysis');
    return generateNLPFallback(initiative);
  };
  
  const generateNLPFallback = (initiative: CongressInitiative): string => {
    const objeto = initiative.objeto || '';
    const tipo = initiative.congress_initiative_type || '';
    const partido = initiative.political_party_short_name || '';
    const resultado = initiative.resultado_tramitacion || '';
    const comision = initiative.comision_competente || '';
    
    // Enhanced NLP analysis (simplified version of our previous logic)
    let places: string[] = [];
    let organizations: string[] = [];
    let numbers: any[] = [];
    
    try {
      const doc = nlp(objeto);
      places = doc.places().out('array');
      organizations = doc.organizations().out('array');
      numbers = doc.numbers().out('array');
    } catch (error) {
      console.error('❌ NLP Error:', error);
    }
    
    // Extract specific legal references
    const legalReferences = objeto.match(/(?:Ley|Decreto|Real Decreto|Orden|Resolución)\s+\d+\/\d+/gi) || [];
    
    // Build a single, flowing paragraph
    let analysis = '';
    const text = objeto.toLowerCase();
    
    // Problem statement
    if (text.includes('carne sintética') || text.includes('harinas de insectos') || text.includes('insectos')) {
      analysis += 'Se necesita regular la producción y comercialización de alimentos alternativos como carne sintética y harinas de insectos';
    } else if (text.includes('publicidad') && text.includes('contratación')) {
      analysis += 'Se necesita regular la publicidad y contratación';
    } else if (text.includes('vivienda') || text.includes('alquiler')) {
      analysis += 'Se necesita regular el sector de la vivienda';
    } else if (text.includes('energía') || text.includes('electricidad')) {
      analysis += 'Se necesita regular el sector energético';
    } else if (text.includes('sanidad') || text.includes('hospital')) {
      analysis += 'Se necesita regular el sector sanitario';
    } else if (text.includes('educación') || text.includes('escuela')) {
      analysis += 'Se necesita regular el sector educativo';
    } else if (text.includes('transporte') || text.includes('movilidad')) {
      analysis += 'Se necesita regular el sector del transporte';
    } else if (text.includes('medio ambiente') || text.includes('contaminación')) {
      analysis += 'Se necesita regular la protección del medio ambiente';
    } else if (text.includes('consumidor') || text.includes('consumidores')) {
      analysis += 'Se necesita proteger los derechos de los consumidores';
    } else if (legalReferences.length > 0) {
      analysis += `Se necesita actualizar ${legalReferences[0]}`;
    } else {
      analysis += 'Se necesita regular una actividad específica';
    }
    
    if (places.length > 0) {
      analysis += ` en ${places[0]}`;
    }
    
    if (numbers.length > 0) {
      const significantNumber = numbers.find(n => n > 100);
      if (significantNumber) {
        analysis += `, afectando a ${significantNumber > 1000 ? `${(significantNumber/1000).toFixed(1)} mil` : significantNumber} personas`;
      }
    }
    
    analysis += '. ';
    
    // Solution
    if (text.includes('carne sintética') || text.includes('harinas de insectos')) {
      analysis += 'Esta ley establece etiquetado claro y regulaciones de seguridad para estos nuevos alimentos. ';
    } else if (text.includes('consumidor') || text.includes('consumidores')) {
      analysis += 'Esta ley establece protecciones y derechos para los consumidores. ';
    } else {
      analysis += 'Esta ley establece regulaciones para resolver el problema. ';
    }
    
    // Opposition
    if (partido === 'PSOE') {
      analysis += 'La oposición dice que costará mucho dinero y afectará a las empresas. ';
    } else if (partido === 'PP') {
      analysis += 'La oposición dice que es demasiado restrictiva y limitará la libertad económica. ';
    } else if (partido === 'VOX') {
      analysis += 'La oposición dice que podría ser inconstitucional y necesita cambios. ';
    } else {
      analysis += 'Hay dudas sobre si la ley resolverá realmente el problema. ';
    }
    
    // Political effects analysis
    if (partido === 'PSOE') {
      analysis += 'Esta iniciativa puede fortalecer la posición del gobierno PSOE-SUMAR ante sus votantes progresistas. ';
    } else if (partido === 'PP') {
      analysis += 'Esta iniciativa puede ser utilizada por el PP para movilizar a su base conservadora. ';
    } else if (partido === 'VOX') {
      analysis += 'Esta iniciativa puede generar tensiones con la base más moderada del partido. ';
    }
    
    // Technical implementation analysis
    if (comision) {
      analysis += `La ${comision} debe revisar técnicamente la ley antes de aplicarla. `;
    } else if (numbers.length > 0 && numbers.find(n => n > 1000)) {
      analysis += 'La implementación costará millones de euros y tomará tiempo. ';
    } else {
      analysis += 'Se necesita tiempo y recursos para implementar esta ley correctamente. ';
    }
    
    // Additional technical considerations
    if (text.includes('digital') || text.includes('tecnología')) {
      analysis += 'La implementación requerirá recursos tecnológicos y formación del personal. ';
    }
    if (text.includes('coordinación') || text.includes('administración')) {
      analysis += 'Se necesitará coordinación entre diferentes niveles administrativos. ';
    }
    
    // Real-world effects analysis
    if (text.includes('vivienda') || text.includes('alquiler')) {
      analysis += 'Esta regulación podría hacer que haya menos pisos turísticos, pero también podría hacer que suban los precios de los alquileres normales. ';
    }
    if (text.includes('turismo') || text.includes('turístico')) {
      analysis += 'El impacto en el turismo podría ser importante, afectando a los dueños de pisos y a las aplicaciones digitales. ';
    }
    if (text.includes('mercado') || text.includes('oferta')) {
      analysis += 'Los efectos en el mercado podrían incluir la creación de mercados paralelos o formas de evitar la regulación. ';
    }
    
    // Implementation risks
    if (text.includes('control') || text.includes('supervisión')) {
      analysis += 'Será muy importante poder supervisar y controlar que se cumpla la ley. ';
    }
    if (text.includes('recursos') || text.includes('costos')) {
      analysis += 'Si no hay suficientes recursos, la implementación podría no funcionar bien. ';
    }
    
    return analysis;
  };

  // Debug functions - HIDDEN (no longer needed)
  /*
  const handleCacheStats = async () => {
    try {
      const stats = await aiService.getCacheStats();
      const savings = await aiService.getCostSavings();
      
      alert(
        `📊 Estadísticas de Caché del Servidor:\n\n` +
        `Total en caché: ${stats.total_cached} iniciativas\n` +
        `Costo total ahorrado: $${stats.total_cost_saved.toFixed(6)}\n` +
        `Edad promedio: ${stats.average_age_hours} horas\n` +
        `Más reciente: ${stats.most_recent ? new Date(stats.most_recent).toLocaleDateString('es-ES') : 'N/A'}\n\n` +
        `💰 Ahorros:\n` +
        `Total ahorrado: $${savings.totalSaved.toFixed(6)}\n` +
        `Porcentaje ahorrado: ${savings.percentageSaved.toFixed(1)}%`
      );
    } catch (error) {
      console.error('Error getting cache stats:', error);
      alert('Error al obtener estadísticas de caché');
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar todo el caché del servidor? Esto forzará la regeneración de todo el contenido AI.')) {
      try {
        await aiService.clearCache();
        alert('Caché del servidor limpiado exitosamente');
        // Reload the current initiative to regenerate content
        if (initiative) {
          loadAllAnalyses(); // Call loadAllAnalyses to regenerate all analyses
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
        alert('Error al limpiar el caché');
      }
    }
  };
  */

  // Build a concise, high-signal overview of the problem, affected groups, solution and technical view
  const buildProblemOverview = (
    init: CongressInitiative,
    ai: { analysis: string } | null,
    prosCons: { analysis: string; economic_impact: string; social_impact: string; societal_impact: string } | null
  ): string => {
    // Enhanced cleaning function that handles JSON and formatting issues
    const clean = (text?: string | null): string => {
      if (!text) return '';
      
      let cleaned = text.trim();
      
      // Remove JSON content if present - handle multiple formats
      if (cleaned.includes('```json')) {
        const jsonStart = cleaned.indexOf('```json');
        if (jsonStart > 0) {
          cleaned = cleaned.substring(0, jsonStart).trim();
        } else {
          // If ```json is at the beginning, return empty
          return '';
        }
      } else if (cleaned.includes('```')) {
        const codeStart = cleaned.indexOf('```');
        if (codeStart > 0) {
          cleaned = cleaned.substring(0, codeStart).trim();
        } else {
          // If ``` is at the beginning, return empty
          return '';
        }
      } else if (cleaned.includes('{') && cleaned.includes('}')) {
        const braceStart = cleaned.indexOf('{');
        if (braceStart > 0) {
          cleaned = cleaned.substring(0, braceStart).trim();
        } else {
          // If { is at the beginning, return empty
          return '';
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
      
      return cleaned;
    };
 
    // 1) Problem description
    let problem = clean(ai?.analysis);
    if (!problem) {
      // fallback to NLP hints
      if (init.nlp_purpose) problem = `Se busca ${init.nlp_purpose.toLowerCase()}.`;
      if (!problem && init.objeto) problem = clean(init.objeto);
    }
 
    // 2) Who is affected
    const affectedCandidates = [
      'familias', 'empresas', 'autónomos', 'consumidores', 'trabajadores', 'administraciones públicas', 'jóvenes', 'mayores'
    ];
    const sourceText = `${ai?.analysis || ''} ${prosCons?.economic_impact || ''} ${prosCons?.social_impact || ''} ${prosCons?.societal_impact || ''} ${init.objeto || ''}`.toLowerCase();
    const foundGroups: string[] = [];
    for (const g of affectedCandidates) {
      if (sourceText.includes(g)) foundGroups.push(g);
    }
    let affected = foundGroups.length > 0
      ? `Afecta principalmente a ${foundGroups.slice(0, 3).join(', ')}.`
      : 'Afecta a la ciudadanía y al sector implicado.';
 
    // 3) Proposed solution
    let solution = '';
    if (init.nlp_specific_changes) {
      solution = `Propone ${init.nlp_specific_changes.toLowerCase()}`;
    } else if (init.nlp_regulation_scope) {
      solution = `Actúa sobre ${init.nlp_regulation_scope.toLowerCase()}`;
    } else if (init.congress_initiative_type) {
      solution = `Se articula como ${init.congress_initiative_type.replace(/_/g, ' ').toLowerCase()}`;
    } else {
      solution = 'Plantea nuevas regulaciones y ajustes normativos';
    }
    solution = solution.endsWith('.') ? solution : solution + '.';
 
    // 4) Technical view / effectiveness
    let technicalView = clean(prosCons?.analysis);
    if (!technicalView) {
      technicalView = 'Según la valoración técnica, su eficacia dependerá del diseño detallado y la implementación.';
    }
 
    // Compose overview
    const overview = [problem, affected, solution, technicalView]
      .filter(Boolean)
      .join(' ');
 
    return overview;
  };

  const problemOverview = buildProblemOverview(initiative, aiAnalysis, technicalProsCons);

  // Helper function to clean technical pros/cons content
  const cleanTechnicalContent = (content: string | undefined): string => {
    if (!content) return '';
    
    let cleaned = content.trim();
    
    // Remove JSON content if present - handle multiple formats
    if (cleaned.includes('```json')) {
      const jsonStart = cleaned.indexOf('```json');
      if (jsonStart > 0) {
        cleaned = cleaned.substring(0, jsonStart).trim();
      } else {
        // If ```json is at the beginning, return empty
        return '';
      }
    } else if (cleaned.includes('```')) {
      const codeStart = cleaned.indexOf('```');
      if (codeStart > 0) {
        cleaned = cleaned.substring(0, codeStart).trim();
      } else {
        // If ``` is at the beginning, return empty
        return '';
      }
    } else if (cleaned.includes('{') && cleaned.includes('}')) {
      const braceStart = cleaned.indexOf('{');
      if (braceStart > 0) {
        cleaned = cleaned.substring(0, braceStart).trim();
      } else {
        // If { is at the beginning, return empty
        return '';
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
    
    return cleaned;
  };

  // Helper function to extract pros and cons from impact content
  const extractProsAndCons = (content: string | undefined): { pros: string; cons: string } => {
    if (!content) return { pros: 'No disponible', cons: 'No disponible' };
    
    const cleaned = cleanTechnicalContent(content);
    
    // If cleaning resulted in empty content, provide meaningful fallbacks
    if (!cleaned || cleaned.trim().length === 0) {
      return {
        pros: 'Análisis no disponible - se requiere regeneración',
        cons: 'Análisis no disponible - se requiere regeneración'
      };
    }
    
    console.log('🔍 extractProsAndCons input:', cleaned);
    
    // Look for the new AI format with explicit BENEFICIOS and RIESGOS markers
    const lowerContent = cleaned.toLowerCase();
    
    if (lowerContent.includes('beneficios:') && lowerContent.includes('riesgos:')) {
      // Split on the explicit markers
      const beneficiosMatch = cleaned.match(/beneficios:\s*([^.]*)/i);
      const riesgosMatch = cleaned.match(/riesgos:\s*([^.]*)/i);
      
      if (beneficiosMatch && riesgosMatch) {
        console.log('🔍 Found explicit markers:', { beneficios: beneficiosMatch[1], riesgos: riesgosMatch[1] });
        return {
          pros: beneficiosMatch[1].trim() || 'Beneficios no especificados',
          cons: riesgosMatch[1].trim() || 'Riesgos no especificados'
        };
      }
    }
    
    // First try: explicit contrast splitters (these usually separate pros then cons)
    const contrastSplitters = [
      /\bno obstante\b/i,
      /\bsin embargo\b/i,
      /\bpero\b/i,
      /\bpor otro lado\b/i,
      /\baunque\b/i
    ];
    for (const splitter of contrastSplitters) {
      if (splitter.test(cleaned)) {
        const parts = cleaned.split(splitter);
        if (parts.length >= 2) {
          return {
            pros: parts[0].trim() || 'Beneficios no especificados',
            cons: parts.slice(1).join(' ').trim() || 'Riesgos no especificados'
          };
        }
      }
    }

    // Fallback: Look for common patterns that indicate pros and cons
    if (lowerContent.includes('beneficios') && lowerContent.includes('riesgos')) {
      // Split on common separators
      const parts = cleaned.split(/[.;]\s*(?:por otro lado|sin embargo|pero|no obstante|aunque|sin embargo)/i);
      if (parts.length >= 2) {
        return {
          pros: parts[0].trim() || 'Beneficios no especificados',
          cons: parts[1].trim() || 'Riesgos no especificados'
        };
      }
    }
    
    // If no clear separation, try to split on common conjunctions
    const conjunctions = ['pero', 'sin embargo', 'aunque', 'no obstante', 'por otro lado'];
    for (const conj of conjunctions) {
      if (lowerContent.includes(conj)) {
        const parts = cleaned.split(new RegExp(conj, 'i'));
        if (parts.length >= 2) {
          return {
            pros: parts[0].trim() || 'Beneficios no especificados',
            cons: parts[1].trim() || 'Riesgos no especificados'
          };
        }
      }
    }

    // As last resort, if text seems mostly negative, treat as CONS and synthesize a PRO
    const negativeKeywords = [
      'reducir', 'limitar', 'aumentar la precariedad', 'dificultar', 'provocar tensiones',
      'aumentar la estigmatización', 'polarizar', 'afectar negativamente', 'perjudicar',
      'empeorar', 'deteriorar', 'complicar', 'obstaculizar', 'restricción', 'limitación'
    ];
    const hasNegativeContent = negativeKeywords.some(keyword => lowerContent.includes(keyword));
    if (hasNegativeContent) {
      let prosText = 'Beneficios no claramente especificados en el análisis';
      if (lowerContent.includes('control') || lowerContent.includes('regulación')) {
        prosText = 'Mayor control y regulación del sistema';
      } else if (lowerContent.includes('protección') || lowerContent.includes('derechos')) {
        prosText = 'Protección de derechos existentes';
      } else if (lowerContent.includes('seguridad') || lowerContent.includes('estabilidad')) {
        prosText = 'Mayor seguridad y estabilidad';
      }
      return {
        pros: prosText,
        cons: cleaned || 'Riesgos no especificados'
      };
    }
    
    // Final fallback: if content seems negative, treat as CONS; otherwise as PROS
    if (hasNegativeContent) {
      return {
        pros: 'Beneficios no claramente especificados',
        cons: cleaned || 'Análisis no disponible'
      };
    }
    
    // If still no clear separation, return the content as pros and a generic cons
    return {
      pros: cleaned || 'Análisis no disponible',
      cons: 'Riesgos y desventajas no especificados en el análisis'
    };
  };

  // Helper: standardized legislative timeline and current step inference
  const TIMELINE_STEPS: { id: number; title: string; items: string[] }[] = [
    {
      id: 1,
      title: 'Presentación',
      items: [
        'Presentación de la iniciativa (Gobierno, partido, ciudadanos…)','Calificación por la Mesa del Congreso','Toma en consideración (si es proposición de ley)','Publicación del texto'
      ]
    },
    {
      id: 2,
      title: 'Debate',
      items: [
        'Enmiendas a la totalidad (si alguien quiere tumbar el texto completo)','Debate de totalidad en el Pleno'
      ]
    },
    {
      id: 3,
      title: 'Trabajo',
      items: [
        'Envío a Comisión','Enmiendas parciales (al articulado)','Comparecencias de expertos (opcional)','Redacción del dictamen por la Ponencia y aprobación en Comisión'
      ]
    },
    {
      id: 4,
      title: 'Aprobación',
      items: [
        'Debate y votación en el Pleno del Congreso','Envío al Senado','Enmiendas o veto del Senado','Aprobación definitiva por el Congreso'
      ]
    },
    {
      id: 5,
      title: 'Publicación',
      items: [
        'Sanción por el Rey','Publicación en el BOE','Entrada en vigor según fecha indicada'
      ]
    }
  ];

  const STEP_ICONS = ['📄','🗣️','🛠️','✅','📢'];

  const inferCurrentStep = (init: CongressInitiative): number => {
    // Use new stage classification from backend if available
    if (init.current_step && init.current_step >= 1 && init.current_step <= 5) {
      return init.current_step;
    }
    
    // Fallback to old logic
    const text = `${init.situacion_actual || ''} ${init.tramitacion_texto || ''}`.toLowerCase();

    // Step 5: Publication indicators
    if (text.includes('boe') || text.includes('publicación') || text.includes('entrada en vigor')) {
      return 5;
    }

    // Step 4: Approval and senate processing
    if ((init.resultado_tramitacion || '').toLowerCase().includes('aprob') ||
        text.includes('aprobación') || text.includes('senado') || text.includes('votación')) {
      return 4;
    }

    // Step 3: Commission work indicators
    if (init.comision_competente || text.includes('comisión') || text.includes('ponencia') || text.includes('dictamen') || text.includes('enmiendas parciales')) {
      return 3;
    }

    // Step 2: Debate of totalidad indicators
    if (text.includes('totalidad') || text.includes('debate en el pleno')) {
      return 2;
    }

    // Step 1: Default when only presented/calified
    return 1;
  };

  const currentStep = inferCurrentStep(initiative);

  // Helpers for prevote UI
  const positionBadge = (position: string) => {
    const styles: Record<string, string> = {
      'For': 'bg-green-100 text-green-800 border-green-200',
      'Likely For': 'bg-emerald-50 text-emerald-800 border-emerald-200',
      'Likely Against': 'bg-rose-50 text-rose-800 border-rose-200',
      'Undecided': 'bg-yellow-50 text-yellow-800 border-yellow-200',
      'Unknown': 'bg-gray-50 text-gray-700 border-gray-200'
    };
    const cls = styles[position] || styles['Unknown'];
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`;
  };

  const positionLabelEs = (position: string) => {
    switch (position) {
      case 'For':
        return 'A favor';
      case 'Likely For':
        return 'Probablemente a favor';
      case 'Likely Against':
        return 'Probablemente en contra';
      case 'Undecided':
        return 'Indeciso';
      case 'Unknown':
      default:
        return 'Sin información';
    }
  };

  // Resolve party from prevote label to known party meta (short name, color)
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const partyNameToShort: Record<string, string> = {
    'partido socialista obrero español': 'PSOE',
    'psoe': 'PSOE',
    'partido popular': 'PP',
    'pp': 'PP',
    'vox': 'VOX',
    'sumar': 'SUMAR',
    'unidas podemos': 'UP',
    'podemos': 'UP',
    'partido nacionalista vasco': 'EAJ-PNV',
    'eaj-pnv': 'EAJ-PNV',
    'eh bildu': 'EH Bildu',
    'junts per catalunya': 'Junts',
    'junts': 'Junts',
    'esquerra republicana de catalunya': 'ERC',
    'erc': 'ERC',
    'bloque nacionalista galego': 'BNG',
    'bng': 'BNG',
    'union del pueblo navarro': 'UPN',
    'unión del pueblo navarro': 'UPN',
    'upn': 'UPN',
    'coalicion canaria': 'CC',
    'coalición canaria': 'CC',
    'cc': 'CC',
  };
  const resolvePartyDisplay = (label: string) => {
    const key = normalize(label || '');
    const shortGuess = partyNameToShort[key];
    let match: PoliticalParty | undefined;
    if (shortGuess) {
      match = partyCatalog.find(p => (p.short_name || '').toUpperCase() === shortGuess.toUpperCase());
    }
    if (!match) {
      match = partyCatalog.find(p => normalize(p.name || '') === key);
    }
    return {
      displayName: match?.name || label,
      shortName: match?.short_name || label,
      color: match?.color || '#666666'
    };
  };

  // Group prevote data
  // Build canonical party list so specific parties always appear
  const TARGET_PARTIES_ORDER = ['PSOE','PP','VOX','SUMAR','ERC','Junts','EAJ-PNV','EH Bildu','CC','BNG','UPN'];
  type MinimalParty = { name: string; short_name: string; color: string; seats: number };
  const DEFAULT_PARTIES: MinimalParty[] = [
    { name: 'Partido Socialista Obrero Español', short_name: 'PSOE', color: '#E30613', seats: 121 },
    { name: 'Partido Popular', short_name: 'PP', color: '#0056A3', seats: 137 },
    { name: 'VOX', short_name: 'VOX', color: '#5BC236', seats: 33 },
    { name: 'SUMAR', short_name: 'SUMAR', color: '#FF6B35', seats: 31 },
    { name: 'Esquerra Republicana de Catalunya', short_name: 'ERC', color: '#FFB81C', seats: 7 },
    { name: 'Junts per Catalunya', short_name: 'Junts', color: '#FFD700', seats: 7 },
    { name: 'Partido Nacionalista Vasco', short_name: 'EAJ-PNV', color: '#008C15', seats: 5 },
    { name: 'EH Bildu', short_name: 'EH Bildu', color: '#00A9E0', seats: 6 },
    { name: 'Coalición Canaria', short_name: 'CC', color: '#FFCC00', seats: 1 },
    { name: 'Bloque Nacionalista Galego', short_name: 'BNG', color: '#0066CC', seats: 1 },
    { name: 'Unión del Pueblo Navarro', short_name: 'UPN', color: '#FF6600', seats: 1 },
  ];
  const availableParties: MinimalParty[] = (partyCatalog && partyCatalog.length > 0)
    ? partyCatalog.map(p => ({ name: p.name, short_name: p.short_name, color: p.color, seats: typeof p.seats === 'number' ? p.seats : 0 }))
    : DEFAULT_PARTIES;
  const canonicalParties = (availableParties || [])
    .filter(p => TARGET_PARTIES_ORDER.includes(p.short_name))
    .sort((a, b) => TARGET_PARTIES_ORDER.indexOf(a.short_name) - TARGET_PARTIES_ORDER.indexOf(b.short_name));

  type CanonicalPosition = { displayName: string; shortName: string; color: string; position: string; evidence: string };
  const canonicalPositions: CanonicalPosition[] = canonicalParties.map(cp => {
    let matched = null as PrevotePartyPosition | null;
    for (const pp of (prevote?.party_positions_prevote || [])) {
      const meta = resolvePartyDisplay(pp.party);
      if ((meta.shortName || '').toUpperCase() === cp.short_name.toUpperCase()) {
        matched = pp;
        break;
      }
    }
    return {
      displayName: cp.name,
      shortName: cp.short_name,
      color: cp.color || '#666666',
      position: matched ? matched.position : 'Unknown',
      evidence: matched?.evidence || ''
    };
  });

  // Promote: disabled (we omit heuristics)
  const canonicalPositionsWithPromoter = canonicalPositions;

  const supportPrevote = canonicalPositionsWithPromoter.filter(p => p.position === 'For' || p.position === 'Likely For');
  const oppositionPrevote = canonicalPositionsWithPromoter.filter(p => p.position === 'Likely Against');
  const undecidedPrevote = canonicalPositionsWithPromoter.filter(p => p.position === 'Undecided' || p.position === 'Unknown');

  // Sorted arrays for nicer display
  const supportPrevoteSorted = [...supportPrevote].sort((a, b) => {
    const order = (pos: string) => (pos === 'For' ? 0 : pos === 'Likely For' ? 1 : 2);
    const byOrder = order(a.position) - order(b.position);
    if (byOrder !== 0) return byOrder;
    return a.displayName.localeCompare(b.displayName, 'es');
  });
  const oppositionPrevoteSorted = [...oppositionPrevote].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  const undecidedPrevoteSorted = [...undecidedPrevote].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

  // Approval estimation based on aligned parties (uses seats if available)
  const getPartySeats = (shortName: string): number => {
    const p = (partyCatalog || []).find(pp => (pp.short_name || '').toUpperCase() === (shortName || '').toUpperCase());
    const seats = p && typeof p.seats === 'number' ? p.seats : null;
    if (seats && seats > 0) return seats;
    // fallback to availableParties/default mapping
    const alt = (availableParties || []).find(pp => (pp.short_name || '').toUpperCase() === (shortName || '').toUpperCase());
    if (alt && alt.seats > 0) return alt.seats;
    return 0;
  };
  const positionWeight = (pos: string): number => {
    if (pos === 'For') return 1.0;
    if (pos === 'Likely For') return 0.7;
    if (pos === 'Likely Against') return -0.7;
    return 0.0; // Unknown / Undecided
  };
  const estimationTotals = canonicalPositionsWithPromoter.reduce(
    (acc, item) => {
      const seats = getPartySeats(item.shortName);
      const w = positionWeight(item.position);
      acc.weighted += w * seats;
      acc.totalSeats += seats;
      acc.supportSeats += w > 0 ? seats * w : 0;
      acc.againstSeats += w < 0 ? seats * Math.abs(w) : 0;
      return acc;
    },
    { weighted: 0, totalSeats: 0, supportSeats: 0, againstSeats: 0 }
  );
  const normalizedScore = estimationTotals.totalSeats > 0 ? estimationTotals.weighted / estimationTotals.totalSeats : 0;
  let approvalLabel = 'Equilibrado';
  let approvalColor = 'text-gray-800';
  if (normalizedScore >= 0.5) { approvalLabel = 'Muy probable'; approvalColor = 'text-green-700'; }
  else if (normalizedScore >= 0.25) { approvalLabel = 'Probable'; approvalColor = 'text-green-600'; }
  else if (normalizedScore > -0.25) { approvalLabel = 'Incierto'; approvalColor = 'text-yellow-700'; }
  else if (normalizedScore > -0.5) { approvalLabel = 'Poco probable'; approvalColor = 'text-red-600'; }
  else { approvalLabel = 'Muy poco probable'; approvalColor = 'text-red-700'; }
  const progressPct = Math.round(((normalizedScore + 1) / 2) * 100); // map [-1..1] -> [0..100]
  const MAJORITY_THRESHOLD = 176;
  const TOTAL_SEATS = 350;
  const hasEstimatedMajority = estimationTotals.supportSeats >= MAJORITY_THRESHOLD;
  // Build stacked segments by raw seats per party (reflect real seat counts)
  const supportForSegments = canonicalPositionsWithPromoter
    .filter(i => i.position === 'For')
    .map(i => ({ shortName: i.shortName, color: i.color, seats: getPartySeats(i.shortName) }))
    .filter(s => s.seats > 0)
    .sort((a, b) => b.seats - a.seats);
  const supportLikelySegments = canonicalPositionsWithPromoter
    .filter(i => i.position === 'Likely For')
    .map(i => ({ shortName: i.shortName, color: i.color, seats: getPartySeats(i.shortName) }))
    .filter(s => s.seats > 0)
    .sort((a, b) => b.seats - a.seats);
  const againstLikelySegments = canonicalPositionsWithPromoter
    .filter(i => i.position === 'Likely Against')
    .map(i => ({ shortName: i.shortName, color: i.color, seats: getPartySeats(i.shortName) }))
    .filter(s => s.seats > 0)
    .sort((a, b) => b.seats - a.seats);
  const neutralSegments = canonicalPositionsWithPromoter
    .filter(i => i.position === 'Undecided' || i.position === 'Unknown')
    .map(i => ({ shortName: i.shortName, color: '#e5e7eb', seats: getPartySeats(i.shortName) }))
    .filter(s => s.seats > 0)
    .sort((a, b) => b.seats - a.seats);
  const majorityPct = (MAJORITY_THRESHOLD / TOTAL_SEATS) * 100;

  // Helpers (kept even if prevote UI is toggled off)
  const tramitacionRaw = `${initiative.tramitacion_texto || ''}\n${(initiative as any).tramitacion || ''}`;
  const extractAmendmentNumbers = (forPartyShort: string): string[] => {
    if (!tramitacionRaw) return [];
    const partyMeta = (availableParties || []).find(p => p.short_name.toUpperCase() === forPartyShort.toUpperCase());
    const labels = [forPartyShort, partyMeta?.name || ''].filter(Boolean).map(s => s.toLowerCase());
    const lines = tramitacionRaw.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const numbers: string[] = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!lower.includes('enmiend')) continue;
      if (labels.some(lbl => lower.includes(lbl))) {
        const matches = line.match(/enmiend[ao]s?\s*(?:n[.ºo]\s*)?(\d+)/gi) || [];
        for (const m of matches) {
          const num = (m.match(/(\d+)/) || [])[1];
          if (num && !numbers.includes(num)) numbers.push(num);
        }
      }
    }
    return numbers;
  };
  const extractFirstUrl = (text: string): string | null => {
    const m = (text || '').match(/https?:\/\/[^\s)]+/i);
    return m ? m[0] : null;
  };
  const getLinksForParty = (partyShort: string, amendNums: string[]) => {
    const links: { href: string; label: string }[] = [];
    if (initiative.enlaces_bocg) {
      links.push({ href: initiative.enlaces_bocg, label: 'BOCG' });
    } else {
      const q = `site:www.congreso.es BOCG ${initiative.num_expediente || ''} enmienda ${partyShort}`;
      links.push({ href: `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Buscar BOCG' });
    }
    if (initiative.enlaces_ds) {
      links.push({ href: initiative.enlaces_ds, label: 'Diario de Sesiones' });
    } else {
      const q2 = `site:www.congreso.es Diario de Sesiones ${initiative.num_expediente || ''} ${partyShort}`;
      links.push({ href: `https://www.google.com/search?q=${encodeURIComponent(q2)}`, label: 'Buscar DS' });
    }
    const firstUrl = extractFirstUrl(tramitacionRaw);
    if (!initiative.enlaces_bocg && !initiative.enlaces_ds && firstUrl) {
      links.push({ href: firstUrl, label: 'Documento' });
    }
    return links;
  };

  // Feature toggle to hide prevote and estimation sections
  const showPrevote = false;

  return (
    <div className="px-4 py-6">
      {/* Header with Back Button */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Detalles de la Iniciativa</h1>
        </div>
      </div>

      {/* Initiative Header */}
      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
              {enhancedTitle || initiative.accessible_title || initiative.objeto}
            </h2>
            <div className="mt-2">
              <button
                onClick={async () => {
                  try {
                    setIsRegeneratingTitle(true);
                    let newTitle: string | null = null;
                    try {
                      newTitle = await aiService.generateEnhancedTitleStrict(initiative);
                    } catch (aiErr) {
                      console.warn('AI title regeneration failed, using local fallback.');
                      newTitle = aiService.getLocalTitleFallback(initiative);
                    }
                    setEnhancedTitle(newTitle);
                  } catch (e) {
                    console.error('Failed to regenerate title:', e);
                    alert('No se pudo regenerar el título');
                  } finally {
                    setIsRegeneratingTitle(false);
                  }
                }}
                className="text-xs text-blue-700 hover:text-blue-900 underline disabled:opacity-50"
                disabled={isRegeneratingTitle}
              >
                {isRegeneratingTitle ? 'Regenerando título…' : 'Regenerar título'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${getStatusColor(initiative)}`}>
              {getStatusLabel(initiative)}
            </span>
            {(initiative.boe_id || initiative.boe_url) && (
              (() => {
                const href = getBoeHref(initiative.boe_url, initiative.boe_id);
                const label = href ? getRelativeBoePath(href) : '';
                return href && label ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    title="Ver publicación en el BOE"
                  >
                    {label}
                  </a>
                ) : null;
              })()
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-2">
          <span className="font-medium">Título oficial: </span>
          <span>{initiative.accessible_title || 'No proporcionado'}</span>
        </div>
        
        <div className="space-y-4">
          {/* Main Description */}
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Descripción Completa:</h4>
            <p className="text-gray-600 mb-4 leading-relaxed">
              {initiative.objeto}
            </p>
          </div>

          {/* BOE Publication Information */}
          {initiative.publication_confidence && initiative.publication_confidence !== 'not_identified' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <span className="mr-2">📢</span>
                Información de Publicación en BOE
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600 font-medium">Estado:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    initiative.publication_confidence === 'high' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {initiative.publication_confidence === 'high' ? 'Publicada en BOE' : 'Probablemente publicada'}
                  </span>
                </div>
                {initiative.boe_id && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 font-medium">ID BOE:</span>
                    <span className="text-blue-700">{initiative.boe_id}</span>
                  </div>
                )}
                {initiative.boe_publication_date && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 font-medium">Fecha de Publicación:</span>
                    <span className="text-blue-700">
                      {new Date(initiative.boe_publication_date).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {initiative.boe_url && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 font-medium">Enlace BOE:</span>
                    <a 
                      href={initiative.boe_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {getRelativeBoePath(initiative.boe_url) || 'Ver publicación oficial →'}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Context */}
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Contexto Ampliado:</h4>
            <p className="text-gray-600 leading-relaxed">
              Esta iniciativa legislativa, presentada por {getPartyName(initiative.political_party_short_name)} en la {initiative.legislatura} legislatura, 
              {initiative.nlp_purpose ? ` busca ${initiative.nlp_purpose.toLowerCase()}. ` : ''}
              {initiative.nlp_regulation_scope ? `Su ámbito de aplicación se extiende a ${initiative.nlp_regulation_scope.toLowerCase()}. ` : ''}
              {initiative.nlp_specific_changes ? `Los cambios específicos incluyen ${initiative.nlp_specific_changes.toLowerCase()}. ` : ''}
              La iniciativa se enmarca en el contexto de {initiative.congress_initiative_type?.replace(/_/g, ' ').toLowerCase()}, 
              {initiative.tipo_tramitacion === 'urgente' ? ' con tramitación urgente que acelera los plazos parlamentarios.' : ' siguiendo el procedimiento legislativo ordinario.'}
            </p>
          </div>

          {/* Legislative Process Details */}
          {initiative.tramitacion_texto && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Detalles del Proceso Legislativo:</h4>
              <p className="text-gray-600 leading-relaxed">
                {initiative.tramitacion_texto}
              </p>
            </div>
          )}

          {/* Commission and Rapporteurs */}
          {(initiative.comision_competente || initiative.ponentes) && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Asignación Parlamentaria:</h4>
              <div className="text-gray-600 space-y-1">
                {initiative.comision_competente && (
                  <p><strong>Comisión Competente:</strong> {initiative.comision_competente}</p>
                )}
                {initiative.ponentes && (
                  <p><strong>Ponentes:</strong> {initiative.ponentes}</p>
                )}
                {initiative.plazos && (
                  <p><strong>Plazos:</strong> {initiative.plazos}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Follow Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            // TODO: Implement follow functionality
            console.log('Follow initiative:', initiative.id);
          }}
          className="w-full py-3 rounded-lg font-medium transition-colors duration-200 bg-primary-600 text-white hover:bg-primary-700"
        >
          Seguir esta Iniciativa
        </button>
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={handleClearServerCache}
            className="px-3 py-2 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Limpiar caché del servidor
          </button>
        </div>
      </div>

      {/* Problem Analysis Section */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">🎯 Problema que Aborda esta Ley</h3>
        
        {isLoadingAI ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Analizando iniciativa con IA...</p>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-gray-700 leading-relaxed">
              {problemOverview || 'Análisis no disponible - se requiere regeneración'}
            </p>
            {!problemOverview && aiAnalysis?.analysis && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="text-yellow-800 font-medium">⚠️ Contenido AI disponible pero no procesado:</p>
                <p className="text-yellow-700 mt-1 font-mono text-xs break-words">
                  {aiAnalysis.analysis}
                </p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <p>🧭 <em>Síntesis basada en IA/NLP y análisis técnicos</em></p>
              </div>
              {!problemOverview && (
                <button
                  onClick={refreshResearch}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
                >
                  🔄 Regenerar Análisis
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pros y Contras Técnicos */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">⚖️ Pros y Contras Técnicos</h3>
        {isLoadingProsCons ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Analizando pros y contras técnicos con IA...</p>
          </div>
        ) : technicalProsCons ? (
          <div className="space-y-6">
            {/* Pros and Cons Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PROS Box */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200 shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-green-600 text-lg font-bold">✓</span>
                  </div>
                  <h4 className="text-xl font-semibold text-green-800">PROS</h4>
                </div>
                
                <div className="space-y-4">
                  {/* Economic Benefits */}
                  <div className="bg-white p-3 rounded border border-green-200">
                    <h5 className="font-medium text-green-800 mb-2 flex items-center">
                      <span className="text-green-600 mr-2">💰</span>
                      Beneficios Económicos
                    </h5>
                    <p className="text-green-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.economic_impact).pros}
                    </p>
                  </div>

                  {/* Social Benefits */}
                  <div className="bg-white p-3 rounded border border-green-200">
                    <h5 className="font-medium text-green-800 mb-2 flex items-center">
                      <span className="text-green-600 mr-2">👥</span>
                      Beneficios Sociales
                    </h5>
                    <p className="text-green-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.social_impact).pros}
                    </p>
                  </div>

                  {/* Societal Benefits */}
                  <div className="bg-white p-3 rounded border border-green-200">
                    <h5 className="font-medium text-green-800 mb-2 flex items-center">
                      <span className="text-green-600 mr-2">🏛️</span>
                      Beneficios Societales
                    </h5>
                    <p className="text-green-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.societal_impact).pros}
                    </p>
                  </div>
                </div>
              </div>

              {/* CONS Box */}
              <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-lg border-2 border-red-200 shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-red-600 text-lg font-bold">✗</span>
                  </div>
                  <h4 className="text-xl font-semibold text-red-800">CONTRAS</h4>
                </div>
                
                <div className="space-y-4">
                  {/* Economic Risks */}
                  <div className="bg-white p-3 rounded border border-red-200">
                    <h5 className="font-medium text-red-800 mb-2 flex items-center">
                      <span className="text-red-600 mr-2">⚠️</span>
                      Riesgos Económicos
                    </h5>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.economic_impact).cons}
                    </p>
                  </div>

                  {/* Social Risks */}
                  <div className="bg-white p-3 rounded border border-red-200">
                    <h5 className="font-medium text-red-800 mb-2 flex items-center">
                      <span className="text-red-600 mr-2">🚨</span>
                      Riesgos Sociales
                    </h5>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.social_impact).cons}
                    </p>
                  </div>

                  {/* Societal Risks */}
                  <div className="bg-white p-3 rounded border border-red-200">
                    <h5 className="font-medium text-red-800 mb-2 flex items-center">
                      <span className="text-red-600 mr-2">⚡</span>
                      Riesgos Societales
                    </h5>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {extractProsAndCons(technicalProsCons?.societal_impact).cons}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Regeneration button for technical pros/cons */}
            <div className="mt-6 text-center">
              <button
                onClick={refreshResearch}
                className="px-6 py-3 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                🔄 Regenerar Análisis Técnico
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Regenera el análisis de pros y contras con IA
              </p>
              
              {/* Debug button to test extraction logic */}
              <button
                onClick={() => {
                  console.log('🔍 Testing extraction logic:');
                  console.log('🔍 Technical pros/cons data:', technicalProsCons);
                  if (technicalProsCons) {
                    console.log('🔍 Economic impact extraction test:');
                    const economic = extractProsAndCons(technicalProsCons.economic_impact);
                    console.log('🔍 Economic pros:', economic.pros);
                    console.log('🔍 Economic cons:', economic.cons);
                  }
                }}
                className="mt-3 px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                🐛 Debug Extraction
              </button>
              
              {/* Note about content extraction */}
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <p className="font-medium">ℹ️ Nota:</p>
                <p>El contenido se extrae automáticamente del análisis de IA. Si solo aparecen contras, se generan beneficios basados en el contexto.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-gray-600">No hay análisis técnico de pros y contras disponible</p>
            <button
              onClick={refreshResearch}
              className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
            >
              🔄 Generar Análisis
            </button>
          </div>
        )}
      </div>

      {/* Support, Opposition, and Unaligned/Unknown */}
      {showPrevote && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-green-700 mb-3">✅ Partidos de Apoyo <span className="text-xs text-gray-500 font-normal">({isLoadingPrevote ? '…' : supportPrevote.length})</span></h3>
          {isLoadingPrevote ? (
            <div className="text-sm text-gray-500">Cargando posiciones…</div>
          ) : supportPrevoteSorted.length > 0 ? (
            <div className="space-y-2">
              {/* Promoter always on top, if available */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getPartyColor(initiative.political_party_short_name) }}
                  ></div>
                  <span className="text-sm text-gray-700">{initiative.political_party_short_name} (Promotor)</span>
                </div>
                <span className={positionBadge('For')}>{positionLabelEs('For')}</span>
              </div>
              {/* Other supportive parties (avoid duplicating promoter by name) */}
              {supportPrevoteSorted
                .filter(pp => pp.shortName !== initiative.political_party_short_name)
                .map((pp, idx) => {
                  const meta = { color: pp.color };
                  const amendNums = extractAmendmentNumbers(pp.shortName);
                  const officialLinks = getLinksForParty(pp.shortName, amendNums);
                  return (
                    <div key={idx} className="flex items-start justify-between">
                      <div className="pr-4 flex items-start gap-2">
                        <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: meta.color }}></div>
                        <div>
                          <div className="text-sm text-gray-800">{pp.shortName}</div>
                          {pp.evidence && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2" title={pp.evidence}>{pp.evidence}</div>
                          )}
                          <div className="mt-1 text-xs text-gray-600">
                            {amendNums.length > 0 && (
                              <>
                                Enmiendas: {amendNums.slice(0, 5).join(', ')}
                                {amendNums.length > 5 && '…'}
                                {' '}
                              </>
                            )}
                            {officialLinks.map((l: { href: string; label: string }, i: number) => (
                              <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline mr-2">
                                {l.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className={positionBadge(pp.position)}>{positionLabelEs(pp.position)}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getPartyColor(initiative.political_party_short_name) }}
                ></div>
                <span className="text-sm text-gray-700">
                  {getPartyName(initiative.political_party_short_name)} (Promotor)
                </span>
              </div>
              {initiative.political_party_confidence === 'high' && (
                <div className="text-xs text-gray-500 mt-2 p-2 bg-green-50 rounded">
                  Alta confianza en la identificación del partido promotor
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="card">
          <h3 className="font-semibold text-red-700 mb-3">❌ Posible Oposición <span className="text-xs text-gray-500 font-normal">({isLoadingPrevote ? '…' : oppositionPrevote.length})</span></h3>
          {isLoadingPrevote ? (
            <div className="text-sm text-gray-500">Cargando posiciones…</div>
          ) : oppositionPrevoteSorted.length > 0 ? (
            <div className="space-y-2">
              {oppositionPrevoteSorted.map((pp, idx) => {
                const meta = { color: pp.color };
                const amendNums = extractAmendmentNumbers(pp.shortName);
                const officialLinks = getLinksForParty(pp.shortName, amendNums);
                return (
                  <div key={idx} className="flex items-start justify-between">
                    <div className="pr-4 flex items-start gap-2">
                      <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: meta.color }}></div>
                      <div>
                        <div className="text-sm text-gray-800">{pp.shortName}</div>
                        {pp.evidence && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2" title={pp.evidence}>{pp.evidence}</div>
                        )}
                        <div className="mt-1 text-xs text-gray-600">
                          {amendNums.length > 0 && (
                            <>
                              Enmiendas: {amendNums.slice(0, 5).join(', ')}
                              {amendNums.length > 5 && '…'}
                              {' '}
                            </>
                          )}
                          {officialLinks.map((l: { href: string; label: string }, i: number) => (
                            <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline mr-2">
                              {l.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className={positionBadge(pp.position)}>{positionLabelEs(pp.position)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-700">
                {initiative.political_party_short_name === 'PSOE' ? 'Partidos de derecha' :
                 initiative.political_party_short_name === 'PP' ? 'Partidos de izquierda' :
                 initiative.political_party_short_name === 'VOX' ? 'Partidos de centro-izquierda' :
                 initiative.political_party_short_name === 'SUMAR' ? 'Partidos de derecha' :
                 'Otros grupos parlamentarios'} podrían oponerse
              </div>
              {initiative.tipo_tramitacion === 'urgente' && (
                <div className="text-xs text-gray-500 mt-2 p-2 bg-red-50 rounded">
                  Tramitación urgente puede generar mayor oposición
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">🔍 Indecisos / Sin información <span className="text-xs text-gray-500 font-normal">({isLoadingPrevote ? '…' : undecidedPrevote.length})</span></h3>
          {isLoadingPrevote ? (
            <div className="text-sm text-gray-500">Cargando posiciones…</div>
          ) : undecidedPrevoteSorted.length > 0 ? (
            <div className="space-y-2">
              {undecidedPrevoteSorted.map((pp, idx) => {
                const amendNums = extractAmendmentNumbers(pp.shortName);
                const officialLinks = getLinksForParty(pp.shortName, amendNums);
                return (
                <div key={idx} className="flex items-start justify-between">
                  <div className="pr-4 flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: pp.color }}></div>
                    <div>
                      <div className="text-sm text-gray-800">{pp.shortName}</div>
                      {pp.evidence && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2" title={pp.evidence}>{pp.evidence}</div>
                      )}
                      <div className="mt-1 text-xs text-gray-600">
                        {amendNums.length > 0 && (
                          <>
                            Enmiendas: {amendNums.slice(0, 5).join(', ')}
                            {amendNums.length > 5 && '…'}
                            {' '}
                          </>
                        )}
                        {officialLinks.map((l: { href: string; label: string }, i: number) => (
                          <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline mr-2">
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className={positionBadge(pp.position)}>{positionLabelEs(pp.position)}</span>
                </div>
              );})}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No hay partidos indecisos o sin información.</div>
          )}
        </div>
      </div>
      )}

      {/* Approval Estimation */}
      {showPrevote && (
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">🧮 Estimación de Aprobación</h3>
          <span className={`text-sm font-medium ${approvalColor}`}>{approvalLabel}</span>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          Basado en la alineación de partidos (ponderado por escaños cuando estén disponibles).
        </div>
        <div className="w-full">
          <div className="relative h-4 bg-gray-200 rounded">
            {/* Stacked segments scaled to 350 seats */}
            <div className="absolute inset-0 flex rounded overflow-hidden">
              {/* For */}
              {supportForSegments.map((seg, idx) => (
                <div
                  key={idx}
                  className="h-4"
                  title={`${seg.shortName}: ${seg.seats} escaños (a favor)`}
                  style={{
                    width: `${(seg.seats / TOTAL_SEATS) * 100}%`,
                    backgroundColor: seg.color
                  }}
                ></div>
              ))}
              {/* Likely For */}
              {supportLikelySegments.map((seg, idx) => (
                <div
                  key={`lf-${idx}`}
                  className="h-4 opacity-60"
                  title={`${seg.shortName}: ${seg.seats} escaños (probablemente a favor)`}
                  style={{
                    width: `${(seg.seats / TOTAL_SEATS) * 100}%`,
                    backgroundColor: seg.color
                  }}
                ></div>
              ))}
              {/* Neutral */}
              {neutralSegments.map((seg, idx) => (
                <div
                  key={`nu-${idx}`}
                  className="h-4"
                  title={`${seg.shortName}: ${seg.seats} escaños (sin información)`}
                  style={{
                    width: `${(seg.seats / TOTAL_SEATS) * 100}%`,
                    backgroundColor: seg.color
                  }}
                ></div>
              ))}
              {/* Likely Against */}
              {againstLikelySegments.map((seg, idx) => (
                <div
                  key={`la-${idx}`}
                  className="h-4 opacity-60"
                  title={`${seg.shortName}: ${seg.seats} escaños (probablemente en contra)`}
                  style={{
                    width: `${(seg.seats / TOTAL_SEATS) * 100}%`,
                    backgroundColor: seg.color
                  }}
                ></div>
              ))}
            </div>
            {/* Majority threshold line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-700"
              style={{ left: `${Math.min(100, Math.max(0, majorityPct))}%` }}
              title={`Mayoría absoluta (${MAJORITY_THRESHOLD} escaños)`}
            ></div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
            <span>0</span>
            <span>{TOTAL_SEATS} escaños</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>En contra (estimado): {Math.round(estimationTotals.againstSeats)}</span>
          <span>A favor (estimado): {Math.round(estimationTotals.supportSeats)}</span>
        </div>
        <div className="mt-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full border ${hasEstimatedMajority ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            Mayoría estimada: {hasEstimatedMajority ? 'Sí' : 'No'} (umbral {MAJORITY_THRESHOLD})
          </span>
        </div>
      </div>
      )}

      {/* Timeline - Standardized 5-step process */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">📅 Cronología del Proceso</h3>
          <span className="text-xs text-gray-500">Paso actual: {currentStep}/5</span>
        </div>
        <div className="relative">
          {/* Gradient connector line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-blue-200 via-gray-200 to-gray-200 z-0"></div>
          <ol className="space-y-6">
            {TIMELINE_STEPS.map(step => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              const isFuture = step.id > currentStep;
              const dotBase = isCompleted
                ? 'bg-green-500 border-green-600'
                : isCurrent
                ? 'bg-blue-600 border-blue-700'
                : 'bg-gray-200 border-gray-300';
              const titleColor = isCurrent
                ? 'text-blue-900'
                : isCompleted
                ? 'text-green-900'
                : 'text-gray-500';
              return (
                <li key={step.id} className="relative pl-10">
                  {/* White mask to fully cover the connector line */}
                  <span className="absolute left-1 top-1 w-6 h-6 rounded-full bg-white z-10"></span>
                  {/* Colored dot above the mask */}
                  <span className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 z-20 ${dotBase}`}></span>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`font-medium ${titleColor} flex items-center gap-2`}>
                        <span className="text-base">{STEP_ICONS[step.id - 1] || '•'}</span>
                        <span>{step.id}. {step.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* BOE link badge for step 5 (Publicación) */}
                        {step.id === 5 && (initiative.boe_id || initiative.boe_url) && (
                          (() => {
                            const href = getBoeHref(initiative.boe_url, initiative.boe_id);
                            const label = href ? getRelativeBoePath(href) : '';
                            return href && label ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                title="Ver publicación en el BOE"
                              >
                                {label}
                              </a>
                            ) : null;
                          })()
                        )}
                        {isCurrent && <span className="text-xs text-blue-700 font-medium">Actual</span>}
                        {isCompleted && <span className="text-xs text-green-700">Completado</span>}
                        {isFuture && <span className="text-xs text-gray-400">Pendiente</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Sources Section - Evidence Context */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">📚 Fuentes y Evidencia</h3>
        
        {/* Debug Information */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <p className="font-medium text-yellow-800 mb-1">🔍 Debug Info:</p>
          <p className="text-yellow-700">Initiative ID: {initiative.id}</p>
          <p className="text-yellow-700">Num Expediente: {initiative.num_expediente}</p>
          <p className="text-yellow-700">Has Evidence Context: {aiService.hasEvidenceContext(initiative) ? 'Yes' : 'No'}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                const evidence = aiService.getEvidenceContextForInitiative(initiative);
                const stats = aiService.getEvidenceContextStats();
                console.log('🔍 Evidence Context Debug:', {
                  initiative: { id: initiative.id, num_expediente: initiative.num_expediente },
                  evidence,
                  stats,
                  hasEvidence: aiService.hasEvidenceContext(initiative)
                });
                alert(
                  `🔍 Debug Info:\n\n` +
                  `Initiative ID: ${initiative.id}\n` +
                  `Num Expediente: ${initiative.num_expediente}\n` +
                  `Has Evidence: ${aiService.hasEvidenceContext(initiative)}\n` +
                  `Total Initiatives: ${stats.totalInitiatives}\n` +
                  `With Evidence: ${stats.withEvidence}\n\n` +
                  `Evidence Data: ${evidence ? JSON.stringify(evidence, null, 2) : 'None'}`
                );
              }}
              className="text-blue-600 hover:text-blue-800 underline text-xs"
            >
              Debug Evidence Context
            </button>
            <button
              onClick={async () => {
                try {
                  await aiService.refreshEvidenceContext();
                  alert('✅ Evidence context refreshed successfully!');
                  // Force re-render
                  window.location.reload();
                } catch (error) {
                  alert('❌ Error refreshing evidence context: ' + error);
                }
              }}
              className="text-green-600 hover:text-green-800 underline text-xs"
            >
              Refresh Evidence Context
            </button>
          </div>
        </div>
        
        {/* News Sources */}
        {aiService.hasEvidenceContext(initiative) && (
          <div className="space-y-4">
            {/* News Articles */}
            {(() => {
              const evidence = aiService.getEvidenceContextForInitiative(initiative);
              const newsItems = evidence?.news || [];
              return newsItems.length > 0 ? (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <span className="text-blue-600 mr-2">📰</span>
                    Noticias Relacionadas
                  </h4>
                  <div className="space-y-3">
                    {newsItems.slice(0, 5).map((news, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-blue-900 mb-1">
                              {news.title}
                            </h5>
                            {news.snippet && (
                              <p className="text-blue-700 text-sm mb-2 line-clamp-2">
                                {news.snippet}
                              </p>
                            )}
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs underline"
                            >
                              Leer artículo completo →
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Social Media Posts */}
            {(() => {
              const evidence = aiService.getEvidenceContextForInitiative(initiative);
              const socialPosts = evidence?.x || {};
              const hasSocialPosts = Object.keys(socialPosts).length > 0;
              return hasSocialPosts ? (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <span className="text-blue-600 mr-2">🐦</span>
                    Posiciones en Redes Sociales
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(socialPosts).map(([party, posts]) => (
                      <div key={party} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <h5 className="font-medium text-gray-900 mb-2">
                          {party} ({posts.length} publicación{posts.length !== 1 ? 'es' : ''})
                        </h5>
                        <div className="space-y-1">
                          {posts.slice(0, 3).map((post, index) => (
                            <a
                              key={index}
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-gray-600 hover:text-gray-800 text-sm"
                            >
                              • {post.type}: {post.url}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Legal Documents */}
            {(() => {
              const evidence = aiService.getEvidenceContextForInitiative(initiative);
              const legalDocs = evidence?.legal || {};
              const hasLegalDocs = legalDocs.bocg || legalDocs.ds;
              return hasLegalDocs ? (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <span className="text-blue-600 mr-2">📋</span>
                    Documentos Legales Oficiales
                  </h4>
                  <div className="space-y-2">
                    {legalDocs.bocg && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h5 className="font-medium text-green-900 mb-1">BOCG (Boletín Oficial del Congreso)</h5>
                        <a
                          href={legalDocs.bocg}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 text-sm underline"
                        >
                          Ver documento oficial →
                        </a>
                      </div>
                    )}
                    {legalDocs.ds && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h5 className="font-medium text-green-900 mb-1">DS (Diario de Sesiones)</h5>
                        <a
                          href={legalDocs.ds}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 text-sm underline"
                        >
                          Ver documento oficial →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Fallback when no evidence is available */}
        {!aiService.hasEvidenceContext(initiative) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-gray-600 mb-2">No hay fuentes externas disponibles para esta iniciativa</p>
            <p className="text-xs text-gray-500">
              El análisis se basa únicamente en la información oficial de la iniciativa
            </p>
          </div>
        )}

        {/* Evidence Context Stats */}
        {aiService.hasEvidenceContext(initiative) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Fuentes utilizadas para el análisis AI</span>
              <button
                onClick={() => {
                  const stats = aiService.getEvidenceContextStats();
                  alert(
                    `📊 Estadísticas de Evidencia:\n\n` +
                    `Total de iniciativas con evidencia: ${stats.withEvidence}\n` +
                    `Total de iniciativas procesadas: ${stats.totalInitiatives}\n\n` +
                    `Esta iniciativa tiene evidencia externa que mejora la calidad del análisis AI.`
                  );
                }}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Ver estadísticas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Related Topics - Generated from NLP and initiative data */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">🏷️ Temas Relacionados</h3>
        <div className="flex flex-wrap gap-2">
          {initiative.nlp_subject_area && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
              {initiative.nlp_subject_area}
            </span>
          )}
          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
            {initiative.congress_initiative_type?.replace(/_/g, ' ')}
          </span>
          {initiative.tipo_tramitacion && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
              {initiative.tipo_tramitacion}
            </span>
          )}
          {initiative.legislatura && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
              Legislatura {initiative.legislatura}
            </span>
          )}
          {initiative.nlp_urgency && (
            <span className={`px-3 py-1 text-sm rounded-full ${
              initiative.nlp_urgency === 'alta' 
                ? 'bg-red-100 text-red-700'
                : initiative.nlp_urgency === 'media'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
              Urgencia: {initiative.nlp_urgency}
            </span>
          )}
          {initiative.nlp_complexity && (
            <span className={`px-3 py-1 text-sm rounded-full ${
              initiative.nlp_complexity === 'alta' 
                ? 'bg-red-100 text-red-700'
                : initiative.nlp_complexity === 'media'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
              Complejidad: {initiative.nlp_complexity}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitiativeDetailScreen;