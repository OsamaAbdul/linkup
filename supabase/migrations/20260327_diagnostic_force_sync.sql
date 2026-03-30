-- DIAGNOSTIC & FORCE SYNC: The "Final Answer" to Identity Gaps
-- This migration provides a way to see what the database sees, and forces a global sync.

-- 1. Create a Diagnostic Function
-- You can run this in the Supabase SQL Web Editor to find any user:
-- SELECT * FROM public.debug_user_identity('your-email@gmail.com');
CREATE OR REPLACE FUNCTION public.debug_user_identity(p_email TEXT)
RETURNS TABLE (
    auth_id UUID,
    auth_email TEXT,
    profile_id UUID,
    profile_user_id UUID,
    profile_email TEXT,
    has_profile BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as auth_id,
        u.email::TEXT as auth_email,
        p.id as profile_id,
        p.user_id as profile_user_id,
        p.email as profile_email,
        (p.id IS NOT NULL) as has_profile
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE LOWER(u.email) = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FORCE SYNC: The Comprehensive Hammer
-- This handles missing emails, missing profiles, and identity mismatches in one go.

-- Step A: Sync existing emails across all profiles
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- Step B: Insert missing profiles for ANY auth account
-- We use a looser constraint here to ensure NO ONE is left behind.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT u.id, u.id, 'LinkUp Member', LOWER(u.email)
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO UPDATE SET 
    email = EXCLUDED.email,
    id = EXCLUDED.id;

-- 3. FINAL RESET: Clear and Fix RLS Public Discovery
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

-- Refresh API
NOTIFY pgrst, 'reload schema';
