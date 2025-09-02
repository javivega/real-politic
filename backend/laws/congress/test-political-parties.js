const PoliticalPartyService = require('./services/PoliticalPartyService');
const fs = require('fs-extra');
const path = require('path');

async function testPoliticalParties() {
    try {
        console.log('🧪 Testing Political Party Identification Service...\n');

        const service = new PoliticalPartyService();

        // Test 1: Show all political parties
        console.log('📋 Test 1: All Political Parties');
        const allParties = service.getAllPoliticalParties();
        Object.entries(allParties).forEach(([partyId, party]) => {
            console.log(`  ${party.shortName}: ${party.name}`);
        });
        console.log('');

        // Test 2: Test with sample data
        console.log('🎯 Test 2: Sample Party Identification');
        const sampleInitiatives = [
            {
                autor: 'Grupo Parlamentario Vasco (EAJ-PNV)',
                tipo: 'Proposición de ley',
                objeto: 'Proposición de Ley sobre derechos lingüísticos'
            },
            {
                autor: 'Grupo Parlamentario Popular en el Congreso',
                tipo: 'Proposición de ley',
                objeto: 'Proposición de Ley sobre seguridad ciudadana'
            },
            {
                autor: 'Grupo Parlamentario Socialista',
                tipo: 'Proposición de ley',
                objeto: 'Proposición de Ley sobre derechos laborales'
            },
            {
                autor: 'Grupo Parlamentario VOX',
                tipo: 'Proposición de ley',
                objeto: 'Proposición de Ley sobre inmigración'
            },
            {
                autor: 'Gobierno',
                tipo: 'Proyecto de ley',
                objeto: 'Proyecto de Ley de Presupuestos Generales del Estado'
            },
            {
                autor: 'Grupo Parlamentario Mixto',
                tipo: 'Proposición de ley',
                objeto: 'Proposición de Ley sobre derechos de los animales'
            }
        ];

        sampleInitiatives.forEach((initiative, i) => {
            const party = service.identifyPoliticalParty(initiative);
            console.log(`  ${i + 1}. ${initiative.autor}`);
            console.log(`     → ${party.party_name} (${party.party_short_name})`);
            console.log(`     → Confidence: ${party.confidence}, Method: ${party.method}`);
            console.log('');
        });

        // Test 3: Test with real data if available
        console.log('📊 Test 3: Real Data Analysis');
        const initiativesPath = path.join(__dirname, 'output/iniciativas-completas.json');
        
        if (await fs.pathExists(initiativesPath)) {
            const initiatives = await fs.readJson(initiativesPath);
            console.log(`✅ Loaded ${initiatives.length} real initiatives`);
            
            // Get party distribution
            const distribution = service.getPartyDistribution(initiatives);
            console.log(`📈 Party Distribution (Top 10):`);
            
            distribution.distribution.slice(0, 10).forEach((party, i) => {
                console.log(`  ${i + 1}. ${party.party_short_name}: ${party.count} (${party.percentage}%)`);
            });

            // Show some examples of each major party
            console.log('\n🔍 Examples by Party:');
            const examplesByParty = {};
            
            initiatives.forEach(initiative => {
                const party = service.identifyPoliticalParty(initiative);
                const partyId = party.party_id;
                
                if (!examplesByParty[partyId]) {
                    examplesByParty[partyId] = [];
                }
                
                if (examplesByParty[partyId].length < 2) {
                    examplesByParty[partyId].push({
                        expediente: initiative.numExpediente,
                        tipo: initiative.tipo,
                        objeto: initiative.objeto.substring(0, 80) + '...'
                    });
                }
            });

            // Show examples for major parties
            ['partido_popular', 'partido_socialista', 'vox', 'sumar', 'partido_nacionalista_vasco'].forEach(partyId => {
                if (examplesByParty[partyId] && examplesByParty[partyId].length > 0) {
                    const party = service.getPartyById(partyId);
                    console.log(`\n  ${party.shortName} (${party.name}):`);
                    examplesByParty[partyId].forEach(example => {
                        console.log(`    • ${example.expediente}: ${example.objeto}`);
                    });
                }
            });

        } else {
            console.log('⚠️  No real initiatives data found. Run the full pipeline first.');
        }

        console.log('\n🎉 Political Party Service test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing Political Party Service:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testPoliticalParties();
}

module.exports = { testPoliticalParties }; 