/**
 * Simple test to check if CongressProcessingService can be created
 */

const CongressProcessingService = require('./services/CongressProcessingService');

try {
    console.log('🧪 Testing CongressProcessingService creation...\n');
    
    const service = new CongressProcessingService();
    console.log('✅ Service created successfully');
    
    console.log('\n📋 Service Properties:');
    console.log(`   XML Service: ${!!service.xmlService}`);
    console.log(`   NLP Service: ${!!service.nlpService}`);
    console.log(`   Relationship Service: ${!!service.relationshipService}`);
    console.log(`   Export Service: ${!!service.exportService}`);
    console.log(`   Supabase Service: ${!!service.supabaseService}`);
    
    console.log('\n⚙️ Configuration:');
    console.log(`   Enable NLP: ${service.config.enableNLP}`);
    console.log(`   Similarity Threshold: ${service.config.similarityThreshold}`);
    console.log(`   Max File Size: ${service.config.maxFileSize}`);
    
    console.log('\n🎉 Service creation test passed!');
    
} catch (error) {
    console.error('❌ Error creating service:', error);
    console.error('Stack:', error.stack);
} 