#!/usr/bin/env node

const path = require('path');
const CongressXMLProcessor = require('./xmlProcessor');

/**
 * Script principal para procesar archivos XML del Congreso de los Diputados
 * 
 * Uso:
 *   node index.js [ruta-descargas] [archivo-salida]
 * 
 * Ejemplos:
 *   node index.js                                    # Usa ruta por defecto
 *   node index.js ./downloads                        # Especifica carpeta de descargas
 *   node index.js ./downloads ./output.json          # Especifica carpeta y archivo de salida
 */

async function main() {
  try {
    console.log('🏛️  Procesador de XML del Congreso de los Diputados');
    console.log('==================================================\n');
    
    // Obtener argumentos de línea de comandos
    const args = process.argv.slice(2);
    const downloadsPath = args[0] || path.join(__dirname, 'downloads');
    const outputPath = args[1] || path.join(__dirname, 'output', 'iniciativas-procesadas.json');
    
    console.log(`📁 Carpeta de descargas: ${downloadsPath}`);
    console.log(`💾 Archivo de salida: ${outputPath}\n`);
    
    // Verificar que existe la carpeta de descargas
    const fs = require('fs-extra');
    if (!await fs.pathExists(downloadsPath)) {
      throw new Error(`❌ La carpeta de descargas no existe: ${downloadsPath}`);
    }
    
    // Crear instancia del procesador
    const processor = new CongressXMLProcessor();
    
    // Procesar archivos XML
    console.log('🚀 Iniciando procesamiento...\n');
    const startTime = Date.now();
    
    const iniciativas = await processor.processDownloadsFolder(downloadsPath);
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️  Tiempo de procesamiento: ${processingTime} segundos`);
    
    // Mostrar estadísticas
    const stats = processor.getStats();
    console.log('\n📊 Estadísticas del procesamiento:');
    console.log(`   • Total de iniciativas: ${stats.totalIniciativas}`);
    console.log(`   • Con relaciones directas: ${stats.conRelacionesDirectas} (${stats.porcentajeRelaciones}%)`);
    console.log(`   • Con iniciativas similares: ${stats.conSimilares} (${stats.porcentajeSimilares}%)`);
    
    // Crear directorio de salida si no existe
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);
    
    // Exportar datos completos (con relaciones limpias)
    await processor.exportToJSON(outputPath);
    
    // Exportar datos básicos (sin relaciones)
    const basicOutputPath = path.join(outputDir, 'iniciativas-basicas.json');
    await processor.exportBasicData(basicOutputPath);
    
    // Exportar solo las relaciones (para grafos)
    const relationshipsOutputPath = path.join(outputDir, 'relaciones.json');
    await processor.exportRelationships(relationshipsOutputPath);
    
    // Mostrar ejemplo de salida
    if (iniciativas.length > 0) {
      console.log('\n📋 Ejemplo de iniciativa procesada:');
      const ejemplo = iniciativas[0];
      console.log(JSON.stringify({
        numExpediente: ejemplo.numExpediente,
        tipo: ejemplo.tipo,
        objeto: ejemplo.objeto.substring(0, 100) + '...',
        timeline: ejemplo.timeline.length + ' eventos',
        relacionesDirectas: ejemplo.relacionesDirectas.length + ' relaciones',
        similares: ejemplo.similares.length + ' iniciativas similares'
      }, null, 2));
    }
    
    console.log('\n✅ Procesamiento completado exitosamente!');
    console.log('\n📁 Archivos generados:');
    console.log(`   • Datos completos: ${outputPath}`);
    console.log(`   • Datos básicos: ${basicOutputPath}`);
    console.log(`   • Relaciones para grafos: ${relationshipsOutputPath}`);
    console.log('\n🎯 Uso recomendado:');
    console.log('   • Para análisis completo: usar archivo de datos completos');
    console.log('   • Para listas y búsquedas: usar archivo de datos básicos');
    console.log('   • Para grafos de relaciones: usar archivo de relaciones');
    console.log('   • Para timeline: usar campo "timeline" en cualquier archivo');
    
  } catch (error) {
    console.error('\n❌ Error durante el procesamiento:', error.message);
    console.error('\n💡 Solución de problemas:');
    console.error('   1. Verifica que la carpeta de descargas existe');
    console.error('   2. Asegúrate de que los archivos XML son válidos');
    console.error('   3. Ejecuta "npm install" para instalar dependencias');
    process.exit(1);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = { main }; 