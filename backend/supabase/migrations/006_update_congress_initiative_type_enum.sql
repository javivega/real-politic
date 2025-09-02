-- Migration: Update congress_initiative_type enum to include longer initiative type names
-- This migration fixes the enum constraint error by adding the missing initiative types

-- First, drop the existing enum constraint from the table
ALTER TABLE public.congress_initiatives 
DROP CONSTRAINT IF EXISTS congress_initiatives_tipo_check;

-- Drop the old enum type
DROP TYPE IF EXISTS congress_initiative_type;

-- Create the new enum type with all the initiative types found in the XML data
CREATE TYPE congress_initiative_type AS ENUM (
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
    'Propuesta de Comunidad Autónoma'
);

-- Add the constraint back to the table
ALTER TABLE public.congress_initiatives 
ADD CONSTRAINT congress_initiatives_tipo_check 
CHECK (tipo::text = ANY(ARRAY[
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
    'Propuesta de Comunidad Autónoma'
]));

-- Add a comment explaining the updated enum
COMMENT ON TYPE congress_initiative_type IS 
'Updated enum for Congress initiative types including the full names found in XML data.
This covers all the initiative types that appear in the Spanish Congress XML files.';

-- Update any existing records that might have invalid values
-- Set them to a safe default if they don't match the new enum
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
    'Propuesta de Comunidad Autónoma'
); 