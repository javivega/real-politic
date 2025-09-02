const fs = require('fs-extra');
const path = require('path');

/**
 * Service to track the complete legislative flow from initiatives to approved laws
 * Creates a comprehensive timeline showing the journey of each law
 */
class LegislativeFlowService {
    constructor() {
        this.initiatives = [];
        this.approvedLaws = [];
        this.legislativeTimelines = [];
    }

    /**
     * Load all legislative data from processed files
     */
    async loadLegislativeData() {
        try {
            // Load processed initiatives
            const initiativesPath = path.join(__dirname, '../output/iniciativas-completas.json');
            if (await fs.pathExists(initiativesPath)) {
                this.initiatives = await fs.readJson(initiativesPath);
                console.log(`📋 Loaded ${this.initiatives.length} initiatives`);
            } else {
                console.log('⚠️  No processed initiatives found. Run the full pipeline first.');
            }

            // Load approved laws from the specific file
            const approvedLawsPath = path.join(__dirname, '../scripts/downloads/14082025/congress-iniciativas-legislativas-aprobadas-1755190292442.xml');
            if (await fs.pathExists(approvedLawsPath)) {
                const xmlContent = await fs.readFile(approvedLawsPath, 'utf8');
                this.approvedLaws = this.parseApprovedLawsXML(xmlContent);
                console.log(`📜 Loaded ${this.approvedLaws.length} approved laws`);
            } else {
                console.log('⚠️  No approved laws file found. Check the downloads directory.');
            }

            return this.initiatives.length > 0 || this.approvedLaws.length > 0;
        } catch (error) {
            console.error('❌ Error loading legislative data:', error);
            return false;
        }
    }

    /**
     * Parse the approved laws XML file
     */
    parseApprovedLawsXML(xmlContent) {
        const laws = [];
        const lawRegex = /<result>([\s\S]*?)<\/result>/g;
        let match;

        while ((match = lawRegex.exec(xmlContent)) !== null) {
            const lawContent = match[1];
            
            const law = {
                tipo: this.extractXMLField(lawContent, 'TIPO'),
                numero_ley: this.extractXMLField(lawContent, 'NUMERO_LEY'),
                titulo_ley: this.extractXMLField(lawContent, 'TITULO_LEY'),
                numero_boletin: this.extractXMLField(lawContent, 'NUMERO_BOLETIN'),
                fecha_boletin: this.extractXMLField(lawContent, 'FECHA_BOLETIN'),
                fecha_ley: this.extractXMLField(lawContent, 'FECHA_LEY'),
                pdf_url: this.extractXMLField(lawContent, 'PDF'),
                year: this.extractYearFromLawTitle(this.extractXMLField(lawContent, 'TITULO_LEY'))
            };

            if (law.numero_ley && law.titulo_ley) {
                laws.push(law);
            }
        }

        return laws;
    }

    /**
     * Extract year from law title (e.g., "Ley 7/2025" -> "2025")
     */
    extractYearFromLawTitle(title) {
        if (!title) return null;
        const yearRegex = /Ley\s+\d+\/(\d{4})/;
        const match = title.match(yearRegex);
        return match ? match[1] : null;
    }

    /**
     * Extract field value from XML content
     */
    extractXMLField(content, fieldName) {
        const regex = new RegExp(`<${fieldName}>(.*?)</${fieldName}>`, 's');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Match initiatives with approved laws to create legislative timelines
     */
    createLegislativeTimelines() {
        console.log('🔗 Creating legislative timelines...');
        
        this.legislativeTimelines = [];

        // Process each approved law
        this.approvedLaws.forEach(law => {
            const timeline = this.createTimelineForLaw(law);
            if (timeline) {
                this.legislativeTimelines.push(timeline);
            }
        });

        // Process initiatives that don't have approved laws yet
        this.initiatives.forEach(initiative => {
            if (!this.isInitiativeInTimeline(initiative)) {
                const timeline = this.createTimelineForInitiative(initiative);
                if (timeline) {
                    this.legislativeTimelines.push(timeline);
                }
            }
        });

        console.log(`📊 Created ${this.legislativeTimelines.length} legislative timelines`);
        return this.legislativeTimelines;
    }

    /**
     * Create timeline for a specific approved law
     */
    createTimelineForLaw(law) {
        const timeline = {
            law_id: `law_${law.year}_${law.numero_ley}`,
            law_number: law.numero_ley,
            law_year: law.year,
            law_title: law.titulo_ley,
            law_type: law.tipo,
            final_status: 'approved',
            final_publication_date: law.fecha_ley,
            final_boletin: law.numero_boletin,
            pdf_url: law.pdf_url,
            timeline_events: [],
            related_initiatives: [],
            legislative_phase: 'completed'
        };

        // Try to find related initiatives
        const relatedInitiatives = this.findRelatedInitiatives(law);
        timeline.related_initiatives = relatedInitiatives;

        // Create timeline events following Spanish legislative procedure
        if (relatedInitiatives.length > 0) {
            // 1. PRESENTACIÓN (Presentation Phase)
            relatedInitiatives.forEach(initiative => {
                // 1a. Presentación de la iniciativa
                timeline.timeline_events.push({
                    date: initiative.fechaPresentacion,
                    event_type: 'presentacion_iniciativa',
                    phase: 'presentacion',
                    phase_step: '1a',
                    description: `${initiative.tipo} presentado por ${initiative.autor}`,
                    initiative_id: initiative.numExpediente,
                    details: {
                        expediente: initiative.numExpediente,
                        autor: initiative.autor,
                        objeto: initiative.objeto,
                        tipo_tramitacion: initiative.tipotramitacion
                    }
                });

                // 1b. Calificación por la Mesa del Congreso
                if (initiative.fechaCalificacion) {
                    timeline.timeline_events.push({
                        date: initiative.fechaCalificacion,
                        event_type: 'calificacion_mesa',
                        phase: 'presentacion',
                        phase_step: '1b',
                        description: 'Iniciativa calificada y admitida a trámite por la Mesa del Congreso',
                        initiative_id: initiative.numExpediente,
                        details: {
                            expediente: initiative.numExpediente,
                            comision: initiative.comisionCompetente
                        }
                    });
                }

                // 1c. Toma en consideración (for propositions)
                if (initiative.tipo && initiative.tipo.toLowerCase().includes('proposición')) {
                    timeline.timeline_events.push({
                        date: initiative.fechaCalificacion || initiative.fechaPresentacion,
                        event_type: 'toma_consideracion',
                        phase: 'presentacion',
                        phase_step: '1c',
                        description: 'Toma en consideración de la proposición de ley',
                        initiative_id: initiative.numExpediente,
                        details: {
                            expediente: initiative.numExpediente,
                            tipo: initiative.tipo
                        }
                    });
                }

                // 1d. Publicación del texto (assumed after qualification)
                if (initiative.fechaCalificacion) {
                    timeline.timeline_events.push({
                        date: this.addDays(initiative.fechaCalificacion, 1),
                        event_type: 'publicacion_texto',
                        phase: 'presentacion',
                        phase_step: '1d',
                        description: 'Publicación del texto de la iniciativa en el BOCG',
                        initiative_id: initiative.numExpediente,
                        details: {
                            expediente: initiative.numExpediente,
                            boletin: 'BOCG'
                        }
                    });
                }
            });

            // 2. DEBATE (Debate Phase)
            // 2a. Enmiendas a la totalidad (if applicable)
            // 2b. Debate de totalidad en el Pleno
            timeline.timeline_events.push({
                date: this.estimateDebateDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'debate_totalidad',
                phase: 'debate',
                phase_step: '2b',
                description: 'Debate de totalidad en el Pleno del Congreso',
                details: {
                    fase: 'Debate de totalidad',
                    lugar: 'Pleno del Congreso'
                }
            });

            // 3. TRABAJO (Work Phase)
            // 3a. Envío a Comisión
            relatedInitiatives.forEach(initiative => {
                if (initiative.comisionCompetente) {
                    timeline.timeline_events.push({
                        date: this.addDays(initiative.fechaCalificacion, 5),
                        event_type: 'envio_comision',
                        phase: 'trabajo',
                        phase_step: '3a',
                        description: `Envío a ${initiative.comisionCompetente}`,
                        initiative_id: initiative.numExpediente,
                        details: {
                            expediente: initiative.numExpediente,
                            comision: initiative.comisionCompetente
                        }
                    });
                }
            });

            // 3b. Enmiendas parciales (estimated)
            timeline.timeline_events.push({
                date: this.estimateAmendmentDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'enmiendas_parciales',
                phase: 'trabajo',
                phase_step: '3b',
                description: 'Presentación de enmiendas parciales al articulado',
                details: {
                    tipo: 'Enmiendas parciales',
                    plazo: 'Establecido por la Comisión'
                }
            });

            // 3c. Comparecencias de expertos (optional, estimated)
            timeline.timeline_events.push({
                date: this.estimateExpertHearingDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'comparecencias_expertos',
                phase: 'trabajo',
                phase_step: '3c',
                description: 'Comparecencias de expertos y audiencias (opcional)',
                details: {
                    tipo: 'Audiencias y comparecencias',
                    obligatorio: false
                }
            });

            // 3d. Dictamen de la Ponencia
            timeline.timeline_events.push({
                date: this.estimateReportDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'dictamen_ponencia',
                phase: 'trabajo',
                phase_step: '3d',
                description: 'Redacción del dictamen por la Ponencia y aprobación en Comisión',
                details: {
                    fase: 'Dictamen de Ponencia',
                    lugar: 'Comisión'
                }
            });

            // 4. APROBACIÓN (Approval Phase)
            // 4a. Debate y votación en el Pleno del Congreso
            timeline.timeline_events.push({
                date: this.estimatePlenaryVoteDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'votacion_congreso',
                phase: 'aprobacion',
                phase_step: '4a',
                description: 'Debate y votación en el Pleno del Congreso',
                details: {
                    fase: 'Votación en Pleno',
                    lugar: 'Congreso de los Diputados',
                    resultado: 'Aprobado'
                }
            });

            // 4b. Envío al Senado
            timeline.timeline_events.push({
                date: this.addDays(this.estimatePlenaryVoteDate(relatedInitiatives[0].fechaCalificacion), 1),
                event_type: 'envio_senado',
                phase: 'aprobacion',
                phase_step: '4b',
                description: 'Envío del texto aprobado al Senado',
                details: {
                    destino: 'Senado',
                    fase: 'Tramitación en Cámara Alta'
                }
            });

            // 4c. Enmiendas o veto del Senado (estimated)
            timeline.timeline_events.push({
                date: this.estimateSenateReviewDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'revision_senado',
                phase: 'aprobacion',
                phase_step: '4c',
                description: 'Revisión, enmiendas o veto del Senado',
                details: {
                    cámara: 'Senado',
                    plazo: '2 meses (primer veto) / 20 días (segundo veto)'
                }
            });

            // 4d. Aprobación definitiva por el Congreso
            timeline.timeline_events.push({
                date: this.estimateFinalApprovalDate(relatedInitiatives[0].fechaCalificacion),
                event_type: 'aprobacion_definitiva',
                phase: 'aprobacion',
                phase_step: '4d',
                description: 'Aprobación definitiva por el Congreso de los Diputados',
                details: {
                    fase: 'Aprobación definitiva',
                    lugar: 'Congreso de los Diputados',
                    resultado: 'Ley aprobada'
                }
            });
        }

        // 5. PUBLICACIÓN (Publication Phase)
        // 5a. Sanción por el Rey
        timeline.timeline_events.push({
            date: this.addDays(law.fecha_ley, -1),
            event_type: 'sancion_rey',
            phase: 'publicacion',
            phase_step: '5a',
            description: 'Sanción por Su Majestad el Rey',
            details: {
                fase: 'Sanción Real',
                requisito: 'Constitucional'
            }
        });

        // 5b. Publicación en el BOE
        timeline.timeline_events.push({
            date: law.fecha_ley,
            event_type: 'publicacion_boe',
            phase: 'publicacion',
            phase_step: '5b',
            description: `Ley ${law.numero_ley} publicada en el BOE`,
            details: {
                boletin: law.numero_boletin,
                fecha: law.fecha_ley,
                pdf_url: law.pdf_url
            }
        });

        // 5c. Entrada en vigor
        timeline.timeline_events.push({
            date: this.addDays(law.fecha_ley, 20),
            event_type: 'entrada_vigor',
            phase: 'publicacion',
            phase_step: '5c',
            description: 'Entrada en vigor de la ley',
            details: {
                plazo: '20 días desde publicación (salvo disposición contraria)',
                fecha: this.addDays(law.fecha_ley, 20)
            }
        });

        // Sort timeline events by date
        timeline.timeline_events.sort((a, b) => new Date(a.date) - new Date(b.date));

        return timeline;
    }

    /**
     * Create timeline for an initiative that doesn't have an approved law yet
     */
    createTimelineForInitiative(initiative) {
        const timeline = {
            initiative_id: initiative.numExpediente,
            initiative_type: initiative.tipo,
            author: initiative.autor,
            object: initiative.objeto,
            current_status: initiative.situacionActual,
            final_status: this.determineFinalStatus(initiative),
            timeline_events: [],
            related_laws: [],
            legislative_phase: this.determineLegislativePhase(initiative)
        };

        // 1. PRESENTACIÓN (Presentation Phase)
        // 1a. Presentación de la iniciativa
        timeline.timeline_events.push({
            date: initiative.fechaPresentacion,
            event_type: 'presentacion_iniciativa',
            phase: 'presentacion',
            phase_step: '1a',
            description: `${initiative.tipo} presentado por ${initiative.autor}`,
            details: {
                expediente: initiative.numExpediente,
                autor: initiative.autor,
                objeto: initiative.objeto,
                tipo_tramitacion: initiative.tipotramitacion
            }
        });

        // 1b. Calificación por la Mesa del Congreso
        if (initiative.fechaCalificacion) {
            timeline.timeline_events.push({
                date: initiative.fechaCalificacion,
                event_type: 'calificacion_mesa',
                phase: 'presentacion',
                phase_step: '1b',
                description: 'Iniciativa calificada y admitida a trámite por la Mesa del Congreso',
                details: {
                    expediente: initiative.numExpediente,
                    comision: initiative.comisionCompetente
                }
            });

            // 1d. Publicación del texto
            timeline.timeline_events.push({
                date: this.addDays(initiative.fechaCalificacion, 1),
                event_type: 'publicacion_texto',
                phase: 'presentacion',
                phase_step: '1d',
                description: 'Publicación del texto de la iniciativa en el BOCG',
                details: {
                    expediente: initiative.numExpediente,
                    boletin: 'BOCG'
                }
            });
        }

        // 1c. Toma en consideración (for propositions)
        if (initiative.tipo && initiative.tipo.toLowerCase().includes('proposición')) {
            timeline.timeline_events.push({
                date: initiative.fechaCalificacion || initiative.fechaPresentacion,
                event_type: 'toma_consideracion',
                phase: 'presentacion',
                phase_step: '1c',
                description: 'Toma en consideración de la proposición de ley',
                details: {
                    expediente: initiative.numExpediente,
                    tipo: initiative.tipo
                }
            });
        }

        // 2. DEBATE (Debate Phase) - if qualification exists
        if (initiative.fechaCalificacion) {
            // 2b. Debate de totalidad en el Pleno (estimated)
            timeline.timeline_events.push({
                date: this.estimateDebateDate(initiative.fechaCalificacion),
                event_type: 'debate_totalidad',
                phase: 'debate',
                phase_step: '2b',
                description: 'Debate de totalidad en el Pleno del Congreso',
                details: {
                    fase: 'Debate de totalidad',
                    lugar: 'Pleno del Congreso'
                }
            });

            // 3. TRABAJO (Work Phase)
            // 3a. Envío a Comisión
            if (initiative.comisionCompetente) {
                timeline.timeline_events.push({
                    date: this.addDays(initiative.fechaCalificacion, 5),
                    event_type: 'envio_comision',
                    phase: 'trabajo',
                    phase_step: '3a',
                    description: `Envío a ${initiative.comisionCompetente}`,
                    details: {
                        expediente: initiative.numExpediente,
                        comision: initiative.comisionCompetente
                    }
                });
            }

            // 3b. Enmiendas parciales (estimated)
            timeline.timeline_events.push({
                date: this.estimateAmendmentDate(initiative.fechaCalificacion),
                event_type: 'enmiendas_parciales',
                phase: 'trabajo',
                phase_step: '3b',
                description: 'Presentación de enmiendas parciales al articulado',
                details: {
                    tipo: 'Enmiendas parciales',
                    plazo: 'Establecido por la Comisión'
                }
            });

            // 3c. Comparecencias de expertos (optional, estimated)
            timeline.timeline_events.push({
                date: this.estimateExpertHearingDate(initiative.fechaCalificacion),
                event_type: 'comparecencias_expertos',
                phase: 'trabajo',
                phase_step: '3c',
                description: 'Comparecencias de expertos y audiencias (opcional)',
                details: {
                    tipo: 'Audiencias y comparecencias',
                    obligatorio: false
                }
            });

            // 3d. Dictamen de la Ponencia (estimated)
            timeline.timeline_events.push({
                date: this.estimateReportDate(initiative.fechaCalificacion),
                event_type: 'dictamen_ponencia',
                phase: 'trabajo',
                phase_step: '3d',
                description: 'Redacción del dictamen por la Ponencia y aprobación en Comisión',
                details: {
                    fase: 'Dictamen de Ponencia',
                    lugar: 'Comisión'
                }
            });

            // 4. APROBACIÓN (Approval Phase) - estimated
            // 4a. Debate y votación en el Pleno del Congreso
            timeline.timeline_events.push({
                date: this.estimatePlenaryVoteDate(initiative.fechaCalificacion),
                event_type: 'votacion_congreso',
                phase: 'aprobacion',
                phase_step: '4a',
                description: 'Debate y votación en el Pleno del Congreso',
                details: {
                    fase: 'Votación en Pleno',
                    lugar: 'Congreso de los Diputados',
                    resultado: 'Pendiente'
                }
            });

            // 4b. Envío al Senado (estimated)
            timeline.timeline_events.push({
                date: this.addDays(this.estimatePlenaryVoteDate(initiative.fechaCalificacion), 1),
                event_type: 'envio_senado',
                phase: 'aprobacion',
                phase_step: '4b',
                description: 'Envío del texto aprobado al Senado',
                details: {
                    destino: 'Senado',
                    fase: 'Tramitación en Cámara Alta'
                }
            });
        }

        // Sort timeline events by date
        timeline.timeline_events.sort((a, b) => new Date(a.date) - new Date(b.date));

        return timeline;
    }

    /**
     * Determine the current legislative phase of an initiative
     */
    determineLegislativePhase(initiative) {
        if (!initiative.fechaCalificacion) {
            return 'presentacion';
        }
        
        if (initiative.situacionActual) {
            if (initiative.situacionActual.toLowerCase().includes('pleno')) {
                return 'debate';
            } else if (initiative.situacionActual.toLowerCase().includes('comisión')) {
                return 'trabajo';
            } else if (initiative.situacionActual.toLowerCase().includes('senado')) {
                return 'aprobacion';
            }
        }

        return 'trabajo'; // Default to work phase if qualified
    }

    /**
     * Helper method to add days to a date string
     */
    addDays(dateString, days) {
        if (!dateString) return null;
        const date = new Date(dateString.split('/').reverse().join('-'));
        date.setDate(date.getDate() + days);
        return date.toLocaleDateString('es-ES');
    }

    /**
     * Estimate debate date (typically 2-4 weeks after qualification)
     */
    estimateDebateDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 21); // 3 weeks
    }

    /**
     * Estimate amendment date (typically 1-2 weeks after qualification)
     */
    estimateAmendmentDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 10); // 1.5 weeks
    }

    /**
     * Estimate expert hearing date (typically 2-3 weeks after qualification)
     */
    estimateExpertHearingDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 14); // 2 weeks
    }

    /**
     * Estimate report date (typically 4-6 weeks after qualification)
     */
    estimateReportDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 35); // 5 weeks
    }

    /**
     * Estimate plenary vote date (typically 6-8 weeks after qualification)
     */
    estimatePlenaryVoteDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 49); // 7 weeks
    }

    /**
     * Estimate Senate review date (typically 8-10 weeks after qualification)
     */
    estimateSenateReviewDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 63); // 9 weeks
    }

    /**
     * Estimate final approval date (typically 10-12 weeks after qualification)
     */
    estimateFinalApprovalDate(qualificationDate) {
        if (!qualificationDate) return null;
        return this.addDays(qualificationDate, 77); // 11 weeks
    }

    /**
     * Find initiatives that might be related to an approved law
     */
    findRelatedInitiatives(law) {
        const related = [];

        this.initiatives.forEach(initiative => {
            // Try to match by content similarity
            if (this.isInitiativeRelatedToLaw(initiative, law)) {
                related.push(initiative);
            }
        });

        return related;
    }

    /**
     * Check if an initiative is related to a law
     */
    isInitiativeRelatedToLaw(initiative, law) {
        // Simple matching by content similarity
        const lawTitle = law.titulo_ley.toLowerCase();
        const initiativeObject = (initiative.objeto || '').toLowerCase();
        
        // Check for key terms in common
        const keyTerms = this.extractKeyTerms(lawTitle);
        const matches = keyTerms.filter(term => 
            initiativeObject.includes(term) || 
            initiativeObject.includes(term.replace(/\s+/g, ' '))
        );

        return matches.length >= 2; // At least 2 key terms must match
    }

    /**
     * Extract key terms from law title for matching
     */
    extractKeyTerms(title) {
        // Remove common words and extract meaningful terms
        const commonWords = ['ley', 'de', 'la', 'el', 'y', 'por', 'que', 'se', 'del', 'las', 'los', 'un', 'una', 'con', 'para'];
        const words = title.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.includes(word));
        
        return words.slice(0, 5); // Return top 5 key terms
    }

    /**
     * Check if an initiative is already part of a timeline
     */
    isInitiativeInTimeline(initiative) {
        return this.legislativeTimelines.some(timeline => 
            timeline.related_initiatives && 
            timeline.related_initiatives.some(rel => rel.numExpediente === initiative.numExpediente)
        );
    }

    /**
     * Determine final status of an initiative (deprecated – use StageClassifier in TS backend)
     */
    determineFinalStatus(initiative) {
        const resultado = (initiative.resultadotramitacion || '').toLowerCase();
        const situacion = (initiative.situacionActual || '').toLowerCase();
        const tramitacion = (initiative.tramitacion || '').toLowerCase();

        if (resultado.includes('aprob')) return 'approved';
        if (resultado.includes('rechaz')) return 'rejected';
        if (resultado.includes('retirad')) return 'withdrawn';
        if (situacion.includes('boe') || tramitacion.includes('boe') || situacion.includes('publicación') || tramitacion.includes('publicación')) return 'published';
        if (situacion.includes('votación') || tramitacion.includes('votación')) return 'voting';
        if (situacion.includes('comisión') || tramitacion.includes('comisión') || tramitacion.includes('ponencia') || tramitacion.includes('dictamen')) return 'in_committee';
        if (situacion.includes('pleno') || tramitacion.includes('debate') || tramitacion.includes('totalidad')) return 'in_plenary';
        if (situacion.includes('cerrado')) return 'closed';
        return 'in_progress';
    }

    /**
     * Extract date from processing result text
     */
    extractDateFromResult(resultText) {
        const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
        const match = resultText.match(dateRegex);
        return match ? match[1] : null;
    }

    /**
     * Export legislative timelines to JSON
     */
    async exportLegislativeTimelines() {
        try {
            const outputPath = path.join(__dirname, '../output/legislative-timelines.json');
            await fs.writeJson(outputPath, this.legislativeTimelines, { spaces: 2 });
            console.log(`📁 Legislative timelines exported to: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Error exporting legislative timelines:', error);
            return null;
        }
    }

    /**
     * Generate summary statistics
     */
    generateSummary() {
        const summary = {
            total_timelines: this.legislativeTimelines.length,
            approved_laws: this.approvedLaws.length,
            initiatives_without_laws: this.initiatives.filter(i => !this.isInitiativeInTimeline(i)).length,
            timeline_breakdown: {
                complete_journeys: this.legislativeTimelines.filter(t => t.final_status === 'approved').length,
                in_progress: this.legislativeTimelines.filter(t => t.final_status === 'in_progress').length,
                other_statuses: this.legislativeTimelines.filter(t => !['approved', 'in_progress'].includes(t.final_status)).length
            }
        };

        console.log('📊 Legislative Flow Summary:');
        console.log(`  Total timelines: ${summary.total_timelines}`);
        console.log(`  Approved laws: ${summary.approved_laws}`);
        console.log(`  Initiatives without laws: ${summary.initiatives_without_laws}`);
        console.log(`  Complete journeys: ${summary.timeline_breakdown.complete_journeys}`);
        console.log(`  In progress: ${summary.timeline_breakdown.in_progress}`);
        console.log(`  Other statuses: ${summary.timeline_breakdown.other_statuses}`);

        return summary;
    }
}

module.exports = LegislativeFlowService; 