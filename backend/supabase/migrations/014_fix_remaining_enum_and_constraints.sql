-- Migration: Fix remaining enum values and political parties constraints
-- This migration addresses the "Reales decretos" enum issue and fixes table constraints

-- Add the missing enum value for "Reales decretos"
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Reales decretos';

-- Add any other missing enum values that might appear in the data
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Real Decreto';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Decreto';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Orden ministerial';
ALTER TYPE congress_initiative_type ADD VALUE IF NOT EXISTS 'Resolución';

-- Update the comment to include the new values
COMMENT ON TYPE congress_initiative_type IS 
'Updated enum for Congress initiative types including all types found in XML data.
Values include: Proyecto de ley, Proposición de ley, Proposición de ley de Grupos Parlamentarios del Congreso, 
Proposición de ley del Senado, Propuesta de reforma, Propuesta de reforma de Estatuto de Autonomía, 
Iniciativa legislativa aprobada, Ley, Decreto-ley, Real Decreto-ley, Reforma constitucional, 
Iniciativa Legislativa Popular, Propuesta de Comunidad Autónoma, Reales decretos, Real Decreto, 
Decreto, Orden ministerial, Resolución';

-- Fix the political_parties table constraints
-- First, let's check if there are duplicate names and handle them
-- Create a temporary table to store unique political parties
CREATE TEMP TABLE temp_unique_parties AS
SELECT DISTINCT ON (name) 
    id, name, short_name, logo, color, ideology, leader, seats, is_active, created_at, updated_at
FROM public.political_parties
ORDER BY name, created_at;

-- Drop the existing table and recreate it with proper constraints
DROP TABLE IF EXISTS public.congress_initiative_parties CASCADE;
DROP TABLE IF EXISTS public.political_parties CASCADE;

-- Recreate the political_parties table with proper constraints
CREATE TABLE public.political_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_name TEXT UNIQUE NOT NULL,
    logo TEXT,
    color TEXT NOT NULL,
    ideology TEXT,
    leader TEXT,
    seats INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate the congress_initiative_parties table
CREATE TABLE public.congress_initiative_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    party_id TEXT REFERENCES public.political_parties(short_name) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'promoter',
    confidence TEXT DEFAULT 'medium',
    method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate relationships
ALTER TABLE public.congress_initiative_parties 
ADD CONSTRAINT unique_initiative_party_relationship 
UNIQUE(initiative_id, party_id, relationship_type);

-- Restore the data from the temporary table
INSERT INTO public.political_parties (id, name, short_name, logo, color, ideology, leader, seats, is_active, created_at, updated_at)
SELECT id, name, short_name, logo, color, ideology, leader, seats, is_active, created_at, updated_at
FROM temp_unique_parties;

-- Add the default political parties that our service expects
INSERT INTO public.political_parties (name, short_name, color, is_active) VALUES
('Partido Popular', 'PP', '#0056A3', true),
('Partido Socialista Obrero Español', 'PSOE', '#E30613', true),
('VOX', 'VOX', '#5BC236', true),
('SUMAR', 'SUMAR', '#FF6B35', true),
('Unidas Podemos', 'UP', '#6B2C91', true),
('Partido Nacionalista Vasco', 'EAJ-PNV', '#008C15', true),
('Euskal Herria Bildu', 'EH Bildu', '#000000', true),
('Junts per Catalunya', 'Junts', '#FDB913', true),
('Esquerra Republicana de Catalunya', 'ERC', '#FFD700', true),
('Bloque Nacionalista Galego', 'BNG', '#77B5FE', true),
('Unión del Pueblo Navarro', 'UPN', '#FF6B35', true),
('Coalición Canaria', 'CC', '#FFD700', true),
('Gobierno de España', 'Gobierno', '#333333', true),
('Comisiones Parlamentarias', 'Comisiones', '#666666', true),
('Comunidades Autónomas', 'CCAA', '#999999', true)
ON CONFLICT (short_name) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.political_parties IS 
'Political parties table with proper constraints. Uses short_name as the unique identifier.';

COMMENT ON TABLE public.congress_initiative_parties IS 
'Junction table linking Congress initiatives with political parties and their positions.';

-- Create indexes
CREATE INDEX idx_congress_initiative_parties_initiative 
ON public.congress_initiative_parties(initiative_id);

CREATE INDEX idx_congress_initiative_parties_party 
ON public.congress_initiative_parties(party_id);

CREATE INDEX idx_congress_initiative_parties_relationship 
ON public.congress_initiative_parties(relationship_type);

-- Enable RLS
ALTER TABLE public.political_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_initiative_parties ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Political parties full access" ON public.political_parties
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Congress initiative parties full access" ON public.congress_initiative_parties
    FOR ALL USING (true) WITH CHECK (true);

-- Update existing records to set default values for new fields
UPDATE public.congress_initiatives 
SET political_party_confidence = 'low',
    political_party_method = 'not_identified'
WHERE political_party_confidence IS NULL; 