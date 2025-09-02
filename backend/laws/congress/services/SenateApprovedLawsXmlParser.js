const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

/**
 * Parses the Senate approved laws XML export and extracts structured entries.
 * Expected structure similar to backend/supabase/openData*.xml provided by user.
 */
class SenateApprovedLawsXmlParser {
    constructor(config = {}) {
        this.config = {
            xmlPath: config.xmlPath || null,
            xmlDir: config.xmlDir || path.resolve(__dirname, '../../supabase'),
            ...config
        };
        this.parser = new xml2js.Parser({ explicitArray: false, trim: true, ignoreAttrs: true });
    }

    async parse() {
        const xmlPath = await this.resolveXmlPath();
        if (!xmlPath) return [];
        const data = await fs.readFile(xmlPath, 'utf8');
        const json = await this.parser.parseStringPromise(data);
        const results = [];

        const pushEntry = (node, isOrganica = false) => {
            if (!node) return;
            const titulo = (node.titulo || '').trim();
            if (!titulo) return;
            const lawNumberMatch = titulo.match(/^(Ley(?: Orgánica)?)[^\d]*(\d+\/\d{4})/i);
            const law_type = lawNumberMatch ? lawNumberMatch[1] : null;
            const law_number = lawNumberMatch ? lawNumberMatch[2] : null;
            const expedienteMatch = titulo.match(/\((\d{3})\/(\d{6})\)/);
            const expediente = expedienteMatch ? `${expedienteMatch[1]}/${expedienteMatch[2]}` : null;
            const boeLine = (node.boe || '').trim();
            const urlBoe = (node.urlBoe || '').trim();
            const boeDate = this.extractBoeDate(boeLine);
            results.push({
                law_type,
                law_number,
                title: titulo,
                expediente,
                boe_issue_number: this.extractBoeIssue(boeLine),
                boe_date: boeDate,
                url_boe: urlBoe || null
            });
        };

        const organicas = json.leyesAprobadas?.leyesOrganicas?.detalleLeyOrganica;
        if (organicas) {
            const arr = Array.isArray(organicas) ? organicas : [organicas];
            arr.forEach(n => pushEntry(n, true));
        }
        const leyes = json.leyesAprobadas?.leyes?.detalleLey;
        if (leyes) {
            const arr = Array.isArray(leyes) ? leyes : [leyes];
            arr.forEach(n => pushEntry(n, false));
        }
        return results;
    }

    async resolveXmlPath() {
        if (this.config.xmlPath) {
            const exists = await fs.pathExists(this.config.xmlPath);
            return exists ? this.config.xmlPath : null;
        }
        const dir = this.config.xmlDir;
        if (!await fs.pathExists(dir)) return null;
        const files = (await fs.readdir(dir))
            .filter(f => /^openData\d+\.xml$/i.test(f))
            .map(f => path.join(dir, f));
        if (files.length === 0) return null;
        const withTimes = await Promise.all(files.map(async f => ({ f, t: (await fs.stat(f)).mtimeMs })));
        withTimes.sort((a, b) => b.t - a.t);
        return withTimes[0].f;
    }

    extractBoeIssue(boeLine) {
        const m = (boeLine || '').match(/B\.O\.E\. n[ºo] (\d+)/i);
        return m ? m[1] : null;
    }

    extractBoeDate(boeLine) {
        const m = (boeLine || '').match(/(\d{1,2}) de ([A-Za-zÁÉÍÓÚáéíóú]+) de (\d{4})/);
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

module.exports = SenateApprovedLawsXmlParser;


