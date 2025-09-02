/**
 * Spanish Legal NLP Service
 * 
 * Processes Spanish legal texts to create more accessible and meaningful titles
 * Focuses on making bureaucratic language understandable for citizens
 */

const nlp = require('compromise');
require('compromise-numbers');
require('compromise-dates');

class SpanishLegalNLPService {
    constructor() {
        // Spanish legal language patterns
        this.legalPatterns = {
            // Common bureaucratic prefixes to remove
            prefixes: [
                /^(?:Real Decreto-ley|Real Decreto|Ley Orgánica|Proyecto de Ley|Proposición de Ley|Propuesta de Ley|Iniciativa Legislativa Popular|Resolución)\s*\d*\/\d*[,\s]*/i,
                /^Decreto\s*\d*\/\d*[,\s]*/i,
                /^Ley\s*\d*\/\d*[,\s]*/i
            ],
            
            // Date patterns to remove
            dates: [
                /de \d{1,2} de \w+ de \d{4}[,\s]*/i,
                /del \d{1,2} de \w+ de \d{4}[,\s]*/i
            ],
            
            // Bureaucratic language to simplify
            bureaucratic: [
                { pattern: /por el que se adoptan?/gi, replacement: '' },
                { pattern: /por la que se modifica/gi, replacement: 'modifica' },
                { pattern: /por la que se regula/gi, replacement: 'regula' },
                { pattern: /por la que se establece/gi, replacement: 'establece' },
                { pattern: /por la que se aprueba/gi, replacement: 'aprueba' },
                { pattern: /para la/gi, replacement: 'para' },
                { pattern: /sobre la/gi, replacement: 'sobre' },
                { pattern: /relativa a la/gi, replacement: 'relativa a' },
                { pattern: /que regula/gi, replacement: 'que regula' },
                { pattern: /que modifica/gi, replacement: 'que modifica' },
                { pattern: /que establece/gi, replacement: 'que establece' }
            ],
            
            // Legal action verbs to highlight
            actions: [
                'modifica', 'establece', 'regula', 'aprueba', 'deroga', 
                'crea', 'suprime', 'amplía', 'reforma', 'actualiza',
                'simplifica', 'mejora', 'fortalece', 'garantiza', 'protege'
            ],
            
            // Legal subject areas
            subjectAreas: {
                'justicia': ['poder judicial', 'fiscal', 'penal', 'civil', 'administrativo', 'constitucional'],
                'economia': ['tributaria', 'presupuestos', 'bancaria', 'comercial', 'financiera', 'fiscal'],
                'social': ['sanidad', 'educación', 'vivienda', 'empleo', 'bienestar', 'servicios sociales'],
                'medio_ambiente': ['energía', 'clima', 'biodiversidad', 'residuos', 'sostenibilidad', 'transición'],
                'administracion': ['función pública', 'régimen local', 'transparencia', 'gobierno', 'administración'],
                'defensa': ['seguridad', 'defensa', 'inteligencia', 'militar', 'policial'],
                'transporte': ['infraestructura', 'movilidad', 'carreteras', 'ferrocarril', 'aéreo'],
                'comunicaciones': ['telecomunicaciones', 'medios', 'digital', 'tecnología']
            }
        };
    }

    /**
     * Process a legal title to make it more accessible
     * @param {string} objeto - The original legal description
     * @param {string} tipo - The type of legal initiative
     * @param {string} autor - The author/originator
     * @returns {object} - Processed title with metadata
     */
    processLegalTitle(objeto, tipo, autor) {
        try {
            // Step 1: Clean the text
            let cleanText = this.cleanLegalText(objeto);
            
            // Step 2: Extract key information
            const extracted = this.extractKeyInformation(cleanText);
            
            // Step 3: Generate accessible title
            const accessibleTitle = this.generateAccessibleTitle(extracted, tipo, autor);
            
            // Step 4: Add metadata
            const metadata = this.generateMetadata(extracted, tipo, autor);
            
            return {
                original: objeto,
                clean: cleanText,
                accessible: accessibleTitle,
                metadata: metadata,
                extracted: extracted
            };
            
        } catch (error) {
            console.error('Error processing legal title:', error);
            return {
                original: objeto,
                accessible: this.fallbackTitle(objeto, tipo),
                error: error.message
            };
        }
    }

    /**
     * Clean legal text by removing bureaucratic language
     */
    cleanLegalText(text) {
        let clean = text;
        
        // Remove prefixes
        this.legalPatterns.prefixes.forEach(pattern => {
            clean = clean.replace(pattern, '');
        });
        
        // Remove dates
        this.legalPatterns.dates.forEach(pattern => {
            clean = clean.replace(pattern, '');
        });
        
        // Simplify bureaucratic language
        this.legalPatterns.bureaucratic.forEach(item => {
            clean = clean.replace(item.pattern, item.replacement);
        });
        
        // Clean up extra spaces and punctuation
        clean = clean.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '');
        
        return clean;
    }

    /**
     * Extract the main subject of the law
     */
    extractMainSubject(text) {
        // Look for patterns like "Ley de X", "Ley sobre Y", "Ley que regula Z"
        const patterns = [
            /(?:Ley|Decreto|Reglamento)\s+(?:de|sobre|que regula)\s+([^,\.]+)/i,
            /(?:para|sobre|relativa a)\s+([^,\.]+)/i,
            /(?:que regula|que modifica|que establece)\s+([^,\.]+)/i,
            /modifica\s+(?:la\s+)?([^,\.]+)/i,
            /reforma\s+(?:de\s+)?(?:la\s+)?([^,\.]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let subject = match[1].trim();
                // Clean up the subject
                subject = subject.replace(/^(?:de\s+|del\s+)/i, '');
                if (subject.length > 3) { // Avoid very short subjects
                    return subject;
                }
            }
        }
        
        // Fallback: look for meaningful phrases after common verbs
        const verbPatterns = [
            /(?:modifica|reforma|establece|regula)\s+([^,\.]+)/i,
            /(?:para|sobre)\s+([^,\.]+)/i
        ];
        
        for (const pattern of verbPatterns) {
            const match = text.match(pattern);
            if (match) {
                let subject = match[1].trim();
                if (subject.length > 5) {
                    return subject;
                }
            }
        }
        
        // Last fallback: take first meaningful noun phrase
        const doc = nlp(text);
        const nouns = doc.nouns().out('array');
        return nouns.length > 0 ? nouns[0] : 'legislación';
    }

    /**
     * Extract the purpose of the law
     */
    extractPurpose(text) {
        // Look for purpose indicators
        const purposePatterns = [
            /para\s+([^,\.]+)/gi,
            /con el fin de\s+([^,\.]+)/gi,
            /con objeto de\s+([^,\.]+)/gi,
            /destinado a\s+([^,\.]+)/gi
        ];
        
        for (const pattern of purposePatterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                return matches[0][1].trim();
            }
        }
        
        return null;
    }

    /**
     * Extract specific changes or modifications the law makes
     */
    extractSpecificChanges(text) {
        const lowerText = text.toLowerCase();
        
        // Look for specific change indicators
        const changePatterns = [
            // Specific modifications with context
            /(?:modifica|reforma|cambia|actualiza)\s+(?:la\s+)?([^,\.]+?)(?:\s+para|\s+en\s+cuanto\s+a|\s+relativo\s+a|\s+sobre|\s+en\s+materia\s+de|\s+para\s+mejorar|\s+para\s+garantizar|\s+para\s+establecer|\s+para\s+regular)/gi,
            // Purpose of changes
            /(?:para|con el fin de|con objeto de)\s+(?:mejorar|simplificar|fortalecer|garantizar|proteger|establecer|regular|tipificar|abordar|recuperar)\s+([^,\.]+)/gi,
            // Specific areas being changed
            /(?:en materia de|relativo a|sobre|en cuanto a)\s+([^,\.]+)/gi,
            // Specific articles or sections
            /(?:artículos?|secciones?|apartados?)\s+([^,\.]+)/gi,
            // Fallback: just the modification
            /(?:modifica|reforma|cambia|actualiza)\s+(?:la\s+)?([^,\.]+)/gi
        ];
        
        for (const pattern of changePatterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                const change = matches[0][1].trim();
                if (change.length > 10 && change.length < 100) { // Avoid very short or very long changes
                    return change;
                }
            }
        }
        
        return null;
    }

    /**
     * Extract what the law is actually regulating or changing
     */
    extractRegulationScope(text) {
        const lowerText = text.toLowerCase();
        
        // Look for regulation scope
        const scopePatterns = [
            // What is being regulated
            /(?:regula|establece|define|organiza)\s+(?:el|la|los|las)\s+([^,\.]+)/gi,
            // Specific areas of regulation
            /(?:en el ámbito de|en materia de|relativo a)\s+([^,\.]+)/gi,
            // Specific rights or procedures
            /(?:derechos?|procedimientos?|funciones?|competencias?)\s+(?:de|del|de la)\s+([^,\.]+)/gi,
            // Specific sectors or activities
            /(?:sector|actividad|servicio|régimen)\s+(?:de|del|de la)\s+([^,\.]+)/gi
        ];
        
        for (const pattern of scopePatterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                const scope = matches[0][1].trim();
                if (scope.length > 8) {
                    return scope;
                }
            }
        }
        
        return null;
    }

    /**
     * Extract key information from cleaned text
     */
    extractKeyInformation(text) {
        try {
            const doc = nlp(text);
            
            // Extract main action (look for specific legal verbs first)
            const legalVerbs = this.legalPatterns.actions;
            let mainAction = 'establece';
            
            // Look for specific legal verbs in the text
            for (const verb of legalVerbs) {
                if (text.toLowerCase().includes(verb)) {
                    mainAction = verb;
                    break;
                }
            }
            
            // If no specific verb found, try to get the first verb
            if (mainAction === 'establece') {
                const verbs = doc.verbs().out('array');
                if (verbs.length > 0) {
                    mainAction = verbs[0];
                }
            }
            
            // Extract main subject (what the law affects)
            const subjects = this.extractMainSubject(text);
            
            // Extract purpose (why the law exists)
            const purpose = this.extractPurpose(text);
            
            // Extract specific changes (what is being modified)
            const specificChanges = this.extractSpecificChanges(text);
            
            // Extract regulation scope (what is being regulated)
            const regulationScope = this.extractRegulationScope(text);
            
            // Identify subject area
            const subjectArea = this.identifySubjectArea(text);
            
            // Extract key entities (organizations, laws, etc.)
            const entities = this.extractEntities(text);
            
            return {
                action: mainAction,
                subject: subjects,
                purpose: purpose,
                specificChanges: specificChanges,
                regulationScope: regulationScope,
                subjectArea: subjectArea,
                entities: entities,
                urgency: this.detectUrgency(text),
                complexity: this.assessComplexity(text)
            };
        } catch (error) {
            console.warn('Warning: Error extracting key information:', error.message);
            return {
                action: 'establece',
                subject: 'legislación',
                purpose: null,
                specificChanges: null,
                regulationScope: null,
                subjectArea: 'general',
                entities: { organizations: [], laws: [], amounts: [], dates: [] },
                urgency: 'baja',
                complexity: 'media'
            };
        }
    }

    /**
     * Identify the subject area of the law
     */
    identifySubjectArea(text) {
        const lowerText = text.toLowerCase();
        let bestMatch = { area: 'general', score: 0 };
        
        for (const [area, keywords] of Object.entries(this.legalPatterns.subjectAreas)) {
            let score = 0;
            keywords.forEach(keyword => {
                if (lowerText.includes(keyword)) {
                    score += 1;
                }
            });
            
            if (score > bestMatch.score) {
                bestMatch = { area, score };
            }
        }
        
        return bestMatch.score > 0 ? bestMatch.area : 'general';
    }

    /**
     * Extract key entities from the text
     */
    extractEntities(text) {
        try {
            const doc = nlp(text);
            
            // Extract organizations
            const organizations = doc.organizations().out('array');
            
            // Extract laws and regulations
            const laws = text.match(/(?:Ley|Decreto|Reglamento)\s+\d+\/\d+/gi) || [];
            
            // Extract amounts and numbers
            const amounts = doc.numbers().out('array');
            
            // Extract dates using regex instead of compromise
            const datePattern = /\d{1,2}\s+(?:de|del)\s+\w+\s+(?:de|del)\s+\d{4}/gi;
            const dates = text.match(datePattern) || [];
            
            return {
                organizations,
                laws,
                amounts,
                dates
            };
        } catch (error) {
            console.warn('Warning: Error extracting entities:', error.message);
            return {
                organizations: [],
                laws: [],
                amounts: [],
                dates: []
            };
        }
    }

    /**
     * Detect urgency level
     */
    detectUrgency(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('urgente') || lowerText.includes('emergencia') || lowerText.includes('crisis')) {
            return 'alta';
        } else if (lowerText.includes('prioritaria') || lowerText.includes('importante')) {
            return 'media';
        } else {
            return 'baja';
        }
    }

    /**
     * Assess complexity of the law
     */
    assessComplexity(text) {
        const wordCount = text.split(' ').length;
        const hasTechnicalTerms = /(?:jurídico|legal|administrativo|técnico|especializado)/i.test(text);
        
        if (wordCount > 50 || hasTechnicalTerms) {
            return 'alta';
        } else if (wordCount > 25) {
            return 'media';
        } else {
            return 'baja';
        }
    }

    /**
     * Generate an accessible title
     */
    generateAccessibleTitle(extracted, tipo, autor) {
        let title = '';
        
        // Add context based on type
        if (tipo.includes('Gobierno')) {
            title += 'Gobierno: ';
        } else if (tipo.includes('Parlamentarios')) {
            title += 'Parlamento: ';
        } else if (tipo.includes('Senado')) {
            title += 'Senado: ';
        } else if (tipo.includes('Popular')) {
            title += 'Ciudadanos: ';
        }
        
        // Create a more meaningful title by combining multiple pieces of information
        let mainContent = '';
        
        // Priority 1: If we have specific changes, use them
        if (extracted.specificChanges && extracted.specificChanges.length > 10) {
            mainContent = extracted.specificChanges;
        }
        // Priority 2: If we have regulation scope, use that
        else if (extracted.regulationScope && extracted.regulationScope.length > 10) {
            mainContent = extracted.regulationScope;
        }
        // Priority 3: If we have purpose, use that
        else if (extracted.purpose && extracted.purpose.length > 15) {
            mainContent = extracted.purpose;
        }
        // Priority 4: Use action + subject
        else if (extracted.action && extracted.subject) {
            let action = extracted.action;
            // Use more specific action verbs
            if (action === 'establece' && extracted.subject.includes('modifica')) {
                action = 'modifica';
            } else if (action === 'establece' && extracted.subject.includes('reforma')) {
                action = 'reforma';
            }
            
            mainContent = `${action} ${extracted.subject}`;
        }
        // Priority 5: Just use subject
        else if (extracted.subject) {
            mainContent = extracted.subject;
        }
        
        // Clean up the main content
        if (mainContent) {
            // Remove redundant words and clean up
            mainContent = mainContent
                .replace(/^(?:de la|del|de)\s+/i, '')
                .replace(/^(?:la|el|los|las)\s+/i, '')
                .replace(/^(?:para|con el fin de|con objeto de)\s+/i, '')
                .trim();
            
            // Capitalize first letter
            mainContent = mainContent.charAt(0).toUpperCase() + mainContent.slice(1);
            
            title += mainContent;
        }
        
        // Add urgency indicator
        if (extracted.urgency === 'alta') {
            title += ' (Urgente)';
        }
        
        // Encourage shorter titles by simplifying complex phrases
        if (title.length > 80) {
            // Try to make it more concise without truncating
            title = title
                .replace(/para mejorar el sistema de/g, 'del sistema')
                .replace(/establecimiento de un nuevo/g, 'nuevo')
                .replace(/ampliación de los derechos de/g, 'derechos de')
                .replace(/regulación de la actividad de/g, 'regulación de')
                .replace(/modificación de la legislación vigente/g, 'reforma legal')
                .replace(/actualización de la normativa existente/g, 'actualización normativa');
        }
        
        return title;
    }

    /**
     * Generate metadata about the law
     */
    generateMetadata(extracted, tipo, autor) {
        return {
            subjectArea: extracted.subjectArea,
            urgency: extracted.urgency,
            complexity: extracted.complexity,
            actionType: extracted.action,
            hasPurpose: !!extracted.purpose,
            hasSpecificChanges: !!extracted.specificChanges,
            hasRegulationScope: !!extracted.regulationScope,
            entityCount: Object.values(extracted.entities).flat().length,
            estimatedReadability: this.calculateReadability(extracted)
        };
    }

    /**
     * Calculate readability score
     */
    calculateReadability(extracted) {
        let score = 100;
        
        // Reduce score for high complexity
        if (extracted.complexity === 'alta') score -= 30;
        else if (extracted.complexity === 'media') score -= 15;
        
        // Reduce score for technical subject areas
        if (['justicia', 'administracion'].includes(extracted.subjectArea)) score -= 20;
        
        // Increase score if purpose is clear
        if (extracted.purpose) score += 15;
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Fallback title if processing fails
     */
    fallbackTitle(objeto, tipo) {
        // Simple fallback that still improves readability
        let title = objeto
            .replace(/^(?:Real Decreto-ley|Real Decreto|Ley Orgánica|Proyecto de Ley|Proposición de Ley|Propuesta de Ley)\s*\d*\/\d*[,\s]*/i, '')
            .replace(/de \d{1,2} de \w+ de \d{4}[,\s]*/i, '');
        
        if (tipo.includes('Gobierno')) {
            title = `Gobierno: ${title}`;
        } else if (tipo.includes('Parlamentarios')) {
            title = `Parlamento: ${title}`;
        }
        
        // Encourage shorter titles by simplifying common phrases
        if (title.length > 80) {
            title = title
                .replace(/^(?:Real Decreto-ley|Real Decreto|Ley Orgánica|Proyecto de Ley|Proposición de Ley|Propuesta de Ley)\s*\d*\/\d*[,\s]*/i, '')
                .replace(/de \d{1,2} de \w+ de \d{4}[,\s]*/i, '')
                .replace(/para la mejora del/g, 'mejora del')
                .replace(/establecimiento de un/g, 'nuevo')
                .replace(/ampliación de los/g, 'derechos de');
        }
        
        return title; // Show full title without truncation
    }

    /**
     * Batch process multiple legal titles
     */
    processBatch(initiatives) {
        return initiatives.map(initiative => {
            const processed = this.processLegalTitle(
                initiative.objeto || initiative.objeto,
                initiative.tipo || initiative.tipo,
                initiative.autor || initiative.autor
            );
            
            return {
                ...initiative,
                processedTitle: processed
            };
        });
    }
}

module.exports = SpanishLegalNLPService; 