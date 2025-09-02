const SupabaseService = require('./services/SupabaseService');

async function testEnumValues() {
    try {
        console.log('🧪 Testing Congress Initiative Type Enum Values...\n');

        const supabaseService = new SupabaseService();
        
        // Test connection
        const connected = await supabaseService.testConnection();
        if (!connected) {
            console.log('❌ Could not connect to Supabase');
            return;
        }

        // Test inserting initiatives with different enum values
        const testInitiatives = [
            {
                num_expediente: 'TEST-001',
                tipo: 'Leyes organicas',
                objeto: 'Test initiative for organic laws',
                autor: 'Test Author',
                fecha_presentacion: '2025-01-01'
            },
            {
                num_expediente: 'TEST-002',
                tipo: 'Proposición de ley de Grupos Parlamentarios del Congreso',
                objeto: 'Test initiative for parliamentary groups',
                autor: 'Test Author 2',
                fecha_presentacion: '2025-01-02'
            },
            {
                num_expediente: 'TEST-003',
                tipo: 'Reales decretos',
                objeto: 'Test initiative for royal decrees',
                autor: 'Test Author 3',
                fecha_presentacion: '2025-01-03'
            }
        ];

        console.log('📝 Testing enum values with sample initiatives...');
        
        for (const initiative of testInitiatives) {
            try {
                const { error } = await supabaseService.supabase
                    .from('congress_initiatives')
                    .insert(initiative);
                
                if (error) {
                    console.log(`❌ Error with '${initiative.tipo}': ${error.message}`);
                } else {
                    console.log(`✅ Successfully inserted '${initiative.tipo}'`);
                }
            } catch (err) {
                console.log(`❌ Exception with '${initiative.tipo}': ${err.message}`);
            }
        }

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        for (const initiative of testInitiatives) {
            try {
                await supabaseService.supabase
                    .from('congress_initiatives')
                    .delete()
                    .eq('num_expediente', initiative.num_expediente);
                console.log(`✅ Cleaned up ${initiative.num_expediente}`);
            } catch (err) {
                console.log(`⚠️  Warning: Could not clean up ${initiative.num_expediente}: ${err.message}`);
            }
        }

        console.log('\n🎉 Enum value test completed!');
        console.log('\n📋 Next Steps:');
        console.log('  1. If all tests passed, run the full pipeline: node index.js');
        console.log('  2. If any tests failed, check the enum migration');

    } catch (error) {
        console.error('❌ Error in enum test:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEnumValues();
}

module.exports = { testEnumValues }; 