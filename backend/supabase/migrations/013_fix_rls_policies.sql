-- Migration: Fix RLS policies for congress_initiative_parties table
-- This migration updates the RLS policies to allow proper insertions and updates

-- First, let's drop the existing restrictive policy
DROP POLICY IF EXISTS "Congress initiative parties are viewable by everyone" ON public.congress_initiative_parties;

-- Create a comprehensive policy that allows all operations for authenticated users
-- This is appropriate for a public dataset like Congress initiatives
CREATE POLICY "Congress initiative parties full access" ON public.congress_initiative_parties
    FOR ALL USING (true) WITH CHECK (true);

-- Alternative: If you want more restrictive policies, you can use these instead:
-- CREATE POLICY "Congress initiative parties select" ON public.congress_initiative_parties
--     FOR SELECT USING (true);
-- 
-- CREATE POLICY "Congress initiative parties insert" ON public.congress_initiative_parties
--     FOR INSERT WITH CHECK (true);
-- 
-- CREATE POLICY "Congress initiative parties update" ON public.congress_initiative_parties
--     FOR UPDATE USING (true) WITH CHECK (true);
-- 
-- CREATE POLICY "Congress initiative parties delete" ON public.congress_initiative_parties
--     FOR DELETE USING (true);

-- Also, let's ensure the political_parties table has proper RLS policies
-- Check if the policy exists and update it if needed
DROP POLICY IF EXISTS "Political parties are viewable by everyone" ON public.political_parties;

CREATE POLICY "Political parties full access" ON public.political_parties
    FOR ALL USING (true) WITH CHECK (true);

-- Update the comment to reflect the new policy
COMMENT ON TABLE public.congress_initiative_parties IS 
'Junction table linking Congress initiatives with political parties and their positions.
RLS policies allow full access for data management operations.';

-- Verify the policies are in place
-- You can check this in Supabase with:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename IN ('congress_initiative_parties', 'political_parties'); 