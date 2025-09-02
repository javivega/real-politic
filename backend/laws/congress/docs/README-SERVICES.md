# 🏛️ Procesador XML del Congreso - Nueva Arquitectura de Servicios

## 🚀 Resumen de Cambios

La carpeta `@/congress` ha sido **reorganizada completamente** siguiendo una **arquitectura de servicios** moderna y mantenible. Esto reemplaza la implementación monolítica anterior con un sistema modular y extensible.

## 🏗️ Nueva Estructura de Directorios

```
@/congress/
├── services/                    # 🎯 Lógica de negocio
│   ├── CongressProcessingService.js  # Servicio principal coordinador
│   ├── XmlProcessingService.js       # Procesamiento de XML
│   ├── RelationshipService.js        # Análisis de relaciones
│   └── ExportService.js             # Exportación de datos
├── models/                     # 📊 Modelos de datos
│   └── Initiative.js           # Modelo de iniciativa parlamentaria
├── config/                     # ⚙️ Configuración
│   └── index.js               # Configuración centralizada
├── scripts/                    # 📜 Scripts de ejecución
│   ├── index.js               # Script principal (antiguo)
│   ├── example.js             # Ejemplos (antiguo)
│   └── update-congress.js     # Actualización (antiguo)
├── docs/                       # 📚 Documentación
│   ├── README.md              # Documentación principal
│   └── SUPABASE_INTEGRATION.md # Integración con Supabase
└── example-services.js         # 🧪 Ejemplos de la nueva arquitectura
```

## 🎯 Servicios Principales

### 1. **CongressProcessingService** (Coordinador Principal)
- **Responsabilidad**: Coordina todos los demás servicios
- **Funcionalidades**:
  - Procesamiento completo de datos del Congreso
  - Gestión de estadísticas y métricas
  - Filtrado y búsqueda de iniciativas
  - Cambio de configuración en tiempo de ejecución

### 2. **XmlProcessingService** (Procesamiento XML)
- **Responsabilidad**: Lectura, parsing y extracción de iniciativas
- **Funcionalidades**:
  - Procesamiento de archivos XML del Congreso
  - Extracción de iniciativas parlamentarias
  - Generación de timeline desde tramitación
  - Validación y limpieza de datos

### 3. **RelationshipService** (Análisis de Relaciones)
- **Responsabilidad**: Análisis de relaciones directas e indirectas
- **Funcionalidades**:
  - Generación de relaciones directas entre iniciativas
  - Cálculo de similitud por texto (Jaro-Winkler + Levenshtein)
  - Cache de similitud para optimización
  - Generación de grafos de relaciones

### 4. **ExportService** (Exportación de Datos)
- **Responsabilidad**: Exportación en múltiples formatos
- **Funcionalidades**:
  - Exportación JSON (completo, básico, resumen)
  - Datos para visualización en grafo
  - Timeline consolidado
  - Estadísticas y métricas
  - Exportación CSV para análisis

## 📊 Modelo de Datos

### **Initiative** (Modelo Principal)
```javascript
class Initiative {
    // Campos básicos
    numExpediente, tipo, objeto, autor
    fechaPresentacion, fechaCalificacion
    
    // Campos de relaciones
    iniciativasRelacionadas, iniciativasDeOrigen
    relacionesDirectas, similares
    
    // Timeline y metadatos
    timeline, tramitacion, legislatura
    situacionActual, comisionCompetente
    
    // Métodos de utilidad
    isValid(), hasValidDates(), getSummary()
    getBasicData(), getFullData(), getGraphNode()
    filterInitiatives(), update(), addTimelineEvent()
}
```

## 🔧 Uso de la Nueva Arquitectura

### **Uso Básico**
```javascript
const CongressProcessingService = require('./services/CongressProcessingService');

const congressService = new CongressProcessingService({
    similarityThreshold: 0.7,
    maxFileSize: 100,
    outputDirectory: './output'
});

// Procesar archivos XML
const initiatives = await congressService.processCongressData('./downloads');

// Exportar todos los formatos
const results = await congressService.exportAllData('./output');
```

### **Análisis de Relaciones**
```javascript
// Obtener iniciativas con más relaciones
const topRelaciones = congressService.getInitiativesWithMostRelations(10);

// Obtener iniciativas con mayor similitud
const topSimilares = congressService.getInitiativesWithHighestSimilarity(5);

// Buscar iniciativas similares
const similares = congressService.findSimilarInitiatives('121/000001', 0.6);
```

### **Filtrado Avanzado**
```javascript
// Filtrar por múltiples criterios
const filtradas = congressService.filterInitiatives({
    tipo: 'proyecto',
    autor: 'gobierno',
    similitudMinima: 0.7
});
```

### **Exportación Selectiva**
```javascript
// Exportar solo iniciativas filtradas
const proyectosLey = congressService.filterInitiatives({ tipo: 'proyecto' });

await congressService.exportService.exportBasicData(
    proyectosLey, 
    'proyectos_ley.json'
);
```

## 🚀 Script Principal Actualizado

### **Nuevas Opciones de Línea de Comandos**
```bash
# Uso básico
node index.js

# Con opciones personalizadas
node index.js ./downloads ./output --similarity 0.7 --stats

# Solo exportación (sin reprocesar)
node index.js --export-only

# Ayuda completa
node index.js --help
```

### **Opciones Disponibles**
- `--similarity <valor>`: Umbral de similitud (0.0-1.0)
- `--max-file-size <MB>`: Tamaño máximo de archivo XML
- `--max-concurrent <num>`: Archivos procesados en paralelo
- `--stats`: Muestra estadísticas detalladas
- `--export-only`: Solo exporta datos existentes
- `--help`: Muestra ayuda completa

## 📈 Beneficios de la Nueva Arquitectura

### ✅ **Ventajas Técnicas**
- **Separación de responsabilidades**: Cada servicio tiene una función específica
- **Código más mantenible**: Fácil de entender y modificar
- **Reutilización**: Servicios pueden usarse independientemente
- **Testing**: Cada servicio puede probarse por separado
- **Extensibilidad**: Fácil agregar nuevos servicios o funcionalidades

### ✅ **Ventajas de Desarrollo**
- **Arquitectura moderna**: Sigue patrones de diseño actuales
- **Configuración flexible**: Cambios en tiempo de ejecución
- **Mejor manejo de errores**: Errores específicos por servicio
- **Logging mejorado**: Información detallada del procesamiento
- **Documentación integrada**: Código autodocumentado

### ✅ **Ventajas de Uso**
- **API más clara**: Métodos bien definidos y documentados
- **Flexibilidad**: Diferentes niveles de uso (básico a avanzado)
- **Performance**: Cache y optimizaciones por servicio
- **Debugging**: Fácil identificar dónde ocurren problemas

## 🔄 Migración desde la Arquitectura Anterior

### **Cambios Principales**
1. **Antes**: Una clase monolítica `CongressXMLProcessor`
2. **Ahora**: Múltiples servicios especializados coordinados

### **Compatibilidad**
- ✅ **Mantiene** todas las funcionalidades existentes
- ✅ **Mejora** el rendimiento y mantenibilidad
- ✅ **Añade** nuevas capacidades de filtrado y análisis
- ✅ **Preserva** la compatibilidad con scripts existentes

### **Scripts Actualizados**
- `index.js` → `scripts/index.js` (mantiene funcionalidad)
- `example.js` → `scripts/example.js` (mantiene funcionalidad)
- Nuevo `index.js` principal con arquitectura de servicios
- Nuevo `example-services.js` con ejemplos de la nueva arquitectura

## 🧪 Ejemplos y Pruebas

### **Ejecutar Ejemplos de la Nueva Arquitectura**
```bash
# Ejecutar todos los ejemplos
node example-services.js

# Ejecutar ejemplo específico
node -e "require('./example-services').ejemploBasico()"
```

### **Ejemplos Disponibles**
1. **Uso básico del servicio principal**
2. **Análisis de relaciones específicas**
3. **Filtrado y búsqueda de iniciativas**
4. **Exportación selectiva**
5. **Obtención de grafo completo**
6. **Cambio de configuración en tiempo de ejecución**

## 🔮 Extensiones Futuras

### **Servicios Planificados**
- **ValidationService**: Validación avanzada de datos
- **CacheService**: Cache distribuido para grandes volúmenes
- **NotificationService**: Notificaciones de procesamiento
- **AnalyticsService**: Análisis estadístico avanzado
- **IntegrationService**: Integración con sistemas externos

### **Mejoras Técnicas**
- **API REST**: Servicio web para procesamiento remoto
- **WebSockets**: Actualizaciones en tiempo real
- **Queue System**: Procesamiento asíncrono de archivos grandes
- **Plugin System**: Sistema de extensiones para funcionalidades personalizadas

## 📚 Documentación Adicional

- **README.md**: Documentación principal del proyecto
- **SUPABASE_INTEGRATION.md**: Integración con base de datos
- **example-services.js**: Ejemplos prácticos de uso
- **Código fuente**: Comentarios detallados en cada servicio

## 🎯 Conclusión

La nueva arquitectura de servicios transforma el procesador XML del Congreso en un sistema **moderno, mantenible y extensible**, manteniendo toda la funcionalidad existente mientras añade nuevas capacidades y mejor rendimiento.

---

**🏛️ Real Politic - Nueva Arquitectura de Servicios** 🚀 