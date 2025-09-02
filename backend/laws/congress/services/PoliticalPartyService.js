/**
 * Service to identify and map political parties from Congress data
 * Maps parliamentary groups, commissions, and other entities to actual political parties
 */
class PoliticalPartyService {
    constructor() {
        // Spanish political parties in Congress and Senate
        this.politicalParties = {
            'partido_popular': {
                name: 'Partido Popular',
                shortName: 'PP',
                parliamentaryGroups: [
                    'Grupo Parlamentario Popular en el Congreso',
                    'Grupo Parlamentario Popular',
                    'Popular'
                ],
                color: '#0056A3'
            },
            'partido_socialista': {
                name: 'Partido Socialista Obrero Español',
                shortName: 'PSOE',
                parliamentaryGroups: [
                    'Grupo Parlamentario Socialista',
                    'Socialista',
                    'PSOE'
                ],
                color: '#E30613'
            },
            'vox': {
                name: 'VOX',
                shortName: 'VOX',
                parliamentaryGroups: [
                    'Grupo Parlamentario VOX',
                    'VOX'
                ],
                color: '#5BC236'
            },
            'sumar': {
                name: 'SUMAR',
                shortName: 'SUMAR',
                parliamentaryGroups: [
                    'Grupo Parlamentario Plurinacional SUMAR',
                    'Grupo Parlamentario Plurinacional SUMAR ',
                    'SUMAR'
                ],
                color: '#FF6B35'
            },
            'unidas_podemos': {
                name: 'Unidas Podemos',
                shortName: 'UP',
                parliamentaryGroups: [
                    'Grupo Parlamentario Confederal de Unidas Podemos-En Comú Podem-Galicia en Común',
                    'Unidas Podemos',
                    'Podemos'
                ],
                color: '#6B3FA0'
            },
            'partido_nacionalista_vasco': {
                name: 'Partido Nacionalista Vasco',
                shortName: 'EAJ-PNV',
                parliamentaryGroups: [
                    'Grupo Parlamentario Vasco (EAJ-PNV)',
                    'EAJ-PNV',
                    'Partido Nacionalista Vasco'
                ],
                color: '#008C15'
            },
            'eh_bildu': {
                name: 'EH Bildu',
                shortName: 'EH Bildu',
                parliamentaryGroups: [
                    'Grupo Parlamentario Euskal Herria Bildu',
                    'Euskal Herria Bildu',
                    'EH Bildu'
                ],
                color: '#00A9E0'
            },
            'junts': {
                name: 'Junts per Catalunya',
                shortName: 'Junts',
                parliamentaryGroups: [
                    'Grupo Parlamentario Junts per Catalunya',
                    'Junts per Catalunya',
                    'Junts'
                ],
                color: '#FFD700'
            },
            'esquerra_republicana': {
                name: 'Esquerra Republicana de Catalunya',
                shortName: 'ERC',
                parliamentaryGroups: [
                    'Grupo Parlamentario Republicano',
                    'Esquerra Republicana',
                    'ERC'
                ],
                color: '#FFB81C'
            },
            'bloque_nacionalista_galego': {
                name: 'Bloque Nacionalista Galego',
                shortName: 'BNG',
                parliamentaryGroups: [
                    'Grupo Parlamentario Mixto',
                    'BNG',
                    'Bloque Nacionalista Galego'
                ],
                color: '#0066CC'
            },
            'union_pueblo_navarro': {
                name: 'Unión del Pueblo Navarro',
                shortName: 'UPN',
                parliamentaryGroups: [
                    'Grupo Parlamentario Mixto',
                    'UPN',
                    'Unión del Pueblo Navarro'
                ],
                color: '#FF6600'
            },
            'coalicion_canaria': {
                name: 'Coalición Canaria',
                shortName: 'CC',
                parliamentaryGroups: [
                    'Grupo Parlamentario Mixto',
                    'Coalición Canaria',
                    'CC'
                ],
                color: '#FFCC00'
            },
            'gobierno': {
                name: 'Gobierno de España',
                shortName: 'Gobierno',
                parliamentaryGroups: [
                    'Gobierno',
                    'Gobierno de España'
                ],
                color: '#333333'
            },
            'comisiones': {
                name: 'Comisiones Parlamentarias',
                shortName: 'Comisiones',
                parliamentaryGroups: [
                    'Comisión',
                    'Comisiones'
                ],
                color: '#666666'
            },
            'comunidades_autonomas': {
                name: 'Comunidades Autónomas',
                shortName: 'CCAA',
                parliamentaryGroups: [
                    'Comunidad Autónoma',
                    'Parlamento',
                    'Asamblea'
                ],
                color: '#999999'
            }
        };

        // Special cases for mixed groups that need additional context
        this.mixedGroupParties = {
            'Grupo Parlamentario Mixto': [
                'bloque_nacionalista_galego',
                'union_pueblo_navarro', 
                'coalicion_canaria',
                'partido_animalista',
                'partido_verde',
                'otros_independientes'
            ]
        };
    }

    /**
     * Identify the political party from an initiative
     * @param {Object} initiative - The initiative object
     * @returns {Object} Political party information
     */
    identifyPoliticalParty(initiative) {
        const autor = initiative.autor || '';
        const tipo = initiative.tipo || '';
        const objeto = initiative.objeto || '';

        // First, try to identify by parliamentary group
        const partyByGroup = this.identifyByParliamentaryGroup(autor);
        if (partyByGroup) {
            return partyByGroup;
        }

        // Try to identify by initiative type
        const partyByType = this.identifyByInitiativeType(tipo, autor);
        if (partyByType) {
            return partyByType;
        }

        // Try to identify by content analysis
        const partyByContent = this.identifyByContent(objeto, autor);
        if (partyByContent) {
            return partyByContent;
        }

        // Default fallback
        return {
            party_id: 'desconocido',
            party_name: 'Partido Desconocido',
            party_short_name: 'Desconocido',
            confidence: 'low',
            method: 'fallback',
            parliamentary_group: autor
        };
    }

    /**
     * Identify party by parliamentary group name
     * @param {string} autor - The author field
     * @returns {Object|null} Political party information or null
     */
    identifyByParliamentaryGroup(autor) {
        if (!autor) return null;

        const autorLower = autor.toLowerCase();

        // Check each political party's parliamentary groups
        for (const [partyId, party] of Object.entries(this.politicalParties)) {
            for (const group of party.parliamentaryGroups) {
                if (autorLower.includes(group.toLowerCase())) {
                    return {
                        party_id: partyId,
                        party_name: party.name,
                        party_short_name: party.shortName,
                        confidence: 'high',
                        method: 'parliamentary_group',
                        parliamentary_group: autor,
                        color: party.color
                    };
                }
            }
        }

        return null;
    }

    /**
     * Identify party by initiative type
     * @param {string} tipo - The initiative type
     * @param {string} autor - The author field
     * @returns {Object|null} Political party information or null
     */
    identifyByInitiativeType(tipo, autor) {
        if (!tipo) return null;

        const tipoLower = tipo.toLowerCase();
        const autorLower = autor.toLowerCase();

        // Government bills are always from the government
        if (tipoLower.includes('proyecto de ley') && autorLower.includes('gobierno')) {
            return {
                party_id: 'gobierno',
                party_name: 'Gobierno de España',
                party_short_name: 'Gobierno',
                confidence: 'high',
                method: 'initiative_type',
                parliamentary_group: autor,
                color: this.politicalParties.gobierno.color
            };
        }

        // Senate propositions might indicate specific parties
        if (tipoLower.includes('proposición de ley del senado')) {
            // This would need additional context from PDFs to identify specific parties
            return {
                party_id: 'senado',
                party_name: 'Senado',
                party_short_name: 'Senado',
                confidence: 'medium',
                method: 'initiative_type',
                parliamentary_group: autor,
                color: '#666666'
            };
        }

        return null;
    }

    /**
     * Identify party by content analysis
     * @param {string} objeto - The object/description field
     * @param {string} autor - The author field
     * @returns {Object|null} Political party information or null
     */
    identifyByContent(objeto, autor) {
        if (!objeto) return null;

        const objetoLower = objeto.toLowerCase();
        const autorLower = autor.toLowerCase();

        // Look for party-specific keywords in the content
        const partyKeywords = {
            'partido_popular': ['popular', 'pp', 'partido popular'],
            'partido_socialista': ['socialista', 'psoe', 'partido socialista'],
            'vox': ['vox', 'nacional', 'patria'],
            'sumar': ['sumar', 'plurinacional', 'progresista'],
            'unidas_podemos': ['podemos', 'confederal', 'izquierda'],
            'partido_nacionalista_vasco': ['vasco', 'eaj-pnv', 'nacionalismo vasco'],
            'eh_bildu': ['euskal herria', 'bildu', 'nacionalismo vasco'],
            'junts': ['junts', 'catalunya', 'nacionalismo catalán'],
            'esquerra_republicana': ['republicano', 'erc', 'catalunya'],
            'bloque_nacionalista_galego': ['galego', 'galicia', 'nacionalismo gallego'],
            'union_pueblo_navarro': ['navarro', 'navarra', 'upn'],
            'coalicion_canaria': ['canaria', 'canarias', 'cc']
        };

        for (const [partyId, keywords] of Object.entries(partyKeywords)) {
            for (const keyword of keywords) {
                if (objetoLower.includes(keyword) || autorLower.includes(keyword)) {
                    const party = this.politicalParties[partyId];
                    return {
                        party_id: partyId,
                        party_name: party.name,
                        party_short_name: party.shortName,
                        confidence: 'medium',
                        method: 'content_analysis',
                        parliamentary_group: autor,
                        color: party.color
                    };
                }
            }
        }

        return null;
    }

    /**
     * Get all political parties
     * @returns {Object} All political parties
     */
    getAllPoliticalParties() {
        return this.politicalParties;
    }

    /**
     * Get party by ID
     * @param {string} partyId - The party ID
     * @returns {Object|null} Political party or null
     */
    getPartyById(partyId) {
        return this.politicalParties[partyId] || null;
    }

    /**
     * Get statistics about party distribution
     * @param {Array} initiatives - Array of initiatives
     * @returns {Object} Party distribution statistics
     */
    getPartyDistribution(initiatives) {
        const distribution = {};
        let total = 0;

        initiatives.forEach(initiative => {
            const party = this.identifyPoliticalParty(initiative);
            const partyId = party.party_id;

            if (!distribution[partyId]) {
                distribution[partyId] = {
                    count: 0,
                    party_name: party.party_name,
                    party_short_name: party.party_short_name,
                    color: party.color
                };
            }

            distribution[partyId].count++;
            total++;
        });

        // Convert to array and sort by count
        const sortedDistribution = Object.entries(distribution)
            .map(([partyId, data]) => ({
                party_id: partyId,
                ...data,
                percentage: ((data.count / total) * 100).toFixed(1)
            }))
            .sort((a, b) => b.count - a.count);

        return {
            total,
            distribution: sortedDistribution
        };
    }
}

module.exports = PoliticalPartyService; 