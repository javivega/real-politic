/**
 * Modelo de Iniciativa Parlamentaria
 * 
 * Representa una iniciativa del Congreso de los Diputados
 * con todos sus campos y métodos de validación
 */

class Initiative {
    constructor(data = {}) {
        // Campos básicos
        this.numExpediente = data.numExpediente || '';
        this.tipo = data.tipo || 'Desconocido';
        this.objeto = data.objeto || '';
        this.autor = data.autor || 'Desconocido';
        this.fechaPresentacion = data.fechaPresentacion || '';
        this.fechaCalificacion = data.fechaCalificacion || '';
        
        // Campo de categorización del Congreso
        this.congress_initiative_type = data.congress_initiative_type || 'tramitacion_ordinaria';
        
        // Campos de relaciones
        this.iniciativasRelacionadas = data.iniciativasRelacionadas || [];
        this.iniciativasDeOrigen = data.iniciativasDeOrigen || [];
        
        // Campo de tramitación
        this.tramitacion = data.tramitacion || '';
        
        // Campos adicionales del Congreso
        this.legislatura = data.legislatura || '';
        this.supertipo = data.supertipo || '';
        this.agrupacion = data.agrupacion || '';
        this.tipotramitacion = data.tipotramitacion || '';
        this.resultadoTramitacion = data.resultadoTramitacion || '';
        this.situacionActual = data.situacionActual || '';
        this.comisionCompetente = data.comisionCompetente || '';
        this.plazos = data.plazos || '';
        this.ponentes = data.ponentes || '';
        this.enlacesBOCG = data.enlacesBOCG || '';
        this.enlacesDS = data.enlacesDS || '';
        
        // Campos generados por el procesamiento
        this.timeline = data.timeline || [];
        this.relacionesDirectas = data.relacionesDirectas || [];
        this.similares = data.similares || [];
        
        // Metadatos
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.processedAt = data.processedAt || new Date();
    }

    /**
     * Valida si la iniciativa tiene los campos mínimos requeridos
     * @returns {boolean} true si es válida
     */
    isValid() {
        return !!(
            this.numExpediente &&
            this.tipo &&
            this.objeto
        );
    }

    /**
     * Valida si la iniciativa tiene campos de fecha válidos
     * @returns {boolean} true si las fechas son válidas
     */
    hasValidDates() {
        if (this.fechaPresentacion) {
            const fecha = new Date(this.fechaPresentacion);
            if (isNaN(fecha.getTime())) return false;
        }
        
        if (this.fechaCalificacion) {
            const fecha = new Date(this.fechaCalificacion);
            if (isNaN(fecha.getTime())) return false;
        }
        
        return true;
    }

    /**
     * Obtiene un resumen de la iniciativa
     * @returns {Object} Resumen con campos principales
     */
    getSummary() {
        return {
            numExpediente: this.numExpediente,
            tipo: this.tipo,
            objeto: this.objeto, // Remove truncation - show full object
            autor: this.autor,
            fechaPresentacion: this.fechaPresentacion,
            situacionActual: this.situacionActual,
            totalRelaciones: this.relacionesDirectas.length,
            totalSimilares: this.similares.length,
            totalTimeline: this.timeline.length
        };
    }

    /**
     * Obtiene datos para exportación básica (sin relaciones circulares)
     * @returns {Object} Datos limpios para exportar
     */
    getBasicData() {
        return {
            numExpediente: this.numExpediente,
            tipo: this.tipo,
            objeto: this.objeto,
            autor: this.autor,
            fechaPresentacion: this.fechaPresentacion,
            fechaCalificacion: this.fechaCalificacion,
            legislatura: this.legislatura,
            situacionActual: this.situacionActual,
            comisionCompetente: this.comisionCompetente,
            timeline: this.timeline,
            totalRelacionesDirectas: this.relacionesDirectas.length,
            totalSimilares: this.similares.length
        };
    }

    /**
     * Obtiene datos para exportación completa (con relaciones limpias)
     * @returns {Object} Datos completos sin referencias circulares
     */
    getFullData() {
        const cleanRelaciones = this.relacionesDirectas.map(rel => ({
            expediente: rel.expediente,
            tipo: rel.tipo,
            iniciativa: {
                numExpediente: rel.iniciativa.numExpediente,
                tipo: rel.iniciativa.tipo,
                objeto: rel.iniciativa.objeto,
                autor: rel.iniciativa.autor,
                fechaPresentacion: rel.iniciativa.fechaPresentacion
            }
        }));

        const cleanSimilares = this.similares.map(sim => ({
            expediente: sim.expediente,
            similitud: sim.similitud,
            iniciativa: {
                numExpediente: sim.iniciativa.numExpediente,
                tipo: sim.iniciativa.tipo,
                objeto: sim.iniciativa.objeto
            }
        }));

        return {
            ...this.getBasicData(),
            relacionesDirectas: cleanRelaciones,
            similares: cleanSimilares
        };
    }

    /**
     * Obtiene datos para visualización en grafo
     * @returns {Object} Nodo del grafo
     */
    getGraphNode() {
        return {
            id: this.numExpediente,
            label: `${this.tipo} - ${this.numExpediente}`,
            tipo: this.tipo,
            objeto: this.objeto,
            autor: this.autor,
            fechaPresentacion: this.fechaPresentacion,
            grupo: this.getGroup(),
            size: this.relacionesDirectas.length + this.similares.length
        };
    }

    /**
     * Obtiene aristas del grafo para esta iniciativa
     * @returns {Array} Array de aristas
     */
    getGraphEdges() {
        const edges = [];
        
        // Relaciones directas
        this.relacionesDirectas.forEach(rel => {
            edges.push({
                source: this.numExpediente,
                target: rel.expediente,
                type: 'directa',
                label: rel.tipo,
                weight: 1
            });
        });

        // Similitudes
        this.similares.forEach(sim => {
            edges.push({
                source: this.numExpediente,
                target: sim.expediente,
                type: 'similitud',
                label: `Similitud: ${sim.similitud}`,
                weight: sim.similitud
            });
        });

        return edges;
    }

    /**
     * Determina el grupo de la iniciativa para visualización
     * @returns {string} Grupo de la iniciativa
     */
    getGroup() {
        const tipo = this.tipo.toLowerCase();
        
        if (tipo.includes('proyecto')) return 'proyecto';
        if (tipo.includes('proposición')) return 'proposicion';
        if (tipo.includes('iniciativa')) return 'iniciativa';
        if (tipo.includes('enmienda')) return 'enmienda';
        if (tipo.includes('ley')) return 'ley';
        
        return 'otro';
    }

    /**
     * Actualiza la iniciativa con nuevos datos
     * @param {Object} newData - Nuevos datos
     */
    update(newData) {
        Object.assign(this, newData);
        this.updatedAt = new Date();
    }

    /**
     * Añade una relación directa
     * @param {Object} relacion - Objeto de relación
     */
    addDirectRelation(relacion) {
        this.relacionesDirectas.push(relacion);
    }

    /**
     * Añade una iniciativa similar
     * @param {Object} similar - Objeto de iniciativa similar
     */
    addSimilar(similar) {
        this.similares.push(similar);
    }

    /**
     * Añade un evento al timeline
     * @param {Object} event - Objeto de evento
     */
    addTimelineEvent(event) {
        this.timeline.push(event);
    }

    /**
     * Limpia el timeline de eventos duplicados
     */
    cleanTimeline() {
        const seen = new Set();
        this.timeline = this.timeline.filter(event => {
            const key = `${event.evento}-${event.fechaInicio}-${event.fechaFin}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Ordena el timeline por fecha
     */
    sortTimeline() {
        this.timeline.sort((a, b) => {
            if (!a.fechaInicio && !b.fechaInicio) return 0;
            if (!a.fechaInicio) return 1;
            if (!b.fechaInicio) return -1;
            return new Date(a.fechaInicio) - new Date(b.fechaInicio);
        });
    }

    /**
     * Convierte la iniciativa a objeto plano
     * @returns {Object} Objeto plano
     */
    toObject() {
        return {
            numExpediente: this.numExpediente,
            tipo: this.tipo,
            objeto: this.objeto,
            autor: this.autor,
            fechaPresentacion: this.fechaPresentacion,
            fechaCalificacion: this.fechaCalificacion,
            congress_initiative_type: this.congress_initiative_type,
            iniciativasRelacionadas: this.iniciativasRelacionadas,
            iniciativasDeOrigen: this.iniciativasDeOrigen,
            tramitacion: this.tramitacion,
            legislatura: this.legislatura,
            supertipo: this.supertipo,
            agrupacion: this.agrupacion,
            tipotramitacion: this.tipotramitacion,
            resultadoTramitacion: this.resultadoTramitacion,
            situacionActual: this.situacionActual,
            comisionCompetente: this.comisionCompetente,
            plazos: this.plazos,
            ponentes: this.ponentes,
            enlacesBOCG: this.enlacesBOCG,
            enlacesDS: this.enlacesDS,
            timeline: this.timeline,
            relacionesDirectas: this.relacionesDirectas,
            similares: this.similares,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            processedAt: this.processedAt
        };
    }

    /**
     * Crea una iniciativa desde datos XML
     * @param {Object} xmlData - Datos del XML
     * @returns {Initiative} Nueva instancia de iniciativa
     */
    static fromXML(xmlData) {
        // Determinar el tipo de iniciativa según la clasificación del Congreso
        const congressInitiativeType = Initiative.determineCongressInitiativeType(xmlData);
        
        return new Initiative({
            numExpediente: xmlData.NUMEXPEDIENTE || xmlData.NUMERO_LEY,
            tipo: xmlData.TIPO || 'Desconocido',
            objeto: xmlData.OBJETO || xmlData.TITULO_LEY || '',
            autor: xmlData.AUTOR || 'Desconocido',
            fechaPresentacion: xmlData.FECHAPRESENTACION || xmlData.FECHA_LEY || '',
            fechaCalificacion: xmlData.FECHACALIFICACION || '',
            congress_initiative_type: congressInitiativeType,
            iniciativasRelacionadas: xmlData.INICIATIVASRELACIONADAS || '',
            iniciativasDeOrigen: xmlData.INICIATIVASDEORIGEN || '',
            tramitacion: xmlData.TRAMITACIONSEGUIDA || '',
            legislatura: xmlData.LEGISLATURA || '',
            supertipo: xmlData.SUPERTIPO || '',
            agrupacion: xmlData.AGRUPACION || '',
            tipotramitacion: xmlData.TIPOTRAMITACION || '',
            resultadoTramitacion: xmlData.RESULTADOTRAMITACION || '',
            situacionActual: xmlData.SITUACIONACTUAL || '',
            comisionCompetente: xmlData.COMISIONCOMPETENTE || '',
            plazos: xmlData.PLAZOS || '',
            ponentes: xmlData.PONENTES || '',
            enlacesBOCG: xmlData.ENLACESBOCG || '',
            enlacesDS: xmlData.ENLACESDS || ''
        });
    }

    /**
     * Determina el tipo de iniciativa según la clasificación del Congreso de los Diputados
     * @param {Object} xmlData - Datos del XML
     * @returns {string} Tipo de iniciativa del Congreso
     */
    static determineCongressInitiativeType(xmlData) {
        const tipo = (xmlData.TIPO || '').toString().toLowerCase();
        const tipotramitacion = (xmlData.TIPOTRAMITACION || '').toString().toLowerCase();
        const autor = (xmlData.AUTOR || '').toString().toLowerCase();
        const objeto = (xmlData.OBJETO || '').toString().toLowerCase();

        // 1. TRAMITACIÓN ORDINARIA (Ordinary processing)
        // - Proyecto de ley (Gobierno)
        // - Proposición de ley (Parlamento) - including the longer version
        // - Propuesta del Senado
        if (['proyecto de ley', 'proposición de ley', 'proposición de ley de grupos parlamentarios del congreso'].some(t => tipo.includes(t)) &&
            (!tipotramitacion || tipotramitacion === 'normal' || tipotramitacion === '')) {
            return 'tramitacion_ordinaria';
        }

        // Senate proposals (appear in context but not as main TIPO)
        if (autor.includes('senado') && tipo.includes('proposición de ley')) {
            return 'tramitacion_ordinaria';
        }

        // 2. TRAMITACIÓN URGENTE (Urgent processing)
        // - Proyecto o proposición con procedimiento urgente
        // - Decreto-ley
        if (['proyecto de ley', 'proposición de ley', 'proposición de ley de grupos parlamentarios del congreso'].some(t => tipo.includes(t)) &&
            tipotramitacion === 'urgente') {
            return 'tramitacion_urgente';
        }

        // Decreto-ley (appears in OBJETO field or TIPO)
        if (objeto.includes('decreto-ley') || objeto.includes('decreto ley') ||
            objeto.includes('real decreto-ley') || tipo.includes('decreto-ley') || tipo.includes('decreto ley')) {
            // Only categorize as urgent if it's actually a decree-law initiative, not just a reference
            if (tipo.includes('decreto-ley') || tipo.includes('decreto ley') ||
                (objeto.includes('proyecto de ley') && objeto.includes('decreto-ley'))) {
                return 'tramitacion_urgente';
            }
        }

        // 3. TRAMITACIÓN ESPECIAL (Reinforced majority) - Reforma constitucional
        if (tipo.includes('reforma constitucional') || objeto.includes('reforma constitucional') ||
            tipo.includes('reforma de la constitución') || objeto.includes('reforma de la constitución')) {
            return 'tramitacion_especial_mayoria_reforzada';
        }

        // 4. TRAMITACIÓN DE INICIATIVAS AUTONÓMICAS (Autonomous initiatives)
        // - Propuestas de parlamentos autonómicos que pasan a ámbito estatal
        if (autor.includes('comunidad autónoma') || autor.includes('parlamento') &&
            (autor.includes('cataluña') || autor.includes('galicia') || autor.includes('andalucía') ||
                autor.includes('cantabria') || autor.includes('canarias') || autor.includes('vasco'))) {
            return 'tramitacion_iniciativas_autonomicas';
        }

        // Propuestas de reforma de Estatuto de Autonomía
        if (tipo.includes('propuesta de reforma de estatuto de autonomía')) {
            return 'tramitacion_iniciativas_autonomicas';
        }

        // 5. TRAMITACIÓN DE INICIATIVAS POPULARES (Popular initiatives)
        // - Iniciativa Legislativa Popular (ILP)
        if (autor.includes('popular') || autor.includes('ilp') ||
            tipo.includes('iniciativa legislativa popular') || objeto.includes('iniciativa legislativa popular')) {
            return 'tramitacion_iniciativas_populares';
        }

        // 6. TRAMITACIÓN POR ÓRGANOS CONSTITUCIONALES O CONSULTIVOS
        // - Propuestas o recomendaciones del Defensor del Pueblo, CGPJ, otros órganos
        if (autor.includes('defensor del pueblo') || autor.includes('cgpj') ||
            autor.includes('órgano consultivo') || autor.includes('órgano constitucional') ||
            autor.includes('tribunal constitucional') || autor.includes('consejo de estado') ||
            autor.includes('parlamento europeo')) {
            return 'tramitacion_organos_constitucionales';
        }

        // 7. LEYES APROBADAS (Approved laws)
        if (tipo.includes('leyes') || xmlData.NUMERO_LEY) {
            return 'ley_aprobada';
        }

        // Default fallback - Ordinary processing
        return 'tramitacion_ordinaria';
    }
}

module.exports = Initiative; 