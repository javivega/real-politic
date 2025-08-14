#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...\n');
    
    // Check environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
    }
    
    console.log(`📡 Supabase URL: ${supabaseUrl}`);
    console.log(`🔑 Anon Key: ${supabaseKey.substring(0, 20)}...\n`);
    
    // Create client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connection
    console.log('🔄 Testing basic connection...');
    const { data, error } = await supabase
      .from('congress_initiatives')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('✅ Connection successful! Table "congress_initiatives" does not exist yet (this is expected)');
        console.log('💡 You need to run the database migration first');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Connection successful! Table exists and is accessible');
    }
    
    // Test if we can at least connect to the database
    console.log('\n🔄 Testing database access...');
    const { data: testData, error: testError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);
    
    if (testError) {
      console.log('⚠️  Could not access information_schema (this might be normal)');
    } else {
      console.log('✅ Database access successful!');
      console.log('📋 Available tables:', testData.map(t => t.table_name).join(', '));
    }
    
    console.log('\n🎉 Connection test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the database migration in Supabase SQL Editor');
    console.log('   2. Then run: node uploadToSupabase.js');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your .env file has correct credentials');
    console.error('   2. Verify your Supabase project is running');
    console.error('   3. Check your internet connection');
  }
}

// Run the test
testConnection(); 