-- FINAL FIX: Public Profile Visibility & Email Recovery
-- This migration ensures that guest users can check for a profile by email 
-- during the "Forgot Password" flow.

-- 1. Ensure public visibility for profiles (SELECT only)
-- Drop existing select policies to avoid ambiguity
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create the definitive visibility policy
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 2. Ensure RLS is enabled but the policy allows the check
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. CASE-INSENSITIVE BACKFILL: Align ibrahimabdulosama@gmail.com and all others
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. EMERGENCY IDENTITY SYNC: Create profile if STILL missing
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    id, 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', email), 
    LOWER(email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
