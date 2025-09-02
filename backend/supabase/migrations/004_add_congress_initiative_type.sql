-- Migration: Add congress_initiative_type column to congress_initiatives table
-- This column categorizes initiatives according to the Spanish Congress classification system

-- First, create the enum type for initiative types
CREATE TYPE congress_initiative_type_enum AS ENUM (
    'tramitacion_ordinaria',           -- Ordinary processing
    'tramitacion_urgente',             -- Urgent processing  
    'tramitacion_especial_mayoria_reforzada', -- Special processing (reinforced majority)
    'tramitacion_iniciativas_autonomicas',    -- Autonomous initiatives processing
    'tramitacion_iniciativas_populares',      -- Popular initiatives processing
    'tramitacion_organos_constitucionales',   -- Constitutional/consultative bodies processing
    'ley_aprobada'                     -- Approved laws
);

-- Add the column to the congress_initiatives table
ALTER TABLE congress_initiatives 
ADD COLUMN congress_initiative_type congress_initiative_type_enum 
DEFAULT 'tramitacion_ordinaria' 
NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN congress_initiatives.congress_initiative_type IS 
'Categoría de trámite según la clasificación del Congreso de los Diputados de España. 
Determina el tipo de procedimiento legislativo que sigue la iniciativa.';

-- Create an index on this column for better query performance
CREATE INDEX idx_congress_initiatives_type ON congress_initiatives(congress_initiative_type);

-- Update existing records with default values based on current data
-- This is a safe default that won't break existing functionality
UPDATE congress_initiatives 
SET congress_initiative_type = 'tramitacion_ordinaria' 
WHERE congress_initiative_type IS NULL; 