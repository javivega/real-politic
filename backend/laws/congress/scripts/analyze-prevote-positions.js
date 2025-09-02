#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const XmlProcessingService = require('../services/XmlProcessingService');
const PoliticalPartyService = require('../services/PoliticalPartyService');
const PreVotePositionService = require('../services/PreVotePositionService');

async function main() {
    try {
        const [,, inputPathArg, outputPathArg] = process.argv;
        if (!inputPathArg) {
            console.error('Usage: node scripts/analyze-prevote-positions.js <xml-file-or-folder> [output.json]');
            process.exit(1);
        }

        const inputPath = path.resolve(inputPathArg);
        const outputPath = path.resolve(outputPathArg || './output/prevote-positions.json');

        await fs.ensureDir(path.dirname(outputPath));

        const xmlService = new XmlProcessingService();
        const partyService = new PoliticalPartyService();
        const prevoteService = new PreVotePositionService(partyService);

        let initiatives = [];

        const stats = await fs.stat(inputPath);
        if (stats.isDirectory()) {
            // Process whole folder (date folder or downloads root)
            await xmlService.processDownloadsFolder(inputPath);
            initiatives = Array.from(xmlService.getInitiatives().values()).map(i => i.toObject());
        } else {
            // Process single XML file
            await xmlService.processXMLFile(inputPath);
            initiatives = Array.from(xmlService.getInitiatives().values()).map(i => i.toObject());
        }

        // Map initiatives to required minimal fields (NUMEXPEDIENTE, AUTOR, OBJETO, FECHAPRESENTACION, SITUACIONACTUAL)
        const minimalInits = initiatives.map(i => ({
            numExpediente: i.numExpediente,
            autor: i.autor,
            objeto: i.objeto,
            fechaPresentacion: i.fechaPresentacion,
            situacionActual: i.situacionActual,
            tramitacion: i.tramitacion,
            enlacesDS: i.enlacesDS
        }));

        const analysis = prevoteService.inferForInitiatives(minimalInits);

        await fs.writeJson(outputPath, analysis, { spaces: 2 });
        console.log(`✅ Wrote pre-vote positions to ${outputPath}`);
    } catch (err) {
        console.error('❌ Error analyzing pre-vote positions:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 