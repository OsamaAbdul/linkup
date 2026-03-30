-- DEFINITIVE IDENTITY RECOVERY: Case-Insensitive Alignment & Public Visibility
-- This migration ensures that the identity check is foolproof and visible to all.

-- 1. Ensure Schema Visibility
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Explicit Column Privileges (Just in case table-level is blocked)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 3. Definitive Case-Insensitive Backfill
-- We lowercase everything globally to ensure the .toLowerCase() check in React matches.
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 4. Target the specific user ibrahimabdulosama@gmail.com
-- This ensures that even if the trigger failed previously, the profile is now active and visible.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT u.id, u.id, COALESCE(u.raw_user_meta_data->>'display_name', 'User'), LOWER(u.email)
FROM auth.users u
WHERE LOWER(u.email) = 'ibrahimabdulosama@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- 5. Public Discovery Policy (Re-Verified)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 6. Reload the API Cache
NOTIFY pgrst, 'reload schema';
