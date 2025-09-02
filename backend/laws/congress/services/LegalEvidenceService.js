const puppeteer = require('puppeteer');

class LegalEvidenceService {
	constructor() {}

	static pickFromInitiative(init) {
		const links = [];
		const bocg = init.enlacesBOCG || init.enlaces_bocg;
		const ds = init.enlacesDS || init.enlaces_ds;
		if (bocg) links.push({ url: bocg, source: 'BOCG', type: 'official' });
		if (ds) links.push({ url: ds, source: 'Diario de Sesiones', type: 'official' });
		return links;
	}

	async searchOfficial(init, limit = 3) {
		const browser = await puppeteer.launch({ headless: 'new' });
		try {
			const page = await browser.newPage();
			const q1 = `site:www.congreso.es BOCG ${init.numExpediente || ''}`;
			await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q1)}`, { waitUntil: 'domcontentloaded' });
			let urls = await page.$$eval('a', as => as.map(a => a.href).filter(h => h && h.includes('www.congreso.es')));
			urls = Array.from(new Set(urls));
			if (urls.length < limit) {
				const q2 = `site:www.congreso.es "Diario de Sesiones" ${init.numExpediente || ''}`;
				await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q2)}`, { waitUntil: 'domcontentloaded' });
				const extra = await page.$$eval('a', as => as.map(a => a.href).filter(h => h && h.includes('www.congreso.es')));
				urls = Array.from(new Set(urls.concat(extra)));
			}
			return urls.slice(0, limit).map(u => ({ url: u, source: 'Congreso', type: 'official' }));
		} catch (e) {
			console.warn('LegalEvidenceService search failed:', e.message || e);
			return [];
		} finally {
			await browser.close().catch(() => {});
		}
	}

	async fetchSnippet(url) {
		const browser = await puppeteer.launch({ headless: 'new' });
		try {
			const page = await browser.newPage();
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			const snippet = await page.$eval('body', b => (b.innerText || '').replace(/\s+/g, ' ').slice(0, 300));
			return snippet;
		} catch (e) {
			return '';
		} finally {
			await browser.close().catch(() => {});
		}
	}

	async getLegalEvidence(init) {
		const links = LegalEvidenceService.pickFromInitiative(init);
		const more = await this.searchOfficial(init, 3);
		const all = Array.from(new Set([...links.map(l => l.url), ...more.map(m => m.url)])).map(u => {
			const meta = links.find(l => l.url === u) || more.find(m => m.url === u) || { source: 'Congreso', type: 'official' };
			return { url: u, source: meta.source, type: meta.type };
		});
		// Optionally fetch snippets for first 2 links to keep it fast
		for (let i = 0; i < Math.min(2, all.length); i++) {
			all[i].snippet = await this.fetchSnippet(all[i].url);
		}
		return all;
	}
}

module.exports = LegalEvidenceService; 