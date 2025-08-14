-- Fix RLS policies for Congress tables
-- Run this in your Supabase SQL Editor

-- First, temporarily disable RLS to allow data insertion
ALTER TABLE public.congress_initiatives DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_timeline_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_relationships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_keywords DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.congress_initiative_keywords DISABLE ROW LEVEL SECURITY;

-- Alternative: Create policies that allow inserts from authenticated users
-- Uncomment these if you want to keep RLS enabled but allow inserts

/*
-- Allow inserts for authenticated users
CREATE POLICY "Allow inserts for authenticated users" ON public.congress_initiatives
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow inserts for authenticated users" ON public.congress_timeline_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow inserts for authenticated users" ON public.congress_relationships
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow inserts for authenticated users" ON public.congress_keywords
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow inserts for authenticated users" ON public.congress_initiative_keywords
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow updates for authenticated users
CREATE POLICY "Allow updates for authenticated users" ON public.congress_initiatives
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow updates for authenticated users" ON public.congress_timeline_events
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow updates for authenticated users" ON public.congress_relationships
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow updates for authenticated users" ON public.congress_keywords
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow updates for authenticated users" ON public.congress_initiative_keywords
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow deletes for authenticated users
CREATE POLICY "Allow deletes for authenticated users" ON public.congress_initiatives
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow deletes for authenticated users" ON public.congress_timeline_events
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow deletes for authenticated users" ON public.congress_relationships
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow deletes for authenticated users" ON public.congress_keywords
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow deletes for authenticated users" ON public.congress_initiative_keywords
    FOR DELETE USING (auth.role() = 'authenticated');
*/ 