import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { createClient } from '@supabase/supabase-js';
import {
  CongressInitiative,
  CongressResults,
  CongressDataProcessor,
  CongressUpdateResult,
  Law,
  LawStage,
  LawType
} from '../types';
import { classifyCongressInitiative } from './StageClassifier';

export class CongressDataService implements CongressDataProcessor {
  private supabase;
  // Optional remote URLs (kept for future use). We prioritize local downloads.
  private readonly CONGRESS_API_URLS = [
    // Disabled by default since we use local downloads
  ];
  private readonly XML_PARSER_OPTIONS = {
    explicitArray: false,
    ignoreAttrs: true,
    trim: true
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async fetchData(): Promise<CongressInitiative[]> {
    try {
      console.log('Loading Congress data from local downloads...');

      const baseDownloadsDirEnv = process.env.CONGRESS_DOWNLOAD_DIR; // absolute or relative
      const baseDownloadsDir = baseDownloadsDirEnv
        ? path.resolve(baseDownloadsDirEnv)
        : path.resolve(__dirname, '../../laws/congress/scripts/downloads');

      const targetDir = await this.resolveLatestDownloadDir(baseDownloadsDir);
      console.log(`📁 Using downloads directory: ${targetDir}`);

      const xmlFiles = await this.findXmlFiles(targetDir);
      if (xmlFiles.length === 0) {
        throw new Error(`No XML files found under ${targetDir}`);
      }

      let allInitiatives: CongressInitiative[] = [];
      for (const file of xmlFiles) {
        try {
          const data = await fs.readFile(file, 'utf8');
          const initiatives = await this.parseXML(data);
          allInitiatives = allInitiatives.concat(initiatives);
          console.log(`📄 Parsed ${initiatives.length} initiatives from ${path.basename(file)}`);
        } catch (err) {
          console.warn(`⚠️  Could not parse ${file}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      console.log(`🎯 Total initiatives collected: ${allInitiatives.length}`);
      return allInitiatives;
    } catch (error) {
      console.error('Error fetching Congress data:', error);
      throw new Error(`Failed to fetch Congress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async resolveLatestDownloadDir(baseDir: string): Promise<string> {
    try {
      const stat = await fs.stat(baseDir);
      if (!stat.isDirectory()) {
        throw new Error(`${baseDir} is not a directory`);
      }
      // If env var points to a dated folder directly, just use it
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      // If baseDir contains .xml files directly, use baseDir
      const hasXmlHere = (await Promise.all(entries.filter(e => e.isFile()).map(e => e.name)))
        .some(name => name.toLowerCase().endsWith('.xml'));
      if (hasXmlHere) return baseDir;
      // Otherwise, select the most recently modified subdirectory
      const subdirs = entries.filter(e => e.isDirectory());
      if (subdirs.length === 0) return baseDir; // fallback
      const withTimes = await Promise.all(
        subdirs.map(async d => {
          const full = path.join(baseDir, d.name);
          const s = await fs.stat(full);
          return { dir: full, mtime: s.mtimeMs };
        })
      );
      withTimes.sort((a, b) => b.mtime - a.mtime);
      const first = withTimes[0];
      if (!first) {
        return baseDir;
      }
      return first.dir;
    } catch (e) {
      console.warn('Could not resolve latest download dir, using base:', baseDir, e);
      return baseDir;
    }
  }

  private async findXmlFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (d: string) => {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
          out.push(full);
        }
      }
    };
    await walk(dir);
    return out;
  }

  private extractXMLFromHTML(htmlData: string): string | null {
    try {
      // Look for XML content embedded in HTML
      const xmlMatch = htmlData.match(/<xml[^>]*>([\s\S]*?)<\/xml>/i);
      if (xmlMatch && xmlMatch[1]) {
        return xmlMatch[1];
      }
      
      // Look for XML-like content in script tags
      const scriptMatch = htmlData.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatch) {
        for (const script of scriptMatch) {
          const xmlContent = script.match(/<results>([\s\S]*?)<\/results>/i);
          if (xmlContent && xmlContent[1]) {
            return `<results>${xmlContent[1]}</results>`;
          }
        }
      }
      
      // Look for data attributes or hidden fields
      const dataMatch = htmlData.match(/data-xml="([^"]*)"|value="([^"]*<results>[\s\S]*?<\/results>[^"]*)"/i);
      if (dataMatch) {
        const xmlContent = dataMatch[1] || dataMatch[2];
        if (xmlContent) {
          return xmlContent.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }
      }
      
      console.log('Could not extract XML from HTML response');
      return null;
    } catch (error) {
      console.error('Error extracting XML from HTML:', error);
      return null;
    }
  }

  async parseXML(xmlData: string): Promise<CongressInitiative[]> {
    try {
      console.log('Parsing XML data...');
      
      const parser = new xml2js.Parser(this.XML_PARSER_OPTIONS);
      const result = await parser.parseStringPromise(xmlData) as CongressResults;
      
      if (!result.results || !result.results.result) {
        throw new Error('Invalid XML structure: missing results or result elements');
      }

      const initiatives = Array.isArray(result.results.result) 
        ? result.results.result 
        : [result.results.result];

      console.log(`Successfully parsed ${initiatives.length} initiatives`);
      return initiatives;
    } catch (error) {
      console.error('Error parsing XML:', error);
      throw new Error(`Failed to parse XML data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  mapToLaw(initiative: CongressInitiative): Partial<Law> {
    // Map Congress initiative fields to our Law structure
    const law: Partial<Law> = {
      title: initiative.OBJETO || 'Sin título',
      slug: this.generateSlug(initiative.OBJETO, initiative.NUMEXPEDIENTE),
      description: initiative.OBJETO,
      summary: this.generateSummary(initiative.OBJETO),
      stage: this.mapStage(initiative.SITUACIONACTUAL),
      type: this.mapType(initiative.TIPO),
      proposer: initiative.AUTOR || 'Desconocido',
      proposerParty: this.extractParty(initiative.AUTOR),
      introductionDate: this.parseDate(initiative.FECHAPRESENTACION) || new Date(),
      lastUpdated: this.parseDate(initiative.FECHACALIFICACION) || new Date(),
      congressExpediente: initiative.NUMEXPEDIENTE,
      isActive: true
    };

    return law;
  }

  private generateSlug(title: string, expediente: string): string {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const cleanExpediente = expediente.replace(/[^a-zA-Z0-9]/g, '');
    
    return `${cleanTitle}-${cleanExpediente}`;
  }

  private generateSummary(description: string): string {
    if (!description) return 'Sin descripción disponible';
    
    // Clean up the description and create a summary
    const cleanDescription = description
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanDescription.length > 200 
      ? cleanDescription.substring(0, 200) + '...'
      : cleanDescription;
  }

  private mapStage(situacionActual: string): LawStage {
    const situation = situacionActual.toLowerCase();
    
    if (situation.includes('pleno') && situation.includes('toma en consideración')) {
      return 'debating';
    } else if (situation.includes('comisión')) {
      return 'debating';
    } else if (situation.includes('votación') || situation.includes('voto')) {
      return 'voting';
    } else if (situation.includes('aprobado') || situation.includes('aprobada')) {
      return 'passed';
    } else if (situation.includes('rechazado') || situation.includes('rechazada')) {
      return 'rejected';
    } else if (situation.includes('retirado') || situation.includes('retirada')) {
      return 'withdrawn';
    } else {
      return 'proposed';
    }
  }

  private classifyAndPersistStage(initiative: CongressInitiative, lawIdOrExpediente: string): void {
    try {
      const classification = classifyCongressInitiative(initiative);
      // Best-effort async persist to congress_initiatives canonical fields if available
      // Note: this service primarily writes to 'laws'; canonical fields are persisted in the Congress pipeline
      // We keep this here as a hook for when we have the congress_initiatives row id
      void this.supabase
        .from('congress_initiatives')
        .update({
          stage: classification.stage,
          current_step: classification.step,
          stage_reason: classification.reason
        })
        .or(`num_expediente.eq.${initiative.NUMEXPEDIENTE}`);
    } catch (e) {
      console.warn('Stage classification failed:', e);
    }
  }

  private mapType(tipo: string): LawType {
    const type = tipo.toLowerCase();
    
    if (type.includes('proposición de ley')) {
      return 'bill';
    } else if (type.includes('enmienda')) {
      return 'amendment';
    } else if (type.includes('resolución')) {
      return 'resolution';
    } else if (type.includes('moción')) {
      return 'motion';
    } else {
      return 'bill'; // Default to bill
    }
  }

  private extractParty(autor: string): string {
    if (!autor) return 'Desconocido';
    
          // Extract party from author field
      const partyMatch = autor.match(/\(([^)]+)\)/);
      if (partyMatch && partyMatch[1]) {
        return partyMatch[1];
      }
    
    // Common party abbreviations
    const partyMap: Record<string, string> = {
      'PSOE': 'Partido Socialista Obrero Español',
      'PP': 'Partido Popular',
      'Vox': 'Vox',
      'UP': 'Unidas Podemos',
      'ERC': 'Esquerra Republicana de Catalunya',
      'JxCat': 'Junts per Catalunya',
      'PNV': 'Partido Nacionalista Vasco',
      'EAJ-PNV': 'Partido Nacionalista Vasco',
      'EH Bildu': 'Euskal Herria Bildu',
      'CC': 'Coalición Canaria',
      'Cs': 'Ciudadanos'
    };
    
    for (const [abbrev, fullName] of Object.entries(partyMap)) {
      if (autor.includes(abbrev)) {
        return fullName;
      }
    }
    
    return autor;
  }

  private parseDate(dateString: string): Date | null {
    if (!dateString) return null;
    
    try {
      // Parse Spanish date format DD/MM/YYYY
      const [day, month, year] = dateString.split('/').map(Number);
      if (day && month && year) {
        return new Date(year, month - 1, day);
      }
    } catch (error) {
      console.warn(`Failed to parse date: ${dateString}`);
    }
    
    return null;
  }

  async updateDatabase(initiatives: CongressInitiative[]): Promise<void> {
    console.log(`Starting database update for ${initiatives.length} initiatives...`);
    
    for (const initiative of initiatives) {
      try {
        const lawData = this.mapToLaw(initiative);
        
        // Check if law already exists by expediente number
        if (!lawData.congressExpediente) {
          console.warn(`Skipping law without expediente: ${lawData.title}`);
          continue;
        }
        
        const { data: existingLaw } = await this.supabase
          .from('laws')
          .select('id')
          .eq('congress_expediente', lawData.congressExpediente)
          .single();

        if (existingLaw) {
          // Update existing law
          await this.supabase
            .from('laws')
            .update({
              ...lawData,
              updatedAt: new Date().toISOString()
            })
            .eq('id', existingLaw.id);
          
          console.log(`Updated law: ${lawData.title}`);
        } else {
          // Insert new law
          const { data: newLaw, error } = await this.supabase
            .from('laws')
            .insert([lawData])
            .select()
            .single();

          if (error) {
            console.error(`Error inserting law: ${error.message}`);
          } else {
            console.log(`Inserted new law: ${lawData.title}`);
          }
        }
      } catch (error) {
        console.error(`Error processing initiative ${initiative.NUMEXPEDIENTE}:`, error);
      }
    }
    
    console.log('Database update completed');
  }

  async processCongressData(): Promise<CongressUpdateResult> {
    const startTime = Date.now();
    const result: CongressUpdateResult = {
      totalProcessed: 0,
      newLaws: 0,
      updatedLaws: 0,
      errors: [],
      processingTime: 0
    };

    try {
      const initiatives = await this.fetchData();
      result.totalProcessed = initiatives.length;
      
      await this.updateDatabase(initiatives);
      
      result.processingTime = Date.now() - startTime;
      console.log(`Congress data processing completed in ${result.processingTime}ms`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      console.error('Congress data processing failed:', errorMessage);
    }

    return result;
  }
} 