-- Migration to fix relationship between issues and profiles
-- This allows joining issues on user_id to profiles to get display_name

ALTER TABLE public.issues
ADD CONSTRAINT issues_reporter_profile_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
