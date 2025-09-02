-- Migration: Add basic political party fields to congress_initiatives table
-- Very basic version that should work with all PostgreSQL versions

-- Add political_party_name column
ALTER TABLE public.congress_initiatives 
ADD COLUMN political_party_name TEXT;

-- Add political_party_short_name column
ALTER TABLE public.congress_initiatives 
ADD COLUMN political_party_short_name TEXT;

-- Add political_party_confidence column
ALTER TABLE public.congress_initiatives 
ADD COLUMN political_party_confidence TEXT;

-- Add political_party_method column
ALTER TABLE public.congress_initiatives 
ADD COLUMN political_party_method TEXT;

-- Add political_party_color column
ALTER TABLE public.congress_initiatives 
ADD COLUMN political_party_color TEXT;

-- Add comments for the new fields
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

-- Create index for confidence field
CREATE INDEX idx_congress_initiatives_party_confidence 
ON public.congress_initiatives(political_party_confidence);

-- Create the junction table for party relationships
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

-- Add comments for the junction table
COMMENT ON TABLE public.congress_initiative_parties IS 
'Junction table linking Congress initiatives with political parties and their positions';

COMMENT ON COLUMN public.congress_initiative_parties.relationship_type IS 
'Type of relationship: promoter (main party), supporter, opponent, or neutral';

COMMENT ON COLUMN public.congress_initiative_parties.confidence IS 
'Confidence level of the party relationship identification';

-- Create indexes for the junction table
CREATE INDEX idx_congress_initiative_parties_initiative 
ON public.congress_initiative_parties(initiative_id);

CREATE INDEX idx_congress_initiative_parties_party 
ON public.congress_initiative_parties(party_id);

CREATE INDEX idx_congress_initiative_parties_relationship 
ON public.congress_initiative_parties(relationship_type);

-- Enable RLS on the new table
ALTER TABLE public.congress_initiative_parties ENABLE ROW LEVEL SECURITY;

-- Create policy for the junction table
CREATE POLICY "Congress initiative parties are viewable by everyone" 
ON public.congress_initiative_parties
FOR SELECT USING (true);

-- Update existing records to set default values for new fields
UPDATE public.congress_initiatives 
SET political_party_confidence = 'low',
    political_party_method = 'not_identified'
WHERE political_party_confidence IS NULL; 