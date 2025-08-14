-- Add Congress expediente number field to laws table
ALTER TABLE public.laws 
ADD COLUMN IF NOT EXISTS congress_expediente TEXT;

-- Add index for faster lookups by expediente
CREATE INDEX IF NOT EXISTS idx_laws_congress_expediente ON public.laws(congress_expediente);

-- Add comment explaining the field
COMMENT ON COLUMN public.laws.congress_expediente IS 'Spanish Congress expediente number (e.g., 122/000001/0000)';

-- Add unique constraint to prevent duplicate expediente numbers
ALTER TABLE public.laws 
ADD CONSTRAINT unique_congress_expediente UNIQUE (congress_expediente);

-- Update existing laws to have a default expediente if needed
UPDATE public.laws 
SET congress_expediente = CONCAT('DEMO-', id::text) 
WHERE congress_expediente IS NULL; 