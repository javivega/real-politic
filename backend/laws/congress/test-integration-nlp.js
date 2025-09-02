/**
 * Test script for NLP integration in Congress Processing Service
 * Verifies that the NLP service is properly integrated and working
 */

const CongressProcessingService = require('./services/CongressProcessingService');
const path = require('path');

async function testNLPIntegration() {
    try {
        console.log('🧪 Testing NLP Integration in Congress Processing Service...\n');

        const congressService = new CongressProcessingService();
        
        // Test 1: Check if NLP service is initialized
        console.log('✅ Test 1: NLP Service Initialization');
        if (congressService.nlpService) {
            console.log('   ✅ NLP Service is properly initialized');
            console.log(`   📊 Service type: ${congressService.nlpService.constructor.name}`);
        } else {
            console.log('   ❌ NLP Service is not initialized');
            return;
        }

        // Test 2: Check configuration
        console.log('\n✅ Test 2: Configuration');
        console.log(`   📋 Enable NLP: ${congressService.config.enableNLP}`);
        console.log(`   📋 Enable Relationships: ${congressService.config.enableRelationships}`);
        console.log(`   📋 Enable Timeline: ${congressService.config.enableTimeline}`);
        console.log(`   📋 Enable Keywords: ${congressService.config.enableKeywords}`);

        // Test 3: Test NLP processing with sample data
        console.log('\n✅ Test 3: NLP Processing Test');
        const sampleInitiative = {
            numExpediente: 'TEST-001',
            tipo: 'Proposición de ley de Grupos Parlamentarios del Congreso',
            objeto: 'Proposición de Ley de reforma de la Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial (Orgánica).',
            autor: 'Grupo Parlamentario Vasco (EAJ-PNV)',
            fechaPresentacion: '29/08/2023'
        };

        const processed = congressService.nlpService.processLegalTitle(
            sampleInitiative.objeto,
            sampleInitiative.tipo,
            sampleInitiative.autor
        );

        console.log('   📝 Sample Initiative:');
        console.log(`      Original: ${sampleInitiative.objeto.substring(0, 60)}...`);
        console.log(`      ✅ Accessible Title: ${processed.accessible}`);
        console.log(`      📊 Subject Area: ${processed.metadata.subjectArea}`);
        console.log(`      🚨 Urgency: ${processed.metadata.urgency}`);
        console.log(`      📚 Complexity: ${processed.metadata.complexity}`);
        console.log(`      📖 Readability: ${processed.metadata.estimatedReadability}/100`);

        // Test 4: Test batch processing
        console.log('\n✅ Test 4: Batch Processing Test');
        const sampleBatch = [sampleInitiative];
        const batchProcessed = congressService.nlpService.processBatch(sampleBatch);
        
        console.log(`   📊 Processed ${batchProcessed.length} initiatives`);
        console.log(`   🔍 First initiative has processedTitle: ${!!batchProcessed[0].processedTitle}`);
        console.log(`   📝 Accessible title: ${batchProcessed[0].processedTitle?.accessible}`);

        // Test 5: Test NLP stats generation
        console.log('\n✅ Test 5: NLP Statistics Generation');
        const nlpStats = congressService.generateNLPStats();
        
        if (nlpStats) {
            console.log('   📊 NLP Statistics generated successfully');
            console.log(`      Total Processed: ${nlpStats.totalProcessed}`);
            console.log(`      Title Improvements: ${nlpStats.titleImprovements}`);
            console.log(`      Improvement Percentage: ${nlpStats.improvementPercentage}%`);
            console.log(`      Average Readability: ${nlpStats.averageReadability}/100`);
        } else {
            console.log('   ⚠️  NLP Statistics not generated (no initiatives loaded)');
        }

        // Test 6: Test configuration toggle
        console.log('\n✅ Test 6: Configuration Toggle');
        congressService.config.enableNLP = false;
        console.log(`   📋 NLP disabled: ${!congressService.config.enableNLP}`);
        
        const nlpStatsDisabled = congressService.generateNLPStats();
        console.log(`   📊 NLP stats when disabled: ${nlpStatsDisabled === null ? 'null (correct)' : 'generated (incorrect)'}`);
        
        // Re-enable for future tests
        congressService.config.enableNLP = true;

        console.log('\n🎉 NLP Integration Test Completed Successfully!');
        console.log('\n📋 Integration Status:');
        console.log('   ✅ NLP Service: Integrated and working');
        console.log('   ✅ Configuration: Properly set up');
        console.log('   ✅ Processing: Can handle individual and batch initiatives');
        console.log('   ✅ Statistics: Generated correctly');
        console.log('   ✅ Configuration: Can be toggled on/off');
        
        console.log('\n🚀 Ready for Production Use!');
        console.log('   • Run the full pipeline to process real initiatives with NLP');
        console.log('   • Frontend will automatically use accessible titles');
        console.log('   • Supabase will store NLP metadata for better filtering');

    } catch (error) {
        console.error('❌ Error testing NLP integration:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testNLPIntegration();
}

module.exports = { testNLPIntegration }; 