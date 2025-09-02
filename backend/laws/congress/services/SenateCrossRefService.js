const path = require('path');
const SenateApprovedLawsScraper = require('./SenateApprovedLawsScraper');
const SenateApprovedLawsXmlParser = require('./SenateApprovedLawsXmlParser');

/**
 * Cross-references initiatives with Senate "Leyes aprobadas" page
 * to infer BOE publication metadata and confirmation of approval.
 */
class SenateCrossRefService {
    constructor(config = {}) {
        this.scraper = new SenateApprovedLawsScraper();
        this.xmlParser = new SenateApprovedLawsXmlParser({
            xmlDir: path.resolve(__dirname, '../../../supabase'),
            ...config.xml
        });
        this.config = {
            titleMatchThreshold: 0.65,
            ...config
        };
    }

    async augmentWithSenateData(initiatives = []) {
        try {
            // Prefer XML source if available
            let senateLaws = await this.xmlParser.parse();
            if (!senateLaws || senateLaws.length === 0) {
                senateLaws = await this.scraper.fetchApprovedLaws();
            }
            if (!senateLaws || senateLaws.length === 0) return initiatives;

            console.log(`🔍 Found ${senateLaws.length} Senate approved laws for cross-referencing`);
            console.log(`📋 Sample Senate law:`, senateLaws[0]);

            let matchCount = 0;
            const enhanced = initiatives.map(init => {
                const match = this.findBestMatch(init, senateLaws);
                if (match) {
                    matchCount++;
                    console.log(`✅ Matched initiative "${init.objeto?.substring(0, 50)}..." with Senate law "${match.title?.substring(0, 50)}..."`);
                }

                if (!match) return init;

                // Attach BOE metadata. High confidence if url_boe present in XML
                return {
                    ...init,
                    boe_id: init.boe_id || (match.url_boe ? this.extractBoeId(match.url_boe) : null),
                    boe_url: init.boe_url || match.url_boe || null,
                    boe_publication_date: init.boe_publication_date || match.boe_date || null,
                    publication_confidence: init.publication_confidence || (match.url_boe ? 'high' : (match.boe_date ? 'medium' : 'low')),
                    // Optional: mark as approved if not already captured in resultado
                    resultadotramitacion: init.resultadotramitacion || init.resultadoTramitacion || 'Aprobado',
                };
            });

            console.log(`🎯 Total matches found: ${matchCount}/${initiatives.length} initiatives`);
            return enhanced;
        } catch (e) {
            console.warn('Senate cross-ref failed:', e.message);
            return initiatives;
        }
    }

    findBestMatch(initiative, senateLaws) {
        const title = (initiative.objeto || '').toLowerCase();
        if (!title) return null;

        // Try matching by expediente in title e.g., (621/000016)
        const expTitleMatch = title.match(/\((\d{3})\/(\d{6})\)/);
        if (expTitleMatch) {
            const exp = `${expTitleMatch[1]}/${expTitleMatch[2]}`;
            const byExp = senateLaws.find(l => (l.expediente || '').toLowerCase() === exp.toLowerCase());
            if (byExp) return byExp;
        }

        // Try matching by our initiative NUMEXPEDIENTE if present in model shape
        const numExp = (initiative.numExpediente || initiative.NUMEXPEDIENTE || '').toLowerCase();
        if (numExp) {
            const byNum = senateLaws.find(l => (l.expediente || '').toLowerCase() === numExp);
            if (byNum) return byNum;
        }

        // Basic fuzzy: inclusion both ways or Jaccard over tokens
        let best = null;
        let bestScore = 0;
        const titleTokens = this.tokenize(title);

        for (const law of senateLaws) {
            const senateTitle = (law.title || '').toLowerCase();
            if (!senateTitle) continue;
            const score = this.jaccard(titleTokens, this.tokenize(senateTitle));
            if (score > bestScore) {
                bestScore = score;
                best = law;
            }
        }

        return bestScore >= this.config.titleMatchThreshold ? best : null;
    }

    extractBoeId(url) {
        const m = (url || '').match(/BOE-A-\d{4}-\d{1,6}/);
        return m ? m[0] : null;
    }

    tokenize(text) {
        return text
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    jaccard(aTokens, bTokens) {
        const a = new Set(aTokens);
        const b = new Set(bTokens);
        const intersection = new Set([...a].filter(x => b.has(x)));
        const union = new Set([...a, ...b]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
}

module.exports = SenateCrossRefService;


