const xml2js = require('xml2js');
const natural = require('natural');
const fs = require('fs-extra');
const path = require('path');

/**
 * Procesador de archivos XML del Congreso de los Diputados
 * Extrae iniciativas parlamentarias y genera relaciones entre ellas
 */
class CongressXMLProcessor {
  constructor() {
    this.initiatives = new Map(); // Mapa de expedientes -> iniciativa
    this.similarityThreshold = 0.6; // Umbral de similitud (60%)
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true
    });
  }

  /**
   * Procesa todos los archivos XML de una carpeta de descargas
   * @param {string} downloadsPath - Ruta a la carpeta de descargas
   * @returns {Promise<Array>} Array de iniciativas procesadas
   */
  async processDownloadsFolder(downloadsPath) {
    console.log('🔍 Procesando carpeta de descargas:', downloadsPath);
    
    try {
      const dateFolders = await fs.readdir(downloadsPath);
      
      for (const dateFolder of dateFolders) {
        const datePath = path.join(downloadsPath, dateFolder);
        const stats = await fs.stat(datePath);
        
        if (stats.isDirectory()) {
          console.log(`📅 Procesando carpeta de fecha: ${dateFolder}`);
          await this.processDateFolder(datePath);
        }
      }
      
      // Generar relaciones y similitudes
      await this.generateRelationships();
      await this.generateSimilarities();
      
      // Convertir a array y devolver
      const result = Array.from(this.initiatives.values());
      console.log(`✅ Procesamiento completado. ${result.length} iniciativas encontradas.`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error procesando carpeta de descargas:', error);
      throw error;
    }
  }

  /**
   * Procesa todos los archivos XML de una carpeta de fecha específica
   * @param {string} datePath - Ruta a la carpeta de fecha
   */
  async processDateFolder(datePath) {
    try {
      const files = await fs.readdir(datePath);
      const xmlFiles = files.filter(file => file.endsWith('.xml'));
      
      for (const xmlFile of xmlFiles) {
        const filePath = path.join(datePath, xmlFile);
        console.log(`📄 Procesando archivo: ${xmlFile}`);
        await this.processXMLFile(filePath);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando carpeta de fecha ${datePath}:`, error);
    }
  }

  /**
   * Procesa un archivo XML individual
   * @param {string} filePath - Ruta al archivo XML
   */
  async processXMLFile(filePath) {
    try {
      const xmlContent = await fs.readFile(filePath, 'utf-8');
      const result = await this.parser.parseStringPromise(xmlContent);
      
      if (result.results && result.results.result) {
        const initiatives = Array.isArray(result.results.result) 
          ? result.results.result 
          : [result.results.result];
        
        for (const initiative of initiatives) {
          await this.processInitiative(initiative);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error procesando archivo ${filePath}:`, error);
    }
  }

  /**
   * Procesa una iniciativa individual y la añade al mapa
   * @param {Object} initiative - Objeto de iniciativa del XML
   */
  async processInitiative(initiative) {
    try {
      // Extraer campos básicos
      const expediente = initiative.NUMEXPEDIENTE || initiative.NUMERO_LEY;
      
      if (!expediente) {
        console.warn('⚠️ Iniciativa sin expediente, saltando...');
        return;
      }

      // Crear objeto de iniciativa normalizado
      const normalizedInitiative = {
        numExpediente: expediente,
        tipo: initiative.TIPO || 'Desconocido',
        objeto: initiative.OBJETO || initiative.TITULO_LEY || '',
        autor: initiative.AUTOR || 'Desconocido',
        fechaPresentacion: initiative.FECHAPRESENTACION || initiative.FECHA_LEY || '',
        fechaCalificacion: initiative.FECHACALIFICACION || '',
        iniciativasRelacionadas: this.parseRelatedInitiatives(initiative.INICIATIVASRELACIONADAS),
        iniciativasDeOrigen: this.parseRelatedInitiatives(initiative.INICIATIVASDEORIGEN),
        tramitacion: initiative.TRAMITACIONSEGUIDA || '',
        // Campos adicionales útiles
        legislatura: initiative.LEGISLATURA || '',
        supertipo: initiative.SUPERTIPO || '',
        agrupacion: initiative.AGRUPACION || '',
        tipotramitacion: initiative.TIPOTRAMITACION || '',
        resultadoTramitacion: initiative.RESULTADOTRAMITACION || '',
        situacionActual: initiative.SITUACIONACTUAL || '',
        comisionCompetente: initiative.COMISIONCOMPETENTE || '',
        plazos: initiative.PLAZOS || '',
        ponentes: initiative.PONENTES || '',
        enlacesBOCG: initiative.ENLACESBOCG || '',
        enlacesDS: initiative.ENLACESDS || '',
        // Campos para relaciones y timeline (se generarán después)
        timeline: [],
        relacionesDirectas: [],
        similares: []
      };

      // Generar timeline desde la tramitación
      normalizedInitiative.timeline = this.generateTimeline(initiative.TRAMITACIONSEGUIDA);
      
      // Añadir al mapa
      this.initiatives.set(expediente, normalizedInitiative);
      
    } catch (error) {
      console.error('❌ Error procesando iniciativa:', error);
    }
  }

  /**
   * Parsea las iniciativas relacionadas desde el string del XML
   * @param {string} relatedString - String con iniciativas relacionadas
   * @returns {Array} Array de expedientes relacionados
   */
  parseRelatedInitiatives(relatedString) {
    if (!relatedString || typeof relatedString !== 'string') {
      return [];
    }
    
    // Separar por espacios, comas o saltos de línea y limpiar
    return relatedString
      .split(/[\s,\n]+/)
      .map(exp => exp.trim())
      .filter(exp => exp && exp.length > 0);
  }

  /**
   * Genera un timeline de eventos desde el campo TRAMITACIONSEGUIDA
   * @param {string} tramitacion - String con la tramitación seguida
   * @returns {Array} Array de eventos con fecha
   */
  generateTimeline(tramitacion) {
    if (!tramitacion || typeof tramitacion !== 'string') {
      return [];
    }

    const timeline = [];
    const lines = tramitacion.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentEvent = '';
    
    for (const line of lines) {
      // Buscar patrones de fecha "desde X hasta Y"
      const datePattern = /desde\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+hasta\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
      const singleDatePattern = /desde\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
      
      if (datePattern.test(line)) {
        const match = line.match(datePattern);
        timeline.push({
          evento: currentEvent || 'Tramitación',
          fechaInicio: match[1],
          fechaFin: match[2],
          descripcion: line
        });
      } else if (singleDatePattern.test(line)) {
        const match = line.match(singleDatePattern);
        timeline.push({
          evento: currentEvent || 'Tramitación',
          fechaInicio: match[1],
          fechaFin: null,
          descripcion: line
        });
      } else if (line && !line.includes('desde') && !line.includes('hasta')) {
        // Es el nombre del evento/fase
        currentEvent = line;
      }
    }
    
    return timeline;
  }

  /**
   * Genera las relaciones directas entre iniciativas
   */
  async generateRelationships() {
    console.log('🔗 Generando relaciones directas...');
    
    for (const [expediente, iniciativa] of this.initiatives) {
      const relacionesDirectas = [];
      
      // Añadir iniciativas relacionadas
      for (const relacionada of iniciativa.iniciativasRelacionadas) {
        if (this.initiatives.has(relacionada)) {
          relacionesDirectas.push({
            expediente: relacionada,
            tipo: 'relacionada',
            iniciativa: this.initiatives.get(relacionada)
          });
        }
      }
      
      // Añadir iniciativas de origen
      for (const origen of iniciativa.iniciativasDeOrigen) {
        if (this.initiatives.has(origen)) {
          relacionesDirectas.push({
            expediente: origen,
            tipo: 'origen',
            iniciativa: this.initiatives.get(origen)
          });
        }
      }
      
      iniciativa.relacionesDirectas = relacionesDirectas;
    }
  }

  /**
   * Genera relaciones de similitud basadas en el campo OBJETO
   */
  async generateSimilarities() {
    console.log('🔍 Generando relaciones de similitud...');
    
    const expedientes = Array.from(this.initiatives.keys());
    
    for (let i = 0; i < expedientes.length; i++) {
      const expediente1 = expedientes[i];
      const iniciativa1 = this.initiatives.get(expediente1);
      
      if (!iniciativa1.objeto) continue;
      
      const similares = [];
      
      for (let j = i + 1; j < expedientes.length; j++) {
        const expediente2 = expedientes[j];
        const iniciativa2 = this.initiatives.get(expediente2);
        
        if (!iniciativa2.objeto) continue;
        
        // Calcular similitud usando distancia de Levenshtein normalizada
        const similarity = this.calculateSimilarity(iniciativa1.objeto, iniciativa2.objeto);
        
        if (similarity >= this.similarityThreshold) {
          similares.push({
            expediente: expediente2,
            similitud: similarity,
            iniciativa: {
              numExpediente: iniciativa2.numExpediente,
              tipo: iniciativa2.tipo,
              objeto: iniciativa2.objeto
            }
          });
        }
      }
      
      // Ordenar por similitud descendente
      iniciativa1.similares = similares.sort((a, b) => b.similitud - a.similitud);
    }
  }

  /**
   * Calcula la similitud entre dos textos usando distancia de Levenshtein
   * @param {string} text1 - Primer texto
   * @param {string} text2 - Segundo texto
   * @returns {number} Valor de similitud entre 0 y 1
   */
  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Normalizar textos
    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();
    
    if (normalized1 === normalized2) return 1.0;
    
    // Calcular distancia de Levenshtein
    const distance = natural.LevenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    // Convertir a similitud (1 - distancia normalizada)
    return 1 - (distance / maxLength);
  }

  /**
   * Exporta las iniciativas procesadas a JSON
   * @param {string} outputPath - Ruta del archivo de salida
   */
  async exportToJSON(outputPath) {
    try {
      const data = Array.from(this.initiatives.values()).map(initiative => {
        // Crear una copia limpia sin referencias circulares
        const cleanInitiative = { ...initiative };
        
        // Limpiar relaciones directas para evitar referencias circulares
        cleanInitiative.relacionesDirectas = initiative.relacionesDirectas.map(rel => ({
          expediente: rel.expediente,
          tipo: rel.tipo,
          // Solo incluir información básica de la iniciativa relacionada
          iniciativa: {
            numExpediente: rel.iniciativa.numExpediente,
            tipo: rel.iniciativa.tipo,
            objeto: rel.iniciativa.objeto,
            autor: rel.iniciativa.autor,
            fechaPresentacion: rel.iniciativa.fechaPresentacion
          }
        }));
        
        // Limpiar iniciativas similares para evitar referencias circulares
        cleanInitiative.similares = initiative.similares.map(sim => ({
          expediente: sim.expediente,
          similitud: sim.similitud,
          // Solo incluir información básica de la iniciativa similar
          iniciativa: {
            numExpediente: sim.iniciativa.numExpediente,
            tipo: sim.iniciativa.tipo,
            objeto: sim.iniciativa.objeto
          }
        }));
        
        return cleanInitiative;
      });
      
      await fs.writeJson(outputPath, data, { spaces: 2 });
      console.log(`💾 Datos exportados a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando a JSON:', error);
      throw error;
    }
  }

  /**
   * Exporta solo los datos básicos de las iniciativas (sin relaciones)
   * @param {string} outputPath - Ruta del archivo de salida
   */
  async exportBasicData(outputPath) {
    try {
      const basicData = Array.from(this.initiatives.values()).map(initiative => ({
        numExpediente: initiative.numExpediente,
        tipo: initiative.tipo,
        objeto: initiative.objeto,
        autor: initiative.autor,
        fechaPresentacion: initiative.fechaPresentacion,
        fechaCalificacion: initiative.fechaCalificacion,
        legislatura: initiative.legislatura,
        situacionActual: initiative.situacionActual,
        comisionCompetente: initiative.comisionCompetente,
        timeline: initiative.timeline,
        // Contadores de relaciones (sin los objetos completos)
        totalRelacionesDirectas: initiative.relacionesDirectas.length,
        totalSimilares: initiative.similares.length
      }));
      
      await fs.writeJson(outputPath, basicData, { spaces: 2 });
      console.log(`💾 Datos básicos exportados a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando datos básicos:', error);
      throw error;
    }
  }

  /**
   * Exporta solo las relaciones entre iniciativas
   * @param {string} outputPath - Ruta del archivo de salida
   */
  async exportRelationships(outputPath) {
    try {
      const relationships = [];
      
      for (const [expediente, iniciativa] of this.initiatives) {
        // Relaciones directas
        iniciativa.relacionesDirectas.forEach(rel => {
          relationships.push({
            source: expediente,
            target: rel.expediente,
            type: rel.tipo,
            relationshipType: 'directa'
          });
        });
        
        // Relaciones de similitud
        iniciativa.similares.forEach(sim => {
          relationships.push({
            source: expediente,
            target: sim.expediente,
            type: 'similar',
            relationshipType: 'similitud',
            similarity: sim.similitud
          });
        });
      }
      
      await fs.writeJson(outputPath, relationships, { spaces: 2 });
      console.log(`💾 Relaciones exportadas a: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exportando relaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del procesamiento
   * @returns {Object} Estadísticas del procesamiento
   */
  getStats() {
    const total = this.initiatives.size;
    const conRelaciones = Array.from(this.initiatives.values())
      .filter(i => i.relacionesDirectas.length > 0).length;
    const conSimilares = Array.from(this.initiatives.values())
      .filter(i => i.similares.length > 0).length;
    
    return {
      totalIniciativas: total,
      conRelacionesDirectas: conRelaciones,
      conSimilares: conSimilares,
      porcentajeRelaciones: total > 0 ? ((conRelaciones / total) * 100).toFixed(2) : 0,
      porcentajeSimilares: total > 0 ? ((conSimilares / total) * 100).toFixed(2) : 0
    };
  }
}

module.exports = CongressXMLProcessor; 