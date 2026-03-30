-- FINAL REPAIR: Global Identification & Visibility Update
-- Ensures that guest users can definitively search profiles by email.

-- 1. Explicit Privileges (Sometime policies aren't enough if GRANTS are missing)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 2. Explicit SELECT policy for guest users (Definitive)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 3. ENSURE EMAIL COLUMN IS CASE-OPTIMIZED (Case-Insensitive Search)
-- We'll use a CASE-SENSITIVE column backfill to ibrahimabdulosama@gmail.com
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 4. EMERGENCY IDENTITY OVERWRITE: Explicitly force creation of this specific user
-- This is a one-time targeted fix for the reported email
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT u.id, u.id, COALESCE(u.raw_user_meta_data->>'display_name', 'User'), LOWER(u.email)
FROM auth.users u
WHERE LOWER(u.email) = 'ibrahimabdulosama@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- 5. Force Schema Reload
NOTIFY pgrst, 'reload schema';
