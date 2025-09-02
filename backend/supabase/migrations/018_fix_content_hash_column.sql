-- Migration: Fix content_hash column for URL-safe hashes
-- This migration updates the content_hash column to handle the new hash format

-- Update the content_hash column to be larger and handle hex strings
ALTER TABLE ai_analysis_cache 
ALTER COLUMN content_hash TYPE VARCHAR(32);

-- Add a comment explaining the new hash format
COMMENT ON COLUMN ai_analysis_cache.content_hash IS 'URL-safe hex hash (16 characters) generated from initiative content to detect changes and invalidate cache';

-- Drop the old unique constraint that might be causing issues
ALTER TABLE ai_analysis_cache DROP CONSTRAINT IF EXISTS ai_analysis_cache_initiative_id_content_hash_key;

-- Recreate the unique constraint with the new hash format
ALTER TABLE ai_analysis_cache 
ADD CONSTRAINT ai_analysis_cache_initiative_id_content_hash_key 
UNIQUE (initiative_id, content_hash); 