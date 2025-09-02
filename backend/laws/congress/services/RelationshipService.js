/**
 * Servicio de Relaciones
 * 
 * Maneja el análisis de relaciones directas e indirectas
 * entre iniciativas parlamentarias
 */

const natural = require('natural');

class RelationshipService {
    constructor(config = {}) {
        this.config = {
            similarityThreshold: config.similarityThreshold || 0.6,
            similarityAlgorithms: {
                jaroWinkler: config.jaroWinklerWeight || 0.7,
                levenshtein: config.levenshteinWeight || 0.3
            },
            cacheSize: config.cacheSize || 10000,
            ...config
        };

        this.similarityCache = new Map(); // Cache para evitar recálculos
        this.initiatives = new Map();
    }

    /**
     * Establece las iniciativas para analizar
     * @param {Map} initiatives - Mapa de expedientes -> Initiative
     */
    setInitiatives(initiatives) {
        this.initiatives = initiatives;
    }

    /**
     * Analiza todas las relaciones entre iniciativas
     * @returns {Promise<Object>} Estadísticas del análisis
     */
    async analyzeAllRelationships() {
        console.log('🔗 Analizando relaciones entre iniciativas...');
        
        try {
            // Generar relaciones directas
            console.log('📋 Generando relaciones directas...');
            await this.generateDirectRelationships();
            
            // Generar relaciones de similitud
            console.log('🔍 Generando relaciones de similitud...');
            await this.generateSimilarityRelationships();
            
            // Limpiar cache si es muy grande
            this.cleanCache();
            
            const stats = this.getRelationshipStats();
            console.log('✅ Análisis de relaciones completado');
            
            return stats;
            
        } catch (error) {
            console.error('❌ Error analizando relaciones:', error);
            throw error;
        }
    }

    /**
     * Genera las relaciones directas entre iniciativas
     */
    async generateDirectRelationships() {
        for (const [expediente, iniciativa] of this.initiatives) {
            const relacionesDirectas = [];
            
            // Añadir iniciativas relacionadas
            for (const relacionada of iniciativa.iniciativasRelacionadas) {
                if (this.initiatives.has(relacionada)) {
                    const iniciativaRelacionada = this.initiatives.get(relacionada);
                    relacionesDirectas.push({
                        expediente: relacionada,
                        tipo: 'relacionada',
                        iniciativa: iniciativaRelacionada
                    });
                }
            }
            
            // Añadir iniciativas de origen
            for (const origen of iniciativa.iniciativasDeOrigen) {
                if (this.initiatives.has(origen)) {
                    const iniciativaOrigen = this.initiatives.get(origen);
                    relacionesDirectas.push({
                        expediente: origen,
                        tipo: 'origen',
                        iniciativa: iniciativaOrigen
                    });
                }
            }
            
            iniciativa.relacionesDirectas = relacionesDirectas;
        }
    }

    /**
     * Genera relaciones de similitud basadas en el campo OBJETO
     */
    async generateSimilarityRelationships() {
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
                
                // Calcular similitud usando algoritmos combinados
                const similarity = this.calculateSimilarity(iniciativa1.objeto, iniciativa2.objeto);
                
                if (similarity >= this.config.similarityThreshold) {
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
     * Calcula la similitud entre dos textos usando algoritmos combinados
     * @param {string} text1 - Primer texto
     * @param {string} text2 - Segundo texto
     * @returns {number} Valor de similitud entre 0 y 1
     */
    calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        // Verificar cache
        const cacheKey = `${text1}|${text2}`;
        if (this.similarityCache.has(cacheKey)) {
            return this.similarityCache.get(cacheKey);
        }
        
        // Normalizar textos
        const normalized1 = this.normalizeText(text1);
        const normalized2 = this.normalizeText(text2);
        
        if (normalized1 === normalized2) {
            this.similarityCache.set(cacheKey, 1.0);
            return 1.0;
        }
        
        // Calcular similitud usando Jaro-Winkler (mejor para textos cortos)
        const jaroWinkler = natural.JaroWinklerDistance(normalized1, normalized2);
        
        // Calcular similitud usando Levenshtein (normalizada)
        const maxLength = Math.max(normalized1.length, normalized2.length);
        const levenshtein = maxLength > 0 ? 
            (1 - natural.LevenshteinDistance(normalized1, normalized2) / maxLength) : 0;
        
        // Combinar ambas métricas con pesos configurados
        const similarity = (
            jaroWinkler * this.config.similarityAlgorithms.jaroWinkler +
            levenshtein * this.config.similarityAlgorithms.levenshtein
        );
        
        // Guardar en cache
        this.similarityCache.set(cacheKey, similarity);
        
        return similarity;
    }

    /**
     * Normaliza un texto para mejorar la comparación
     * @param {string} text - Texto a normalizar
     * @returns {string} Texto normalizado
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[áäâà]/g, 'a')
            .replace(/[éëêè]/g, 'e')
            .replace(/[íïîì]/g, 'i')
            .replace(/[óöôò]/g, 'o')
            .replace(/[úüûù]/g, 'u')
            .replace(/[ñ]/g, 'n')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Busca una iniciativa por su número de expediente
     * @param {string} expediente - Número de expediente a buscar
     * @returns {Initiative|null} Iniciativa encontrada o null
     */
    findInitiativeByExpediente(expediente) {
        return this.initiatives.get(expediente) || null;
    }

    /**
     * Obtiene estadísticas de las relaciones analizadas
     * @returns {Object} Estadísticas del análisis
     */
    getRelationshipStats() {
        const totalInitiatives = this.initiatives.size;
        let totalDirectRelations = 0;
        let totalSimilarities = 0;
        let maxDirectRelations = 0;
        let maxSimilarities = 0;
        let totalSimilarityScore = 0;
        let similarityCount = 0;

        this.initiatives.forEach(initiative => {
            // Relaciones directas
            if (initiative.relacionesDirectas) {
                totalDirectRelations += initiative.relacionesDirectas.length;
                maxDirectRelations = Math.max(maxDirectRelations, initiative.relacionesDirectas.length);
            }
            
            // Similitudes
            if (initiative.similares) {
                totalSimilarities += initiative.similares.length;
                maxSimilarities = Math.max(maxSimilarities, initiative.similares.length);
                
                // Calcular score promedio de similitud
                initiative.similares.forEach(sim => {
                    totalSimilarityScore += sim.similitud;
                    similarityCount++;
                });
            }
        });

        return {
            totalInitiatives,
            totalDirectRelations,
            totalSimilarities,
            maxDirectRelations,
            maxSimilarities,
            averageDirectRelations: totalInitiatives > 0 ? 
                (totalDirectRelations / totalInitiatives).toFixed(2) : 0,
            averageSimilarities: totalInitiatives > 0 ? 
                (totalSimilarities / totalInitiatives).toFixed(2) : 0,
            averageSimilarityScore: similarityCount > 0 ? 
                (totalSimilarityScore / similarityCount).toFixed(3) : 0,
            initiativesWithRelations: Array.from(this.initiatives.values())
                .filter(i => i.relacionesDirectas.length > 0).length,
            initiativesWithSimilarities: Array.from(this.initiatives.values())
                .filter(i => i.similares.length > 0).length
        };
    }

    /**
     * Obtiene iniciativas con más relaciones directas
     * @param {number} limit - Número máximo de iniciativas a retornar
     * @returns {Array} Array de iniciativas ordenadas por número de relaciones
     */
    getInitiativesWithMostRelations(limit = 10) {
        return Array.from(this.initiatives.values())
            .filter(i => i.relacionesDirectas.length > 0)
            .sort((a, b) => b.relacionesDirectas.length - a.relacionesDirectas.length)
            .slice(0, limit)
            .map(i => ({
                expediente: i.numExpediente,
                tipo: i.tipo,
                objeto: i.objeto.substring(0, 100) + '...',
                totalRelaciones: i.relacionesDirectas.length
            }));
    }

    /**
     * Obtiene iniciativas con mayor similitud
     * @param {number} limit - Número máximo de iniciativas a retornar
     * @returns {Array} Array de iniciativas ordenadas por similitud máxima
     */
    getInitiativesWithHighestSimilarity(limit = 10) {
        return Array.from(this.initiatives.values())
            .filter(i => i.similares.length > 0)
            .map(i => {
                const maxSimilarity = Math.max(...i.similares.map(s => s.similitud));
                return {
                    expediente: i.numExpediente,
                    tipo: i.tipo,
                    objeto: i.objeto.substring(0, 100) + '...',
                    maxSimilarity,
                    totalSimilares: i.similares.length
                };
            })
            .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
            .slice(0, limit);
    }

    /**
     * Busca iniciativas similares a una específica
     * @param {string} expediente - Número de expediente de la iniciativa
     * @param {number} minSimilarity - Similitud mínima (opcional)
     * @returns {Array} Array de iniciativas similares
     */
    findSimilarInitiatives(expediente, minSimilarity = null) {
        const iniciativa = this.initiatives.get(expediente);
        if (!iniciativa || !iniciativa.similares) return [];
        
        const threshold = minSimilarity || this.config.similarityThreshold;
        return iniciativa.similares
            .filter(sim => sim.similitud >= threshold)
            .sort((a, b) => b.similitud - a.similitud);
    }

    /**
     * Obtiene el grafo completo de relaciones
     * @returns {Object} Estructura del grafo con nodos y aristas
     */
    getCompleteGraph() {
        const nodes = [];
        const edges = [];
        
        this.initiatives.forEach(initiative => {
            // Añadir nodo
            nodes.push(initiative.getGraphNode());
            
            // Añadir aristas
            edges.push(...initiative.getGraphEdges());
        });
        
        return {
            nodes,
            edges,
            metadata: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Limpia el cache de similitud si es muy grande
     */
    cleanCache() {
        if (this.similarityCache.size > this.config.cacheSize) {
            console.log(`🧹 Limpiando cache de similitud (${this.similarityCache.size} -> ${this.config.cacheSize})`);
            this.similarityCache.clear();
        }
    }

    /**
     * Obtiene información de una relación específica
     * @param {string} sourceExpediente - Expediente origen
     * @param {string} targetExpediente - Expediente destino
     * @returns {Object|null} Información de la relación o null
     */
    getRelationshipInfo(sourceExpediente, targetExpediente) {
        const source = this.initiatives.get(sourceExpediente);
        if (!source) return null;
        
        // Buscar en relaciones directas
        const directRelation = source.relacionesDirectas.find(r => r.expediente === targetExpediente);
        if (directRelation) {
            return {
                type: 'directa',
                subtype: directRelation.tipo,
                source: sourceExpediente,
                target: targetExpediente
            };
        }
        
        // Buscar en similitudes
        const similarRelation = source.similares.find(s => s.expediente === targetExpediente);
        if (similarRelation) {
            return {
                type: 'similitud',
                similarity: similarRelation.similitud,
                source: sourceExpediente,
                target: targetExpediente
            };
        }
        
        return null;
    }

    /**
     * Exporta solo las relaciones para análisis externo
     * @returns {Array} Array de relaciones
     */
    exportRelationships() {
        const relationships = [];
        
        this.initiatives.forEach(initiative => {
            // Relaciones directas
            initiative.relacionesDirectas.forEach(rel => {
                relationships.push({
                    source: initiative.numExpediente,
                    target: rel.expediente,
                    type: rel.tipo,
                    relationshipType: 'directa'
                });
            });
            
            // Relaciones de similitud
            initiative.similares.forEach(sim => {
                relationships.push({
                    source: initiative.numExpediente,
                    target: sim.expediente,
                    type: 'similar',
                    relationshipType: 'similitud',
                    similarity: sim.similitud
                });
            });
        });
        
        return relationships;
    }
}

module.exports = RelationshipService; 