const puppeteer = require('puppeteer');

class XEvidenceService {
	constructor() {
		this.partyToHandle = {
			PSOE: 'PSOE',
			PP: 'populares',
			VOX: 'vox_es',
			SUMAR: 'sumar',
			ERC: 'Esquerra_ERC',
			Junts: 'JuntsXCat',
			'EAJ-PNV': 'eajpnv',
			'EH Bildu': 'ehbildu',
			BNG: 'obloque',
			UPN: 'upn_navarra',
			CC: 'Coalicion'
		};
	}

	getHandle(shortNameOrLabel = '') {
		const key = (shortNameOrLabel || '').toUpperCase();
		return this.partyToHandle[key] || null;
	}

	async searchTweetsViaGoogle(handle, terms, limit = 3) {
		const browser = await puppeteer.launch({ headless: 'new' });
		try {
			const page = await browser.newPage();
			const query = `site:x.com from:${handle} ${terms}`;
			await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
				waitUntil: 'domcontentloaded'
			});
			// Collect result links
			const results = await page.$$eval('a h3', nodes => nodes.map(n => n.parentElement && n.parentElement.href).filter(Boolean));
			// Fallback: generic anchors
			let urls = results;
			if (!urls || urls.length === 0) {
				urls = await page.$$eval('a', as => as.map(a => a.href).filter(h => h && h.includes('x.com')));
			}
			// Deduplicate and trim
			const dedup = Array.from(new Set(urls)).slice(0, limit);
			return dedup.map(u => ({ url: u }));
		} catch (e) {
			console.warn('XEvidenceService google search failed:', e.message || e);
			return [];
		} finally {
			await browser.close().catch(() => {});
		}
	}

	async getEvidenceForParty(initiative, partyShortOrLabel) {
		const handle = this.getHandle(partyShortOrLabel);
		if (!handle) return [];
		const terms = `${initiative.numExpediente || ''} ${((initiative.objeto || '').split(' ').slice(0, 8).join(' '))}`;
		const links = await this.searchTweetsViaGoogle(handle, terms, 3);
		return links.map(l => ({
			url: l.url,
			source: 'x.com',
			type: 'tweet'
		}));
	}
}

module.exports = XEvidenceService; 