#!/usr/bin/env node

/**
 * Script para inspeccionar el esquema actual de Supabase
 * y adaptar la integración a la estructura existente
 */

const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('./config/supabase');

async function inspectSupabaseSchema() {
    console.log('🔍 INSPECCIONANDO ESQUEMA DE SUPABASE');
    console.log('=====================================');
    
    try {
        // Crear cliente de Supabase
        const supabase = createClient(supabaseConfig.supabase.url, supabaseConfig.supabase.anonKey);
        
        console.log('🔌 Conectando a Supabase...');
        
        // 1. Verificar qué tablas existen
        console.log('\n📋 Verificando tablas existentes...');
        
        // Intentar acceder a diferentes nombres de tablas posibles
        const possibleTableNames = [
            'congress_initiatives',
            'congress_initiatives_v2',
            'initiatives',
            'congress_data',
            'parliamentary_initiatives',
            'laws',
            'congress'
        ];
        
        const existingTables = [];
        
        for (const tableName of possibleTableNames) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(1);
                
                if (!error) {
                    existingTables.push(tableName);
                    console.log(`   ✅ Tabla encontrada: ${tableName}`);
                }
            } catch (e) {
                // Table doesn't exist or no access
            }
        }
        
        if (existingTables.length === 0) {
            console.log('   ❌ No se encontraron tablas relacionadas con el Congreso');
            console.log('   💡 Crearemos las tablas necesarias');
            return;
        }
        
        // 2. Inspeccionar la estructura de la primera tabla encontrada
        const mainTable = existingTables[0];
        console.log(`\n🔍 Inspeccionando estructura de: ${mainTable}`);
        
        try {
            // Obtener una muestra de datos para entender la estructura
            const { data: sampleData, error } = await supabase
                .from(mainTable)
                .select('*')
                .limit(5);
            
            if (error) {
                console.log(`   ❌ Error accediendo a ${mainTable}:`, error.message);
                return;
            }
            
            if (sampleData && sampleData.length > 0) {
                console.log(`   📊 Muestra de datos (${sampleData.length} registros):`);
                
                // Mostrar la estructura del primer registro
                const firstRecord = sampleData[0];
                console.log('   📋 Campos disponibles:');
                
                Object.keys(firstRecord).forEach(field => {
                    const value = firstRecord[field];
                    const type = typeof value;
                    const sample = value !== null && value !== undefined ? 
                        (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : String(value)) : 
                        'null';
                    
                    console.log(`      • ${field}: ${type} = ${sample}`);
                });
                
                // 3. Verificar si hay tablas relacionadas
                console.log('\n🔗 Verificando tablas relacionadas...');
                
                const possibleRelatedTables = [
                    'congress_relationships',
                    'congress_timeline_events',
                    'congress_keywords',
                    'relationships',
                    'timeline_events',
                    'keywords',
                    'initiative_relationships',
                    'initiative_timeline'
                ];
                
                const relatedTables = [];
                
                for (const tableName of possibleRelatedTables) {
                    try {
                        const { data, error } = await supabase
                            .from(tableName)
                            .select('*')
                            .limit(1);
                        
                        if (!error) {
                            relatedTables.push(tableName);
                            console.log(`   ✅ Tabla relacionada encontrada: ${tableName}`);
                        }
                    } catch (e) {
                        // Table doesn't exist or no access
                    }
                }
                
                if (relatedTables.length === 0) {
                    console.log('   ℹ️  No se encontraron tablas relacionadas');
                }
                
                // 4. Generar recomendaciones
                console.log('\n💡 RECOMENDACIONES PARA LA INTEGRACIÓN:');
                console.log('========================================');
                
                console.log(`   • Tabla principal: ${mainTable}`);
                console.log(`   • Campos disponibles: ${Object.keys(firstRecord).length}`);
                console.log(`   • Tablas relacionadas: ${relatedTables.length}`);
                
                // Verificar campos críticos
                const criticalFields = ['num_expediente', 'tipo', 'objeto', 'autor'];
                const missingFields = criticalFields.filter(field => !(field in firstRecord));
                
                if (missingFields.length > 0) {
                    console.log(`   ⚠️  Campos críticos faltantes: ${missingFields.join(', ')}`);
                    console.log('   💡 Se recomienda crear estos campos o mapear los existentes');
                } else {
                    console.log('   ✅ Todos los campos críticos están presentes');
                }
                
                // 5. Generar script de adaptación
                console.log('\n📝 SCRIPT DE ADAPTACIÓN RECOMENDADO:');
                console.log('====================================');
                
                console.log('   // Adaptar la integración a tu esquema existente');
                console.log(`   const tableMapping = {`);
                console.log(`     initiatives: '${mainTable}',`);
                console.log(`     relationships: '${relatedTables.find(t => t.includes('relationship')) || 'congress_relationships'}',`);
                console.log(`     timelineEvents: '${relatedTables.find(t => t.includes('timeline')) || 'congress_timeline_events'}',`);
                console.log(`     keywords: '${relatedTables.find(t => t.includes('keyword')) || 'congress_keywords'}'`);
                console.log(`   };`);
                
                console.log('   // Mapear campos según tu esquema');
                console.log('   const fieldMapping = {');
                Object.keys(firstRecord).forEach(field => {
                    console.log(`     ${field}: '${field}',`);
                });
                console.log('   };');
                
            } else {
                console.log('   ℹ️  La tabla está vacía, no hay datos para inspeccionar');
                
                // Si la primera tabla está vacía, intentar con la segunda
                if (existingTables.length > 1) {
                    const secondTable = existingTables[1];
                    console.log(`\n🔍 Intentando con la segunda tabla: ${secondTable}`);
                    
                    try {
                        const { data: sampleData2, error: error2 } = await supabase
                            .from(secondTable)
                            .select('*')
                            .limit(5);
                        
                        if (!error2 && sampleData2 && sampleData2.length > 0) {
                            console.log(`   📊 Muestra de datos de ${secondTable} (${sampleData2.length} registros):`);
                            
                            const firstRecord2 = sampleData2[0];
                            console.log('   📋 Campos disponibles:');
                            
                            Object.keys(firstRecord2).forEach(field => {
                                const value = firstRecord2[field];
                                const type = typeof value;
                                const sample = value !== null && value !== undefined ? 
                                    (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : String(value)) : 
                                    'null';
                                
                                console.log(`      • ${field}: ${type} = ${sample}`);
                            });
                            
                            console.log(`\n💡 RECOMENDACIÓN: Usar ${secondTable} como tabla principal`);
                        } else {
                            console.log(`   ℹ️  ${secondTable} también está vacía`);
                        }
                    } catch (e) {
                        console.log(`   ❌ Error accediendo a ${secondTable}:`, e.message);
                    }
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Error inspeccionando ${mainTable}:`, error.message);
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

// Ejecutar inspección
inspectSupabaseSchema(); 