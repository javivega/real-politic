class PreVotePositionService {
    constructor(politicalPartyService) {
        this.politicalPartyService = politicalPartyService;

        // Simple keyword heuristics to simulate public statement tendencies by topic
        // positiveParties -> likely support; negativeParties -> likely oppose
        this.keywordHeuristics = [
            {
                keywords: ['vivienda', 'alquiler', 'protección social', 'bienestar'],
                positiveParties: ['partido_socialista', 'sumar', 'unidas_podemos', 'esquerra_republicana', 'junts', 'eh_bildu', 'bloque_nacionalista_galego'],
                negativeParties: ['vox'],
                description: 'Tema social / vivienda'
            },
            {
                keywords: ['clima', 'medio ambiente', 'energía renovable', 'emisiones', 'sostenible'],
                positiveParties: ['partido_socialista', 'sumar', 'unidas_podemos', 'esquerra_republicana', 'junts', 'eh_bildu', 'bloque_nacionalista_galego'],
                negativeParties: ['vox'],
                description: 'Transición ecológica'
            },
            {
                keywords: ['seguridad', 'inmigración', 'fronteras', 'delito', 'ocupación ilegal'],
                positiveParties: ['vox', 'partido_popular', 'union_pueblo_navarro'],
                negativeParties: ['sumar', 'unidas_podemos', 'esquerra_republicana', 'eh_bildu'],
                description: 'Seguridad e inmigración'
            },
            {
                keywords: ['impuestos', 'fiscal', 'cotizaciones', 'deflactación', 'rebaja fiscal'],
                positiveParties: ['partido_popular', 'vox', 'union_pueblo_navarro', 'coalicion_canaria'],
                negativeParties: ['partido_socialista', 'sumar', 'unidas_podemos'],
                description: 'Política fiscal'
            }
        ];

        // Position precedence
        this.POSITIONS = {
            FOR: 'For',
            LIKELY_FOR: 'Likely For',
            LIKELY_AGAINST: 'Likely Against',
            UNDECIDED: 'Undecided',
            UNKNOWN: 'Unknown'
        };
    }

    inferForInitiatives(initiativesArray) {
        const allParties = this.politicalPartyService.getAllPoliticalParties();
        const partyEntries = Object.entries(allParties);

        return initiativesArray.map(init => {
            const positions = [];
            for (const [partyId, party] of partyEntries) {
                const result = this.inferForParty(init, partyId, party);
                if (result.position !== this.POSITIONS.UNKNOWN) {
                    positions.push({
                        party: party.name,
                        position: result.position,
                        evidence: result.evidence.join(' | ')
                    });
                }
            }

            return {
                initiative_id: init.numExpediente,
                party_positions_prevote: positions
            };
        });
    }

    inferForParty(initiative, partyId, party) {
        const evidence = [];

        // 1) Co-authorship / Autor field
        if (this.isCoAuthor(initiative.autor, party)) {
            evidence.push('Co-authorship/Autor field indicates this party');
            return { position: this.POSITIONS.FOR, evidence };
        }

        const objetoText = (initiative.objeto || '').toLowerCase();
        const situacionText = (initiative.situacionActual || '').toLowerCase();
        const tramitacionText = (initiative.tramitacion || '').toLowerCase();

        // 2) Simulated public statements by topic keywords
        let score = 0;
        for (const rule of this.keywordHeuristics) {
            if (rule.keywords.some(k => objetoText.includes(k))) {
                if (rule.positiveParties.includes(partyId)) {
                    score += 1;
                    evidence.push(`Public statements (simulated): ${rule.description} aligns with party platform`);
                }
                if (rule.negativeParties.includes(partyId)) {
                    score -= 1;
                    evidence.push(`Public statements (simulated): ${rule.description} likely opposed by party`);
                }
            }
        }

        // 3) Simulated amendments signal (committee work)
        if (tramitacionText.includes('enmiend') || situacionText.includes('enmiend')) {
            evidence.push('Amendments proposed/processed (simulated source)');
        }

        // 4) Simulated debate record presence
        if (initiative.enlacesDS) {
            evidence.push('Statements in debates (simulated source via Diario de Sesiones)');
        }

        // 5) Simple classification from score
        if (score >= 1) {
            return { position: this.POSITIONS.LIKELY_FOR, evidence };
        }
        if (score <= -1) {
            return { position: this.POSITIONS.LIKELY_AGAINST, evidence };
        }

        // If there is any generic activity, mark Undecided; else Unknown
        if (evidence.length > 0) {
            return { position: this.POSITIONS.UNDECIDED, evidence };
        }

        return { position: this.POSITIONS.UNKNOWN, evidence };
    }

    isCoAuthor(autorField, party) {
        if (!autorField) return false;
        const autorLower = autorField.toLowerCase();
        const groups = party.parliamentaryGroups || [];
        for (const g of groups) {
            if (autorLower.includes(g.toLowerCase())) return true;
        }
        return false;
    }
}

module.exports = PreVotePositionService; 