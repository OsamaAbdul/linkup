-- UNIVERSAL IDENTITY SYNC: CONFLICT-FREE EDITION
-- This migration fixes the "Duplicate Key" error by using a safer synchronization strategy.

-- 1. Sync all EXISTING profiles first
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 2. Insert MISSING profiles safely
-- We use a simpler INSERT that generates a new ID if needed, or preserves user_id.
-- We use the WHERE NOT EXISTS check on user_id to ensure NO duplicates are attempted.
INSERT INTO public.profiles (user_id, display_name, email)
SELECT 
    u.id, 
    COALESCE(u.raw_user_meta_data->>'display_name', 'LinkUp Member'), 
    LOWER(u.email)
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
);

-- 3. Restore Public Visibility
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 4. Refresh API Cache
NOTIFY pgrst, 'reload schema';
