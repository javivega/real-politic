#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const XmlProcessingService = require('../services/XmlProcessingService');
const PoliticalPartyService = require('../services/PoliticalPartyService');
const XEvidenceService = require('../services/XEvidenceService');

async function main() {
	const [,, inputPathArg, outputPathArg] = process.argv;
	if (!inputPathArg) {
		console.error('Usage: node scripts/fetch-prevote-evidence.js <xml-file-or-folder> [output.json]');
		process.exit(1);
	}

	const inputPath = path.resolve(inputPathArg);
	const outputPath = path.resolve(outputPathArg || './output/prevote-positions-with-evidence.json');
	await fs.ensureDir(path.dirname(outputPath));

	const xmlService = new XmlProcessingService();
	const partyService = new PoliticalPartyService();
	const xService = new XEvidenceService();

	const stats = await fs.stat(inputPath);
	if (stats.isDirectory()) {
		await xmlService.processDownloadsFolder(inputPath);
	} else {
		await xmlService.processXMLFile(inputPath);
	}

	const initiatives = Array.from(xmlService.getInitiatives().values()).map(i => i.toObject());
	const parties = partyService.getAllPoliticalParties();
	const partyShorts = Object.values(parties).map(p => p.shortName);

	const results = [];
	for (const init of initiatives) {
		const record = {
			initiative_id: init.numExpediente,
			party_positions_prevote: [],
			party_evidence: {}
		};
		for (const short of partyShorts) {
			const links = await xService.getEvidenceForParty({ numExpediente: init.numExpediente, objeto: init.objeto }, short);
			if (links.length > 0) {
				record.party_evidence[short] = (record.party_evidence[short] || []).concat(links);
			}
		}
		results.push(record);
	}

	await fs.writeJson(outputPath, results, { spaces: 2 });
	console.log(`✅ Wrote evidence to ${outputPath}`);
}

if (require.main === module) {
	main();
} 