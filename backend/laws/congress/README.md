# Procesador de XML del Congreso de los Diputados

Este módulo procesa archivos XML descargados del Congreso de los Diputados de España para extraer iniciativas parlamentarias y generar relaciones entre ellas.

## 🎯 Características

- **Procesamiento de XML**: Lee y parsea múltiples archivos XML del Congreso
- **Extracción de datos**: Extrae campos como expediente, tipo, objeto, autor, fechas, etc.
- **Relaciones directas**: Identifica iniciativas relacionadas y de origen
- **Análisis de similitud**: Compara iniciativas por similitud de texto (umbral 60%)
- **Timeline de eventos**: Extrae cronología desde el campo de tramitación
- **Exportación JSON**: Genera archivos listos para usar en frontend

## 📋 Campos extraídos

Para cada iniciativa se extraen los siguientes campos:

- `numExpediente`: Número de expediente único
- `tipo`: Tipo de iniciativa parlamentaria
- `objeto`: Objeto o título de la iniciativa
- `autor`: Autor de la iniciativa
- `fechaPresentacion`: Fecha de presentación
- `fechaCalificacion`: Fecha de calificación
- `iniciativasRelacionadas`: Array de expedientes relacionados
- `iniciativasDeOrigen`: Array de expedientes de origen
- `tramitacion`: Texto de la tramitación seguida
- `timeline`: Array de eventos con fechas
- `relacionesDirectas`: Array de iniciativas relacionadas
- `similares`: Array de iniciativas similares

## 🚀 Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Verificar archivos XML**: Asegúrate de que tienes archivos XML en la carpeta `downloads/`

## 📖 Uso básico

### Procesamiento simple

```javascript
const CongressXMLProcessor = require('./xmlProcessor');

async function procesar() {
  const processor = new CongressXMLProcessor();
  const iniciativas = await processor.processDownloadsFolder('./downloads');
  
  console.log(`Se procesaron ${iniciativas.length} iniciativas`);
  
  // Exportar a JSON
  await processor.exportToJSON('./output/iniciativas.json');
}

procesar();
```

### Ejecutar desde línea de comandos

```bash
# Procesar con ruta por defecto
node index.js

# Especificar carpeta de descargas
node index.js ./downloads

# Especificar carpeta y archivo de salida
node index.js ./downloads ./output/mis-iniciativas.json
```

## 🔧 Configuración

### Umbral de similitud

Puedes ajustar el umbral de similitud para las relaciones:

```javascript
const processor = new CongressXMLProcessor();
processor.similarityThreshold = 0.7; // 70% en lugar del 60% por defecto
```

### Opciones del parser XML

```javascript
const processor = new CongressXMLProcessor();
processor.parser = new xml2js.Parser({
  explicitArray: false,
  mergeAttrs: true,
  normalize: true,
  // Otras opciones...
});
```

## 📊 Funciones de utilidad

### Filtrado y búsqueda

```javascript
const utils = require('./utils');

// Filtrar por tipo
const proyectosLey = utils.filtrarIniciativas(iniciativas, { 
  tipo: 'Proyecto de ley' 
});

// Filtrar por autor
const gobierno = utils.filtrarIniciativas(iniciativas, { 
  autor: 'Gobierno' 
});

// Filtrar por texto
const salud = utils.filtrarIniciativas(iniciativas, { 
  texto: 'salud' 
});

// Filtrar por fechas
const recientes = utils.filtrarIniciativas(iniciativas, { 
  fechaDesde: '2024-01-01',
  fechaHasta: '2024-12-31'
});
```

### Ordenación

```javascript
// Ordenar por fecha (más recientes primero)
const ordenadas = utils.ordenarIniciativas(iniciativas, 'fechaPresentacion', 'desc');

// Ordenar por tipo
const porTipo = utils.ordenarIniciativas(iniciativas, 'tipo', 'asc');
```

### Generación de resúmenes

```javascript
// Generar resumen para mostrar en listas
const resumen = utils.generarResumen(iniciativa);

// Extraer palabras clave
const palabrasClave = utils.extraerPalabrasClave(iniciativa.objeto);
```

## 📁 Estructura de archivos

```
congress/
├── downloads/                    # Archivos XML descargados
│   └── 2025-08-12/             # Carpeta por fecha
│       ├── congress-full-ProyectosDeLey__20250812050028.xml
│       ├── congress-full-ProposicionesDeLey__20250812050122.xml
│       ├── congress-full-PropuestasDeReforma__20250812050035.xml
│       └── congress-full-IniciativasLegislativasAprobadas__20250812050019.xml
├── output/                      # Archivos de salida generados
├── xmlProcessor.js              # Procesador principal
├── utils.js                     # Funciones de utilidad
├── index.js                     # Script principal
├── example.js                   # Ejemplos de uso
├── package.json                 # Dependencias
└── README.md                    # Este archivo
```

## 🎨 Formato de salida

### Estructura de una iniciativa

```json
{
  "numExpediente": "121/000001/0000",
  "tipo": "Proyecto de ley",
  "objeto": "Proyecto de Ley Orgánica de representación paritaria...",
  "autor": "Gobierno",
  "fechaPresentacion": "07/12/2023",
  "fechaCalificacion": "12/12/2023",
  "timeline": [
    {
      "evento": "Comisión de Igualdad",
      "fechaInicio": "12/12/2023",
      "fechaFin": "15/12/2023",
      "descripcion": "Publicación desde 12/12/2023 hasta 15/12/2023"
    }
  ],
  "relacionesDirectas": [
    {
      "expediente": "025/000031/0000",
      "tipo": "relacionada",
      "iniciativa": { /* datos de la iniciativa relacionada */ }
    }
  ],
  "similares": [
    {
      "expediente": "122/000002/0000",
      "similitud": 0.75,
      "iniciativa": { /* datos de la iniciativa similar */ }
    }
  ]
}
```

## 🔍 Análisis de similitud

El sistema utiliza la **distancia de Levenshtein** para calcular la similitud entre iniciativas:

1. **Normalización**: Se eliminan acentos y se convierte a minúsculas
2. **Cálculo**: Se calcula la distancia entre los textos del campo `objeto`
3. **Umbral**: Solo se consideran similares las que superan el 60% de similitud
4. **Ordenación**: Se ordenan por porcentaje de similitud descendente

## ⏰ Timeline de eventos

El sistema extrae automáticamente eventos del campo `TRAMITACIONSEGUIDA`:

- **Patrones detectados**: "desde X hasta Y" y "desde X"
- **Eventos identificados**: Fases de tramitación, comisiones, plenos, etc.
- **Fechas extraídas**: Se convierten al formato estándar DD/MM/YYYY

## 📈 Estadísticas disponibles

```javascript
const stats = processor.getStats();
console.log(stats);
// {
//   totalIniciativas: 150,
//   conRelacionesDirectas: 45,
//   conSimilares: 78,
//   porcentajeRelaciones: "30.00",
//   porcentajeSimilares: "52.00"
// }
```

## 🧪 Ejemplos y pruebas

### Ejecutar ejemplos

```bash
node example.js
```

### Ejemplos disponibles

- **Básico**: Procesamiento simple de archivos
- **Filtros**: Búsqueda y filtrado de iniciativas
- **Relaciones**: Análisis de conexiones entre iniciativas
- **Timeline**: Análisis de cronologías
- **Exportación**: Diferentes formatos de salida
- **Estadísticas**: Análisis cuantitativo de datos

## 🔧 Personalización

### Añadir nuevos campos

```javascript
// En processInitiative()
const normalizedInitiative = {
  // ... campos existentes ...
  miCampo: initiative.MICAMPO || '',
  // ... resto de campos ...
};
```

### Modificar algoritmo de similitud

```javascript
// En calculateSimilarity()
calculateSimilarity(text1, text2) {
  // Implementar tu propio algoritmo aquí
  // Por ejemplo, usar TF-IDF, cosine similarity, etc.
}
```

### Añadir nuevos tipos de relaciones

```javascript
// En generateRelationships()
// Añadir lógica para nuevos tipos de relaciones
```

## 🚨 Solución de problemas

### Error: "Cannot find module 'xml2js'"

```bash
npm install
```

### Error: "La carpeta de descargas no existe"

Verifica que la ruta `./downloads` existe y contiene archivos XML.

### Error: "Not valid XML format"

Los archivos XML pueden estar corruptos. Verifica que se descargaron correctamente.

### Rendimiento lento

Para archivos muy grandes:
- Ajusta el umbral de similitud
- Procesa archivos por separado
- Usa workers para paralelizar el procesamiento

## 📚 Integración con frontend

### Para grafos de relaciones

```javascript
// Usar campos: relacionesDirectas, similares
const nodes = iniciativas.map(ini => ({
  id: ini.numExpediente,
  label: ini.objeto.substring(0, 50),
  tipo: ini.tipo
}));

const edges = [];
iniciativas.forEach(ini => {
  ini.relacionesDirectas.forEach(rel => {
    edges.push({
      source: ini.numExpediente,
      target: rel.expediente,
      type: rel.tipo
    });
  });
});
```

### Para líneas de tiempo

```javascript
// Usar campo: timeline
const eventos = iniciativas.flatMap(ini => 
  ini.timeline.map(evento => ({
    iniciativa: ini.numExpediente,
    evento: evento.evento,
    fechaInicio: evento.fechaInicio,
    fechaFin: evento.fechaFin
  }))
);
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 📞 Soporte

Para preguntas o problemas:
- Abre un issue en GitHub
- Consulta la documentación
- Revisa los ejemplos en `example.js`

---

**Desarrollado para RealPolitic** - App de transparencia parlamentaria 