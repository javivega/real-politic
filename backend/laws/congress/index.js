#!/usr/bin/env node

/**
 * Script principal del procesador XML del Congreso de los Diputados
 * 
 * Utiliza la nueva arquitectura de servicios para procesar archivos XML
 * y generar análisis de relaciones parlamentarias
 * 
 * Uso:
 *   node index.js [ruta-descargas] [directorio-salida] [opciones]
 * 
 * Ejemplos:
 *   node index.js                                    # Usa rutas por defecto
 *   node index.js ./downloads                        # Especifica carpeta de descargas
 *   node index.js ./downloads ./output               # Especifica carpeta y salida
 *   node index.js --stats                            # Solo muestra estadísticas
 *   node index.js --export-only                      # Solo exporta (sin reprocesar)
 *   node index.js --download-only                    # Solo descarga archivos XML
 *   node index.js --similarity 0.7                   # Umbral de similitud personalizado
 *   node index.js --upload-supabase                  # Procesa y sube a Supabase
 */

const path = require('path');
const fs = require('fs-extra');
const CongressProcessingService = require('./services/CongressProcessingService');
const LegislativeFlowService = require('./services/LegislativeFlowService');

/**
 * Función principal
 */
async function main() {
    try {
        console.log('🏛️  Starting Congress XML Processing Pipeline...\n');

        // Initialize services
        const congressService = new CongressProcessingService();
        const legislativeFlowService = new LegislativeFlowService();

        // Step 1: Download latest Congress files
        console.log('📥 Step 1: Downloading latest Congress files...');
        await congressService.downloadLatestCongressFiles();
        console.log('✅ Download completed\n');

        // Step 2: Process XML files and extract initiatives
        console.log('🔍 Step 2: Processing XML files and extracting initiatives...');
        await congressService.processCongressData('scripts/downloads/14082025');
        console.log('✅ XML processing completed\n');

        // Step 3: Create legislative timelines
        console.log('🔗 Step 3: Creating legislative timelines...');
        await legislativeFlowService.loadLegislativeData();
        const timelines = legislativeFlowService.createLegislativeTimelines();
        await legislativeFlowService.exportLegislativeTimelines();
        legislativeFlowService.generateSummary();
        console.log('✅ Legislative timelines created\n');

        // Step 4: Upload to Supabase
        console.log('☁️  Step 4: Uploading data to Supabase...');
        await congressService.uploadToSupabase();
        console.log('✅ Supabase upload completed\n');

        console.log('🎉 Congress processing pipeline completed successfully!');
        
    } catch (error) {
        console.error('❌ Error in Congress processing pipeline:', error);
        process.exit(1);
    }
}

/**
 * Parsea los argumentos de línea de comandos
 * @param {Array} args - Argumentos de línea de comandos
 * @returns {Object} Opciones parseadas
 */
function parseArguments(args) {
    const options = {
        downloadsPath: './scripts/downloads',  // Ruta por defecto a la carpeta de descargas
        outputDirectory: './output',           // Directorio de salida por defecto
        similarityThreshold: 0.6,              // Umbral de similitud por defecto
        maxFileSize: 100,                      // Tamaño máximo de archivo por defecto (MB)
        maxConcurrentFiles: 5,                 // Número máximo de archivos concurrentes
        showStats: false,
        exportOnly: false,
        uploadToSupabase: false,
        autoDownload: true, // Por defecto, descarga automática
        downloadOnly: false // Por defecto, no solo descarga
    };

    let i = 0;
    
    while (i < args.length) {
        const arg = args[i];
        
        if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        } else if (arg === '--stats' || arg === '-s') {
            options.showStats = true;
        } else if (arg === '--export-only' || arg === '-e') {
            options.exportOnly = true;
        } else if (arg === '--upload-supabase' || arg === '-u') {
            options.uploadToSupabase = true;
        } else if (arg === '--download-only' || arg === '-d') {
            options.downloadOnly = true;
            options.autoDownload = false; // Desactiva la descarga automática si se usa -d
        } else if (arg === '--similarity' || arg === '-sim') {
            const value = parseFloat(args[i + 1]);
            if (isNaN(value) || value < 0 || value > 1) {
                throw new Error('El umbral de similitud debe ser un número entre 0 y 1');
            }
            options.similarityThreshold = value;
            i++; // Saltar el siguiente argumento
        } else if (arg === '--max-file-size') {
            const value = parseInt(args[i + 1]);
            if (isNaN(value) || value <= 0) {
                throw new Error('El tamaño máximo de archivo debe ser un número positivo');
            }
            options.maxFileSize = value;
            i++;
        } else if (arg === '--max-concurrent') {
            const value = parseInt(args[i + 1]);
            if (isNaN(value) || value <= 0) {
                throw new Error('El número máximo de archivos concurrentes debe ser positivo');
            }
            options.maxConcurrentFiles = value;
            i++;
        } else if (arg.startsWith('-')) {
            throw new Error(`Opción desconocida: ${arg}`);
        } else if (i === 0) {
            // Primer argumento: carpeta de descargas
            options.downloadsPath = path.resolve(arg);
        } else if (i === 1) {
            // Segundo argumento: directorio de salida
            options.outputDirectory = path.resolve(arg);
        } else {
            throw new Error(`Argumento extra: ${arg}`);
        }
        
        i++;
    }

    return options;
}

/**
 * Muestra la ayuda del programa
 */
function showHelp() {
    console.log('🏛️  PROCESADOR XML DEL CONGRESO DE LOS DIPUTADOS');
    console.log('==================================================');
    console.log('');
    console.log('USO:');
    console.log('  node index.js [ruta-descargas] [directorio-salida] [opciones]');
    console.log('');
    console.log('ARGUMENTOS:');
    console.log('  ruta-descargas     Carpeta con archivos XML del Congreso (por defecto: ./downloads)');
    console.log('  directorio-salida  Directorio para archivos exportados (por defecto: ./output)');
    console.log('');
    console.log('OPCIONES:');
    console.log('  --help, -h                    Muestra esta ayuda');
    console.log('  --stats, -s                   Muestra estadísticas detalladas');
    console.log('  --export-only, -e             Solo exporta datos (sin reprocesar)');
    console.log('  --upload-supabase, -u         Sube datos procesados a Supabase');
    console.log('  --download-only, -d           Solo descarga archivos XML (desactiva descarga automática)');
    console.log('  --similarity <valor>, -sim    Umbral de similitud (0.0-1.0, por defecto: 0.6)');
    console.log('  --max-file-size <MB>          Tamaño máximo de archivo XML (por defecto: 100MB)');
    console.log('  --max-concurrent <num>        Archivos procesados en paralelo (por defecto: 5)');
    console.log('');
    console.log('EJEMPLOS:');
    console.log('  node index.js                                    # Usa rutas por defecto');
    console.log('  node index.js ./downloads                        # Especifica carpeta de descargas');
    console.log('  node index.js ./downloads ./output               # Especifica carpeta y salida');
    console.log('  node index.js --stats                            # Solo muestra estadísticas');
    console.log('  node index.js --similarity 0.7                   # Umbral de similitud 70%');
    console.log('  node index.js --export-only                      # Solo exporta (sin reprocesar)');
    console.log('  node index.js --upload-supabase                  # Procesa y sube a Supabase');
    console.log('  node index.js --download-only                    # Solo descarga archivos XML (desactiva descarga automática)');
    console.log('');
    console.log('ARQUITECTURA:');
    console.log('  Este script utiliza la nueva arquitectura de servicios:');
    console.log('  • XmlProcessingService: Procesamiento de archivos XML');
    console.log('  • RelationshipService: Análisis de relaciones y similitudes');
    console.log('  • ExportService: Exportación en múltiples formatos');
    console.log('  • SupabaseService: Integración con base de datos');
    console.log('  • CongressProcessingService: Coordinación de todos los servicios');
    console.log('');
    console.log('FORMATOS DE SALIDA:');
    console.log('  • iniciativas-completas.json: Datos completos con relaciones');
    console.log('  • iniciativas-basicas.json: Datos básicos sin relaciones');
    console.log('  • iniciativas-resumen.json: Resumen de iniciativas');
    console.log('  • grafo-relaciones.json: Datos para visualización en grafo');
    console.log('  • timeline-consolidado.json: Cronología unificada');
    console.log('  • estadisticas.json: Métricas y distribuciones');
    console.log('  • relaciones.json: Solo las relaciones entre iniciativas');
    console.log('');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { main, parseArguments, showHelp }; 