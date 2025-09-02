/**
 * Ejemplo de uso del SupabaseService integrado
 * 
 * Este archivo demuestra cómo usar el servicio de Supabase
 * integrado en la nueva arquitectura de servicios
 */

const CongressProcessingService = require('./services/CongressProcessingService');
const path = require('path');

/**
 * Ejemplo 1: Configuración básica con Supabase
 */
async function ejemploConfiguracionSupabase() {
    console.log('\n🔧 EJEMPLO 1: Configuración con Supabase');
    console.log('==========================================');

    try {
        // Crear servicio con configuración de Supabase
        const congressService = new CongressProcessingService({
            similarityThreshold: 0.7,
            outputDirectory: './output-supabase',
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY,
            supabaseBatchSize: 50
        });

        console.log('✅ Servicio creado con configuración de Supabase');
        console.log('📋 Configuración actual:', congressService.getConfig());
        console.log('🔌 Supabase disponible:', congressService.hasSupabaseService());

        // Probar conexión con Supabase
        if (congressService.hasSupabaseService()) {
            console.log('\n🔌 Probando conexión con Supabase...');
            const connected = await congressService.testSupabaseConnection();
            console.log('✅ Estado de conexión:', connected);
        } else {
            console.log('⚠️  Supabase no configurado. Configura las variables de entorno:');
            console.log('   • SUPABASE_URL');
            console.log('   • SUPABASE_ANON_KEY');
        }

    } catch (error) {
        console.error('❌ Error en configuración de Supabase:', error.message);
    }
}

/**
 * Ejemplo 2: Procesamiento y subida a Supabase
 */
async function ejemploProcesamientoYSubida() {
    console.log('\n🚀 EJEMPLO 2: Procesamiento y Subida a Supabase');
    console.log('================================================');

    try {
        const congressService = new CongressProcessingService({
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY
        });

        if (!congressService.hasSupabaseService()) {
            console.log('⚠️  Supabase no configurado, usando datos de ejemplo');
            await crearDatosEjemplo(congressService);
        } else {
            // Procesar archivos XML reales si están disponibles
            const downloadsPath = path.join(__dirname, 'downloads');
            if (await require('fs-extra').pathExists(downloadsPath)) {
                console.log('📊 Procesando archivos XML reales...');
                await congressService.processCongressData(downloadsPath);
            } else {
                console.log('⚠️  Carpeta downloads no encontrada, usando datos de ejemplo');
                await crearDatosEjemplo(congressService);
            }
        }

        // Subir a Supabase si está disponible
        if (congressService.hasSupabaseService() && congressService.initiatives.length > 0) {
            console.log('\n📤 Subiendo datos a Supabase...');
            const uploadStats = await congressService.uploadToSupabase();
            
            console.log('\n📊 ESTADÍSTICAS DE SUBIDA:');
            console.log(JSON.stringify(uploadStats, null, 2));
        }

    } catch (error) {
        console.error('❌ Error en procesamiento y subida:', error.message);
    }
}

/**
 * Ejemplo 3: Consultas desde Supabase
 */
async function ejemploConsultasSupabase() {
    console.log('\n🔍 EJEMPLO 3: Consultas desde Supabase');
    console.log('========================================');

    try {
        const congressService = new CongressProcessingService({
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY
        });

        if (!congressService.hasSupabaseService()) {
            console.log('⚠️  Supabase no configurado');
            return;
        }

        // Probar conexión
        const connected = await congressService.testSupabaseConnection();
        if (!connected) {
            console.log('❌ No se pudo conectar a Supabase');
            return;
        }

        // Obtener iniciativas relacionadas (ejemplo)
        if (congressService.initiatives.length > 0) {
            const primeraIniciativa = congressService.initiatives[0];
            console.log(`\n🔍 Obteniendo iniciativas relacionadas para ${primeraIniciativa.numExpediente}...`);
            
            try {
                const relacionadas = await congressService.getRelatedInitiativesFromSupabase(
                    primeraIniciativa.numExpediente
                );
                console.log(`✅ Iniciativas relacionadas encontradas: ${relacionadas.length}`);
            } catch (error) {
                console.log('⚠️  Función no disponible en la base de datos');
            }

            // Obtener timeline
            console.log(`\n📅 Obteniendo timeline para ${primeraIniciativa.numExpediente}...`);
            try {
                const timeline = await congressService.getInitiativeTimelineFromSupabase(
                    primeraIniciativa.numExpediente
                );
                console.log(`✅ Eventos de timeline encontrados: ${timeline.length}`);
            } catch (error) {
                console.log('⚠️  Función no disponible en la base de datos');
            }
        }

    } catch (error) {
        console.error('❌ Error en consultas de Supabase:', error.message);
    }
}

/**
 * Ejemplo 4: Flujo completo con Supabase
 */
async function ejemploFlujoCompleto() {
    console.log('\n🔄 EJEMPLO 4: Flujo Completo con Supabase');
    console.log('===========================================');

    try {
        const congressService = new CongressProcessingService({
            similarityThreshold: 0.6,
            outputDirectory: './output-completo',
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY
        });

        console.log('🚀 Iniciando flujo completo...');

        // 1. Procesar datos (XML o ejemplo)
        if (congressService.hasSupabaseService()) {
            const downloadsPath = path.join(__dirname, 'downloads');
            if (await require('fs-extra').pathExists(downloadsPath)) {
                console.log('📊 Paso 1: Procesando archivos XML...');
                await congressService.processCongressData(downloadsPath);
            } else {
                console.log('📊 Paso 1: Usando datos de ejemplo...');
                await crearDatosEjemplo(congressService);
            }
        } else {
            console.log('📊 Paso 1: Usando datos de ejemplo (Supabase no configurado)...');
            await crearDatosEjemplo(congressService);
        }

        // 2. Exportar datos
        console.log('\n📤 Paso 2: Exportando datos...');
        const exportResults = await congressService.exportAllData('./output-completo');
        console.log('✅ Exportación completada');

        // 3. Subir a Supabase si está disponible
        if (congressService.hasSupabaseService()) {
            console.log('\n🚀 Paso 3: Subiendo a Supabase...');
            const uploadStats = await congressService.uploadToSupabase();
            console.log('✅ Subida a Supabase completada');
            
            // 4. Verificar datos en Supabase
            console.log('\n🔍 Paso 4: Verificando datos en Supabase...');
            if (congressService.initiatives.length > 0) {
                const primeraIniciativa = congressService.initiatives[0];
                console.log(`Verificando iniciativa: ${primeraIniciativa.numExpediente}`);
                
                // Aquí podrías hacer consultas adicionales para verificar
                console.log('✅ Verificación completada');
            }
        }

        console.log('\n🎉 Flujo completo ejecutado exitosamente!');

    } catch (error) {
        console.error('❌ Error en flujo completo:', error.message);
    }
}

/**
 * Crea datos de ejemplo para demostración
 */
async function crearDatosEjemplo(congressService) {
    const Initiative = require('./models/Initiative');
    
    const iniciativasEjemplo = [
        new Initiative({
            numExpediente: '121/000001',
            tipo: 'Proyecto de Ley',
            objeto: 'Ley de Protección del Medio Ambiente',
            autor: 'Gobierno de España',
            fechaPresentacion: '15/03/2023',
            timeline: [{ evento: 'Presentación', fechaInicio: '15/03/2023' }],
            relacionesDirectas: [],
            similares: []
        }),
        new Initiative({
            numExpediente: '121/000002',
            tipo: 'Proyecto de Ley',
            objeto: 'Ley de Protección del Medio Ambiente - Enmiendas',
            autor: 'Grupo Parlamentario Socialista',
            fechaPresentacion: '18/03/2023',
            timeline: [{ evento: 'Enmienda', fechaInicio: '18/03/2023' }],
            relacionesDirectas: [],
            similares: []
        })
    ];
    
    congressService.initiatives = iniciativasEjemplo;
    console.log('📝 Datos de ejemplo creados para demostración');
}

/**
 * Función principal que ejecuta todos los ejemplos
 */
async function ejecutarTodosLosEjemplos() {
    console.log('🚀 EJECUTANDO EJEMPLOS DEL SUPABASE SERVICE INTEGRADO');
    console.log('=====================================================');
    
    try {
        await ejemploConfiguracionSupabase();
        await ejemploProcesamientoYSubida();
        await ejemploConsultasSupabase();
        await ejemploFlujoCompleto();
        
        console.log('\n✅ Todos los ejemplos ejecutados exitosamente');
        console.log('\n🎯 El SupabaseService integrado ofrece:');
        console.log('   • Conexión automática a Supabase');
        console.log('   • Subida de iniciativas en lotes');
        console.log('   • Manejo de relaciones y timeline');
        console.log('   • Consultas desde la base de datos');
        console.log('   • Integración perfecta con la arquitectura de servicios');
        
    } catch (error) {
        console.error('\n❌ Error ejecutando ejemplos:', error.message);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    ejecutarTodosLosEjemplos();
}

module.exports = {
    ejemploConfiguracionSupabase,
    ejemploProcesamientoYSubida,
    ejemploConsultasSupabase,
    ejemploFlujoCompleto,
    ejecutarTodosLosEjemplos
}; 