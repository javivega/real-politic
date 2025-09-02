const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

/**
 * Downloads the Senate approved laws XML from a configurable URL and stores it locally.
 * Configure URL via SENATE_XML_URL. Example:
 *   https://www.senado.es/web/actividadparlamentaria/actualidad/leyes/aprobadas/opendata.xml
 */
class SenateOpenDataService {
    constructor(config = {}) {
        this.config = {
            url: process.env.SENATE_XML_URL || config.url || '',
            targetDir: config.targetDir || path.resolve(__dirname, '../../supabase'),
        };
    }

    async downloadLatest() {
        if (!this.config.url) {
            console.warn('SENATE_XML_URL not set; skipping Senate XML download');
            return null;
        }
        const normalizedUrl = this.sanitizeOpenDataUrl(this.config.url);
        await fs.ensureDir(this.config.targetDir);
        const ts = new Date();
        const stamp = `${ts.getFullYear()}${(ts.getMonth()+1).toString().padStart(2,'0')}${ts.getDate().toString().padStart(2,'0')}${ts.getHours().toString().padStart(2,'0')}${ts.getMinutes().toString().padStart(2,'0')}${ts.getSeconds().toString().padStart(2,'0')}`;
        const filename = `openData${stamp}.xml`;
        const fullPath = path.join(this.config.targetDir, filename);

        const res = await axios.get(normalizedUrl, {
            responseType: 'arraybuffer',
            maxRedirects: 5,
            headers: {
                'User-Agent': 'RealPolitic/1.0',
                'Accept': 'application/xml, text/xml, text/plain, */*',
                'Referer': 'https://www.senado.es/'
            }
        });
        await fs.writeFile(fullPath, res.data);
        console.log(`📥 Downloaded Senate XML to ${fullPath}`);
        return fullPath;
    }

    sanitizeOpenDataUrl(url) {
        try {
            // Remove any ;jsessionid=... segment while preserving query string
            const [base, query = ''] = url.split('?');
            const cleanedBase = base.replace(/;jsessionid=[^?]*/i, '');
            return query ? `${cleanedBase}?${query}` : cleanedBase;
        } catch {
            return url;
        }
    }
}

module.exports = SenateOpenDataService;


