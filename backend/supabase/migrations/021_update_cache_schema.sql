-- Migration: Update AI Analysis Cache Schema
-- This migration ensures the table structure matches what the application expects

-- First, let's check if we need to update the content_hash column
DO $$
BEGIN
    -- Check if content_hash column exists and has the right type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_analysis_cache' 
        AND column_name = 'content_hash'
    ) THEN
        -- Update content_hash to handle hex strings (up to 32 characters)
        ALTER TABLE ai_analysis_cache 
        ALTER COLUMN content_hash TYPE VARCHAR(32);
        
        RAISE NOTICE 'Updated content_hash column to VARCHAR(32)';
    ELSE
        RAISE NOTICE 'content_hash column does not exist';
    END IF;
    
    -- Check if model_used column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_analysis_cache' 
        AND column_name = 'model_used'
    ) THEN
        -- Add model_used column if it doesn't exist
        ALTER TABLE ai_analysis_cache 
        ADD COLUMN model_used TEXT DEFAULT 'gpt-3.5-turbo';
        
        RAISE NOTICE 'Added model_used column';
    ELSE
        RAISE NOTICE 'model_used column already exists';
    END IF;
    
    -- Check if unique constraint exists and is correct
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'ai_analysis_cache' 
        AND constraint_name = 'ai_analysis_cache_initiative_id_content_hash_key'
    ) THEN
        RAISE NOTICE 'Unique constraint already exists';
    ELSE
        -- Add unique constraint if it doesn't exist
        ALTER TABLE ai_analysis_cache 
        ADD CONSTRAINT ai_analysis_cache_initiative_id_content_hash_key 
        UNIQUE (initiative_id, content_hash);
        
        RAISE NOTICE 'Added unique constraint';
    END IF;
    
END $$;

-- Ensure RLS is disabled for now (temporary fix)
ALTER TABLE ai_analysis_cache DISABLE ROW LEVEL SECURITY;

-- Grant all permissions
GRANT ALL ON ai_analysis_cache TO anon;
GRANT ALL ON ai_analysis_cache TO authenticated;

-- Add comment explaining the current state
COMMENT ON TABLE ai_analysis_cache IS 'Cache for AI-generated analysis - RLS temporarily disabled for development'; 