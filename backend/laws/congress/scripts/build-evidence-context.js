#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const XmlProcessingService = require('../services/XmlProcessingService');
const NewsEvidenceService = require('../services/NewsEvidenceService');
const XEvidenceService = require('../services/XEvidenceService');

async function main() {
	const [,, inputPathArg, outputPathArg] = process.argv;
	if (!inputPathArg) {
		console.error('Usage: node scripts/build-evidence-context.js <xml-file-or-folder> [output.json]');
		process.exit(1);
	}
	const inputPath = path.resolve(inputPathArg);
	const outputPath = path.resolve(outputPathArg || './output/evidence-context.json');
	await fs.ensureDir(path.dirname(outputPath));

	const xmlService = new XmlProcessingService();
	const news = new NewsEvidenceService();
	const xsvc = new XEvidenceService();

	const stats = await fs.stat(inputPath);
	if (stats.isDirectory()) {
		await xmlService.processDownloadsFolder(inputPath);
	} else {
		await xmlService.processXMLFile(inputPath);
	}

	const initiatives = Array.from(xmlService.getInitiatives().values()).map(i => i.toObject());
	const out = [];

	for (const init of initiatives) {
		const newsItems = await news.searchNews({ numExpediente: init.numExpediente, objeto: init.objeto }, 5);
		// For X, we collect per some key parties
		const parties = ['PSOE','PP','VOX','SUMAR','ERC','Junts','EAJ-PNV','EH Bildu','BNG','UPN','CC'];
		const xEvidence = {};
		for (const p of parties) {
			const links = await xsvc.getEvidenceForParty({ numExpediente: init.numExpediente, objeto: init.objeto }, p);
			if (links.length > 0) xEvidence[p] = links;
		}
		out.push({
			initiative_id: init.numExpediente,
			news: newsItems,
			x: xEvidence,
			legal: {
				bocg: init.enlacesBOCG || init.enlaces_bocg || null,
				ds: init.enlacesDS || init.enlaces_ds || null
			}
		});
	}

	await fs.writeJson(outputPath, out, { spaces: 2 });
	console.log(`✅ Wrote evidence context to ${outputPath}`);
}

if (require.main === module) {
	main();
} 