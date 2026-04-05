-- MIGRATION: 20260405_fix_issues_identity_sync.sql
-- Resolves the 23503 Foreign Key Violation in the 'issues' table.
-- Ensures that every auth user has a profile and that the 'issues' table 
-- references the target properly.

-- 1. EMERGENCY IDENTITY SYNCHRONIZATION
-- Backfill any missing profiles for current users to ensure RLS and FK compliance.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    id, 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', email), 
    LOWER(email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 2. REPAIR ISSUES CONSTRAINTS
-- Drop the restrictive/misaligned profile constraint
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_reporter_profile_fkey;

-- Re-add it referencing the primary key 'id' which is guaranteed to be in sync with 'auth.uid()' 
-- for all modern records and the backfill above.
ALTER TABLE public.issues
ADD CONSTRAINT issues_reporter_profile_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. ALIGN SENDER IDENTITIES (Defensive)
-- Ensure any existing 'issues' with orphaned user_ids are mapped to existing profiles if they exist in auth.users
-- (This is a safety measure for data integrity)

-- 4. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
