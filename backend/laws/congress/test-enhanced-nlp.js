/**
 * Test script for Enhanced Spanish Legal NLP Service
 * Demonstrates improved understanding of law changes and purposes
 */

const SpanishLegalNLPService = require('./services/SpanishLegalNLPService');

async function testEnhancedNLP() {
    try {
        console.log('🧠 Testing Enhanced Spanish Legal NLP Service...\n');

        const nlpService = new SpanishLegalNLPService();

        // Test with sample legal texts that reference other laws
        const sampleTexts = [
            {
                objeto: "Proposición de Ley de reforma de la Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial (Orgánica), para mejorar la independencia judicial y garantizar la transparencia en la selección de magistrados.",
                tipo: "Proposición de ley de Grupos Parlamentarios del Congreso",
                autor: "Grupo Parlamentario Vasco (EAJ-PNV)"
            },
            {
                objeto: "Ley Orgánica 6/2024, de 5 de diciembre, por la que se modifica la Ley Orgánica 13/1982, de 10 de agosto, de reintegración y amejoramiento del Régimen Foral de Navarra, en cuanto a tráfico, circulación de vehículos de motor y seguridad vial.",
                tipo: "Leyes organicas",
                autor: "Gobierno de España"
            },
            {
                objeto: "Real Decreto-ley 9/2024, de 23 de diciembre, por el que se adoptan medidas urgentes en materia económica, tributaria, de transporte, y de Seguridad Social, y se prorrogan determinadas medidas para hacer frente a situaciones de vulnerabilidad social.",
                tipo: "Reales decretos",
                autor: "Gobierno de España"
            },
            {
                objeto: "Proposición de Ley Orgánica para abordar la recuperación urgente por parte de las personas trabajadoras de los derechos de conciliación eliminados por la Ley Orgánica 2/2024, de 1 de agosto, de representación paritaria y presencia equilibrada de mujeres y hombres.",
                tipo: "Proposición de ley de Grupos Parlamentarios del Congreso",
                autor: "Grupo Parlamentario Socialista"
            },
            {
                objeto: "Ley por la que se modifica el Código Penal para tipificar como delito la violencia vicaria y mejorar la protección de las víctimas de violencia de género.",
                tipo: "Proyecto de Ley",
                autor: "Gobierno de España"
            }
        ];

        console.log('📝 Processing sample legal texts with enhanced NLP...\n');

        for (let i = 0; i < sampleTexts.length; i++) {
            const sample = sampleTexts[i];
            console.log(`🔍 Sample ${i + 1}:`);
            console.log(`   Original: ${sample.objeto.substring(0, 100)}...`);
            console.log(`   Type: ${sample.tipo}`);
            console.log(`   Author: ${sample.autor}`);
            
            const processed = nlpService.processLegalTitle(sample.objeto, sample.tipo, sample.autor);
            
            console.log(`   ✅ Enhanced Title: ${processed.accessible}`);
            console.log(`   📊 Subject Area: ${processed.metadata.subjectArea}`);
            console.log(`   🚨 Urgency: ${processed.metadata.urgency}`);
            console.log(`   📚 Complexity: ${processed.metadata.complexity}`);
            console.log(`   📖 Readability: ${processed.metadata.estimatedReadability}/100`);
            
            console.log(`   🎯 Action: ${processed.extracted.action}`);
            console.log(`   📋 Subject: ${processed.extracted.subject}`);
            
            if (processed.extracted.purpose) {
                console.log(`   🎯 Purpose: ${processed.extracted.purpose}`);
            }
            
            if (processed.extracted.specificChanges) {
                console.log(`   🔧 Specific Changes: ${processed.extracted.specificChanges}`);
            }
            
            if (processed.extracted.regulationScope) {
                console.log(`   📜 Regulation Scope: ${processed.extracted.regulationScope}`);
            }
            
            console.log('');
        }

        console.log('🎉 Enhanced NLP Test Completed Successfully!');
        console.log('\n📋 Improvements Made:');
        console.log('   ✅ Better understanding of law references');
        console.log('   ✅ Extraction of specific changes and modifications');
        console.log('   ✅ Identification of regulation scope');
        console.log('   ✅ More descriptive and meaningful titles');
        console.log('   ✅ Better context for citizens');

    } catch (error) {
        console.error('❌ Error testing enhanced NLP service:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEnhancedNLP();
}

module.exports = { testEnhancedNLP }; 