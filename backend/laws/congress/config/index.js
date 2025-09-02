/**
 * Configuración del procesador de XML del Congreso de los Diputados
 */

module.exports = {
  // Configuración del procesador
  processor: {
    // Umbral de similitud para considerar iniciativas similares (0.0 - 1.0)
    similarityThreshold: 0.6,
    
    // Configuración del parser XML
    xmlParser: {
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      trim: true,
      ignoreAttrs: false,
      parseTagName: false
    }
  },

  // Configuración de archivos
  files: {
    // Patrones de archivos XML a procesar
    xmlPatterns: [
      'congress-full-*.xml',
      '*.xml'
    ],
    
    // Campos XML a extraer (en orden de prioridad)
    fields: {
      expediente: ['NUMEXPEDIENTE', 'NUMERO_LEY'],
      tipo: ['TIPO'],
      objeto: ['OBJETO', 'TITULO_LEY'],
      autor: ['AUTOR'],
      fechaPresentacion: ['FECHAPRESENTACION', 'FECHA_LEY'],
      fechaCalificacion: ['FECHACALIFICACION'],
      iniciativasRelacionadas: ['INICIATIVASRELACIONADAS'],
      iniciativasDeOrigen: ['INICIATIVASDEORIGEN'],
      tramitacion: ['TRAMITACIONSEGUIDA'],
      legislatura: ['LEGISLATURA'],
      supertipo: ['SUPERTIPO'],
      agrupacion: ['AGRUPACION'],
      tipotramitacion: ['TIPOTRAMITACION'],
      resultadoTramitacion: ['RESULTADOTRAMITACION'],
      situacionActual: ['SITUACIONACTUAL'],
      comisionCompetente: ['COMISIONCOMPETENTE'],
      plazos: ['PLAZOS'],
      ponentes: ['PONENTES'],
      enlacesBOCG: ['ENLACESBOCG'],
      enlacesDS: ['ENLACESDS']
    }
  },

  // Configuración de relaciones
  relationships: {
    // Tipos de relaciones directas
    directTypes: ['relacionada', 'origen'],
    
    // Configuración de similitud
    similarity: {
      // Algoritmo a usar: 'levenshtein', 'jaro', 'cosine'
      algorithm: 'levenshtein',
      
      // Normalización de texto
      normalize: {
        removeAccents: true,
        toLowerCase: true,
        trim: true
      }
    }
  },

  // Configuración del timeline
  timeline: {
    // Patrones de fecha a detectar
    datePatterns: {
      // Patrón completo: "desde X hasta Y"
      fullRange: /desde\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+hasta\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      
      // Patrón de inicio: "desde X"
      startOnly: /desde\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      
      // Patrón de fin: "hasta X"
      endOnly: /hasta\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
    },
    
    // Formato de fecha de salida
    outputDateFormat: 'DD/MM/YYYY',
    
    // Separadores de eventos
    eventSeparators: ['\n', '\r\n', ';']
  },

  // Configuración de exportación
  export: {
    // Formato por defecto
    defaultFormat: 'json',
    
    // Opciones de JSON
    json: {
      spaces: 2,
      encoding: 'utf8'
    },
    
    // Campos a incluir en exportación
    includeFields: [
      'numExpediente',
      'tipo',
      'objeto',
      'autor',
      'fechaPresentacion',
      'fechaCalificacion',
      'timeline',
      'relacionesDirectas',
      'similares',
      'legislatura',
      'situacionActual',
      'comisionCompetente'
    ]
  },

  // Configuración de logging
  logging: {
    // Nivel de log: 'error', 'warn', 'info', 'debug'
    level: 'info',
    
    // Mostrar progreso
    showProgress: true,
    
    // Mostrar estadísticas
    showStats: true,
    
    // Colores en consola
    colors: true
  },

  // Configuración de rendimiento
  performance: {
    // Procesar archivos en paralelo
    parallelProcessing: false,
    
    // Número máximo de archivos a procesar simultáneamente
    maxConcurrentFiles: 1,
    
    // Tamaño máximo de archivo en MB antes de mostrar advertencia
    maxFileSizeWarning: 100,
    
    // Timeout para procesamiento de archivo individual (ms)
    fileTimeout: 30000
  },

  // Configuración de validación
  validation: {
    // Validar formato XML
    validateXML: true,
    
    // Validar campos requeridos
    requiredFields: ['numExpediente'],
    
    // Validar fechas
    validateDates: true,
    
    // Validar URLs en enlaces
    validateURLs: false
  },

  // Configuración de filtros por defecto
  defaultFilters: {
    // Tipos de iniciativa a incluir (vacío = todos)
    tipos: [],
    
    // Autores a incluir (vacío = todos)
    autores: [],
    
    // Rango de fechas (vacío = sin límite)
    fechaDesde: null,
    fechaHasta: null,
    
    // Texto mínimo en objeto
    textoMinimo: ''
  },

  // Configuración de ordenación por defecto
  defaultSort: {
    campo: 'fechaPresentacion',
    direccion: 'desc'
  }
}; 