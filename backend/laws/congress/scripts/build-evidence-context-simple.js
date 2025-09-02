#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const XmlProcessingService = require('../services/XmlProcessingService');

async function main() {
    const [,, inputPathArg, outputPathArg] = process.argv;
    if (!inputPathArg) {
        console.error('Usage: node scripts/build-evidence-context-simple.js <xml-file-or-folder> [output.json]');
        process.exit(1);
    }
    const inputPath = path.resolve(inputPathArg);
    const outputPath = path.resolve(outputPathArg || './output/evidence-context.json');
    await fs.ensureDir(path.dirname(outputPath));

    const xmlService = new XmlProcessingService();

    const stats = await fs.stat(inputPath);
    if (stats.isDirectory()) {
        await xmlService.processDownloadsFolder(inputPath);
    } else {
        await xmlService.processXMLFile(inputPath);
    }

    const initiatives = Array.from(xmlService.getInitiatives().values()).map(i => i.toObject());
    const out = [];

    console.log(`📊 Processing ${initiatives.length} initiatives for evidence context...`);

    for (const init of initiatives) {
        // Create basic evidence context with legal documents
        const evidenceContext = {
            initiative_id: init.numExpediente,
            news: [
                {
                    url: `https://www.google.com/search?q=${encodeURIComponent(`"${init.numExpediente}" "${init.objeto?.substring(0, 50)}" congreso españa`)}`,
                    title: `Búsqueda de noticias: ${init.numExpediente}`,
                    snippet: `Noticias relacionadas con la iniciativa ${init.numExpediente} del Congreso de los Diputados`
                }
            ],
            x: {
                "PSOE": [
                    {
                        url: `https://www.google.com/search?q=${encodeURIComponent(`site:x.com from:psoe "${init.numExpediente}"`)}`,
                        source: "x.com",
                        type: "search"
                    }
                ],
                "PP": [
                    {
                        url: `https://www.google.com/search?q=${encodeURIComponent(`site:x.com from:populares "${init.numExpediente}"`)}`,
                        source: "x.com",
                        type: "search"
                    }
                ],
                "VOX": [
                    {
                        url: `https://www.google.com/search?q=${encodeURIComponent(`site:x.com from:vox_es "${init.numExpediente}"`)}`,
                        source: "x.com",
                        type: "search"
                    }
                ]
            },
            legal: {
                bocg: init.enlacesBOCG || init.enlaces_bocg || null,
                ds: init.enlacesDS || init.enlaces_ds || null
            }
        };

        out.push(evidenceContext);
    }

    await fs.writeJson(outputPath, out, { spaces: 2 });
    console.log(`✅ Wrote evidence context for ${out.length} initiatives to ${outputPath}`);
    
    // Copy to public directory for frontend access
    const publicPath = path.resolve('../../public/evidence-context.json');
    await fs.copy(outputPath, publicPath);
    console.log(`✅ Copied evidence context to ${publicPath}`);
}

if (require.main === module) {
    main().catch(console.error);
}
