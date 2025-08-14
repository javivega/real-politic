const CongressXMLProcessor = require('./xmlProcessor');
const utils = require('./utils');
const path = require('path');

/**
 * Ejemplo de uso del procesador de XML del Congreso
 * Este archivo muestra diferentes formas de usar el procesador
 */

async function ejemploBasico() {
  console.log('📚 Ejemplo básico de uso del procesador');
  console.log('========================================\n');
  
  const processor = new CongressXMLProcessor();
  
  // Procesar archivos XML
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  console.log(`✅ Se procesaron ${iniciativas.length} iniciativas`);
  
  // Mostrar primera iniciativa como ejemplo
  if (iniciativas.length > 0) {
    const primera = iniciativas[0];
    console.log('\n📋 Primera iniciativa procesada:');
    console.log(JSON.stringify(primera, null, 2));
  }
}

async function ejemploConFiltros() {
  console.log('\n🔍 Ejemplo con filtros y búsquedas');
  console.log('==================================\n');
  
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  // Filtrar por tipo
  const proyectosLey = utils.filtrarIniciativas(iniciativas, { 
    tipo: 'Proyecto de ley' 
  });
  console.log(`📋 Proyectos de ley: ${proyectosLey.length}`);
  
  // Filtrar por autor
  const gobierno = utils.filtrarIniciativas(iniciativas, { 
    autor: 'Gobierno' 
  });
  console.log(`🏛️ Iniciativas del Gobierno: ${gobierno.length}`);
  
  // Filtrar por texto
  const salud = utils.filtrarIniciativas(iniciativas, { 
    texto: 'salud' 
  });
  console.log(`🏥 Iniciativas relacionadas con salud: ${salud.length}`);
  
  // Ordenar por fecha
  const ordenadas = utils.ordenarIniciativas(iniciativas, 'fechaPresentacion', 'desc');
  console.log(`📅 Iniciativas ordenadas por fecha (más recientes primero)`);
}

async function ejemploRelaciones() {
  console.log('\n🔗 Ejemplo de análisis de relaciones');
  console.log('====================================\n');
  
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  // Encontrar iniciativas con más relaciones
  const conMasRelaciones = iniciativas
    .filter(i => i.relacionesDirectas.length > 0)
    .sort((a, b) => b.relacionesDirectas.length - a.relacionesDirectas.length)
    .slice(0, 5);
  
  console.log('🔗 Top 5 iniciativas con más relaciones directas:');
  conMasRelaciones.forEach((ini, index) => {
    console.log(`${index + 1}. ${ini.numExpediente} - ${ini.objeto.substring(0, 80)}...`);
    console.log(`   Relaciones: ${ini.relacionesDirectas.length}`);
  });
  
  // Encontrar iniciativas más similares
  const conMasSimilares = iniciativas
    .filter(i => i.similares.length > 0)
    .sort((a, b) => b.similares.length - a.similares.length)
    .slice(0, 5);
  
  console.log('\n🔍 Top 5 iniciativas con más iniciativas similares:');
  conMasSimilares.forEach((ini, index) => {
    console.log(`${index + 1}. ${ini.numExpediente} - ${ini.objeto.substring(0, 80)}...`);
    console.log(`   Similares: ${ini.similares.length}`);
  });
}

async function ejemploTimeline() {
  console.log('\n⏰ Ejemplo de análisis de timeline');
  console.log('==================================\n');
  
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  // Encontrar iniciativas con timeline más largo
  const conTimelineLargo = iniciativas
    .filter(i => i.timeline.length > 0)
    .sort((a, b) => b.timeline.length - a.timeline.length)
    .slice(0, 5);
  
  console.log('⏰ Top 5 iniciativas con timeline más largo:');
  conTimelineLargo.forEach((ini, index) => {
    console.log(`${index + 1}. ${ini.numExpediente}`);
    console.log(`   Eventos: ${ini.timeline.length}`);
    console.log(`   Primer evento: ${ini.timeline[0]?.evento || 'N/A'}`);
    console.log(`   Último evento: ${ini.timeline[ini.timeline.length - 1]?.evento || 'N/A'}`);
    console.log('');
  });
}

async function ejemploExportacion() {
  console.log('\n💾 Ejemplo de exportación de datos');
  console.log('==================================\n');
  
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  // Exportar todas las iniciativas
  await processor.exportToJSON('./output/todas-iniciativas.json');
  
  // Exportar solo proyectos de ley
  const proyectosLey = utils.filtrarIniciativas(iniciativas, { 
    tipo: 'Proyecto de ley' 
  });
  await utils.exportarDatos(proyectosLey, 'json', './output/proyectos-ley.json');
  
  // Exportar resúmenes
  const resumenes = iniciativas.map(ini => utils.generarResumen(ini));
  await utils.exportarDatos(resumenes, 'json', './output/resumenes.json');
  
  console.log('✅ Datos exportados en diferentes formatos');
}

async function ejemploEstadisticas() {
  console.log('\n📊 Ejemplo de estadísticas');
  console.log('==========================\n');
  
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  // Estadísticas básicas
  const stats = processor.getStats();
  console.log('📊 Estadísticas generales:');
  console.log(JSON.stringify(stats, null, 2));
  
  // Análisis por tipo
  const porTipo = {};
  iniciativas.forEach(ini => {
    porTipo[ini.tipo] = (porTipo[ini.tipo] || 0) + 1;
  });
  
  console.log('\n📋 Distribución por tipo:');
  Object.entries(porTipo)
    .sort(([,a], [,b]) => b - a)
    .forEach(([tipo, cantidad]) => {
      console.log(`   ${tipo}: ${cantidad}`);
    });
  
  // Análisis por autor
  const porAutor = {};
  iniciativas.forEach(ini => {
    porAutor[ini.autor] = (porAutor[ini.autor] || 0) + 1;
  });
  
  console.log('\n👥 Top 10 autores:');
  Object.entries(porAutor)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([autor, cantidad]) => {
      console.log(`   ${autor}: ${cantidad}`);
    });
}

// Función principal que ejecuta todos los ejemplos
async function ejecutarEjemplos() {
  try {
    console.log('🏛️ Ejemplos de uso del procesador de XML del Congreso');
    console.log('=====================================================\n');
    
    await ejemploBasico();
    await ejemploConFiltros();
    await ejemploRelaciones();
    await ejemploTimeline();
    await ejemploExportacion();
    await ejemploEstadisticas();
    
    console.log('\n✅ Todos los ejemplos ejecutados correctamente');
    
  } catch (error) {
    console.error('❌ Error ejecutando ejemplos:', error);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  ejecutarEjemplos();
}

module.exports = {
  ejecutarEjemplos,
  ejemploBasico,
  ejemploConFiltros,
  ejemploRelaciones,
  ejemploTimeline,
  ejemploExportacion,
  ejemploEstadisticas
}; 