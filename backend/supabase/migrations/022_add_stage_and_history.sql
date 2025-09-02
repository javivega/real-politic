-- Migration: Add canonical stage fields and stage history for Congress initiatives

-- 1) Extend or create enum for canonical stages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'congress_stage'
    ) THEN
        CREATE TYPE congress_stage AS ENUM (
            'proposed',
            'debating',
            'committee',
            'voting',
            'passed',
            'rejected',
            'withdrawn',
            'closed',
            'published'
        );
    END IF;
END$$;

-- 2) Add columns to congress_initiatives if not exists
ALTER TABLE public.congress_initiatives
    ADD COLUMN IF NOT EXISTS stage congress_stage,
    ADD COLUMN IF NOT EXISTS current_step SMALLINT,
    ADD COLUMN IF NOT EXISTS stage_reason JSONB;

COMMENT ON COLUMN public.congress_initiatives.stage IS 'Canonical stage derived from timeline and results';
COMMENT ON COLUMN public.congress_initiatives.current_step IS 'Pipeline step (1..5): presentation, debate, commission, approval, publication';
COMMENT ON COLUMN public.congress_initiatives.stage_reason IS 'JSON with signals used to classify current stage';

CREATE INDEX IF NOT EXISTS idx_congress_initiatives_stage ON public.congress_initiatives(stage);
CREATE INDEX IF NOT EXISTS idx_congress_initiatives_current_step ON public.congress_initiatives(current_step);

-- 3) Create stage history table to track transitions
CREATE TABLE IF NOT EXISTS public.congress_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    stage congress_stage NOT NULL,
    step SMALLINT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_initiative ON public.congress_stage_history(initiative_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_detected_at ON public.congress_stage_history(detected_at);

-- 4) Backfill defaults conservatively: map existing resultado/situacion to coarse stage
UPDATE public.congress_initiatives ci
SET stage = COALESCE(
        CASE
            WHEN lower(ci.resultado_tramitacion) LIKE '%aprob%' THEN 'passed'::congress_stage
            WHEN lower(ci.resultado_tramitacion) LIKE '%rechazad%' THEN 'rejected'::congress_stage
            WHEN lower(ci.resultado_tramitacion) LIKE '%retirad%' THEN 'withdrawn'::congress_stage
            WHEN lower(ci.situacion_actual) LIKE '%boe%' OR lower(ci.tramitacion_texto) LIKE '%boe%' OR lower(ci.situacion_actual) LIKE '%publicación%' OR lower(ci.tramitacion_texto) LIKE '%publicación%' OR lower(ci.situacion_actual) LIKE '%entrada en vigor%' OR lower(ci.tramitacion_texto) LIKE '%entrada en vigor%' THEN 'published'::congress_stage
            WHEN lower(ci.situacion_actual) LIKE '%votación%' OR lower(ci.situacion_actual) LIKE '%voto%' OR lower(ci.tramitacion_texto) LIKE '%votación%' THEN 'voting'::congress_stage
            WHEN lower(ci.situacion_actual) LIKE '%comisión%' OR lower(ci.tramitacion_texto) LIKE '%comisión%' OR lower(ci.tramitacion_texto) LIKE '%ponencia%' OR lower(ci.tramitacion_texto) LIKE '%dictamen%' THEN 'committee'::congress_stage
            WHEN lower(ci.situacion_actual) LIKE '%pleno%' OR lower(ci.tramitacion_texto) LIKE '%debate%' OR lower(ci.tramitacion_texto) LIKE '%totalidad%' THEN 'debating'::congress_stage
            WHEN lower(ci.situacion_actual) LIKE '%cerrado%' THEN 'closed'::congress_stage
            ELSE NULL
        END,
        'proposed'::congress_stage
    ),
    current_step = COALESCE(
        CASE
            WHEN lower(ci.situacion_actual) LIKE '%boe%' OR lower(ci.tramitacion_texto) LIKE '%boe%' OR lower(ci.situacion_actual) LIKE '%publicación%' OR lower(ci.tramitacion_texto) LIKE '%publicación%' OR lower(ci.situacion_actual) LIKE '%entrada en vigor%' OR lower(ci.tramitacion_texto) LIKE '%entrada en vigor%' THEN 5
            WHEN lower(ci.resultado_tramitacion) LIKE '%aprob%' OR lower(ci.tramitacion_texto) LIKE '%senado%' OR lower(ci.tramitacion_texto) LIKE '%votación%' THEN 4
            WHEN lower(ci.comision_competente) IS NOT NULL OR lower(ci.tramitacion_texto) LIKE '%comisión%' OR lower(ci.tramitacion_texto) LIKE '%ponencia%' OR lower(ci.tramitacion_texto) LIKE '%dictamen%' THEN 3
            WHEN lower(ci.tramitacion_texto) LIKE '%totalidad%' OR lower(ci.tramitacion_texto) LIKE '%debate en el pleno%' THEN 2
            ELSE NULL
        END,
        1
    );


