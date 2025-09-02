/**
 * Servicio de Integración con Supabase
 * 
 * Maneja la conexión, validación y subida de datos
 * del Congreso a la base de datos Supabase
 * 
 * Integrado con la nueva arquitectura de servicios
 */

const { createClient } = require('@supabase/supabase-js');
const PoliticalPartyService = require('./PoliticalPartyService');

class SupabaseService {
    constructor() {
        this.supabase = null;
        this.politicalPartyService = new PoliticalPartyService();
        this.init();
    }

    init() {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Missing Supabase credentials');
            }

            this.supabase = createClient(supabaseUrl, supabaseKey);
            console.log('🔌 Supabase client initialized');
        } catch (error) {
            console.error('❌ Error initializing Supabase:', error);
        }
    }

    /**
     * Upload Congress initiatives to Supabase with political party identification
     */
    async uploadInitiatives(initiatives) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log(`📤 Subiendo ${initiatives.length} iniciativas a Supabase...`);

        let uploaded = 0;
        let updated = 0;
        let errors = 0;

        for (let i = 0; i < initiatives.length; i++) {
            const initiative = initiatives[i];
            
            try {
                // Identify political party for this initiative
                const partyInfo = this.politicalPartyService.identifyPoliticalParty(initiative);
                
                // Compute canonical stage classification
                const { stage, step, reason } = this.classifyStage(initiative);

                // Prepare initiative data with political party information and canonical stage
                const initiativeData = {
                    num_expediente: initiative.numExpediente,
                    tipo: initiative.tipo,
                    objeto: initiative.objeto,
                    autor: initiative.autor,
                    fecha_presentacion: this.parseDate(initiative.fechaPresentacion),
                    fecha_calificacion: this.parseDate(initiative.fechaCalificacion),
                    legislatura: initiative.legislatura,
                    supertipo: initiative.supertipo,
                    agrupacion: initiative.agrupacion,
                    tipo_tramitacion: initiative.tipotramitacion,
                    resultado_tramitacion: initiative.resultadotramitacion,
                    situacion_actual: initiative.situacionActual,
                    comision_competente: initiative.comisionCompetente,
                    plazos: initiative.plazos,
                    ponentes: initiative.ponentes,
                    enlaces_bocg: initiative.enlacesbocg,
                    enlaces_ds: initiative.enlacesds,
                    tramitacion_texto: initiative.tramitacionseguida,
                    // Canonical stage fields
                    stage,
                    current_step: step,
                    stage_reason: reason,
                    congress_initiative_type: initiative.congress_initiative_type,
                    // Political party fields
                    political_party_id: partyInfo.party_id,
                    political_party_name: partyInfo.party_name,
                    political_party_short_name: partyInfo.party_short_name,
                    political_party_confidence: partyInfo.confidence,
                    political_party_method: partyInfo.method,
                    political_party_color: partyInfo.color,
                    // NLP processed fields
                    accessible_title: initiative.accessibleTitle || initiative.objeto,
                    nlp_subject_area: initiative.nlpMetadata?.subjectArea || null,
                    nlp_urgency: initiative.nlpMetadata?.urgency || null,
                    nlp_complexity: initiative.nlpMetadata?.complexity || null,
                    nlp_readability: initiative.nlpMetadata?.estimatedReadability || null,
                    nlp_action: initiative.nlpExtracted?.action || null,
                    nlp_purpose: initiative.nlpExtracted?.purpose || null,
                    nlp_specific_changes: initiative.nlpExtracted?.specificChanges || null,
                    nlp_regulation_scope: initiative.nlpExtracted?.regulationScope || null
                };

                // Check if initiative already exists (fetch current stage for history)
                const { data: existing } = await this.supabase
                    .from('congress_initiatives')
                    .select('id, stage, current_step')
                    .eq('num_expediente', initiative.numExpediente)
                    .single();

                if (existing) {
                    // Update existing initiative
                    const { error } = await this.supabase
                        .from('congress_initiatives')
                        .update(initiativeData)
                        .eq('id', existing.id);

                    if (error) throw error;
                    updated++;
                    // Stage history: record transition when changed
                    if (!existing.stage || existing.stage !== stage || existing.current_step !== step) {
                        await this.insertStageHistory(existing.id, stage, step, reason);
                    }
                } else {
                    // Insert new initiative
                    const { data: inserted, error } = await this.supabase
                        .from('congress_initiatives')
                        .insert(initiativeData)
                        .select()
                        .single();

                    if (error) throw error;
                    uploaded++;
                    if (inserted && inserted.id) {
                        await this.insertStageHistory(inserted.id, stage, step, reason);
                    }
                }

                // Create political party relationship
                if (partyInfo.party_id && partyInfo.party_id !== 'desconocido') {
                    await this.createInitiativePartyRelationship(existing?.id || initiative.numExpediente, partyInfo);
                }

                // Progress indicator
                if ((i + 1) % 100 === 0) {
                    console.log(`📊 Progreso: ${i + 1}/${initiatives.length} iniciativas procesadas`);
                }

            } catch (error) {
                console.error(`❌ Error processing initiative ${initiative.numExpediente}:`, error);
                errors++;
            }
        }

        console.log('✅ Subida de iniciativas completada');
        return { uploaded, updated, errors };
    }

    /**
     * Classify canonical stage and step with deterministic rules
     */
    classifyStage(initiative) {
        const resultado = (initiative.resultadoTramitacion || initiative.resultadotramitacion || '').toLowerCase();
        const situacion = (initiative.situacionActual || '').toLowerCase();
        const tramitacion = (initiative.tramitacion || initiative.tramitacionseguida || '').toLowerCase();
        const comision = (initiative.comisionCompetente || '').toLowerCase();
        const enlaces = `${(initiative.enlacesBOCG || initiative.enlacesbocg || '')} ${(initiative.enlacesDS || initiative.enlacesds || '')}`.toLowerCase();
        const text = `${resultado} ${situacion} ${tramitacion} ${comision} ${enlaces}`;

        const has = (kw) => text.includes(kw);
        const signals = {
            hasAprob: resultado.includes('aprob'),
            hasRechaz: resultado.includes('rechaz'),
            hasRetir: resultado.includes('retirad'),
            // Keep text heuristic for logging only
            hasBOEText: has('boe') || has('publicación') || has('publicacion') || has('entrada en vigor'),
            hasVerifiedBOE: Boolean(initiative.boe_url || initiative.boe_id),
            hasVotacion: has('votación') || has('votacion') || has('voto') || has('aprobación') || has('aprobacion') || has('senado'),
            hasComision: has('comisión') || has('comision') || has('ponencia') || has('dictamen') || has('enmiendas parciales'),
            hasDebate: has('totalidad') || has('debate en el pleno') || has('toma en consideración') || has('toma en consideracion') || has('pleno'),
            isClosed: situacion.includes('cerrado')
        };

        const reason = { signals };
        if (signals.hasAprob) return { stage: 'passed', step: 4, reason };
        if (signals.hasRechaz) return { stage: 'rejected', step: 2, reason };
        if (signals.hasRetir) return { stage: 'withdrawn', step: 1, reason };
        if (signals.hasVerifiedBOE) return { stage: 'published', step: 5, reason };
        if (signals.hasVotacion) return { stage: 'voting', step: 4, reason };
        if (signals.hasComision) return { stage: 'committee', step: 3, reason };
        if (signals.hasDebate) return { stage: 'debating', step: 2, reason };
        if (signals.isClosed) return { stage: 'closed', step: 1, reason };
        return { stage: 'proposed', step: 1, reason };
    }

    async insertStageHistory(initiativeId, stage, step, reason) {
        try {
            await this.supabase
                .from('congress_stage_history')
                .insert({ initiative_id: initiativeId, stage, step, reason });
        } catch (e) {
            console.warn(`⚠️  Warning: Could not insert stage history for ${initiativeId}: ${e.message}`);
        }
    }

    /**
     * Create relationship between initiative and political party
     */
    async createInitiativePartyRelationship(initiativeId, partyInfo) {
        try {
            // First, ensure the political party exists in the parties table
            await this.ensurePoliticalPartyExists(partyInfo);

            // Get the actual initiative ID from the database
            let dbInitiativeId = initiativeId;
            
            // If initiativeId is not a UUID, we need to get the actual database ID
            if (typeof initiativeId === 'string' && !initiativeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                // It's an expediente number or other identifier, need to get the actual UUID
                const { data: initiative, error } = await this.supabase
                    .from('congress_initiatives')
                    .select('id')
                    .eq('num_expediente', initiativeId)
                    .single();
                
                if (error || !initiative) {
                    console.warn(`⚠️  Warning: Could not find initiative with expediente ${initiativeId}: ${error?.message || 'Not found'}`);
                    return; // Initiative not found
                }
                
                dbInitiativeId = initiative.id;
            }

            // Check if relationship already exists
            const { data: existing, error: checkError } = await this.supabase
                .from('congress_initiative_parties')
                .select('id')
                .eq('initiative_id', dbInitiativeId)
                .eq('party_id', partyInfo.party_short_name)
                .eq('relationship_type', 'promoter')
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.warn(`⚠️  Warning: Error checking existing relationship: ${checkError.message}`);
                return;
            }

            if (!existing) {
                // Create new relationship
                const { error: insertError } = await this.supabase
                    .from('congress_initiative_parties')
                    .insert({
                        initiative_id: dbInitiativeId,
                        party_id: partyInfo.party_short_name,
                        relationship_type: 'promoter',
                        confidence: partyInfo.confidence,
                        method: partyInfo.method
                    });

                if (insertError) {
                    console.warn(`⚠️  Warning: Could not create party relationship: ${insertError.message}`);
                } else {
                    console.log(`✅ Created party relationship: ${partyInfo.party_short_name} -> Initiative ${initiativeId}`);
                }
            } else {
                console.log(`ℹ️  Party relationship already exists: ${partyInfo.party_short_name} -> Initiative ${initiativeId}`);
            }
        } catch (error) {
            console.warn(`⚠️  Warning: Error creating party relationship: ${error.message}`);
        }
    }

    /**
     * Ensure political party exists in the parties table
     */
    async ensurePoliticalPartyExists(partyInfo) {
        try {
            // Check if party already exists
            const { data: existing } = await this.supabase
                .from('political_parties')
                .select('short_name')
                .eq('short_name', partyInfo.party_short_name)
                .single();

            if (!existing) {
                // Insert new party
                const { error } = await this.supabase
                    .from('political_parties')
                    .insert({
                        name: partyInfo.party_name,
                        short_name: partyInfo.party_short_name,
                        color: partyInfo.color,
                        is_active: true
                    });

                if (error) {
                    console.warn(`⚠️  Warning: Could not insert political party: ${error.message}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️  Warning: Error ensuring political party exists: ${error.message}`);
        }
    }

    /**
     * Upload relationships between initiatives
     */
    async uploadRelationships(relationships) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log(`📤 Subiendo ${relationships.length} relaciones a Supabase...`);

        let uploaded = 0;
        let errors = 0;

        for (const relationship of relationships) {
            try {
                const { error } = await this.supabase
                    .from('congress_relationships')
                    .upsert({
                        iniciativa_origen: relationship.iniciativa_origen,
                        iniciativa_relacionada: relationship.iniciativa_relacionada,
                        tipo_relacion: relationship.tipo_relacion,
                        similitud: relationship.similitud
                    }, { onConflict: 'iniciativa_origen,iniciativa_relacionada' });

                if (error) throw error;
                uploaded++;
            } catch (error) {
                console.error(`❌ Error uploading relationship:`, error);
                errors++;
            }
        }

        console.log('✅ Subida de relaciones completada');
        return { uploaded, errors };
    }

    /**
     * Upload timeline events
     */
    async uploadTimelineEvents(timelineEvents) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log(`📤 Subiendo ${timelineEvents.length} eventos de timeline a Supabase...`);

        let uploaded = 0;
        let errors = 0;

        for (const event of timelineEvents) {
            try {
                const { error } = await this.supabase
                    .from('congress_timeline_events')
                    .upsert({
                        iniciativa_id: event.iniciativa_id,
                        evento: event.evento,
                        fecha_inicio: this.parseDate(event.fecha_inicio),
                        fecha_fin: this.parseDate(event.fecha_fin),
                        orden: event.orden
                    }, { onConflict: 'iniciativa_id,evento' });

                if (error) throw error;
                uploaded++;
            } catch (error) {
                console.error(`❌ Error uploading timeline event:`, error);
                errors++;
            }
        }

        console.log('✅ Subida de eventos de timeline completada');
        return { uploaded, errors };
    }

    /**
     * Upload keywords
     */
    async uploadKeywords(keywords) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log(`📤 Subiendo ${keywords.length} palabras clave a Supabase...`);

        let uploaded = 0;
        let errors = 0;

        for (const keyword of keywords) {
            try {
                const { error } = await this.supabase
                    .from('congress_keywords')
                    .upsert({
                        palabra: keyword.palabra,
                        frecuencia: keyword.frecuencia,
                        iniciativas_asociadas: keyword.iniciativas_asociadas
                    }, { onConflict: 'palabra' });

                if (error) throw error;
                uploaded++;
            } catch (error) {
                console.error(`❌ Error uploading keyword:`, error);
                errors++;
            }
        }

        console.log('✅ Subida de palabras clave completada');
        return { uploaded, errors };
    }

    /**
     * Main upload method that orchestrates all uploads
     */
    async uploadToSupabase(initiatives, relationships = [], timelineEvents = [], keywords = []) {
        try {
            console.log('📤 Subiendo datos a Supabase...');

            // Test connection
            if (!await this.testConnection()) {
                throw new Error('No se pudo conectar a Supabase');
            }

            // Upload initiatives (this will also create political party relationships)
            const initiativesResult = await this.uploadInitiatives(initiatives);

            // Upload other data
            const relationshipsResult = relationships.length > 0 ? 
                await this.uploadRelationships(relationships) : { uploaded: 0, errors: 0 };
            
            const timelineResult = timelineEvents.length > 0 ? 
                await this.uploadTimelineEvents(timelineEvents) : { uploaded: 0, errors: 0 };
            
            const keywordsResult = keywords.length > 0 ? 
                await this.uploadKeywords(keywords) : { uploaded: 0, errors: 0 };

            const totalStats = {
                initiativesUploaded: initiativesResult.uploaded,
                initiativesUpdated: initiativesResult.updated,
                relationshipsUploaded: relationshipsResult.uploaded,
                timelineEventsUploaded: timelineResult.uploaded,
                keywordsUploaded: keywordsResult.uploaded,
                errors: initiativesResult.errors + relationshipsResult.errors + 
                        timelineResult.errors + keywordsResult.errors
            };

            console.log('✅ Subida a Supabase completada exitosamente');
            return totalStats;

        } catch (error) {
            console.error('❌ Error en la subida a Supabase:', error);
            throw error;
        }
    }

    /**
     * Test connection to Supabase
     */
    async testConnection() {
        try {
            if (!this.supabase) {
                return false;
            }

            const { data, error } = await this.supabase
                .from('congress_initiatives')
                .select('count')
                .limit(1);

            if (error) {
                console.error('❌ Error de conexión:', error.message);
                return false;
            }

            console.log('✅ Conexión a Supabase establecida exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error probando conexión:', error.message);
            return false;
        }
    }

    /**
     * Parse date string to ISO format
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            // Handle Spanish date format (DD/MM/YYYY)
            if (dateString.includes('/')) {
                const [day, month, year] = dateString.split('/');
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // Handle ISO format
            return new Date(dateString).toISOString().split('T')[0];
        } catch (error) {
            console.warn(`⚠️  Warning: Could not parse date: ${dateString}`);
            return null;
        }
    }

    /**
     * Get political party statistics from Supabase
     */
    async getPoliticalPartyStats() {
        try {
            const { data, error } = await this.supabase
                .from('congress_initiatives')
                .select('political_party_short_name, political_party_confidence')
                .not('political_party_short_name', 'is', null);

            if (error) throw error;

            const stats = {};
            data.forEach(initiative => {
                const party = initiative.political_party_short_name;
                if (!stats[party]) {
                    stats[party] = { total: 0, high_confidence: 0, medium_confidence: 0, low_confidence: 0 };
                }
                stats[party].total++;
                stats[party][`${initiative.political_party_confidence}_confidence`]++;
            });

            return stats;
        } catch (error) {
            console.error('❌ Error getting political party stats:', error);
            return {};
        }
    }

    /**
     * Sube un lote de iniciativas
     * @param {Array} batch - Lote de iniciativas
     */
    async uploadBatch(batch) {
        for (const initiative of batch) {
            try {
                await this.uploadSingleInitiative(initiative);
            } catch (error) {
                console.error(`❌ Error subiendo iniciativa ${initiative.numExpediente}:`, error.message);
                this.stats.errors++;
            }
        }
    }

    /**
     * Sube una iniciativa individual
     * @param {Object} initiative - Datos de la iniciativa
     */
    async uploadSingleInitiative(initiative) {
        // Preparar datos para la base de datos
        const initiativeData = {
            num_expediente: initiative.numExpediente,
            tipo: this.convertInitiativeType(initiative.tipo),
            congress_initiative_type: initiative.congress_initiative_type,
            objeto: initiative.objeto,
            autor: initiative.autor,
            fecha_presentacion: this.convertSpanishDate(initiative.fechaPresentacion),
            fecha_calificacion: this.convertSpanishDate(initiative.fechaCalificacion),
            legislatura: initiative.legislatura,
            supertipo: initiative.supertipo,
            agrupacion: initiative.agrupacion,
            tipo_tramitacion: initiative.tipoTramitacion,
            resultado_tramitacion: initiative.resultadoTramitacion,
            situacion_actual: initiative.situacionActual,
            comision_competente: initiative.comisionCompetente,
            plazos: initiative.plazos,
            ponentes: initiative.ponentes,
            enlaces_bocg: initiative.enlacesBOCG,
            enlaces_ds: initiative.enlacesDS,
            tramitacion_texto: initiative.tramitacion
        };

        // Verificar si la iniciativa ya existe
        const { data: existing } = await this.supabase
            .from('congress_initiatives')
            .select('id')
            .eq('num_expediente', initiative.numExpediente)
            .single();

        let result;
        if (existing) {
            // Actualizar iniciativa existente
            const { data, error } = await this.supabase
                .from('congress_initiatives')
                .update(initiativeData)
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            
            result = data;
            this.uploadedInitiatives.set(initiative.numExpediente, existing.id);
            this.stats.initiativesUpdated++;
            
        } else {
            // Insertar nueva iniciativa
            const { data, error } = await this.supabase
                .from('congress_initiatives')
                .insert(initiativeData)
                .select()
                .single();

            if (error) throw error;
            
            result = data;
            this.uploadedInitiatives.set(initiative.numExpediente, result.id);
            this.stats.initiativesUploaded++;
        }

        // Subir timeline si existe
        if (initiative.timeline && initiative.timeline.length > 0) {
            await this.uploadTimelineEvents(initiative.numExpediente, initiative.timeline);
        }

        // Subir relaciones si existen
        if (initiative.relacionesDirectas && initiative.relacionesDirectas.length > 0) {
            await this.uploadRelationships(initiative.numExpediente, initiative.relacionesDirectas);
        }

        // Subir similitudes si existen
        if (initiative.similares && initiative.similares.length > 0) {
            await this.uploadSimilarities(initiative.numExpediente, initiative.similares);
        }
    }

    /**
     * Sube eventos del timeline
     * @param {string} expediente - Número de expediente
     * @param {Array} timeline - Array de eventos del timeline
     */
    async uploadTimelineEvents(expediente, timeline) {
        const initiativeId = this.uploadedInitiatives.get(expediente);
        if (!initiativeId) return;

        const timelineData = timeline.map((event, index) => ({
            initiative_id: initiativeId,
            evento: event.evento,
            fecha_inicio: this.convertSpanishDate(event.fechaInicio),
            fecha_fin: this.convertSpanishDate(event.fechaFin),
            descripcion: event.descripcion,
            orden: index + 1
        }));

        try {
            // Eliminar eventos existentes
            await this.supabase
                .from('congress_timeline_events')
                .delete()
                .eq('initiative_id', initiativeId);

            // Insertar nuevos eventos
            const { error } = await this.supabase
                .from('congress_timeline_events')
                .insert(timelineData);

            if (error) throw error;

            this.stats.timelineEventsUploaded += timelineData.length;
            
        } catch (error) {
            console.error(`❌ Error subiendo timeline para ${expediente}:`, error.message);
        }
    }

    /**
     * Sube relaciones directas
     * @param {string} expediente - Número de expediente
     * @param {Array} relaciones - Array de relaciones directas
     */
    async uploadRelationships(expediente, relaciones) {
        const initiativeId = this.uploadedInitiatives.get(expediente);
        if (!initiativeId) return;

        // Filtrar relaciones válidas y únicas
        const validRelations = new Map();
        
        relaciones.forEach(rel => {
            const targetId = this.uploadedInitiatives.get(rel.expediente);
            if (targetId) {
                // Crear clave única para evitar duplicados
                const key = `${initiativeId}-${targetId}-relacionada`;
                if (!validRelations.has(key)) {
                    validRelations.set(key, {
                        source_initiative_id: initiativeId,
                        target_initiative_id: targetId,
                        relationship_type: 'relacionada'
                    });
                }
            }
        });

        const relationshipData = Array.from(validRelations.values());
        if (relationshipData.length === 0) return;

        try {
            // Eliminar relaciones existentes
            await this.supabase
                .from('congress_relationships')
                .delete()
                .eq('source_initiative_id', initiativeId)
                .eq('relationship_type', 'relacionada');

            // Insertar nuevas relaciones
            const { error } = await this.supabase
                .from('congress_relationships')
                .insert(relationshipData);

            if (error) throw error;

            this.stats.relationshipsUploaded += relationshipData.length;
            
        } catch (error) {
            console.error(`❌ Error subiendo relaciones para ${expediente}:`, error.message);
        }
    }

    /**
     * Sube similitudes entre iniciativas
     * @param {string} expediente - Número de expediente
     * @param {Array} similares - Array de iniciativas similares
     */
    async uploadSimilarities(expediente, similares) {
        const initiativeId = this.uploadedInitiatives.get(expediente);
        if (!initiativeId) return;

        // Filtrar similitudes válidas y únicas
        const validSimilarities = new Map();
        
        similares.forEach(sim => {
            const targetId = this.uploadedInitiatives.get(sim.expediente);
            if (targetId) {
                // Crear clave única para evitar duplicados
                const key = `${initiativeId}-${targetId}-similar`;
                if (!validSimilarities.has(key)) {
                    validSimilarities.set(key, {
                        source_initiative_id: initiativeId,
                        target_initiative_id: targetId,
                        similarity_score: sim.similitud,
                        relationship_type: 'similar'
                    });
                }
            }
        });

        const similarityData = Array.from(validSimilarities.values());
        if (similarityData.length === 0) return;

        try {
            // Eliminar similitudes existentes
            await this.supabase
                .from('congress_relationships')
                .delete()
                .eq('source_initiative_id', initiativeId)
                .eq('relationship_type', 'similar');

            // Insertar nuevas similitudes
            const { error } = await this.supabase
                .from('congress_relationships')
                .insert(similarityData);

            if (error) throw error;

            this.stats.relationshipsUploaded += similarityData.length;
            
        } catch (error) {
            console.error(`❌ Error subiendo similitudes para ${expediente}:`, error.message);
        }
    }

    /**
     * Convierte fecha española (DD/MM/YYYY) a formato ISO
     * @param {string} fechaEspanol - Fecha en formato DD/MM/YYYY
     * @returns {string|null} Fecha ISO o null si es inválida
     */
    convertSpanishDate(fechaEspanol) {
        if (!fechaEspanol || typeof fechaEspanol !== 'string') {
            return null;
        }
        
        const match = fechaEspanol.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) {
            return null;
        }
        
        const [, dia, mes, año] = match;
        return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    /**
     * Convierte tipo de iniciativa a enum de base de datos
     * @param {string} tipo - Tipo de iniciativa del XML
     * @returns {string} Valor enum de la base de datos
     */
    convertInitiativeType(tipo) {
        if (!tipo) return 'Proyecto de ley';
        
        const typeMapping = {
            'Proyecto de Ley': 'Proyecto de ley',
            'Proposición de Ley': 'Proposición de ley',
            'Propuesta de Reforma': 'Propuesta de reforma',
            'Iniciativa Legislativa Aprobada': 'Iniciativa legislativa aprobada',
            'Ley': 'Ley',
            'Enmienda': 'Enmienda',
            'Moción': 'Moción'
        };
        
        return typeMapping[tipo] || 'Proyecto de ley';
    }

    /**
     * Obtiene estadísticas de la subida
     * @returns {Object} Estadísticas de la subida
     */
    getUploadStats() {
        return { ...this.stats };
    }

    /**
     * Limpia las estadísticas
     */
    clearStats() {
        this.stats = {
            initiativesUploaded: 0,
            initiativesUpdated: 0,
            relationshipsUploaded: 0,
            timelineEventsUploaded: 0,
            keywordsUploaded: 0,
            errors: 0
        };
    }

    /**
     * Obtiene el estado de conexión
     * @returns {boolean} true si está conectado
     */
    isConnected() {
        return this.isConnected;
    }

    /**
     * Cierra la conexión con Supabase
     */
    async disconnect() {
        if (this.supabase) {
            this.supabase = null;
            this.isConnected = false;
            console.log('🔌 Conexión a Supabase cerrada');
        }
    }

    /**
     * Ejecuta una consulta personalizada en Supabase
     * @param {string} query - Consulta SQL personalizada
     * @returns {Promise<Object>} Resultado de la consulta
     */
    async executeCustomQuery(query) {
        if (!this.isConnected) {
            throw new Error('No hay conexión activa con Supabase');
        }

        try {
            const { data, error } = await this.supabase.rpc('execute_sql', { sql_query: query });
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('❌ Error ejecutando consulta personalizada:', error.message);
            throw error;
        }
    }

    /**
     * Obtiene iniciativas relacionadas desde la base de datos
     * @param {string} expediente - Número de expediente
     * @returns {Promise<Array>} Array de iniciativas relacionadas
     */
    async getRelatedInitiatives(expediente) {
        if (!this.isConnected) {
            throw new Error('No hay conexión activa con Supabase');
        }

        try {
            const { data, error } = await this.supabase.rpc('get_related_initiatives', {
                expediente_param: expediente
            });

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error(`❌ Error obteniendo iniciativas relacionadas para ${expediente}:`, error.message);
            return [];
        }
    }

    /**
     * Obtiene timeline de una iniciativa desde la base de datos
     * @param {string} expediente - Número de expediente
     * @returns {Promise<Array>} Array de eventos del timeline
     */
    async getInitiativeTimeline(expediente) {
        if (!this.isConnected) {
            throw new Error('No hay conexión activa con Supabase');
        }

        try {
            const { data, error } = await this.supabase.rpc('get_initiative_timeline', {
                expediente_param: expediente
            });

            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error(`❌ Error obteniendo timeline para ${expediente}:`, error.message);
            return [];
        }
    }
}

module.exports = SupabaseService; 