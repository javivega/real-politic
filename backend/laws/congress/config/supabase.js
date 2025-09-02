/**
 * Configuración de Supabase para el procesador del Congreso
 */

const path = require('path');
const fs = require('fs');

// Find the .env file by looking in parent directories
function findEnvFile() {
    let currentDir = process.cwd();
    let envPath = path.join(currentDir, '.env');
    
    // Look for .env in current directory and parent directories
    while (!fs.existsSync(envPath) && currentDir !== path.dirname(currentDir)) {
        currentDir = path.dirname(currentDir);
        envPath = path.join(currentDir, '.env');
    }
    
    if (fs.existsSync(envPath)) {
        console.log('🔍 Found .env at:', envPath);
        return envPath;
    } else {
        console.log('⚠️  No .env file found, using default values');
        return null;
    }
}

const envPath = findEnvFile();
if (envPath) {
    require('dotenv').config({ path: envPath });
}

// Debug: Show what was loaded
console.log('🔍 Environment variables loaded:');
console.log('   • SUPABASE_URL:', process.env.SUPABASE_URL ? 'Yes' : 'No');
console.log('   • SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Yes' : 'No');

module.exports = {
  // Configuración de Supabase
  supabase: {
    // URL del proyecto Supabase
    url: process.env.SUPABASE_URL || 'https://your-project-id.supabase.co',
    
    // Clave anónima/pública de Supabase
    anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key-here',
    
    // Clave de servicio para operaciones de administrador (opcional)
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // Configuración de subida
    upload: {
      // Tamaño del lote para subidas
      batchSize: parseInt(process.env.SUPABASE_BATCH_SIZE) || 100,
      
      // Intentos de reintento
      retryAttempts: parseInt(process.env.SUPABASE_RETRY_ATTEMPTS) || 3,
      
      // Delay entre reintentos (ms)
      retryDelay: parseInt(process.env.SUPABASE_RETRY_DELAY) || 1000,
      
      // Conexión automática
      autoConnect: true
    }
  },

  // Configuración de la base de datos
  database: {
    // Tablas de Supabase
    tables: {
      initiatives: 'congress_initiatives',
      relationships: 'congress_relationships',
      timelineEvents: 'congress_timeline_events',
      keywords: 'congress_keywords'
    },
    
    // Configuración de esquemas
    schemas: {
      public: 'public',
      congress: 'congress'
    }
  },

  // Configuración de validación
  validation: {
    // Validar conexión antes de subir
    validateConnection: true,
    
    // Validar esquema de tablas
    validateSchema: true,
    
    // Validar datos antes de subir
    validateData: true
  }
}; 