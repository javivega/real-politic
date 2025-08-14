#!/usr/bin/env node

const path = require('path');
const CongressXMLProcessor = require('./xmlProcessor');
const CongressSupabaseUploader = require('./supabaseUploader');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Main script to process XML files and upload to Supabase
 * 
 * Usage:
 *   node uploadToSupabase.js [ruta-descargas] [archivo-salida]
 * 
 * Environment variables needed:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_ANON_KEY - Your Supabase anonymous key
 */

async function main() {
  try {
    console.log('🏛️  Spanish Congress Data Processor & Supabase Uploader');
    console.log('========================================================\n');
    
    // Check environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
    }
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const downloadsPath = args[0] || path.join(__dirname, 'downloads');
    const outputPath = args[1] || path.join(__dirname, 'output', 'iniciativas-procesadas.json');
    
    console.log(`📁 Carpeta de descargas: ${downloadsPath}`);
    console.log(`💾 Archivo de salida: ${outputPath}\n`);
    
    // Step 1: Process XML files
    console.log('🚀 Step 1: Processing XML files...');
    const processor = new CongressXMLProcessor();
    const iniciativas = await processor.processDownloadsFolder(downloadsPath);
    
    console.log(`✅ XML processing completed. ${iniciativas.length} initiatives found.\n`);
    
    // Step 2: Export to JSON (with clean data structure)
    console.log('💾 Step 2: Exporting to JSON...');
    const outputDir = path.dirname(outputPath);
    await require('fs-extra').ensureDir(outputDir);
    
    await processor.exportToJSON(outputPath);
    console.log(`✅ JSON export completed: ${outputPath}\n`);
    
    // Step 3: Initialize Supabase uploader
    console.log('🔌 Step 3: Connecting to Supabase...');
    const uploader = new CongressSupabaseUploader(supabaseUrl, supabaseKey);
    
    // Test connection
    const connectionOk = await uploader.testConnection();
    if (!connectionOk) {
      throw new Error('❌ Failed to connect to Supabase database');
    }
    
    console.log('✅ Supabase connection successful\n');
    
    // Step 4: Upload to Supabase
    console.log('📤 Step 4: Uploading to Supabase...');
    await uploader.uploadFromJSON(outputPath);
    
    console.log('\n🎉 All done! Spanish Congress data has been successfully uploaded to Supabase.');
    console.log('\n📊 Database tables created:');
    console.log('   • congress_initiatives - Main initiatives data');
    console.log('   • congress_timeline_events - Timeline events for each initiative');
    console.log('   • congress_relationships - Relationships between initiatives');
    console.log('   • congress_keywords - Extracted keywords');
    console.log('   • congress_initiative_keywords - Initiative-keyword links');
    
    console.log('\n🔍 Useful database functions:');
    console.log('   • get_related_initiatives(expediente) - Get related initiatives');
    console.log('   • get_initiative_timeline(expediente) - Get initiative timeline');
    console.log('   • extract_initiative_keywords(texto) - Extract keywords from text');
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Verify data in Supabase dashboard');
    console.log('   2. Test the database functions');
    console.log('   3. Build your frontend to display the data');
    console.log('   4. Use the relationships for graph visualization');
    
  } catch (error) {
    console.error('\n❌ Error during processing/upload:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your Supabase credentials in .env file');
    console.error('   2. Ensure the database migration has been applied');
    console.error('   3. Verify the XML files are valid');
    console.error('   4. Check your internet connection');
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main }; 