const puppeteer = require('puppeteer');

class NewsEvidenceService {
	async searchNews(initiative, limit = 5) {
		const browser = await puppeteer.launch({ headless: 'new' });
		try {
			const page = await browser.newPage();
			const q = `${initiative.numExpediente || ''} ${((initiative.objeto || '').split(' ').slice(0, 10).join(' '))}`.trim();
			const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws&hl=es`;
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			const items = await page.$$eval('div.dbsr', cards => cards.map(c => {
				const a = c.querySelector('a');
				const title = c.querySelector('div[role="heading"]')?.textContent || '';
				const snippet = c.querySelector('.Y3v8qd')?.textContent || '';
				return a && a.href ? { url: a.href, title, snippet } : null;
			}).filter(Boolean));
			return (items || []).slice(0, limit);
		} catch (e) {
			console.warn('NewsEvidenceService search failed:', e.message || e);
			return [];
		} finally {
			await browser.close().catch(() => {});
		}
	}

	normalizePartyLabel(label = '') {
		const l = (label || '').toLowerCase();
		const map = {
			'psoe': ['psoe','partido socialista obrero español','socialistas'],
			'pp': ['pp','partido popular','populares'],
			'vox': ['vox'],
			'sumar': ['sumar'],
			'erc': ['erc','esquerra republicana','esquerra republicana de catalunya'],
			'junts': ['junts','junts per catalunya'],
			'eaj-pnv': ['eaj-pnv','pnv','partido nacionalista vasco'],
			'eh bildu': ['eh bildu','bildu'],
			'bng': ['bng','bloque nacionalista galego'],
			'upn': ['upn','union del pueblo navarro','unión del pueblo navarro'],
			'cc': ['cc','coalicion canaria','coalición canaria']
		};
		for (const [shortName, aliases] of Object.entries(map)) {
			if (aliases.includes(l)) return shortName.toUpperCase();
		}
		return label.toUpperCase();
	}

	async searchNewsForParty(initiative, partyLabel, limit = 5) {
		const browser = await puppeteer.launch({ headless: 'new' });
		try {
			const page = await browser.newPage();
			const party = this.normalizePartyLabel(partyLabel);
			const q = `${party} ${initiative.numExpediente || ''} ${((initiative.objeto || '').split(' ').slice(0, 8).join(' '))}`.trim();
			const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws&hl=es`;
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			const items = await page.$$eval('div.dbsr', cards => cards.map(c => {
				const a = c.querySelector('a');
				const title = c.querySelector('div[role="heading"]')?.textContent || '';
				const snippet = c.querySelector('.Y3v8qd')?.textContent || '';
				return a && a.href ? { url: a.href, title, snippet } : null;
			}).filter(Boolean));
			return (items || []).slice(0, limit);
		} catch (e) {
			console.warn('NewsEvidenceService party search failed:', e.message || e);
			return [];
		} finally {
			await browser.close().catch(() => {});
		}
	}
}

module.exports = NewsEvidenceService; 