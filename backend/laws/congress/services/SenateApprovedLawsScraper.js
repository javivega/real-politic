const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes Senado "Leyes aprobadas" for the current legislature
 * and extracts: law_number, law_type, title, boe_issue_number, boe_date, and link if present.
 */
class SenateApprovedLawsScraper {
    constructor() {
        this.url = 'https://www.senado.es/web/actividadparlamentaria/actualidad/leyes/aprobadas/index.html';
    }

    async fetchApprovedLaws() {
        const res = await axios.get(this.url, { headers: { 'User-Agent': 'RealPolitic/1.0' } });
        const $ = cheerio.load(res.data);

        const results = [];
        // The page structure may change; we target common content containers
        // Each law appears as a block with title line and a BOE data line
        $('a, h3, li').each((_, el) => {
            const text = $(el).text().trim().replace(/\s+/g, ' ');
            if (!text) return;

            // Quick filter: entries starting with "Ley" or "Ley Orgánica"
            if (!/^Ley( Orgánica)? \d+\/\d{4}/i.test(text)) return;

            const lawMatch = text.match(/^(Ley(?: Orgánica)?)[^\d]*(\d+\/\d{4}),?\s*(.*)$/i);
            if (!lawMatch) return;

            const law_type = lawMatch[1].trim();
            const law_number = lawMatch[2].trim();
            const title = lawMatch[3] ? lawMatch[3].trim() : '';

            // Look ahead for BOE line near this element
            let boe_issue_number = null;
            let boe_date = null;
            const next = $(el).next();
            const siblingText = next.text().trim();
            const boeLine = siblingText || '';
            const boeIssueMatch = boeLine.match(/B\.O\.E\. n[ºo] (\d+)/i);
            const boeDateMatch = boeLine.match(/de (\d{1,2}) de ([A-Za-zÁÉÍÓÚáéíóú]+) de (\d{4})/);
            if (boeIssueMatch) boe_issue_number = boeIssueMatch[1];
            if (boeDateMatch) boe_date = this.parseSpanishDate(boeDateMatch[0]);

            results.push({ law_type, law_number, title, boe_issue_number, boe_date });
        });

        // Deduplicate by law_number keeping the latest entry (longer info wins)
        const map = new Map();
        for (const r of results) {
            const prev = map.get(r.law_number);
            if (!prev || JSON.stringify(r).length > JSON.stringify(prev).length) {
                map.set(r.law_number, r);
            }
        }
        return Array.from(map.values());
    }

    parseSpanishDate(text) {
        // Extract DD de Mes de YYYY
        const m = text.match(/(\d{1,2}) de ([A-Za-zÁÉÍÓÚáéíóú]+) de (\d{4})/);
        if (!m) return null;
        const day = parseInt(m[1], 10);
        const year = parseInt(m[3], 10);
        const months = {
            'enero': 0,'febrero': 1,'marzo': 2,'abril': 3,'mayo': 4,'junio': 5,
            'julio': 6,'agosto': 7,'septiembre': 8,'setiembre': 8,'octubre': 9,'noviembre': 10,'diciembre': 11
        };
        const month = months[m[2].toLowerCase()];
        if (month == null) return null;
        return new Date(year, month, day).toISOString().split('T')[0];
    }
}

module.exports = SenateApprovedLawsScraper;


