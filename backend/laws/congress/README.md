# Congress XML Processor

Procesador completo de archivos XML del Congreso de los Diputados con descarga automática, procesamiento y subida a Supabase.

## 🚀 Características

- **📥 Descarga Automática**: Descarga automática de archivos XML más recientes
- **🔍 Procesamiento Inteligente**: Extracción y análisis de iniciativas parlamentarias
- **🔗 Análisis de Relaciones**: Detección automática de relaciones entre iniciativas
- **📊 Exportación Múltiple**: Múltiples formatos de salida (JSON, CSV, etc.)
- **☁️ Integración Supabase**: Subida automática a base de datos
- **🔄 Pipeline Completo**: Flujo integrado desde descarga hasta base de datos

## 📋 Pipeline Completo

```
1. 📥 Descarga Automática → 2. 🔍 Procesamiento XML → 3. 📤 Exportación → 4. ☁️ Subida a Supabase
```

## 🔍 Pipeline de Evidencia para AI

```
1. 📰 Noticias → 2. 🐦 Redes Sociales → 3. 📋 Documentos Legales → 4. 🔗 Agregación → 5. 📱 Frontend
```

### Servicios de Evidencia

- **NewsEvidenceService**: Búsqueda de noticias en Google News
- **XEvidenceService**: Recopilación de posts de X.com (Twitter)
- **LegalEvidenceService**: Extracción de documentos BOCG/DS
- **Evidence Aggregator**: Consolidación en un solo archivo JSON

## 🛠️ Instalación

```bash
cd backend/laws/congress
npm install
```

## 🎯 Uso

### Pipeline Completo (Recomendado)

```bash
# Descarga, procesa y sube a Supabase
npm run full-pipeline

# O manualmente
node index.js --upload-supabase
```

### Solo Descarga

```bash
# Solo descarga archivos XML
npm run download-only

# O manualmente
node index.js --download-only
```

### Solo Descarga (Script Directo)

```bash
# Usar el script de descarga directamente
npm run download

# O manualmente
node scripts/update-congress.js
```

### Solo Procesamiento

```bash
# Procesa archivos existentes
npm run process

# O manualmente
node index.js
```

### Solo Exportación

```bash
# Solo exporta datos procesados
node index.js --export-only
```

### Generación de Evidencia para AI

```bash
# Generar evidencia completa (noticias, redes sociales, documentos legales)
npm run evidence:full

# Solo generar evidencia
npm run evidence:generate

# Solo copiar evidencia al frontend
npm run evidence:copy

# Generar evidencia y ejecutar pruebas
npm run evidence:test
```

### Prueba de Integración

```bash
# Prueba completa del pipeline
npm run test-integration
```

## ⚙️ Opciones de Línea de Comandos

| Opción | Descripción | Ejemplo |
|--------|-------------|---------|
| `--download-only` | Solo descarga archivos XML | `node index.js --download-only` |
| `--export-only` | Solo exporta datos procesados | `node index.js --export-only` |
| `--upload-supabase` | Sube datos a Supabase | `node index.js --upload-supabase` |
| `--similarity <valor>` | Umbral de similitud (0.0-1.0) | `node index.js --similarity 0.7` |
| `--max-file-size <MB>` | Tamaño máximo de archivo | `node index.js --max-file-size 50` |
| `--max-concurrent <num>` | Archivos concurrentes | `node index.js --max-concurrent 3` |

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env` en el directorio raíz:

```env
# Supabase (requerido para subida)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Opcional: Clave de servicio para operaciones de administrador
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Configuración de procesamiento
SIMILARITY_THRESHOLD=0.6
MAX_FILE_SIZE=100
MAX_CONCURRENT_FILES=5

# Configuración de Supabase
SUPABASE_BATCH_SIZE=100
SUPABASE_RETRY_ATTEMPTS=3
SUPABASE_RETRY_DELAY=1000
```

### Configuración de Supabase

#### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Anota la URL del proyecto y la clave anónima

#### 2. Configurar Base de Datos

Ejecuta el siguiente SQL en el editor SQL de Supabase:

```sql
-- Crear esquema para datos del Congreso
CREATE SCHEMA IF NOT EXISTS congress;

-- Tabla principal de iniciativas
CREATE TABLE IF NOT EXISTS congress_initiatives (
    id BIGSERIAL PRIMARY KEY,
    num_expediente VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(100),
    objeto TEXT,
    autor VARCHAR(200),
    fecha_presentacion DATE,
    fecha_calificacion DATE,
    legislatura VARCHAR(10),
    supertipo VARCHAR(50),
    agrupacion VARCHAR(100),
    tipo_tramitacion VARCHAR(50),
    resultado_tramitacion VARCHAR(100),
    situacion_actual VARCHAR(100),
    comision_competente VARCHAR(200),
    plazos TEXT,
    ponentes TEXT,
    enlaces_bocg JSONB,
    enlaces_ds JSONB,
    tramitacion_texto TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de relaciones entre iniciativas
CREATE TABLE IF NOT EXISTS congress_relationships (
    id BIGSERIAL PRIMARY KEY,
    iniciativa_origen_id BIGINT REFERENCES congress_initiatives(id) ON DELETE CASCADE,
    iniciativa_destino_id BIGINT REFERENCES congress_initiatives(id) ON DELETE CASCADE,
    tipo_relacion VARCHAR(50),
    score_similitud DECIMAL(5,4),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de eventos del timeline
CREATE TABLE IF NOT EXISTS congress_timeline_events (
    id BIGSERIAL PRIMARY KEY,
    iniciativa_id BIGINT REFERENCES congress_initiatives(id) ON DELETE CASCADE,
    evento VARCHAR(200),
    fecha_inicio DATE,
    fecha_fin DATE,
    descripcion TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de palabras clave
CREATE TABLE IF NOT EXISTS congress_keywords (
    id BIGSERIAL PRIMARY KEY,
    palabra VARCHAR(100) UNIQUE NOT NULL,
    frecuencia INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_expediente ON congress_initiatives(num_expediente);
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_tipo ON congress_initiatives(tipo);
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_autor ON congress_initiatives(autor);
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_fecha ON congress_initiatives(fecha_presentacion);

CREATE INDEX IF NOT EXISTS idx_congress_relationships_origen ON congress_relationships(iniciativa_origen_id);
CREATE INDEX IF NOT EXISTS idx_congress_relationships_destino ON congress_relationships(iniciativa_destino_id);
CREATE INDEX IF NOT EXISTS idx_congress_relationships_tipo ON congress_relationships(tipo_relacion);

CREATE INDEX IF NOT EXISTS idx_congress_timeline_iniciativa ON congress_timeline_events(iniciativa_id);
CREATE INDEX IF NOT EXISTS idx_congress_timeline_fecha ON congress_timeline_events(fecha_inicio);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar timestamps
CREATE TRIGGER update_congress_initiatives_updated_at 
    BEFORE UPDATE ON congress_initiatives 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_congress_keywords_updated_at 
    BEFORE UPDATE ON congress_keywords 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 3. Configurar Políticas RLS (Row Level Security)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE congress_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE congress_keywords ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON congress_initiatives
    FOR SELECT USING (true);

CREATE POLICY "Permitir lectura pública" ON congress_relationships
    FOR SELECT USING (true);

CREATE POLICY "Permitir lectura pública" ON congress_timeline_events
    FOR SELECT USING (true);

CREATE POLICY "Permitir lectura pública" ON congress_keywords
    FOR SELECT USING (true);

-- Política para permitir inserción/actualización desde la aplicación
CREATE POLICY "Permitir inserción desde app" ON congress_initiatives
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización desde app" ON congress_initiatives
    FOR UPDATE USING (true);

CREATE POLICY "Permitir inserción desde app" ON congress_relationships
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir inserción desde app" ON congress_timeline_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir inserción desde app" ON congress_keywords
    FOR INSERT WITH CHECK (true);
```

#### 4. Probar la Integración

```bash
# Probar solo la conexión a Supabase
npm run test-supabase

# Probar el pipeline completo con subida a Supabase
npm run full-pipeline
```

### Configuración por Defecto

- **Umbral de similitud**: 0.6 (60%)
- **Tamaño máximo de archivo**: 100 MB
- **Archivos concurrentes**: 5
- **Descarga automática**: Activada por defecto

## 📁 Estructura de Archivos

```
backend/laws/congress/
├── scripts/
│   ├── update-congress.js      # Script de descarga principal
│   ├── build-evidence-context.js  # Generador de evidencia para AI
│   ├── fetch-prevote-evidence.js  # Recopilador de evidencia X.com
│   └── downloads/              # Archivos XML descargados
│       └── ddmmyyyy/           # Formato de fecha (ej: 14082025)
├── services/
│   ├── CongressProcessingService.js  # Servicio principal
│   ├── XmlProcessingService.js       # Procesamiento XML
│   ├── RelationshipService.js        # Análisis de relaciones
│   ├── ExportService.js             # Exportación
│   ├── SupabaseService.js           # Integración Supabase
│   ├── NewsEvidenceService.js       # Servicio de noticias
│   ├── XEvidenceService.js          # Servicio de redes sociales
│   └── LegalEvidenceService.js      # Servicio de documentos legales
├── output/                     # Archivos exportados
├── index.js                    # Script principal
├── test-evidence-context.js    # Pruebas de evidencia
└── test-integration.js         # Script de prueba
```

## 🔍 Funcionamiento

### 1. Descarga Automática

- **URLs Conocidas**: Intenta URLs que funcionan manualmente
- **Descubrimiento Automático**: Busca nuevas URLs con timestamps actuales
- **Fallback Inteligente**: Si falla, usa métodos alternativos
- **Formato de Carpeta**: `ddmmyyyy` (ej: `14082025` para 14/08/2025)

### 2. Procesamiento XML

- **Extracción**: Parsea archivos XML del Congreso
- **Normalización**: Estructura datos en formato consistente
- **Validación**: Verifica integridad de datos
- **Análisis**: Extrae relaciones y similitudes

### 3. Exportación

- **JSON Completo**: Datos completos con relaciones
- **JSON Básico**: Datos esenciales sin relaciones
- **Gráfico**: Datos para visualización
- **Timeline**: Cronología de eventos
- **Estadísticas**: Métricas y distribuciones

### 4. Subida a Supabase

- **Iniciativas**: Tabla principal de iniciativas
- **Relaciones**: Conexiones entre iniciativas
- **Timeline**: Eventos cronológicos
- **Keywords**: Palabras clave extraídas

## 📊 Formato de Salida

### Archivos Generados

- `iniciativas-completas.json` - Datos completos con relaciones
- `iniciativas-basicas.json` - Datos básicos sin relaciones
- `grafo-relaciones.json` - Datos para visualización en grafo
- `timeline-consolidado.json` - Cronología unificada
- `estadisticas.json` - Métricas y distribuciones
- `relaciones.json` - Solo las relaciones entre iniciativas

## 🔍 Generación de Evidencia para AI

### Archivos de Evidencia

- `evidence-context.json` - Contexto completo para análisis AI
- `prevote-positions.json` - Posiciones pre-voto de partidos políticos

### Estructura de Evidencia

```json
{
  "initiative_id": "NUMEXPEDIENTE",
  "news": [
    {
      "url": "https://example.com/news",
      "title": "Título de la noticia",
      "snippet": "Fragmento de la noticia..."
    }
  ],
  "x": {
    "PSOE": [
      {
        "url": "https://x.com/PSOE/status/123",
        "source": "x.com",
        "type": "tweet"
      }
    ]
  },
  "legal": {
    "bocg": "https://www.congreso.es/bocg/...",
    "ds": "https://www.congreso.es/ds/..."
  }
}
```

### Workflow de Generación

1. **Descarga de XML**: `npm run download`
2. **Generación de Evidencia**: `npm run evidence:generate`
3. **Copia al Frontend**: `npm run evidence:copy`
4. **Verificación**: `npm run evidence:test`

### Servicios de Evidencia

#### NewsEvidenceService
- Búsqueda automática en Google News
- Extracción de títulos y fragmentos
- Límite configurable de noticias por iniciativa

#### XEvidenceService
- Búsqueda de posts de partidos políticos
- Recopilación vía Google Search (no requiere API)
- Identificación automática de partidos

#### LegalEvidenceService
- Extracción de URLs BOCG/DS del XML
- Búsqueda adicional de documentos oficiales
- Generación de fragmentos legales

## 🚨 Solución de Problemas

### Error de Descarga

```bash
# Verificar conectividad
curl https://www.congreso.es/webpublica/opendata/iniciativas

# Probar descarga manual
npm run download-only
```

### Error de Procesamiento

```bash
# Verificar archivos XML
ls -la scripts/downloads/*/

# Probar procesamiento solo
node index.js --export-only
```

### Error de Supabase

```bash
# Verificar variables de entorno
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Probar sin Supabase
node index.js
```

### Error de Generación de Evidencia

```bash
# Verificar que los archivos XML existen
ls -la scripts/downloads/*/

# Probar generación de evidencia
npm run evidence:generate

# Verificar archivo de evidencia generado
ls -la output/evidence-context.json

# Probar copia al frontend
npm run evidence:copy

# Verificar archivo en frontend
ls -la ../../public/evidence-context.json
```

### Error de Pruebas de Evidencia

```bash
# Verificar que evidence-context.json existe
ls -la ../../public/evidence-context.json

# Ejecutar pruebas de evidencia
npm run evidence:test

# Verificar logs de consola para errores
```

## 🔄 Actualización de URLs

Si las URLs del Congreso cambian:

1. **Verificar manualmente**: Acceder a la web del Congreso
2. **Actualizar script**: Modificar `scripts/update-congress.js`
3. **Probar descarga**: `npm run download-only`
4. **Verificar pipeline**: `npm run test-integration`

## 📈 Monitoreo

### Logs de Procesamiento

- **Descarga**: Archivos descargados y errores
- **Procesamiento**: Iniciativas extraídas y tiempo
- **Exportación**: Archivos generados y ubicaciones
- **Supabase**: Estadísticas de subida y errores

### Métricas de Rendimiento

- **Tiempo de descarga**: Velocidad de descarga de archivos
- **Tiempo de procesamiento**: Velocidad de análisis XML
- **Tiempo de exportación**: Velocidad de generación de archivos
- **Tiempo de subida**: Velocidad de subida a Supabase

### Métricas de Evidencia

- **Iniciativas con evidencia**: Número de iniciativas que tienen evidencia disponible
- **Tipos de evidencia**: Distribución de noticias, redes sociales y documentos legales
- **Tiempo de generación**: Velocidad de generación de evidencia
- **Tamaño de archivos**: Tamaño de los archivos de evidencia generados

## 🤝 Contribución

1. **Fork** del repositorio
2. **Crear** rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commit** cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. **Push** a la rama (`git push origin feature/nueva-funcionalidad`)
5. **Crear** Pull Request

## 📄 Licencia

MIT License - ver archivo [LICENSE](../LICENSE) para detalles.

## 🆘 Soporte

- **Issues**: Crear issue en GitHub
- **Documentación**: Ver archivos en `/docs/`
- **Ejemplos**: Ver archivos en `/examples/`
- **Pruebas**: Ejecutar `npm run test-integration` 