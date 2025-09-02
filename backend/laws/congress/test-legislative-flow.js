const LegislativeFlowService = require('./services/LegislativeFlowService');

async function testLegislativeFlow() {
    try {
        console.log('🧪 Testing Legislative Flow Service...\n');

        const service = new LegislativeFlowService();

        // Test 1: Load legislative data
        console.log('📋 Test 1: Loading legislative data...');
        const loadSuccess = await service.loadLegislativeData();
        
        if (!loadSuccess) {
            console.log('❌ Failed to load legislative data');
            return;
        }

        console.log(`✅ Loaded ${service.approvedLaws.length} approved laws`);
        console.log(`✅ Loaded ${service.initiatives.length} initiatives\n`);

        // Test 2: Show sample approved laws
        console.log('📜 Test 2: Sample approved laws...');
        service.approvedLaws.slice(0, 3).forEach((law, i) => {
            console.log(`  ${i + 1}. ${law.tipo} ${law.numero_ley}/${law.year}: ${law.titulo_ley.substring(0, 80)}...`);
        });
        console.log('');

        // Test 3: Show sample initiatives
        console.log('📋 Test 3: Sample initiatives...');
        service.initiatives.slice(0, 3).forEach((initiative, i) => {
            console.log(`  ${i + 1}. ${initiative.tipo}: ${initiative.objeto.substring(0, 80)}...`);
            console.log(`     Expediente: ${initiative.numexpediente}, Autor: ${initiative.autor}`);
        });
        console.log('');

        // Test 4: Create legislative timelines
        console.log('🔗 Test 4: Creating legislative timelines...');
        const timelines = service.createLegislativeTimelines();
        
        console.log(`✅ Created ${timelines.length} legislative timelines\n`);

        // Test 5: Show sample timeline
        if (timelines.length > 0) {
            console.log('📊 Test 5: Sample legislative timeline...');
            const sampleTimeline = timelines[0];
            
            console.log(`  Law ID: ${sampleTimeline.law_id || sampleTimeline.initiative_id}`);
            if (sampleTimeline.law_title) {
                console.log(`  Law Title: ${sampleTimeline.law_title}`);
                console.log(`  Law Type: ${sampleTimeline.law_type}`);
                console.log(`  Final Status: ${sampleTimeline.final_status}`);
            } else {
                console.log(`  Initiative Type: ${sampleTimeline.initiative_type}`);
                console.log(`  Author: ${sampleTimeline.author}`);
                console.log(`  Current Status: ${sampleTimeline.current_status}`);
            }
            
            console.log(`  Timeline Events: ${sampleTimeline.timeline_events.length}`);
            sampleTimeline.timeline_events.slice(0, 3).forEach((event, i) => {
                console.log(`    ${i + 1}. ${event.date}: ${event.description}`);
            });
            
            if (sampleTimeline.related_initiatives && sampleTimeline.related_initiatives.length > 0) {
                console.log(`  Related Initiatives: ${sampleTimeline.related_initiatives.length}`);
            }
        }

        // Test 6: Generate summary
        console.log('\n📊 Test 6: Generating summary...');
        const summary = service.generateSummary();

        // Test 7: Export timelines
        console.log('\n📁 Test 7: Exporting timelines...');
        const exportPath = await service.exportLegislativeTimelines();
        if (exportPath) {
            console.log(`✅ Timelines exported to: ${exportPath}`);
        }

        console.log('\n🎉 Legislative Flow Service test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing Legislative Flow Service:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testLegislativeFlow();
}

module.exports = { testLegislativeFlow }; 