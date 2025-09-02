#!/usr/bin/env node

/**
 * Script de prueba para verificar la integración de descarga
 * con el procesamiento del Congreso
 */

const CongressProcessingService = require('./services/CongressProcessingService');
const PoliticalPartyService = require('./services/PoliticalPartyService');
const SupabaseService = require('./services/SupabaseService');

async function testIntegration() {
    try {
        console.log('🧪 Testing Political Party Integration...\n');

        // Test 1: Political Party Service
        console.log('📋 Test 1: Political Party Service');
        const partyService = new PoliticalPartyService();
        const sampleInitiative = {
            autor: 'Grupo Parlamentario Vasco (EAJ-PNV)',
            tipo: 'Proposición de ley',
            objeto: 'Proposición de Ley sobre derechos lingüísticos'
        };
        
        const party = partyService.identifyPoliticalParty(sampleInitiative);
        console.log(`  Initiative: ${sampleInitiative.autor}`);
        console.log(`  → Identified Party: ${party.party_name} (${party.party_short_name})`);
        console.log(`  → Confidence: ${party.confidence}, Method: ${party.method}\n`);

        // Test 2: Supabase Service
        console.log('🔌 Test 2: Supabase Service');
        const supabaseService = new SupabaseService();
        
        // Test connection
        const connected = await supabaseService.testConnection();
        console.log(`  Connection: ${connected ? '✅ Success' : '❌ Failed'}\n`);

        // Test 3: Congress Processing Service
        console.log('🏛️  Test 3: Congress Processing Service');
        const congressService = new CongressProcessingService();
        
        // Check if we have processed data
        const outputPath = require('path').join(__dirname, 'output/iniciativas-completas.json');
        const fs = require('fs-extra');
        
        if (await fs.pathExists(outputPath)) {
            const initiatives = await fs.readJson(outputPath);
            console.log(`  ✅ Found ${initiatives.length} processed initiatives`);
            
            // Test political party identification on real data
            const partyDistribution = partyService.getPartyDistribution(initiatives.slice(0, 10));
            console.log(`  📊 Sample Party Distribution (Top 5):`);
            partyDistribution.distribution.slice(0, 5).forEach((party, i) => {
                console.log(`    ${i + 1}. ${party.party_short_name}: ${party.count} (${party.percentage}%)`);
            });
        } else {
            console.log('  ⚠️  No processed initiatives found. Run the full pipeline first.');
        }

        console.log('\n🎉 Integration test completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('  1. Apply the database migration: 005_add_political_party_fields.sql');
        console.log('  2. Run the full pipeline: node index.js');
        console.log('  3. Check Supabase for political party data');

    } catch (error) {
        console.error('❌ Error in integration test:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testIntegration();
}

module.exports = { testIntegration }; 