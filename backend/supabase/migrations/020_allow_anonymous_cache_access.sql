-- Migration: Allow anonymous access to ai_analysis_cache table
-- This is a temporary fix to allow caching to work without authentication
-- Later, we can implement proper user authentication

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read active cache" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to insert cache" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to update cache" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow authenticated users to delete cache" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Allow public read access to active cache" ON ai_analysis_cache;

-- Disable RLS temporarily to allow all operations
ALTER TABLE ai_analysis_cache DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to anon and authenticated users
GRANT ALL ON ai_analysis_cache TO anon;
GRANT ALL ON ai_analysis_cache TO authenticated;

-- Add a comment explaining this is temporary
COMMENT ON TABLE ai_analysis_cache IS 'Temporary: RLS disabled to allow anonymous caching. Will be re-enabled with proper authentication later.'; 