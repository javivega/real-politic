-- Migration: Add BOE publication metadata to congress_initiatives

ALTER TABLE public.congress_initiatives
    ADD COLUMN IF NOT EXISTS boe_id TEXT,
    ADD COLUMN IF NOT EXISTS boe_url TEXT,
    ADD COLUMN IF NOT EXISTS boe_publication_date DATE,
    ADD COLUMN IF NOT EXISTS publication_confidence TEXT CHECK (publication_confidence IN ('high','medium','low'));

COMMENT ON COLUMN public.congress_initiatives.boe_id IS 'BOE-A-YYYY-NNNNN identifier when known';
COMMENT ON COLUMN public.congress_initiatives.boe_url IS 'Canonical BOE URL if validated';
COMMENT ON COLUMN public.congress_initiatives.boe_publication_date IS 'Publication date in BOE';
COMMENT ON COLUMN public.congress_initiatives.publication_confidence IS 'Confidence level for publication inference';

CREATE INDEX IF NOT EXISTS idx_congress_initiatives_boe_id ON public.congress_initiatives(boe_id);
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_boe_pub_date ON public.congress_initiatives(boe_publication_date);


