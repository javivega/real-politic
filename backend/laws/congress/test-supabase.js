#!/usr/bin/env node

/**
 * Script de prueba para la integración con Supabase
 */

const CongressProcessingService = require('./services/CongressProcessingService');
const supabaseConfig = require('./config/supabase');

async function testSupabaseIntegration() {
    console.log('☁️  PRUEBA DE INTEGRACIÓN CON SUPABASE');
    console.log('=====================================');
    
    try {
        // Verificar configuración
        console.log('\n🔧 Verificando configuración de Supabase...');
        console.log(`   • URL: ${supabaseConfig.supabase.url}`);
        console.log(`   • Clave configurada: ${supabaseConfig.supabase.anonKey ? 'Sí' : 'No'}`);
        console.log(`   • Tamaño de lote: ${supabaseConfig.supabase.upload.batchSize}`);
        console.log(`   • Intentos de reintento: ${supabaseConfig.supabase.upload.retryAttempts}`);
        
        // Crear instancia del servicio
        const congressService = new CongressProcessingService({
            outputDirectory: './test-supabase-output'
        });
        
        if (!congressService.hasSupabaseService()) {
            console.log('\n⚠️  Supabase no está configurado correctamente.');
            console.log('   • Verifica que SUPABASE_URL y SUPABASE_ANON_KEY estén configurados');
            console.log('   • Crea un archivo .env con las credenciales correctas');
            console.log('   • O actualiza config/supabase.js con tus credenciales');
            return;
        }
        
        console.log('\n✅ Supabase configurado correctamente');
        
        // Probar conexión
        console.log('\n🔌 Probando conexión a Supabase...');
        const connected = await congressService.testSupabaseConnection();
        
        if (!connected) {
            console.log('❌ No se pudo conectar a Supabase');
            console.log('   • Verifica que las credenciales sean correctas');
            console.log('   • Verifica que el proyecto esté activo');
            console.log('   • Verifica que las tablas existan en Supabase');
            return;
        }
        
        console.log('✅ Conexión a Supabase exitosa');
        
        // Probar con datos de ejemplo
        console.log('\n📊 Probando subida de datos de ejemplo...');
        
        // Crear datos de ejemplo
        const exampleInitiatives = [
            {
                numExpediente: 'TEST/000001/0000',
                tipo: 'Proposición de Ley',
                objeto: 'Ley de prueba para integración con Supabase',
                autor: 'Sistema de Pruebas',
                fechaPresentacion: '2025-01-14',
                fechaCalificacion: '2025-01-14',
                legislatura: '15',
                supertipo: 'Legislativo',
                agrupacion: 'General',
                tipotramitacion: 'Ordinaria',
                resultadoTramitacion: 'En tramitación',
                situacionActual: 'Presentada',
                comisionCompetente: 'Comisión de Pruebas',
                plazos: 'Sin plazos específicos',
                ponentes: 'Pendiente de asignación',
                enlacesBOCG: [],
                enlacesDS: [],
                tramitacion: 'Texto de tramitación de prueba',
                timeline: [
                    {
                        evento: 'Presentación',
                        fechaInicio: '2025-01-14',
                        fechaFin: '2025-01-14',
                        descripcion: 'Iniciativa presentada para pruebas'
                    }
                ],
                relacionesDirectas: [],
                similares: []
            }
        ];
        
        // Simular iniciativas procesadas
        congressService.initiatives = exampleInitiatives;
        
        // Intentar subir a Supabase
        try {
            const uploadStats = await congressService.uploadToSupabase();
            
            console.log('\n📊 ESTADÍSTICAS DE SUBIDA:');
            console.log(`   • Iniciativas subidas: ${uploadStats.initiativesUploaded}`);
            console.log(`   • Iniciativas actualizadas: ${uploadStats.initiativesUpdated}`);
            console.log(`   • Relaciones subidas: ${uploadStats.relationshipsUploaded}`);
            console.log(`   • Eventos de timeline: ${uploadStats.timelineEventsUploaded}`);
            console.log(`   • Errores: ${uploadStats.errors}`);
            
            if (uploadStats.errors === 0) {
                console.log('\n🎉 ¡Integración con Supabase exitosa!');
            } else {
                console.log('\n⚠️  Subida completada con algunos errores');
            }
            
        } catch (uploadError) {
            console.error('\n❌ Error durante la subida:', uploadError.message);
            console.log('\n💡 Posibles soluciones:');
            console.log('   • Verifica que las tablas existan en Supabase');
            console.log('   • Verifica que las políticas RLS permitan inserción');
            console.log('   • Verifica que el esquema de la base de datos sea correcto');
        }
        
    } catch (error) {
        console.error('\n❌ Error en la prueba de integración:', error.message);
        process.exit(1);
    }
}

// Ejecutar prueba
testSupabaseIntegration(); 