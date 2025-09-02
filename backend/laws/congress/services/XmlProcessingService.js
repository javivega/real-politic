/**
 * Servicio de Procesamiento XML
 * 
 * Maneja la lectura, parsing y extracción de iniciativas
 * desde archivos XML del Congreso de los Diputados
 */

const xml2js = require('xml2js');
const fs = require('fs-extra');
const path = require('path');
const Initiative = require('../models/Initiative');

class XmlProcessingService {
    constructor(config = {}) {
        this.config = {
            similarityThreshold: config.similarityThreshold || 0.6,
            maxFileSize: config.maxFileSize || 100, // MB
            maxConcurrentFiles: config.maxConcurrentFiles || 5,
            ...config
        };

        this.parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            normalize: true,
            trim: true
        });

        this.initiatives = new Map(); // expediente -> Initiative
        this.processedFiles = new Set();
        this.errors = [];
    }

    /**
     * Procesa todos los archivos XML de una carpeta de descargas
     * @param {string} downloadsPath - Ruta a la carpeta de descargas
     * @returns {Promise<Array>} Array de iniciativas procesadas
     */
    async processDownloadsFolder(downloadsPath) {
        console.log('🔍 Procesando carpeta de descargas:', downloadsPath);
        
        try {
            if (!await fs.pathExists(downloadsPath)) {
                throw new Error(`La carpeta de descargas no existe: ${downloadsPath}`);
            }

            const items = await fs.readdir(downloadsPath);
            console.log(`📁 Encontrados ${items.length} elementos en la carpeta de descargas`);
            
            // Verificar si hay archivos XML directamente o carpetas de fecha
            const xmlFiles = items.filter(item => item.endsWith('.xml'));
            const dateFolders = items.filter(async (item) => {
                const itemPath = path.join(downloadsPath, item);
                const stats = await fs.stat(itemPath);
                return stats.isDirectory();
            });
            
            if (xmlFiles.length > 0) {
                // Hay archivos XML directamente en la carpeta
                console.log(`📄 Procesando ${xmlFiles.length} archivos XML directamente`);
                for (const xmlFile of xmlFiles) {
                    const filePath = path.join(downloadsPath, xmlFile);
                    await this.processXMLFile(filePath);
                }
            } else if (dateFolders.length > 0) {
                // Hay carpetas de fecha
                console.log(`📅 Encontradas ${dateFolders.length} carpetas de fecha`);
                for (const dateFolder of dateFolders) {
                    const datePath = path.join(downloadsPath, dateFolder);
                    const stats = await fs.stat(datePath);
                    
                    if (stats.isDirectory()) {
                        console.log(`📅 Procesando carpeta de fecha: ${dateFolder}`);
                        await this.processDateFolder(datePath);
                    }
                }
            } else {
                console.log('⚠️  No se encontraron archivos XML ni carpetas de fecha');
            }
            
            console.log(`✅ Procesamiento XML completado. ${this.initiatives.size} iniciativas extraídas.`);
            
            // Convertir a array y devolver
            const result = Array.from(this.initiatives.values());
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
            
            console.log(`📄 Encontrados ${xmlFiles.length} archivos XML en ${path.basename(datePath)}`);
            
            for (const xmlFile of xmlFiles) {
                const filePath = path.join(datePath, xmlFile);
                await this.processXMLFile(filePath);
            }
            
        } catch (error) {
            console.error(`❌ Error procesando carpeta de fecha ${datePath}:`, error);
            this.errors.push({
                type: 'dateFolder',
                path: datePath,
                error: error.message
            });
        }
    }

    /**
     * Procesa un archivo XML individual
     * @param {string} filePath - Ruta al archivo XML
     */
    async processXMLFile(filePath) {
        try {
            // Verificar si ya fue procesado
            if (this.processedFiles.has(filePath)) {
                console.log(`⏭️  Archivo ya procesado: ${path.basename(filePath)}`);
                return;
            }

            // Verificar tamaño del archivo
            const stats = await fs.stat(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB > this.config.maxFileSize) {
                console.warn(`⚠️  Archivo muy grande (${fileSizeMB.toFixed(2)}MB): ${path.basename(filePath)}`);
                return;
            }

            console.log(`📄 Procesando archivo: ${path.basename(filePath)}`);
            
            const xmlContent = await fs.readFile(filePath, 'utf-8');
            const result = await this.parser.parseStringPromise(xmlContent);
            
            // Extraer iniciativas según la estructura del XML
            const initiatives = this.extractInitiatives(result);
            
            for (const initiative of initiatives) {
                await this.processInitiative(initiative);
            }
            
            // Marcar como procesado
            this.processedFiles.add(filePath);
            
        } catch (error) {
            console.error(`❌ Error procesando archivo ${filePath}:`, error);
            this.errors.push({
                type: 'xmlFile',
                path: filePath,
                error: error.message
            });
        }
    }

    /**
     * Extrae iniciativas del XML parseado según diferentes estructuras posibles
     * @param {Object} parsedXml - XML parseado
     * @returns {Array} Array de iniciativas extraídas
     */
    extractInitiatives(parsedXml) {
        const initiatives = [];
        
        // Buscar en diferentes estructuras posibles del XML
        const possiblePaths = [
            'results.result',
            'iniciativas.iniciativa',
            'proyectos.proyecto',
            'proposiciones.proposicion',
            'iniciativaslegislativas.iniciativalegislativa',
            'documentos.documento',
            'leyes.ley',
            'enmiendas.enmienda'
        ];

        for (const path of possiblePaths) {
            const pathParts = path.split('.');
            let current = parsedXml;
            
            for (const part of pathParts) {
                if (current && current[part]) {
                    current = current[part];
                } else {
                    current = null;
                    break;
                }
            }
            
            if (current && Array.isArray(current)) {
                initiatives.push(...current);
                break;
            } else if (current && typeof current === 'object') {
                initiatives.push(current);
                break;
            }
        }

        return initiatives;
    }

    /**
     * Procesa una iniciativa individual y la añade al mapa
     * @param {Object} initiative - Objeto de iniciativa del XML
     */
    async processInitiative(initiative) {
        try {
            // Crear instancia del modelo Initiative
            const initiativeModel = Initiative.fromXML(initiative);
            
            // Validar la iniciativa
            if (!initiativeModel.isValid()) {
                console.warn('⚠️ Iniciativa inválida, saltando...', initiativeModel.numExpediente);
                return;
            }

            // Verificar si ya existe
            if (this.initiatives.has(initiativeModel.numExpediente)) {
                console.warn(`⚠️ Iniciativa duplicada: ${initiativeModel.numExpediente}`);
                // Actualizar la existente con nuevos datos
                const existing = this.initiatives.get(initiativeModel.numExpediente);
                existing.update(initiativeModel.toObject());
                return;
            }

            // Parsear iniciativas relacionadas
            initiativeModel.iniciativasRelacionadas = this.parseRelatedInitiatives(
                initiativeModel.iniciativasRelacionadas
            );
            
            initiativeModel.iniciativasDeOrigen = this.parseRelatedInitiatives(
                initiativeModel.iniciativasDeOrigen
            );

            // Generar timeline desde la tramitación
            initiativeModel.timeline = this.generateTimeline(initiativeModel.tramitacion);
            
            // Añadir al mapa
            this.initiatives.set(initiativeModel.numExpediente, initiativeModel);
            
        } catch (error) {
            console.error('❌ Error procesando iniciativa:', error);
            this.errors.push({
                type: 'initiative',
                data: initiative,
                error: error.message
            });
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
     * Obtiene todas las iniciativas procesadas
     * @returns {Map} Mapa de expedientes -> Initiative
     */
    getInitiatives() {
        return this.initiatives;
    }

    /**
     * Obtiene una iniciativa específica por expediente
     * @param {string} expediente - Número de expediente
     * @returns {Initiative|null} Iniciativa o null si no existe
     */
    getInitiative(expediente) {
        return this.initiatives.get(expediente) || null;
    }

    /**
     * Obtiene estadísticas del procesamiento
     * @returns {Object} Estadísticas del procesamiento
     */
    getStats() {
        const total = this.initiatives.size;
        const valid = Array.from(this.initiatives.values())
            .filter(i => i.isValid()).length;
        const withDates = Array.from(this.initiatives.values())
            .filter(i => i.hasValidDates()).length;
        const withTimeline = Array.from(this.initiatives.values())
            .filter(i => i.timeline.length > 0).length;
        
        return {
            totalIniciativas: total,
            iniciativasValidas: valid,
            conFechasValidas: withDates,
            conTimeline: withTimeline,
            archivosProcesados: this.processedFiles.size,
            errores: this.errors.length,
            porcentajeValidas: total > 0 ? ((valid / total) * 100).toFixed(2) : 0
        };
    }

    /**
     * Obtiene errores del procesamiento
     * @returns {Array} Array de errores
     */
    getErrors() {
        return this.errors;
    }

    /**
     * Limpia el estado del servicio
     */
    clear() {
        this.initiatives.clear();
        this.processedFiles.clear();
        this.errors = [];
    }

    /**
     * Exporta las iniciativas a un formato específico
     * @param {string} format - Formato de exportación ('raw', 'basic', 'full')
     * @returns {Array} Array de iniciativas en el formato especificado
     */
    export(format = 'raw') {
        const initiatives = Array.from(this.initiatives.values());
        
        switch (format) {
            case 'basic':
                return initiatives.map(i => i.getBasicData());
            case 'full':
                return initiatives.map(i => i.getFullData());
            case 'summary':
                return initiatives.map(i => i.getSummary());
            case 'graph':
                return {
                    nodes: initiatives.map(i => i.getGraphNode()),
                    edges: initiatives.flatMap(i => i.getGraphEdges())
                };
            default:
                return initiatives.map(i => i.toObject());
        }
    }
}

module.exports = XmlProcessingService; 