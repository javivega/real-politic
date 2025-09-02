/**
 * Test script for Spanish Legal NLP Service
 * Demonstrates how the service processes legal titles to make them more accessible
 */

const SpanishLegalNLPService = require('./services/SpanishLegalNLPService');
const fs = require('fs-extra');
const path = require('path');

async function testNLPTitles() {
    try {
        console.log('🧪 Testing Spanish Legal NLP Service...\n');

        const nlpService = new SpanishLegalNLPService();

        // Test with sample legal texts
        const sampleTexts = [
            {
                objeto: "Real Decreto-ley 7/2023, de 19 de diciembre, por el que se adoptan medidas urgentes, para completar la transposición de la Directiva (UE) 2019/1158, del Parlamento Europeo y del Consejo, de 20 de junio de 2019, relativa a la conciliación de la vida familiar y la vida profesional de los progenitores y los cuidadores, y por la que se deroga la Directiva 2010/18/UE del Consejo, y para la simplificación y mejora del nivel asistencial de la protección por desempleo.",
                tipo: "Reales decretos",
                autor: "Gobierno de España"
            },
            {
                objeto: "Ley Orgánica 6/2024, de 5 de diciembre, por la que se modifica la Ley Orgánica 13/1982, de 10 de agosto, de reintegración y amejoramiento del Régimen Foral de Navarra, en cuanto a tráfico, circulación de vehículos de motor y seguridad vial.",
                tipo: "Leyes organicas",
                autor: "Gobierno de España"
            },
            {
                objeto: "Proposición de Ley de reforma de la Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial (Orgánica).",
                tipo: "Proposición de ley de Grupos Parlamentarios del Congreso",
                autor: "Grupo Parlamentario Vasco (EAJ-PNV)"
            },
            {
                objeto: "Proposición de Ley Orgánica para abordar la recuperación urgente por parte de las personas trabajadoras de los derechos de conciliación eliminados por la Ley Orgánica 2/2024, de 1 de agosto, de representación paritaria y presencia equilibrada de mujeres y hombres.",
                tipo: "Proposición de ley de Grupos Parlamentarios del Congreso",
                autor: "Grupo Parlamentario Socialista"
            },
            {
                objeto: "Real Decreto-ley 9/2024, de 23 de diciembre, por el que se adoptan medidas urgentes en materia económica, tributaria, de transporte, y de Seguridad Social, y se prorrogan determinadas medidas para hacer frente a situaciones de vulnerabilidad social.",
                tipo: "Reales decretos",
                autor: "Gobierno de España"
            }
        ];

        console.log('📝 Processing sample legal titles...\n');

        for (let i = 0; i < sampleTexts.length; i++) {
            const sample = sampleTexts[i];
            console.log(`🔍 Sample ${i + 1}:`);
            console.log(`   Original: ${sample.objeto.substring(0, 100)}...`);
            console.log(`   Type: ${sample.tipo}`);
            console.log(`   Author: ${sample.autor}`);
            
            try {
                const processed = nlpService.processLegalTitle(sample.objeto, sample.tipo, sample.autor);
                
                console.log(`   ✅ Accessible Title: ${processed.accessible}`);
                if (processed.metadata) {
                    console.log(`   📊 Subject Area: ${processed.metadata.subjectArea}`);
                    console.log(`   🚨 Urgency: ${processed.metadata.urgency}`);
                    console.log(`   📚 Complexity: ${processed.metadata.complexity}`);
                    console.log(`   📖 Readability: ${processed.metadata.estimatedReadability}/100`);
                }
                if (processed.extracted) {
                    console.log(`   🎯 Action: ${processed.extracted.action}`);
                    console.log(`   📋 Subject: ${processed.extracted.subject}`);
                    if (processed.extracted.purpose) {
                        console.log(`   🎯 Purpose: ${processed.extracted.purpose}`);
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error processing: ${error.message}`);
            }
            console.log('');
        }

        // Test with real data if available
        console.log('📊 Testing with real data...\n');
        const realDataPath = path.join(__dirname, 'output/iniciativas-completas.json');
        
        if (await fs.pathExists(realDataPath)) {
            const realInitiatives = await fs.readJson(realDataPath);
            console.log(`✅ Loaded ${realInitiatives.length} real initiatives`);
            
            // Process first 5 initiatives
            const sampleReal = realInitiatives.slice(0, 5);
            const processedReal = nlpService.processBatch(sampleReal);
            
            console.log('\n📋 Real Data Examples:');
            processedReal.forEach((initiative, i) => {
                console.log(`\n${i + 1}. ${initiative.numExpediente}`);
                console.log(`   Original: ${initiative.objeto.substring(0, 80)}...`);
                console.log(`   ✅ NLP Title: ${initiative.processedTitle.accessible}`);
                console.log(`   📊 Area: ${initiative.processedTitle.metadata.subjectArea}`);
                console.log(`   🚨 Urgency: ${initiative.processedTitle.metadata.urgency}`);
                console.log(`   📖 Readability: ${initiative.processedTitle.metadata.estimatedReadability}/100`);
            });
            
            // Generate statistics
            const stats = {
                total: processedReal.length,
                bySubjectArea: {},
                byUrgency: {},
                byComplexity: {},
                avgReadability: 0
            };
            
            processedReal.forEach(initiative => {
                const metadata = initiative.processedTitle.metadata;
                
                // Subject area distribution
                stats.bySubjectArea[metadata.subjectArea] = (stats.bySubjectArea[metadata.subjectArea] || 0) + 1;
                
                // Urgency distribution
                stats.byUrgency[metadata.urgency] = (stats.byUrgency[metadata.urgency] || 0) + 1;
                
                // Complexity distribution
                stats.byComplexity[metadata.complexity] = (stats.byComplexity[metadata.complexity] || 0) + 1;
                
                // Average readability
                stats.avgReadability += metadata.estimatedReadability;
            });
            
            stats.avgReadability = Math.round(stats.avgReadability / stats.total);
            
            console.log('\n📈 Processing Statistics:');
            console.log(`   Total Processed: ${stats.total}`);
            console.log(`   Average Readability: ${stats.avgReadability}/100`);
            console.log(`   Subject Areas:`, stats.bySubjectArea);
            console.log(`   Urgency Levels:`, stats.byUrgency);
            console.log(`   Complexity Levels:`, stats.byComplexity);
            
        } else {
            console.log('⚠️  No real initiatives data found. Run the full pipeline first.');
        }

        console.log('\n🎉 NLP Title Processing test completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('  1. Integrate this service into the main processing pipeline');
        console.log('  2. Use processed titles in the frontend instead of raw objeto');
        console.log('  3. Add metadata to Supabase for better filtering and analysis');

    } catch (error) {
        console.error('❌ Error testing NLP service:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testNLPTitles();
}

module.exports = { testNLPTitles }; 