/**
 * Ejemplo de uso de la nueva arquitectura de servicios
 * 
 * Este archivo demuestra cómo usar los diferentes servicios
 * del procesador XML del Congreso de los Diputados
 */

const CongressProcessingService = require('./services/CongressProcessingService');
const path = require('path');

/**
 * Ejemplo 1: Uso básico del servicio principal
 */
async function ejemploBasico() {
    console.log('\n🔧 EJEMPLO 1: Uso Básico del Servicio Principal');
    console.log('==================================================');

    try {
        // Crear instancia del servicio con configuración personalizada
        const congressService = new CongressProcessingService({
            similarityThreshold: 0.7,  // 70% de similitud
            maxFileSize: 50,           // Máximo 50MB por archivo
            outputDirectory: './ejemplo-output'
        });

        console.log('✅ Servicio creado con configuración personalizada');
        console.log('📋 Configuración actual:', congressService.getConfig());

        // Procesar archivos XML (asumiendo que existe la carpeta downloads)
        const downloadsPath = path.join(__dirname, 'downloads');
        
        if (await require('fs-extra').pathExists(downloadsPath)) {
            console.log('\n🚀 Procesando archivos XML...');
            const initiatives = await congressService.processCongressData(downloadsPath);
            console.log(`✅ Procesadas ${initiatives.length} iniciativas`);
        } else {
            console.log('⚠️  Carpeta downloads no encontrada, usando datos de ejemplo');
            // Crear datos de ejemplo para demostración
            await crearDatosEjemplo(congressService);
        }

        // Mostrar estadísticas
        const stats = congressService.getProcessingStats();
        console.log('\n📊 Estadísticas del procesamiento:');
        console.log(JSON.stringify(stats, null, 2));

    } catch (error) {
        console.error('❌ Error en ejemplo básico:', error.message);
    }
}

/**
 * Ejemplo 2: Análisis de relaciones específicas
 */
async function ejemploAnalisisRelaciones() {
    console.log('\n🔗 EJEMPLO 2: Análisis de Relaciones');
    console.log('=======================================');

    try {
        const congressService = new CongressProcessingService();
        
        // Crear datos de ejemplo
        await crearDatosEjemplo(congressService);
        
        // Obtener iniciativas con más relaciones
        const topRelaciones = congressService.getInitiativesWithMostRelations(5);
        console.log('🏆 Top 5 iniciativas con más relaciones:');
        topRelaciones.forEach((init, index) => {
            console.log(`   ${index + 1}. ${init.expediente} - ${init.tipo}`);
            console.log(`      Relaciones: ${init.totalRelaciones}`);
        });

        // Obtener iniciativas con mayor similitud
        const topSimilares = congressService.getInitiativesWithHighestSimilarity(3);
        console.log('\n🎯 Top 3 iniciativas con mayor similitud:');
        topSimilares.forEach((init, index) => {
            console.log(`   ${index + 1}. ${init.expediente} - Similitud máxima: ${init.maxSimilarity}`);
        });

        // Buscar iniciativas similares a una específica
        if (congressService.initiatives.length > 0) {
            const primeraIniciativa = congressService.initiatives[0];
            const similares = congressService.findSimilarInitiatives(
                primeraIniciativa.numExpediente, 
                0.5  // Umbral de 50%
            );
            
            console.log(`\n🔍 Iniciativas similares a ${primeraIniciativa.numExpediente}:`);
            similares.forEach((sim, index) => {
                console.log(`   ${index + 1}. ${sim.expediente} - Similitud: ${sim.similitud}`);
            });
        }

    } catch (error) {
        console.error('❌ Error en análisis de relaciones:', error.message);
    }
}

/**
 * Ejemplo 3: Filtrado y búsqueda de iniciativas
 */
async function ejemploFiltrado() {
    console.log('\n🔍 EJEMPLO 3: Filtrado y Búsqueda');
    console.log('====================================');

    try {
        const congressService = new CongressProcessingService();
        
        // Crear datos de ejemplo
        await crearDatosEjemplo(congressService);
        
        // Filtrar por tipo
        const proyectosLey = congressService.filterInitiatives({ tipo: 'proyecto' });
        console.log(`📋 Proyectos de Ley: ${proyectosLey.length}`);
        
        // Filtrar por autor
        const gobiernoIniciativas = congressService.filterInitiatives({ autor: 'gobierno' });
        console.log(`🏛️  Iniciativas del Gobierno: ${gobiernoIniciativas.length}`);
        
        // Filtrar por similitud mínima
        const iniciativasSimilares = congressService.filterInitiatives({ similitudMinima: 0.6 });
        console.log(`🔍 Iniciativas con similitud ≥ 60%: ${iniciativasSimilares.length}`);
        
        // Combinar filtros
        const filtroCombinado = congressService.filterInitiatives({
            tipo: 'proyecto',
            autor: 'gobierno'
        });
        console.log(`🎯 Proyectos del Gobierno: ${filtroCombinado.length}`);

    } catch (error) {
        console.error('❌ Error en filtrado:', error.message);
    }
}

/**
 * Ejemplo 4: Exportación selectiva
 */
async function ejemploExportacionSelectiva() {
    console.log('\n📤 EJEMPLO 4: Exportación Selectiva');
    console.log('======================================');

    try {
        const congressService = new CongressProcessingService({
            outputDirectory: './exportacion-ejemplo'
        });
        
        // Crear datos de ejemplo
        await crearDatosEjemplo(congressService);
        
        // Exportar solo iniciativas de un tipo específico
        const proyectosLey = congressService.filterInitiatives({ tipo: 'proyecto' });
        
        if (proyectosLey.length > 0) {
            console.log(`📋 Exportando ${proyectosLey.length} proyectos de ley...`);
            
            // Cambiar directorio de salida temporalmente
            congressService.exportService.setOutputDirectory('./exportacion-proyectos');
            
            // Exportar solo datos básicos
            const basicPath = await congressService.exportService.exportBasicData(
                proyectosLey, 
                'proyectos_ley_basicos.json'
            );
            console.log(`✅ Datos básicos exportados a: ${basicPath}`);
            
            // Exportar datos para grafo
            const graphPath = await congressService.exportService.exportGraphData(
                proyectosLey,
                'grafo_proyectos.json'
            );
            console.log(`✅ Grafo exportado a: ${graphPath}`);
        }

    } catch (error) {
        console.error('❌ Error en exportación selectiva:', error.message);
    }
}

/**
 * Ejemplo 5: Obtener grafo completo
 */
async function ejemploGrafoCompleto() {
    console.log('\n📊 EJEMPLO 5: Grafo Completo de Relaciones');
    console.log('==============================================');

    try {
        const congressService = new CongressProcessingService();
        
        // Crear datos de ejemplo
        await crearDatosEjemplo(congressService);
        
        // Obtener grafo completo
        const grafo = congressService.getCompleteGraph();
        
        console.log('🌐 Grafo de relaciones generado:');
        console.log(`   • Nodos: ${grafo.metadata.totalNodes}`);
        console.log(`   • Aristas: ${grafo.metadata.totalEdges}`);
        console.log(`   • Generado: ${grafo.metadata.generatedAt}`);
        
        // Mostrar algunos nodos de ejemplo
        if (grafo.nodes.length > 0) {
            console.log('\n📋 Ejemplos de nodos:');
            grafo.nodes.slice(0, 3).forEach((nodo, index) => {
                console.log(`   ${index + 1}. ${nodo.label} (${nodo.grupo})`);
            });
        }
        
        // Mostrar algunas aristas de ejemplo
        if (grafo.edges.length > 0) {
            console.log('\n🔗 Ejemplos de aristas:');
            grafo.edges.slice(0, 3).forEach((arista, index) => {
                console.log(`   ${index + 1}. ${arista.source} → ${arista.target} (${arista.type})`);
            });
        }

    } catch (error) {
        console.error('❌ Error obteniendo grafo:', error.message);
    }
}

/**
 * Ejemplo 6: Cambio de configuración en tiempo de ejecución
 */
async function ejemploCambioConfiguracion() {
    console.log('\n⚙️  EJEMPLO 6: Cambio de Configuración');
    console.log('==========================================');

    try {
        const congressService = new CongressProcessingService();
        
        console.log('📋 Configuración inicial:');
        console.log(JSON.stringify(congressService.getConfig(), null, 2));
        
        // Cambiar configuración
        console.log('\n🔄 Cambiando configuración...');
        congressService.updateConfig({
            similarityThreshold: 0.8,
            maxFileSize: 200,
            outputDirectory: './nueva-salida'
        });
        
        console.log('\n📋 Nueva configuración:');
        console.log(JSON.stringify(congressService.getConfig(), null, 2));

    } catch (error) {
        console.error('❌ Error cambiando configuración:', error.message);
    }
}

/**
 * Crea datos de ejemplo para demostración
 */
async function crearDatosEjemplo(congressService) {
    // Simular iniciativas procesadas
    const iniciativasEjemplo = [
        {
            numExpediente: '121/000001',
            tipo: 'Proyecto de Ley',
            objeto: 'Ley de Protección del Medio Ambiente',
            autor: 'Gobierno de España',
            fechaPresentacion: '15/03/2023',
            timeline: [{ evento: 'Presentación', fechaInicio: '15/03/2023' }],
            relacionesDirectas: [],
            similares: []
        },
        {
            numExpediente: '121/000002',
            tipo: 'Proyecto de Ley',
            objeto: 'Ley de Protección del Medio Ambiente - Enmiendas',
            autor: 'Grupo Parlamentario Socialista',
            fechaPresentacion: '18/03/2023',
            timeline: [{ evento: 'Enmienda', fechaInicio: '18/03/2023' }],
            relacionesDirectas: [],
            similares: []
        },
        {
            numExpediente: '121/000003',
            tipo: 'Proposición de Ley',
            objeto: 'Ley de Transición Energética',
            autor: 'Grupo Parlamentario Popular',
            fechaPresentacion: '20/03/2023',
            timeline: [{ evento: 'Presentación', fechaInicio: '20/03/2023' }],
            relacionesDirectas: [],
            similares: []
        }
    ];
    
    // Crear instancias del modelo Initiative
    const Initiative = require('./models/Initiative');
    const iniciativasModelo = iniciativasEjemplo.map(data => new Initiative(data));
    
    // Simular que fueron procesadas
    congressService.initiatives = iniciativasModelo;
    
    // Simular estadísticas
    congressService.processingStats = {
        procesamiento: {
            totalIniciativas: 3,
            iniciativasValidas: 3,
            archivosProcesados: 3,
            errores: 0,
            porcentajeValidas: 100
        },
        relaciones: {
            totalDirectRelations: 0,
            totalSimilarities: 0,
            averageDirectRelations: 0,
            averageSimilarities: 0
        }
    };
    
    console.log('📝 Datos de ejemplo creados para demostración');
}

/**
 * Función principal que ejecuta todos los ejemplos
 */
async function ejecutarTodosLosEjemplos() {
    console.log('🚀 EJECUTANDO EJEMPLOS DE LA NUEVA ARQUITECTURA DE SERVICIOS');
    console.log('================================================================');
    
    try {
        await ejemploBasico();
        await ejemploAnalisisRelaciones();
        await ejemploFiltrado();
        await ejemploExportacionSelectiva();
        await ejemploGrafoCompleto();
        await ejemploCambioConfiguracion();
        
        console.log('\n✅ Todos los ejemplos ejecutados exitosamente');
        console.log('\n🎯 La nueva arquitectura de servicios ofrece:');
        console.log('   • Mejor separación de responsabilidades');
        console.log('   • Código más mantenible y extensible');
        console.log('   • Configuración flexible en tiempo de ejecución');
        console.log('   • Servicios reutilizables');
        console.log('   • Mejor manejo de errores y logging');
        
    } catch (error) {
        console.error('\n❌ Error ejecutando ejemplos:', error.message);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    ejecutarTodosLosEjemplos();
}

module.exports = {
    ejemploBasico,
    ejemploAnalisisRelaciones,
    ejemploFiltrado,
    ejemploExportacionSelectiva,
    ejemploGrafoCompleto,
    ejemploCambioConfiguracion,
    ejecutarTodosLosEjemplos
}; 