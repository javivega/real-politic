-- Migration: Add AI Analysis Cache Table
-- This table stores AI-generated analysis for initiatives, allowing content sharing across users

-- Create the AI analysis cache table
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    initiative_id UUID NOT NULL REFERENCES congress_initiatives(id) ON DELETE CASCADE,
    
    -- Analysis content
    problem_analysis TEXT,
    external_research TEXT,
    technical_pros_cons JSONB, -- Stores the structured pros/cons data
    
    -- Metadata
    content_hash TEXT NOT NULL, -- Hash of initiative content to detect changes
    model_used TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    generation_time_ms INTEGER,
    
    -- Version and tracking
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    UNIQUE(initiative_id, content_hash),
    INDEX idx_ai_cache_initiative (initiative_id),
    INDEX idx_ai_cache_hash (content_hash),
    INDEX idx_ai_cache_active (is_active)
);

-- Add RLS policies
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active analysis
CREATE POLICY "Allow public read access to active AI analysis" ON ai_analysis_cache
    FOR SELECT USING (is_active = true);

-- Allow authenticated users to create/update analysis (for admin purposes)
CREATE POLICY "Allow authenticated users to manage AI analysis" ON ai_analysis_cache
    FOR ALL USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_ai_analysis_updated_at
    BEFORE UPDATE ON ai_analysis_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_analysis_updated_at();

-- Add comment to table
COMMENT ON TABLE ai_analysis_cache IS 'Cache for AI-generated analysis of congressional initiatives, shared across all users';
COMMENT ON COLUMN ai_analysis_cache.content_hash IS 'Hash of initiative content to detect changes and invalidate cache';
COMMENT ON COLUMN ai_analysis_cache.technical_pros_cons IS 'JSONB containing structured pros/cons analysis with sources'; 