/**
 * Servicio de Exportación
 * 
 * Maneja la exportación de datos en múltiples formatos
 * para diferentes usos (análisis, visualización, etc.)
 */

const fs = require('fs-extra');
const path = require('path');

class ExportService {
    constructor(config = {}) {
        this.config = {
            outputDirectory: config.outputDirectory || './output',
            jsonFormat: {
                spaces: config.jsonSpaces || 2,
                encoding: config.jsonEncoding || 'utf8'
            },
            ...config
        };
    }

    /**
     * Prepara el directorio de salida
     */
    async prepareOutputDirectory() {
        try {
            await fs.ensureDir(this.config.outputDirectory);
            console.log(`📁 Directorio de salida preparado: ${this.config.outputDirectory}`);
        } catch (error) {
            console.error('❌ Error creando directorio de salida:', error.message);
            throw error;
        }
    }

    /**
     * Exporta iniciativas en formato JSON completo
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportFullData(initiatives, filename = 'iniciativas-completas.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        const fullData = initiatives.map(initiative => initiative.getFullData());

        try {
            await fs.writeJson(outputPath, fullData, this.config.jsonFormat);
            console.log(`✅ Datos completos exportados a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando datos completos:', error.message);
            throw error;
        }
    }

    /**
     * Exporta iniciativas en formato JSON básico
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportBasicData(initiatives, filename = 'iniciativas-basicas.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        const basicData = initiatives.map(initiative => initiative.getBasicData());

        try {
            await fs.writeJson(outputPath, basicData, this.config.jsonFormat);
            console.log(`✅ Datos básicos exportados a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando datos básicos:', error.message);
            throw error;
        }
    }

    /**
     * Exporta iniciativas en formato JSON de resumen
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportSummaryData(initiatives, filename = 'iniciativas-resumen.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        const summaryData = initiatives.map(initiative => initiative.getSummary());

        try {
            await fs.writeJson(outputPath, summaryData, this.config.jsonFormat);
            console.log(`✅ Datos de resumen exportados a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando datos de resumen:', error.message);
            throw error;
        }
    }

    /**
     * Exporta datos para visualización en grafo
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportGraphData(initiatives, filename = 'grafo-relaciones.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        
        const graphData = {
            nodes: initiatives.map(initiative => initiative.getGraphNode()),
            edges: initiatives.flatMap(initiative => initiative.getGraphEdges()),
            metadata: {
                totalNodes: 0,
                totalEdges: 0,
                generatedAt: new Date().toISOString()
            }
        };

        // Actualizar metadata
        graphData.metadata.totalNodes = graphData.nodes.length;
        graphData.metadata.totalEdges = graphData.edges.length;

        try {
            await fs.writeJson(outputPath, graphData, this.config.jsonFormat);
            console.log(`✅ Datos para grafo exportados a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando datos para grafo:', error.message);
            throw error;
        }
    }

    /**
     * Exporta timeline consolidado
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportTimelineData(initiatives, filename = 'timeline-consolidado.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        
        const timelineData = this.consolidateTimeline(initiatives);

        try {
            await fs.writeJson(outputPath, timelineData, this.config.jsonFormat);
            console.log(`✅ Timeline consolidado exportado a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando timeline:', error.message);
            throw error;
        }
    }

    /**
     * Exporta estadísticas generales
     * @param {Array} initiatives - Array de iniciativas
     * @param {Object} relationshipStats - Estadísticas de relaciones
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportStatistics(initiatives, relationshipStats, filename = 'estadisticas.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        
        const stats = {
            totalIniciativas: initiatives.length,
            estadisticasRelaciones: relationshipStats,
            distribucionPorTipo: this.getTypeDistribution(initiatives),
            distribucionPorAutor: this.getAuthorDistribution(initiatives),
            timelineStats: this.getTimelineStats(initiatives),
            exportadoEn: new Date().toISOString()
        };

        try {
            await fs.writeJson(outputPath, stats, this.config.jsonFormat);
            console.log(`✅ Estadísticas exportadas a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando estadísticas:', error.message);
            throw error;
        }
    }

    /**
     * Exporta relaciones para análisis externo
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportRelationships(initiatives, filename = 'relaciones.json') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        
        const relationships = [];
        
        initiatives.forEach(initiative => {
            // Relaciones directas
            if (initiative.relacionesDirectas) {
                initiative.relacionesDirectas.forEach(rel => {
                    relationships.push({
                        source: initiative.numExpediente,
                        target: rel.expediente,
                        type: rel.tipo,
                        relationshipType: 'directa'
                    });
                });
            }

            // Similitudes
            if (initiative.similares) {
                initiative.similares.forEach(sim => {
                    relationships.push({
                        source: initiative.numExpediente,
                        target: sim.expediente,
                        type: 'similar',
                        relationshipType: 'similitud',
                        similarity: sim.similitud
                    });
                });
            }
        });

        try {
            await fs.writeJson(outputPath, relationships, this.config.jsonFormat);
            console.log(`✅ Relaciones exportadas a: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando relaciones:', error.message);
            throw error;
        }
    }

    /**
     * Exporta todos los formatos de una vez
     * @param {Array} initiatives - Array de iniciativas
     * @param {Object} relationshipStats - Estadísticas de relaciones
     * @returns {Promise<Object>} Rutas de todos los archivos exportados
     */
    async exportAll(initiatives, relationshipStats) {
        console.log('📤 Iniciando exportación de todos los formatos...');
        
        const results = {};
        
        try {
            results.full = await this.exportFullData(initiatives);
            results.basic = await this.exportBasicData(initiatives);
            results.summary = await this.exportSummaryData(initiatives);
            results.graph = await this.exportGraphData(initiatives);
            results.timeline = await this.exportTimelineData(initiatives);
            results.statistics = await this.exportStatistics(initiatives, relationshipStats);
            results.relationships = await this.exportRelationships(initiatives);
            
            console.log('✅ Exportación completada exitosamente');
            return results;
        } catch (error) {
            console.error('❌ Error en la exportación completa:', error.message);
            throw error;
        }
    }

    /**
     * Consolida el timeline de todas las iniciativas
     * @param {Array} initiatives - Array de iniciativas
     * @returns {Object} Timeline consolidado
     */
    consolidateTimeline(initiatives) {
        const allEvents = [];
        
        initiatives.forEach(initiative => {
            if (initiative.timeline) {
                initiative.timeline.forEach(event => {
                    allEvents.push({
                        ...event,
                        iniciativa: initiative.numExpediente,
                        tipoIniciativa: initiative.tipo
                    });
                });
            }
        });

        // Ordenar por fecha
        allEvents.sort((a, b) => {
            if (!a.fechaInicio && !b.fechaInicio) return 0;
            if (!a.fechaInicio) return 1;
            if (!b.fechaInicio) return -1;
            return new Date(a.fechaInicio) - new Date(b.fechaInicio);
        });

        return {
            eventos: allEvents,
            totalEventos: allEvents.length,
            distribucionPorTipo: this.getEventTypeDistribution(allEvents)
        };
    }

    /**
     * Obtiene distribución por tipo de iniciativa
     * @param {Array} initiatives - Array de iniciativas
     * @returns {Object} Distribución por tipo
     */
    getTypeDistribution(initiatives) {
        const distribution = {};
        
        initiatives.forEach(initiative => {
            const tipo = initiative.tipo || 'Sin tipo';
            distribution[tipo] = (distribution[tipo] || 0) + 1;
        });
        
        return distribution;
    }

    /**
     * Obtiene distribución por autor
     * @param {Array} initiatives - Array de iniciativas
     * @returns {Object} Distribución por autor
     */
    getAuthorDistribution(initiatives) {
        const distribution = {};
        
        initiatives.forEach(initiative => {
            const autor = initiative.autor || 'Sin autor';
            distribution[autor] = (distribution[autor] || 0) + 1;
        });
        
        return distribution;
    }

    /**
     * Obtiene estadísticas del timeline
     * @param {Array} initiatives - Array de iniciativas
     * @returns {Object} Estadísticas del timeline
     */
    getTimelineStats(initiatives) {
        let totalEvents = 0;
        let eventsWithDates = 0;
        const eventTypes = {};
        
        initiatives.forEach(initiative => {
            if (initiative.timeline) {
                totalEvents += initiative.timeline.length;
                initiative.timeline.forEach(event => {
                    if (event.fechaInicio) eventsWithDates++;
                    if (event.evento) {
                        eventTypes[event.evento] = (eventTypes[event.evento] || 0) + 1;
                    }
                });
            }
        });
        
        return {
            totalEventos: totalEvents,
            eventosConFecha: eventsWithDates,
            eventosSinFecha: totalEvents - eventsWithDates,
            distribucionPorTipo: eventTypes
        };
    }

    /**
     * Obtiene distribución por tipo de evento
     * @param {Array} events - Array de eventos
     * @returns {Object} Distribución por tipo de evento
     */
    getEventTypeDistribution(events) {
        const distribution = {};
        
        events.forEach(event => {
            const tipo = event.evento || 'Sin tipo';
            distribution[tipo] = (distribution[tipo] || 0) + 1;
        });
        
        return distribution;
    }

    /**
     * Exporta datos en formato CSV (para análisis en Excel)
     * @param {Array} initiatives - Array de iniciativas
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<string>} Ruta del archivo exportado
     */
    async exportToCSV(initiatives, filename = 'iniciativas.csv') {
        await this.prepareOutputDirectory();
        
        const outputPath = path.join(this.config.outputDirectory, filename);
        
        // Crear headers CSV
        const headers = [
            'numExpediente',
            'tipo',
            'objeto',
            'autor',
            'fechaPresentacion',
            'fechaCalificacion',
            'legislatura',
            'situacionActual',
            'comisionCompetente',
            'totalRelaciones',
            'totalSimilares',
            'totalTimeline'
        ].join(',');

        // Crear filas CSV
        const rows = initiatives.map(initiative => [
            initiative.numExpediente,
            `"${initiative.tipo}"`,
            `"${initiative.objeto.replace(/"/g, '""')}"`,
            `"${initiative.autor}"`,
            initiative.fechaPresentacion,
            initiative.fechaCalificacion,
            initiative.legislatura,
            initiative.situacionActual,
            initiative.comisionCompetente,
            initiative.relacionesDirectas.length,
            initiative.similares.length,
            initiative.timeline.length
        ].join(','));

        const csvContent = [headers, ...rows].join('\n');

        try {
            await fs.writeFile(outputPath, csvContent, 'utf8');
            console.log(`✅ Datos exportados a CSV: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exportando a CSV:', error.message);
            throw error;
        }
    }

    /**
     * Cambia el directorio de salida
     * @param {string} newOutputDir - Nuevo directorio de salida
     */
    setOutputDirectory(newOutputDir) {
        this.config.outputDirectory = newOutputDir;
        console.log(`📁 Directorio de salida cambiado a: ${newOutputDir}`);
    }

    /**
     * Obtiene el directorio de salida actual
     * @returns {string} Directorio de salida actual
     */
    getOutputDirectory() {
        return this.config.outputDirectory;
    }
}

module.exports = ExportService; 