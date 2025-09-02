-- Migration: Add missing political party fields to congress_initiatives table
-- This migration adds only the fields that don't already exist

-- Check and add political_party_name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'congress_initiatives' 
        AND column_name = 'political_party_name'
    ) THEN
        ALTER TABLE public.congress_initiatives ADD COLUMN political_party_name TEXT;
    END IF;
END $$;

-- Check and add political_party_short_name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'congress_initiatives' 
        AND column_name = 'political_party_short_name'
    ) THEN
        ALTER TABLE public.congress_initiatives ADD COLUMN political_party_short_name TEXT;
    END IF;
END $$;

-- Check and add political_party_confidence if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'congress_initiatives' 
        AND column_name = 'political_party_confidence'
    ) THEN
        ALTER TABLE public.congress_initiatives ADD COLUMN political_party_confidence TEXT CHECK (political_party_confidence IN ('high', 'medium', 'low'));
    END IF;
END $$;

-- Check and add political_party_method if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'congress_initiatives' 
        AND column_name = 'political_party_method'
    ) THEN
        ALTER TABLE public.congress_initiatives ADD COLUMN political_party_method TEXT;
    END IF;
END $$;

-- Check and add political_party_color if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'congress_initiatives' 
        AND column_name = 'political_party_color'
    ) THEN
        ALTER TABLE public.congress_initiatives ADD COLUMN political_party_color TEXT;
    END IF;
END $$;

-- Add comments for the new fields (only if they were added)
COMMENT ON COLUMN public.congress_initiatives.political_party_name IS 
'Full name of the political party that promoted this initiative';

COMMENT ON COLUMN public.congress_initiatives.political_party_short_name IS 
'Short name/abbreviation of the political party';

COMMENT ON COLUMN public.congress_initiatives.political_party_confidence IS 
'Confidence level of the party identification (high, medium, low)';

COMMENT ON COLUMN public.congress_initiatives.political_party_method IS 
'Method used to identify the political party (parliamentary_group, content_analysis, etc.)';

COMMENT ON COLUMN public.congress_initiatives.political_party_color IS 
'Brand color associated with the political party';

-- Create indexes for the new fields (only if they exist)
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_party_confidence 
ON public.congress_initiatives(political_party_confidence);

-- Check if congress_initiative_parties table exists, if not create it
CREATE TABLE IF NOT EXISTS public.congress_initiative_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    party_id TEXT REFERENCES public.political_parties(short_name) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'promoter' CHECK (relationship_type IN ('promoter', 'supporter', 'opponent', 'neutral')),
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')) DEFAULT 'medium',
    method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique relationships
    UNIQUE(initiative_id, party_id, relationship_type)
);

-- Add comments for the junction table
COMMENT ON TABLE public.congress_initiative_parties IS 
'Junction table linking Congress initiatives with political parties and their positions';

COMMENT ON COLUMN public.congress_initiative_parties.relationship_type IS 
'Type of relationship: promoter (main party), supporter, opponent, or neutral';

COMMENT ON COLUMN public.congress_initiative_parties.confidence IS 
'Confidence level of the party relationship identification';

-- Create indexes for the junction table
CREATE INDEX IF NOT EXISTS idx_congress_initiative_parties_initiative 
ON public.congress_initiative_parties(initiative_id);

CREATE INDEX IF NOT EXISTS idx_congress_initiative_parties_party 
ON public.congress_initiative_parties(party_id);

CREATE INDEX IF NOT EXISTS idx_congress_initiative_parties_relationship 
ON public.congress_initiative_parties(relationship_type);

-- Enable RLS on the new table
ALTER TABLE public.congress_initiative_parties ENABLE ROW LEVEL SECURITY;

-- Create policy for the junction table (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'congress_initiative_parties' 
        AND policyname = 'Congress initiative parties are viewable by everyone'
    ) THEN
        CREATE POLICY "Congress initiative parties are viewable by everyone" ON public.congress_initiative_parties
            FOR SELECT USING (true);
    END IF;
END $$;

-- Update existing records to set default values for new fields
UPDATE public.congress_initiatives 
SET political_party_confidence = 'low',
    political_party_method = 'not_identified'
WHERE political_party_confidence IS NULL;

-- Add trigger to update updated_at timestamp (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_congress_initiative_parties_updated_at'
    ) THEN
        CREATE OR REPLACE FUNCTION update_congress_initiative_parties_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER update_congress_initiative_parties_updated_at 
            BEFORE UPDATE ON public.congress_initiative_parties
            FOR EACH ROW EXECUTE FUNCTION update_congress_initiative_parties_updated_at();
    END IF;
END $$; 