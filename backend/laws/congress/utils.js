const fs = require('fs-extra');
const path = require('path');

/**
 * Utilidades para el procesamiento de datos del Congreso
 */

/**
 * Convierte una fecha del formato español (DD/MM/YYYY) a ISO (YYYY-MM-DD)
 * @param {string} fechaEspanol - Fecha en formato DD/MM/YYYY
 * @returns {string} Fecha en formato YYYY-MM-DD o null si es inválida
 */
function convertirFechaEspanol(fechaEspanol) {
  if (!fechaEspanol || typeof fechaEspanol !== 'string') {
    return null;
  }
  
  const match = fechaEspanol.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  
  const [, dia, mes, año] = match;
  return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Normaliza el texto eliminando acentos y caracteres especiales
 * @param {string} texto - Texto a normalizar
 * @returns {string} Texto normalizado
 */
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') {
    return '';
  }
  
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .toLowerCase()
    .trim();
}

/**
 * Extrae palabras clave del objeto de una iniciativa
 * @param {string} objeto - Texto del objeto de la iniciativa
 * @returns {Array} Array de palabras clave
 */
function extraerPalabrasClave(objeto) {
  if (!objeto || typeof objeto !== 'string') {
    return [];
  }
  
  // Palabras comunes a excluir
  const stopWords = [
    'de', 'la', 'el', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da',
    'su', 'por', 'son', 'con', 'para', 'al', 'del', 'las', 'los', 'una', 'como', 'pero',
    'sus', 'me', 'hasta', 'hay', 'donde', 'han', 'quien', 'están', 'estado', 'desde',
    'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese',
    'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo',
    'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada',
    'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'
  ];
  
  // Normalizar y dividir en palabras
  const palabras = normalizarTexto(objeto)
    .split(/\s+/)
    .filter(palabra => 
      palabra.length > 2 && 
      !stopWords.includes(palabra) &&
      !/^\d+$/.test(palabra) // Excluir números
    );
  
  // Contar frecuencia y devolver las más comunes
  const frecuencia = {};
  palabras.forEach(palabra => {
    frecuencia[palabra] = (frecuencia[palabra] || 0) + 1;
  });
  
  return Object.entries(frecuencia)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([palabra]) => palabra);
}

/**
 * Genera un resumen de una iniciativa para mostrar en listas
 * @param {Object} iniciativa - Objeto de iniciativa
 * @returns {Object} Resumen de la iniciativa
 */
function generarResumen(iniciativa) {
  return {
    numExpediente: iniciativa.numExpediente,
    tipo: iniciativa.tipo,
    objeto: iniciativa.objeto.length > 150 
      ? iniciativa.objeto.substring(0, 150) + '...' 
      : iniciativa.objeto,
    autor: iniciativa.autor,
    fechaPresentacion: iniciativa.fechaPresentacion,
    situacionActual: iniciativa.situacionActual,
    comisionCompetente: iniciativa.comisionCompetente,
    // Resumen de relaciones
    totalRelaciones: iniciativa.relacionesDirectas.length,
    totalSimilares: iniciativa.similares.length,
    // Resumen de timeline
    totalEventos: iniciativa.timeline.length,
    ultimoEvento: iniciativa.timeline.length > 0 
      ? iniciativa.timeline[iniciativa.timeline.length - 1] 
      : null
  };
}

/**
 * Filtra iniciativas por criterios específicos
 * @param {Array} iniciativas - Array de iniciativas
 * @param {Object} filtros - Objeto con criterios de filtrado
 * @returns {Array} Iniciativas filtradas
 */
function filtrarIniciativas(iniciativas, filtros = {}) {
  return iniciativas.filter(iniciativa => {
    // Filtro por tipo
    if (filtros.tipo && iniciativa.tipo !== filtros.tipo) {
      return false;
    }
    
    // Filtro por autor
    if (filtros.autor && !iniciativa.autor.includes(filtros.autor)) {
      return false;
    }
    
    // Filtro por comisión
    if (filtros.comision && !iniciativa.comisionCompetente.includes(filtros.comision)) {
      return false;
    }
    
    // Filtro por fecha de presentación
    if (filtros.fechaDesde) {
      const fechaIni = convertirFechaEspanol(iniciativa.fechaPresentacion);
      if (!fechaIni || fechaIni < filtros.fechaDesde) {
        return false;
      }
    }
    
    if (filtros.fechaHasta) {
      const fechaIni = convertirFechaEspanol(iniciativa.fechaPresentacion);
      if (!fechaIni || fechaIni > filtros.fechaHasta) {
        return false;
      }
    }
    
    // Filtro por texto en objeto
    if (filtros.texto) {
      const textoNormalizado = normalizarTexto(iniciativa.objeto);
      const busquedaNormalizada = normalizarTexto(filtros.texto);
      if (!textoNormalizado.includes(busquedaNormalizada)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Ordena iniciativas por criterios específicos
 * @param {Array} iniciativas - Array de iniciativas
 * @param {string} campo - Campo por el que ordenar
 * @param {string} direccion - 'asc' o 'desc'
 * @returns {Array} Iniciativas ordenadas
 */
function ordenarIniciativas(iniciativas, campo = 'fechaPresentacion', direccion = 'desc') {
  return [...iniciativas].sort((a, b) => {
    let valorA = a[campo];
    let valorB = b[campo];
    
    // Convertir fechas si es necesario
    if (campo.includes('fecha')) {
      valorA = convertirFechaEspanol(valorA) || '';
      valorB = convertirFechaEspanol(valorB) || '';
    }
    
    // Comparar valores
    if (valorA < valorB) return direccion === 'asc' ? -1 : 1;
    if (valorA > valorB) return direccion === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Exporta datos en diferentes formatos
 * @param {Array} datos - Datos a exportar
 * @param {string} formato - Formato de salida ('json', 'csv')
 * @param {string} rutaArchivo - Ruta del archivo de salida
 */
async function exportarDatos(datos, formato = 'json', rutaArchivo) {
  try {
    if (formato === 'json') {
      await fs.writeJson(rutaArchivo, datos, { spaces: 2 });
    } else if (formato === 'csv') {
      // Implementar exportación a CSV si es necesario
      throw new Error('Exportación a CSV no implementada aún');
    }
    
    console.log(`💾 Datos exportados en formato ${formato.toUpperCase()}: ${rutaArchivo}`);
  } catch (error) {
    console.error(`❌ Error exportando datos en formato ${formato}:`, error);
    throw error;
  }
}

module.exports = {
  convertirFechaEspanol,
  normalizarTexto,
  extraerPalabrasClave,
  generarResumen,
  filtrarIniciativas,
  ordenarIniciativas,
  exportarDatos
}; 