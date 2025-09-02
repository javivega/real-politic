-- Migration: Safely update congress_initiative_type enum without dropping it
-- This migration adds new values to the existing enum without breaking dependencies

-- First, let's add the new enum values one by one
-- PostgreSQL allows adding values to existing enums

-- Add 'Proposición de ley de Grupos Parlamentarios del Congreso'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Proposición de ley de Grupos Parlamentarios del Congreso';

-- Add 'Proposición de ley del Senado'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Proposición de ley del Senado';

-- Add 'Propuesta de reforma de Estatuto de Autonomía'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Propuesta de reforma de Estatuto de Autonomía';

-- Add 'Decreto-ley'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Decreto-ley';

-- Add 'Real Decreto-ley'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Real Decreto-ley';

-- Add 'Reforma constitucional'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Reforma constitucional';

-- Add 'Iniciativa Legislativa Popular'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Iniciativa Legislativa Popular';

-- Add 'Propuesta de Comunidad Autónoma'
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Propuesta de Comunidad Autónoma';

-- Update the comment on the enum type
COMMENT ON TYPE congress_initiative_type IS 
'Updated enum for Congress initiative types including the full names found in XML data.
This covers all the initiative types that appear in the Spanish Congress XML files.
Values include: Proyecto de ley, Proposición de ley, Proposición de ley de Grupos Parlamentarios del Congreso, 
Proposición de ley del Senado, Propuesta de reforma, Propuesta de reforma de Estatuto de Autonomía, 
Iniciativa legislativa aprobada, Ley, Decreto-ley, Real Decreto-ley, Reforma constitucional, 
Iniciativa Legislativa Popular, Propuesta de Comunidad Autónoma';

-- Now let's update any existing records that might have invalid values
-- Set them to a safe default if they don't match the new enum values
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

-- Add a comment explaining the update
COMMENT ON COLUMN public.congress_initiatives.tipo IS 
'Type of Congress initiative. Updated to include all initiative types found in XML data.
This field now supports the full names like "Proposición de ley de Grupos Parlamentarios del Congreso".'; 