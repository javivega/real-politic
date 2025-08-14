-- Migration: Create Spanish Congress data tables
-- This migration creates tables to store processed XML data from the Spanish Congress

-- Create enum for Congress initiative types
CREATE TYPE congress_initiative_type AS ENUM (
    'Proyecto de ley',
    'Proposición de ley',
    'Propuesta de reforma',
    'Iniciativa legislativa aprobada',
    'Ley'
);

-- Create enum for relationship types
CREATE TYPE congress_relationship_type AS ENUM (
    'relacionada',
    'origen',
    'similar'
);

-- Create Congress initiatives table (main table)
CREATE TABLE public.congress_initiatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    num_expediente TEXT UNIQUE NOT NULL,
    tipo congress_initiative_type NOT NULL,
    objeto TEXT NOT NULL,
    autor TEXT NOT NULL,
    fecha_presentacion DATE,
    fecha_calificacion DATE,
    legislatura TEXT,
    supertipo TEXT,
    agrupacion TEXT,
    tipo_tramitacion TEXT,
    resultado_tramitacion TEXT,
    situacion_actual TEXT,
    comision_competente TEXT,
    plazos TEXT,
    ponentes TEXT,
    enlaces_bocg TEXT,
    enlaces_ds TEXT,
    tramitacion_texto TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Congress timeline events table
CREATE TABLE public.congress_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    evento TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    descripcion TEXT,
    orden INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Congress relationships table (for direct relationships and similarities)
CREATE TABLE public.congress_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    target_initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    relationship_type congress_relationship_type NOT NULL,
    similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_initiative_id, target_initiative_id, relationship_type)
);

-- Create Congress keywords table for better search and analysis
CREATE TABLE public.congress_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    palabra TEXT NOT NULL,
    frecuencia INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(palabra)
);

-- Create junction table for initiatives and keywords
CREATE TABLE public.congress_initiative_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiative_id UUID REFERENCES public.congress_initiatives(id) ON DELETE CASCADE,
    keyword_id UUID REFERENCES public.congress_keywords(id) ON DELETE CASCADE,
    relevancia INTEGER DEFAULT 50 CHECK (relevancia >= 0 AND relevancia <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(initiative_id, keyword_id)
);

-- Create indexes for better performance
CREATE INDEX idx_congress_initiatives_num_expediente ON public.congress_initiatives(num_expediente);
CREATE INDEX idx_congress_initiatives_tipo ON public.congress_initiatives(tipo);
CREATE INDEX idx_congress_initiatives_autor ON public.congress_initiatives(autor);
CREATE INDEX idx_congress_initiatives_fecha_presentacion ON public.congress_initiatives(fecha_presentacion);
CREATE INDEX idx_congress_initiatives_comision ON public.congress_initiatives(comision_competente);
CREATE INDEX idx_congress_initiatives_situacion ON public.congress_initiatives(situacion_actual);

CREATE INDEX idx_congress_timeline_initiative_id ON public.congress_timeline_events(initiative_id);
CREATE INDEX idx_congress_timeline_fecha_inicio ON public.congress_timeline_events(fecha_inicio);
CREATE INDEX idx_congress_timeline_orden ON public.congress_timeline_events(orden);

CREATE INDEX idx_congress_relationships_source ON public.congress_relationships(source_initiative_id);
CREATE INDEX idx_congress_relationships_target ON public.congress_relationships(target_initiative_id);
CREATE INDEX idx_congress_relationships_type ON public.congress_relationships(relationship_type);
CREATE INDEX idx_congress_relationships_similarity ON public.congress_relationships(similarity_score);

CREATE INDEX idx_congress_keywords_palabra ON public.congress_keywords(palabra);
CREATE INDEX idx_congress_keywords_frecuencia ON public.congress_keywords(frecuencia);

CREATE INDEX idx_congress_initiative_keywords_initiative ON public.congress_initiative_keywords(initiative_id);
CREATE INDEX idx_congress_initiative_keywords_keyword ON public.congress_initiative_keywords(keyword_id);

-- Create full-text search indexes
CREATE INDEX idx_congress_initiatives_search ON public.congress_initiatives 
    USING GIN (to_tsvector('spanish', objeto || ' ' || COALESCE(ponentes, '') || ' ' || COALESCE(comision_competente, '')));

CREATE INDEX idx_congress_timeline_search ON public.congress_timeline_events 
    USING GIN (to_tsvector('spanish', evento || ' ' || COALESCE(descripcion, '')));

-- Create function to update similarity scores for better performance
CREATE OR REPLACE FUNCTION update_similarity_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the reverse relationship with the same similarity score
    IF NEW.relationship_type = 'similar' THEN
        INSERT INTO public.congress_relationships (
            source_initiative_id, 
            target_initiative_id, 
            relationship_type, 
            similarity_score, 
            metadata
        ) VALUES (
            NEW.target_initiative_id, 
            NEW.source_initiative_id, 
            'similar', 
            NEW.similarity_score, 
            NEW.metadata
        ) ON CONFLICT (source_initiative_id, target_initiative_id, relationship_type) 
        DO UPDATE SET 
            similarity_score = EXCLUDED.similarity_score,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for similarity relationships
CREATE TRIGGER trigger_update_similarity_score
    AFTER INSERT ON public.congress_relationships
    FOR EACH ROW
    WHEN (NEW.relationship_type = 'similar')
    EXECUTE FUNCTION update_similarity_score();

-- Create function to extract and store keywords from initiative text
CREATE OR REPLACE FUNCTION extract_initiative_keywords(initiative_text TEXT)
RETURNS TEXT[] AS $$
DECLARE
    words TEXT[];
    clean_word TEXT;
    result TEXT[] := '{}';
BEGIN
    -- Split text into words and clean them
    words := string_to_array(lower(initiative_text), ' ');
    
    FOR i IN 1..array_length(words, 1) LOOP
        -- Clean word (remove punctuation, etc.)
        clean_word := regexp_replace(words[i], '[^a-zA-Záéíóúñü]', '', 'g');
        
        -- Filter out common words and short words
        IF length(clean_word) > 3 AND clean_word NOT IN (
            'para', 'con', 'los', 'las', 'del', 'una', 'este', 'esta', 'estos', 'estas',
            'como', 'pero', 'para', 'por', 'que', 'cual', 'quien', 'donde', 'cuando',
            'como', 'porque', 'pues', 'aunque', 'si', 'no', 'ni', 'o', 'y', 'e', 'u'
        ) THEN
            result := array_append(result, clean_word);
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get related initiatives (similar + direct relationships)
CREATE OR REPLACE FUNCTION get_related_initiatives(initiative_expediente TEXT, max_results INTEGER DEFAULT 10)
RETURNS TABLE (
    expediente TEXT,
    tipo congress_initiative_type,
    objeto TEXT,
    relationship_type congress_relationship_type,
    similarity_score DECIMAL(3,2),
    relevance_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.num_expediente as expediente,
        ci.tipo,
        ci.objeto,
        cr.relationship_type,
        cr.similarity_score,
        CASE 
            WHEN cr.relationship_type = 'similar' THEN 
                ROUND(cr.similarity_score * 100)::INTEGER
            ELSE 
                100
        END as relevance_score
    FROM public.congress_initiatives ci
    INNER JOIN public.congress_relationships cr ON ci.id = cr.target_initiative_id
    INNER JOIN public.congress_initiatives source ON source.id = cr.source_initiative_id
    WHERE source.num_expediente = initiative_expediente
    ORDER BY 
        CASE 
            WHEN cr.relationship_type IN ('relacionada', 'origen') THEN 1
            ELSE 2
        END,
        cr.similarity_score DESC NULLS LAST,
        ci.fecha_presentacion DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create function to get initiative timeline
CREATE OR REPLACE FUNCTION get_initiative_timeline(initiative_expediente TEXT)
RETURNS TABLE (
    evento TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    descripcion TEXT,
    orden INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cte.evento,
        cte.fecha_inicio,
        cte.fecha_fin,
        cte.descripcion,
        cte.orden
    FROM public.congress_timeline_events cte
    INNER JOIN public.congress_initiatives ci ON ci.id = cte.initiative_id
    WHERE ci.num_expediente = initiative_expediente
    ORDER BY cte.orden, cte.fecha_inicio;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.congress_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_initiative_keywords ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (all Congress data is public)
CREATE POLICY "Congress initiatives are viewable by everyone" ON public.congress_initiatives
    FOR SELECT USING (true);

CREATE POLICY "Congress timeline events are viewable by everyone" ON public.congress_timeline_events
    FOR SELECT USING (true);

CREATE POLICY "Congress relationships are viewable by everyone" ON public.congress_relationships
    FOR SELECT USING (true);

CREATE POLICY "Congress keywords are viewable by everyone" ON public.congress_keywords
    FOR SELECT USING (true);

CREATE POLICY "Congress initiative keywords are viewable by everyone" ON public.congress_initiative_keywords
    FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.congress_initiatives TO anon, authenticated;
GRANT ALL ON public.congress_timeline_events TO anon, authenticated;
GRANT ALL ON public.congress_relationships TO anon, authenticated;
GRANT ALL ON public.congress_keywords TO anon, authenticated;
GRANT ALL ON public.congress_initiative_keywords TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.congress_initiatives IS 'Spanish Congress initiatives extracted from XML data';
COMMENT ON TABLE public.congress_timeline_events IS 'Timeline events for each Congress initiative';
COMMENT ON TABLE public.congress_relationships IS 'Relationships between Congress initiatives (direct and similarity-based)';
COMMENT ON TABLE public.congress_keywords IS 'Keywords extracted from initiative text for better search';
COMMENT ON TABLE public.congress_initiative_keywords IS 'Junction table linking initiatives to keywords';

COMMENT ON FUNCTION get_related_initiatives IS 'Get related initiatives for a given expediente number';
COMMENT ON FUNCTION get_initiative_timeline IS 'Get timeline events for a given initiative';
COMMENT ON FUNCTION extract_initiative_keywords IS 'Extract keywords from initiative text'; 