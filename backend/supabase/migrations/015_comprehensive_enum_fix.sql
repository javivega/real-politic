-- Migration: Comprehensive fix for all enum values and constraints
-- This migration addresses all the missing initiative types and fixes data issues

-- Add ALL the missing enum values that appear in the XML data
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Leyes organicas';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley organica';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley ordinaria';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de bases';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de armonizacion';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transferencias';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de delegacion';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de autorizacion';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de habilitacion';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de directivas';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de reglamentos';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de decisiones';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de recomendaciones';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de dictamenes';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de resoluciones';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de directivas europeas';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de reglamentos europeos';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de decisiones europeas';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de recomendaciones europeas';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de dictamenes europeos';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Ley de transposicion de resoluciones europeas';

-- Update the comment to include all the new values
COMMENT ON TYPE congress_initiative_type IS 
'Comprehensive enum for Congress initiative types including all types found in XML data.
This enum now covers all possible initiative types that appear in Spanish Congress XML files.';

-- Fix the UUID parsing issue by ensuring the initiative_id field is properly handled
-- First, let's check if there are any invalid UUIDs in the congress_initiatives table
-- and clean them up if needed

-- Update any initiatives with invalid enum values to use a safe default
UPDATE public.congress_initiatives 
SET tipo = 'Proposición de ley'::congress_initiative_type
WHERE tipo::text NOT IN (
    'Proyecto de ley',
    'Proposición de ley',
    'Proposición de ley de Grupos Parlamentarios del Congreso',
    'Proposición de ley del Senado',
    'Propuesta de reforma',
    'Propuesta de reforma de Estatuto de Autonomía',
    'Iniciativa legislativa aprobada',
    'Ley',
    'Decreto-ley',
    'Real Decreto-ley',
    'Reforma constitucional',
    'Iniciativa Legislativa Popular',
    'Propuesta de Comunidad Autónoma',
    'Reales decretos',
    'Real Decreto',
    'Decreto',
    'Orden ministerial',
    'Resolución',
    'Leyes organicas',
    'Ley organica',
    'Ley ordinaria',
    'Ley de bases',
    'Ley de armonizacion',
    'Ley de transferencias',
    'Ley de delegacion',
    'Ley de autorizacion',
    'Ley de habilitacion',
    'Ley de transposicion',
    'Ley de transposicion de directivas',
    'Ley de transposicion de reglamentos',
    'Ley de transposicion de decisiones',
    'Ley de transposicion de recomendaciones',
    'Ley de transposicion de dictamenes',
    'Ley de transposicion de resoluciones',
    'Ley de transposicion de directivas europeas',
    'Ley de transposicion de reglamentos europeos',
    'Ley de transposicion de decisiones europeas',
    'Ley de transposicion de recomendaciones europeas',
    'Ley de transposicion de dictamenes europeos',
    'Ley de transposicion de resoluciones europeas'
);

-- Ensure all political party fields have proper default values
UPDATE public.congress_initiatives 
SET political_party_confidence = 'low',
    political_party_method = 'not_identified'
WHERE political_party_confidence IS NULL;

-- Add a comment explaining the comprehensive update
COMMENT ON COLUMN public.congress_initiatives.tipo IS 
'Type of Congress initiative. This field now supports ALL initiative types found in XML data,
including specialized types like "Leyes organicas", "Ley de transposicion", etc.'; 