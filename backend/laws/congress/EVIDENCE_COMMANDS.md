# 🚀 Comandos de Evidencia para AI - Referencia Rápida

## 📋 Comandos Principales

### Generación Completa
```bash
# Generar evidencia y copiar al frontend en un solo comando
npm run evidence:full
```

### Comandos Individuales
```bash
# Solo generar evidencia
npm run evidence:generate

# Solo copiar al frontend
npm run evidence:copy

# Generar y probar
npm run evidence:test
```

## 🔧 Comandos de Mantenimiento

### Verificación
```bash
# Verificar archivos de evidencia
ls -la output/evidence-context.json
ls -la ../../public/evidence-context.json

# Verificar tamaño y contenido
wc -l output/evidence-context.json
head -20 output/evidence-context.json
```

### Limpieza
```bash
# Limpiar archivos de evidencia
rm output/evidence-context.json
rm ../../public/evidence-context.json

# Regenerar desde cero
npm run evidence:full
```

## 📊 Monitoreo y Debug

### Logs de Generación
```bash
# Ver logs en tiempo real
npm run evidence:generate 2>&1 | tee evidence.log

# Ver solo errores
npm run evidence:generate 2>&1 | grep -i error
```

### Estadísticas de Evidencia
```bash
# Contar iniciativas con evidencia
jq 'length' output/evidence-context.json

# Ver distribución de tipos de evidencia
jq '[.[] | {id: .initiative_id, hasNews: (.news | length > 0), hasSocial: (.x | length > 0), hasLegal: (.legal | length > 0)}]' output/evidence-context.json
```

## 🚨 Solución de Problemas

### Problemas Comunes

#### 1. Archivo XML no encontrado
```bash
# Verificar que existen archivos XML
ls -la scripts/downloads/*/

# Si no hay archivos, descargar primero
npm run download
```

#### 2. Error de permisos al copiar
```bash
# Verificar permisos
ls -la output/evidence-context.json
ls -la ../../public/

# Corregir permisos si es necesario
chmod 644 output/evidence-context.json
chmod 755 ../../public/
```

#### 3. Archivo de evidencia corrupto
```bash
# Verificar formato JSON
jq '.' output/evidence-context.json > /dev/null

# Si hay error, regenerar
npm run evidence:generate
```

## 📁 Estructura de Archivos

```
backend/laws/congress/
├── output/
│   └── evidence-context.json          # Evidencia generada
├── ../../public/
│   └── evidence-context.json          # Evidencia para frontend
└── scripts/
    ├── build-evidence-context.js      # Generador principal
    ├── fetch-prevote-evidence.js      # Evidencia X.com
    └── build-evidence-context.js      # Agregador
```

## ⚡ Workflow Recomendado

### Desarrollo Diario
```bash
# 1. Descargar XML actualizados
npm run download

# 2. Generar evidencia
npm run evidence:generate

# 3. Copiar al frontend
npm run evidence:copy

# 4. Verificar funcionamiento
npm run evidence:test
```

### Producción
```bash
# Pipeline completo automatizado
npm run evidence:full
```

## 🔍 Verificación de Calidad

### Contenido Mínimo
```bash
# Verificar que cada iniciativa tiene al menos un tipo de evidencia
jq '[.[] | select(.news or .x or .legal)] | length' output/evidence-context.json

# Verificar que no hay iniciativas vacías
jq '[.[] | select(.news == [] and (.x | length == 0) and (.legal | keys | length == 0))] | length' output/evidence-context.json
```

### Validación de URLs
```bash
# Verificar que las URLs son válidas
jq '[.[] | .news[]?.url, .x[].url, .legal.bocg, .legal.ds] | map(select(. != null)) | map(select(startswith("http"))) | length' output/evidence-context.json
```

## 📈 Métricas de Rendimiento

### Tiempos Esperados
- **Generación**: 2-5 minutos para 100 iniciativas
- **Copia**: < 1 segundo
- **Pruebas**: 1-2 minutos

### Tamaños Esperados
- **100 iniciativas**: ~500KB - 1MB
- **500 iniciativas**: ~2-5MB
- **1000 iniciativas**: ~5-10MB

## 🎯 Consejos de Uso

1. **Ejecutar después de descargas**: Siempre generar evidencia después de actualizar XML
2. **Verificar antes de copiar**: Asegurar que la evidencia se generó correctamente
3. **Monitorear logs**: Revisar logs para detectar problemas temprano
4. **Backup periódico**: Hacer copias de seguridad de evidence-context.json
5. **Pruebas regulares**: Ejecutar `npm run evidence:test` regularmente

## 🆘 Comandos de Emergencia

### Regeneración Completa
```bash
# Limpiar y regenerar todo
rm -f output/evidence-context.json ../../public/evidence-context.json
npm run evidence:full
```

### Verificación Rápida
```bash
# Verificar estado general
ls -la output/evidence-context.json ../../public/evidence-context.json
npm run evidence:test
``` 