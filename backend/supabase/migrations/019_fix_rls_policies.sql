-- Migration: Fix RLS policies for ai_analysis_cache table
-- This migration ensures authenticated users can read and write to the cache table

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to active AI analysis" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to insert AI analysis" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to update AI analysis" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to delete AI analysis" ON ai_analysis_cache;

-- Enable RLS on the table
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to read active cache entries
CREATE POLICY "Allow authenticated users to read active cache" ON ai_analysis_cache
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Policy 2: Allow authenticated users to insert new cache entries
CREATE POLICY "Allow authenticated users to insert cache" ON ai_analysis_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy 3: Allow authenticated users to update cache entries
CREATE POLICY "Allow authenticated users to update cache" ON ai_analysis_cache
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 4: Allow authenticated users to delete cache entries
CREATE POLICY "Allow authenticated users to delete cache" ON ai_analysis_cache
    FOR DELETE
    TO authenticated
    USING (true);

-- Also allow public read access for now (can be restricted later if needed)
CREATE POLICY "Allow public read access to active cache" ON ai_analysis_cache
    FOR SELECT
    TO anon
    USING (is_active = true);

-- Grant necessary permissions
GRANT ALL ON ai_analysis_cache TO authenticated;
GRANT SELECT ON ai_analysis_cache TO anon; 