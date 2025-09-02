/**
 * Servicio Principal de Procesamiento del Congreso
 * 
 * Coordina todos los servicios para procesar archivos XML
 * del Congreso de los Diputados
 */

const XmlProcessingService = require('./XmlProcessingService');
const Initiative = require('../models/Initiative');
const RelationshipService = require('./RelationshipService');
const ExportService = require('./ExportService');
const SupabaseService = require('./SupabaseService');
const LegislativeFlowService = require('./LegislativeFlowService');
const SpanishLegalNLPService = require('./SpanishLegalNLPService');
const SenateCrossRefService = require('./SenateCrossRefService');
const SenateOpenDataService = require('./SenateOpenDataService');
const supabaseConfig = require('../config/supabase');
const path = require('path');
const fs = require('fs-extra'); // Added for fs-extra

class CongressProcessingService {
    constructor(config = {}) {
        this.initiatives = [];
        this.relationships = [];
        this.timelineEvents = [];
        this.keywords = [];
        this.processingStats = {};
        
        // Processing configuration
        this.config = {
            similarityThreshold: config.similarityThreshold || 0.6,
            maxFileSize: config.maxFileSize || 100,
            maxConcurrentFiles: config.maxConcurrentFiles || 5,
            outputDirectory: config.outputDirectory || './output',
            enableNLP: true,
            enableRelationships: true,
            enableTimeline: true,
            enableKeywords: true,
            ...config
        };
        
        // Initialize services with proper configuration
        this.xmlService = new XmlProcessingService({
            similarityThreshold: this.config.similarityThreshold,
            maxFileSize: this.config.maxFileSize,
            maxConcurrentFiles: this.config.maxConcurrentFiles
        });
        
        this.relationshipService = new RelationshipService({
            similarityThreshold: this.config.similarityThreshold,
            jaroWinklerWeight: 0.7,
            levenshteinWeight: 0.3,
            cacheSize: 10000
        });
        
        this.exportService = new ExportService({
            outputDirectory: this.config.outputDirectory,
            jsonSpaces: 2,
            jsonEncoding: 'utf8'
        });
        
        this.supabaseService = new SupabaseService();
        this.legislativeFlowService = new LegislativeFlowService();
        this.nlpService = new SpanishLegalNLPService();
        this.senateCrossRefService = new SenateCrossRefService();
        this.senateOpenDataService = new SenateOpenDataService();
    }

    /**
     * Determina si se debe inicializar Supabase
     * @returns {boolean} true si se debe inicializar
     */
    shouldInitializeSupabase() {
        const hasConfig = supabaseConfig.supabase.url && supabaseConfig.supabase.anonKey;
        const hasValidUrl = hasConfig && !supabaseConfig.supabase.url.includes('your-project-id');
        const hasValidKey = hasConfig && !supabaseConfig.supabase.anonKey.includes('your-anon-key');
        
        return hasValidUrl && hasValidKey;
    }

    /**
     * Procesa archivos XML del Congreso de los Diputados
     * @param {string} downloadsPath - Ruta a la carpeta de descargas
     * @param {Object} options - Opciones de procesamiento
     * @returns {Promise<Array>} Array de iniciativas procesadas
     */
    async processCongressData(downloadsPath, options = {}) {
        console.log('🏛️  INICIANDO PROCESAMIENTO DEL CONGRESO DE LOS DIPUTADOS');
        console.log('==========================================================');
        
        const startTime = Date.now();
        
        try {
            // 1. Procesar archivos XML
            console.log('\n📊 PASO 1: Procesamiento de archivos XML');
            console.log('==========================================');
            
            // Step 2: Process XML files and extract initiatives
            console.log('📋 Processing XML files...');
            this.initiatives = await this.xmlService.processDownloadsFolder(downloadsPath);
            
            if (this.initiatives.length === 0) {
                throw new Error('No initiatives extracted from XML files');
            }
            
            console.log(`✅ Extracted ${this.initiatives.length} initiatives from XML`);
            
            // Step 2.5: Process titles with NLP to make them accessible
            if (this.config.enableNLP) {
                console.log('🧠 Processing titles with NLP for accessibility...');
                const processedInitiatives = this.nlpService.processBatch(this.initiatives);
                
                // Update initiatives with processed titles
                this.initiatives = processedInitiatives.map(initiative => ({
                    ...initiative,
                    accessibleTitle: initiative.processedTitle?.accessible || initiative.objeto,
                    nlpMetadata: initiative.processedTitle?.metadata || {},
                    nlpExtracted: initiative.processedTitle?.extracted || {}
                }));
                
                console.log(`✅ Enhanced ${this.initiatives.length} initiatives with accessible titles`);
            // Step 2.6: Download latest Senate XML and cross-reference with Senate approved laws for BOE metadata
            console.log('📥 Downloading latest Senate approved laws XML (if configured)...');
            await this.senateOpenDataService.downloadLatest();
            console.log('🏛️ Cross-referencing with Senate approved laws...');
            this.initiatives = await this.senateCrossRefService.augmentWithSenateData(this.initiatives);
            console.log(`✅ Cross-referenced initiatives with Senate data`);
                
                // Log some examples
                const examples = this.initiatives.slice(0, 3);
                examples.forEach((initiative, i) => {
                    console.log(`   Example ${i + 1}:`);
                    console.log(`     Original: ${initiative.objeto.substring(0, 60)}...`);
                    console.log(`     Accessible: ${initiative.accessibleTitle}`);
                    console.log(`     Subject Area: ${initiative.nlpMetadata.subjectArea}`);
                    console.log(`     Urgency: ${initiative.nlpMetadata.urgency}`);
                });
            }
            
            // 2. Configurar servicio de relaciones
            console.log('\n🔗 PASO 2: Análisis de relaciones');
            console.log('===================================');
            
            this.relationshipService.setInitiatives(this.xmlService.getInitiatives());
            
            // 3. Analizar relaciones
            const relationshipStats = await this.relationshipService.analyzeAllRelationships();
            
            // 4. Generar estadísticas completas
            console.log('\n📈 PASO 3: Generación de estadísticas');
            console.log('=======================================');
            
            this.processingStats = this.generateCompleteStats(relationshipStats);
            
            // 5. Mostrar estadísticas
            this.displayStats();
            
            return this.initiatives;
            
        } catch (error) {
            console.error('❌ Error durante el procesamiento:', error.message);
            throw error;
        }
    }

    /**
     * Descarga los archivos XML más recientes del Congreso
     * @returns {Promise<Object>} Resultado de la descarga
     */
    async downloadLatestCongressFiles() {
        console.log('📥 DESCARGANDO ARCHIVOS XML DEL CONGRESO');
        console.log('========================================');
        
        try {
            // Importar el script de descarga dinámicamente
            const { downloadFullXML } = require('../scripts/update-congress.js');
            
            // Crear directorio de descargas si no existe
            const downloadsDir = path.join(__dirname, '..', 'scripts', 'downloads');
            if (!require('fs').existsSync(downloadsDir)) {
                require('fs').mkdirSync(downloadsDir, { recursive: true });
            }
            
            // Ejecutar la descarga
            await downloadFullXML();
            
            // Contar archivos descargados
            const fs = require('fs');
            const today = new Date();
            const day = String(today.getDate()).padStart(2, '0');
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const year = today.getFullYear();
            const dateFolder = `${day}${month}${year}`;
            
            const todayDownloadsDir = path.join(__dirname, '..', 'scripts', 'downloads', dateFolder);
            let fileCount = 0;
            
            if (fs.existsSync(todayDownloadsDir)) {
                const files = fs.readdirSync(todayDownloadsDir);
                fileCount = files.filter(file => file.endsWith('.xml')).length;
            }
            
            return {
                success: true,
                successfulDownloads: fileCount,
                message: `Descarga completada. ${fileCount} archivos XML encontrados.`,
                downloadsPath: todayDownloadsDir
            };
            
        } catch (error) {
            console.error('❌ Error durante la descarga:', error.message);
            return {
                success: false,
                successfulDownloads: 0,
                message: error.message
            };
        }
    }

    /**
     * Exporta todos los datos procesados
     * @param {string} outputDirectory - Directorio de salida (opcional)
     * @returns {Promise<Object>} Rutas de archivos exportados
     */
    async exportAllData(outputDirectory = null) {
        if (outputDirectory) {
            this.exportService.setOutputDirectory(outputDirectory);
        }

        console.log('\n📤 Exportando datos procesados...');
        
        try {
            const relationshipStats = this.relationshipService.getRelationshipStats();
            
            // Prepare initiatives with NLP enhancements for export
            const enhancedInitiatives = this.initiatives.map(initiative => ({
                ...initiative,
                // Include both original and accessible titles
                objeto: initiative.objeto,
                accessibleTitle: initiative.accessibleTitle || initiative.objeto,
                nlpMetadata: initiative.nlpMetadata || {},
                nlpExtracted: initiative.nlpExtracted || {}
            }));
            
            const exportResults = await this.exportService.exportAll(enhancedInitiatives, relationshipStats);
            
            // Also export a dedicated NLP-enhanced version
            if (this.config.enableNLP) {
                const nlpExportData = {
                    initiatives: enhancedInitiatives,
                    relationships: this.relationships,
                    timelineEvents: this.timelineEvents,
                    keywords: this.keywords,
                    processingStats: this.processingStats,
                    nlpStats: this.generateNLPStats()
                };
                
                await this.exportService.exportToJSON(nlpExportData, 'iniciativas-completas-con-nlp.json');
                console.log('✅ NLP-enhanced data exported separately');
            }
            
            console.log('✅ Exportación completada exitosamente');
            return exportResults;
        } catch (error) {
            console.error('❌ Error en la exportación:', error.message);
            throw error;
        }
    }

    /**
     * Genera estadísticas completas del procesamiento
     * @param {Object} relationshipStats - Estadísticas de relaciones
     * @returns {Object} Estadísticas completas
     */
    generateCompleteStats(relationshipStats) {
        const xmlStats = this.xmlService.getStats();
        const timelineStats = this.exportService.getTimelineStats(this.initiatives);
        
        return {
            procesamiento: {
                totalIniciativas: this.initiatives.length,
                iniciativasValidas: xmlStats.iniciativasValidas,
                archivosProcesados: xmlStats.archivosProcesados,
                errores: xmlStats.errores,
                porcentajeValidas: xmlStats.porcentajeValidas
            },
            relaciones: relationshipStats,
            timeline: timelineStats,
            distribucion: {
                porTipo: this.exportService.getTypeDistribution(this.initiatives),
                porAutor: this.exportService.getAuthorDistribution(this.initiatives)
            },
            exportacion: {
                directorio: this.exportService.getOutputDirectory(),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Genera estadísticas del procesamiento NLP
     * @returns {Object} Estadísticas NLP
     */
    generateNLPStats() {
        if (!this.config.enableNLP || this.initiatives.length === 0) {
            return null;
        }

        const stats = {
            totalProcessed: this.initiatives.length,
            bySubjectArea: {},
            byUrgency: {},
            byComplexity: {},
            byReadability: { high: 0, medium: 0, low: 0 },
            averageReadability: 0,
            titleImprovements: 0,
            examples: []
        };

        let totalReadability = 0;
        let improvedTitles = 0;

        this.initiatives.forEach(initiative => {
            if (initiative.nlpMetadata) {
                // Subject area distribution
                const area = initiative.nlpMetadata.subjectArea || 'general';
                stats.bySubjectArea[area] = (stats.bySubjectArea[area] || 0) + 1;

                // Urgency distribution
                const urgency = initiative.nlpMetadata.urgency || 'baja';
                stats.byUrgency[urgency] = (stats.byUrgency[urgency] || 0) + 1;

                // Complexity distribution
                const complexity = initiative.nlpMetadata.complexity || 'media';
                stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1;

                // Readability distribution
                const readability = initiative.nlpMetadata.estimatedReadability || 50;
                totalReadability += readability;
                
                if (readability >= 80) stats.byReadability.high++;
                else if (readability >= 50) stats.byReadability.medium++;
                else stats.byReadability.low++;

                // Count improved titles
                if (initiative.accessibleTitle && initiative.accessibleTitle !== initiative.objeto) {
                    improvedTitles++;
                }

                // Collect examples (first 5)
                if (stats.examples.length < 5) {
                    stats.examples.push({
                        expediente: initiative.numExpediente,
                        original: initiative.objeto.substring(0, 80) + '...',
                        accessible: initiative.accessibleTitle,
                        subjectArea: initiative.nlpMetadata.subjectArea,
                        urgency: initiative.nlpMetadata.urgency,
                        readability: initiative.nlpMetadata.estimatedReadability
                    });
                }
            }
        });

        stats.averageReadability = Math.round(totalReadability / this.initiatives.length);
        stats.titleImprovements = improvedTitles;
        stats.improvementPercentage = Math.round((improvedTitles / this.initiatives.length) * 100);

        return stats;
    }

    /**
     * Muestra estadísticas del procesamiento en consola
     */
    displayStats() {
        const stats = this.processingStats;
        
        console.log('\n📊 ESTADÍSTICAS DEL PROCESAMIENTO');
        console.log('=====================================');
        
        // Estadísticas de procesamiento
        console.log(`📋 Total de iniciativas: ${stats.procesamiento.totalIniciativas}`);
        console.log(`✅ Iniciativas válidas: ${stats.procesamiento.iniciativasValidas} (${stats.procesamiento.porcentajeValidas}%)`);
        console.log(`📄 Archivos procesados: ${stats.procesamiento.archivosProcesados}`);
        console.log(`❌ Errores: ${stats.procesamiento.errores}`);
        
        // Estadísticas de relaciones
        if (stats.relaciones) {
            console.log('\n🔗 RELACIONES:');
            console.log(`   • Relaciones directas: ${stats.relaciones.totalDirectRelations}`);
            console.log(`   • Similitudes: ${stats.relaciones.totalSimilarities}`);
            console.log(`   • Promedio relaciones directas: ${stats.relaciones.averageDirectRelations}`);
            console.log(`   • Promedio similitudes: ${stats.relaciones.averageSimilarities}`);
            console.log(`   • Score promedio similitud: ${stats.relaciones.averageSimilarityScore}`);
        }
        
        // Estadísticas de timeline
        if (stats.timeline) {
            console.log('\n📅 TIMELINE:');
            console.log(`   • Total eventos: ${stats.timeline.totalEventos}`);
            console.log(`   • Eventos con fecha: ${stats.timeline.eventosConFecha}`);
            console.log(`   • Eventos sin fecha: ${stats.timeline.eventosSinFecha}`);
        }
        
        // Distribución por tipo
        if (stats.distribucion && stats.distribucion.porTipo) {
            console.log('\n📈 DISTRIBUCIÓN POR TIPO:');
            Object.entries(stats.distribucion.porTipo).forEach(([tipo, cantidad]) => {
                console.log(`   • ${tipo}: ${cantidad}`);
            });
        }
        
        // Distribución por autor (top 5)
        if (stats.distribucion && stats.distribucion.porAutor) {
            console.log('\n👥 DISTRIBUCIÓN POR AUTOR (top 5):');
            const topAuthors = Object.entries(stats.distribucion.porAutor)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);
            
            topAuthors.forEach(([autor, cantidad]) => {
                console.log(`   • ${autor}: ${cantidad}`);
            });
        }
        
        // NLP Statistics
        if (this.config.enableNLP && this.initiatives.length > 0) {
            const nlpStats = this.generateNLPStats();
            if (nlpStats) {
                console.log('\n🧠 PROCESAMIENTO NLP:');
                console.log(`   • Total procesadas: ${nlpStats.totalProcessed}`);
                console.log(`   • Títulos mejorados: ${nlpStats.titleImprovements} (${nlpStats.improvementPercentage}%)`);
                console.log(`   • Legibilidad promedio: ${nlpStats.averageReadability}/100`);
                
                console.log('\n📊 ÁREAS TEMÁTICAS:');
                Object.entries(nlpStats.bySubjectArea).forEach(([area, cantidad]) => {
                    console.log(`   • ${area}: ${cantidad}`);
                });
                
                console.log('\n🚨 NIVELES DE URGENCIA:');
                Object.entries(nlpStats.byUrgency).forEach(([urgency, cantidad]) => {
                    console.log(`   • ${urgency}: ${cantidad}`);
                });
                
                console.log('\n📚 LEGIBILIDAD:');
                console.log(`   • Alta (80-100): ${nlpStats.byReadability.high}`);
                console.log(`   • Media (50-79): ${nlpStats.byReadability.medium}`);
                console.log(`   • Baja (0-49): ${nlpStats.byReadability.low}`);
                
                if (nlpStats.examples.length > 0) {
                    console.log('\n💡 EJEMPLOS DE TÍTULOS MEJORADOS:');
                    nlpStats.examples.forEach((example, i) => {
                        console.log(`   ${i + 1}. ${example.expediente}:`);
                        console.log(`      Original: ${example.original}`);
                        console.log(`      Accesible: ${example.accessible}`);
                        console.log(`      Área: ${example.subjectArea}, Urgencia: ${example.urgency}, Legibilidad: ${example.readability}/100`);
                    });
                }
            }
        }
    }

    /**
     * Obtiene iniciativas con más relaciones
     * @param {number} limit - Número máximo de iniciativas
     * @returns {Array} Array de iniciativas ordenadas por relaciones
     */
    getInitiativesWithMostRelations(limit = 10) {
        return this.relationshipService.getInitiativesWithMostRelations(limit);
    }

    /**
     * Obtiene iniciativas con mayor similitud
     * @param {number} limit - Número máximo de iniciativas
     * @returns {Array} Array de iniciativas ordenadas por similitud
     */
    getInitiativesWithHighestSimilarity(limit = 10) {
        return this.relationshipService.getInitiativesWithHighestSimilarity(limit);
    }

    /**
     * Busca iniciativas similares a una específica
     * @param {string} expediente - Número de expediente
     * @param {number} minSimilarity - Similitud mínima
     * @returns {Array} Array de iniciativas similares
     */
    findSimilarInitiatives(expediente, minSimilarity = null) {
        return this.relationshipService.findSimilarInitiatives(expediente, minSimilarity);
    }

    /**
     * Obtiene el grafo completo de relaciones
     * @returns {Object} Estructura del grafo
     */
    getCompleteGraph() {
        return this.relationshipService.getCompleteGraph();
    }

    /**
     * Obtiene una iniciativa específica
     * @param {string} expediente - Número de expediente
     * @returns {Object|null} Iniciativa o null
     */
    getInitiative(expediente) {
        return this.xmlService.getInitiative(expediente);
    }

    /**
     * Filtra iniciativas por criterios
     * @param {Object} filters - Criterios de filtrado
     * @returns {Array} Array de iniciativas filtradas
     */
    filterInitiatives(filters = {}) {
        let filtered = [...this.initiatives];
        
        // Filtro por tipo
        if (filters.tipo) {
            filtered = filtered.filter(i => 
                i.tipo && i.tipo.toLowerCase().includes(filters.tipo.toLowerCase())
            );
        }
        
        // Filtro por autor
        if (filters.autor) {
            filtered = filtered.filter(i => 
                i.autor && i.autor.toLowerCase().includes(filters.autor.toLowerCase())
            );
        }
        
        // Filtro por fecha
        if (filters.fechaDesde) {
            filtered = filtered.filter(i => 
                i.fechaPresentacion && new Date(i.fechaPresentacion) >= new Date(filters.fechaDesde)
            );
        }
        
        if (filters.fechaHasta) {
            filtered = filtered.filter(i => 
                i.fechaPresentacion && new Date(i.fechaPresentacion) <= new Date(filters.fechaHasta)
            );
        }
        
        // Filtro por similitud mínima
        if (filters.similitudMinima) {
            filtered = filtered.filter(i => 
                i.similares && i.similares.some(s => s.similitud >= filters.similitudMinima)
            );
        }
        
        return filtered;
    }

    /**
     * Obtiene estadísticas del procesamiento
     * @returns {Object} Estadísticas completas
     */
    getProcessingStats() {
        return this.processingStats;
    }

    /**
     * Obtiene errores del procesamiento
     * @returns {Array} Array de errores
     */
    getProcessingErrors() {
        return this.xmlService.getErrors();
    }

    /**
     * Limpia el estado del servicio
     */
    clear() {
        this.initiatives = [];
        this.processingStats = {};
        this.xmlService.clear();
        this.relationshipService.setInitiatives(new Map());
    }

    /**
     * Cambia la configuración del servicio
     * @param {Object} newConfig - Nueva configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Actualizar servicios
        this.xmlService.config = { ...this.xmlService.config, ...newConfig };
        this.relationshipService.config = { ...this.relationshipService.config, ...newConfig };
        
        if (newConfig.outputDirectory) {
            this.exportService.setOutputDirectory(newConfig.outputDirectory);
        }
        
        console.log('⚙️  Configuración actualizada');
    }

    /**
     * Obtiene la configuración actual
     * @returns {Object} Configuración actual
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Upload data to Supabase
     */
    async uploadToSupabase() {
        try {
            if (!this.supabaseService) {
                this.supabaseService = new SupabaseService();
            }

            // Load initiatives if not already loaded
            if (!this.initiatives || this.initiatives.length === 0) {
                const outputPath = path.join(__dirname, '../output/iniciativas-completas.json');
                if (await fs.pathExists(outputPath)) {
                    this.initiatives = await fs.readJson(outputPath);
                    console.log(`📋 Loaded ${this.initiatives.length} initiatives from output file`);
                } else {
                    throw new Error('No initiatives to upload. Run processCongressData first.');
                }
            }

            // Prepare relationships data
            const relationships = this.relationships || [];
            const timelineEvents = this.timelineEvents || [];
            const keywords = this.keywords || [];

            // Upload everything to Supabase
            const stats = await this.supabaseService.uploadToSupabase(
                this.initiatives,
                relationships,
                timelineEvents,
                keywords
            );

            console.log('\n📊 ESTADÍSTICAS DE SUBIDA A SUPABASE:');
            console.log(`   • Iniciativas subidas: ${stats.initiativesUploaded}`);
            console.log(`   • Iniciativas actualizadas: ${stats.initiativesUpdated}`);
            console.log(`   • Relaciones subidas: ${stats.relationshipsUploaded}`);
            console.log(`   • Eventos de timeline: ${stats.timelineEventsUploaded}`);
            console.log(`   • Palabras clave: ${stats.keywordsUploaded}`);
            console.log(`   • Errores: ${stats.errors}`);

            // Get political party statistics
            const partyStats = await this.supabaseService.getPoliticalPartyStats();
            console.log('\n🏛️  ESTADÍSTICAS DE PARTIDOS POLÍTICOS:');
            Object.entries(partyStats).forEach(([party, stats]) => {
                console.log(`   • ${party}: ${stats.total} iniciativas (${stats.high_confidence} alta confianza)`);
            });

            return stats;

        } catch (error) {
            console.error('❌ Error uploading to Supabase:', error);
            throw error;
        }
    }

    /**
     * Prueba la conexión con Supabase
     * @returns {Promise<boolean>} true si la conexión funciona
     */
    async testSupabaseConnection() {
        if (!this.supabaseService) {
            console.warn('⚠️ Servicio de Supabase no configurado');
            return false;
        }

        try {
            const connected = await this.supabaseService.testConnection();
            if (connected) {
                console.log('✅ Conexión a Supabase exitosa');
            } else {
                console.log('❌ Conexión a Supabase fallida');
            }
            return connected;
        } catch (error) {
            console.error('❌ Error probando conexión a Supabase:', error.message);
            return false;
        }
    }

    /**
     * Obtiene iniciativas relacionadas desde Supabase
     * @param {string} expediente - Número de expediente
     * @returns {Promise<Array>} Array de iniciativas relacionadas
     */
    async getRelatedInitiativesFromSupabase(expediente) {
        if (!this.supabaseService) {
            throw new Error('Servicio de Supabase no configurado');
        }

        return await this.supabaseService.getRelatedInitiatives(expediente);
    }

    /**
     * Obtiene timeline de una iniciativa desde Supabase
     * @param {string} expediente - Número de expediente
     * @returns {Promise<Array>} Array de eventos del timeline
     */
    async getInitiativeTimelineFromSupabase(expediente) {
        if (!this.supabaseService) {
            throw new Error('Servicio de Supabase no configurado');
        }

        return await this.supabaseService.getInitiativeTimeline(expediente);
    }

    /**
     * Verifica si el servicio de Supabase está disponible
     * @returns {boolean} true si está disponible
     */
    hasSupabaseService() {
        return this.supabaseService !== null;
    }
}

module.exports = CongressProcessingService; 