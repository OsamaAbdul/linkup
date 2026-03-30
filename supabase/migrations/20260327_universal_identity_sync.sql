-- UNIVERSAL IDENTITY ALIGNMENT: Full Account Synchronizer
-- This migration fixes the "Email Not Recognized" issue for ALL users once and for all.

-- 1. Sync All Schemas & Permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 2. UNIVERSAL BACKFILL: Fix EVERY missing profile
-- This ensures that EVERY user in auth.users has a matching profile record.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    u.id, 
    u.id, 
    COALESCE(u.raw_user_meta_data->>'display_name', 'User'), 
    LOWER(u.email)
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO UPDATE SET 
    id = EXCLUDED.id,
    email = EXCLUDED.email;

-- 3. CASE-INSENSITIVE EMAIL SYNC: Correct ALL existing emails
-- This ensures the .eq("email", email.toLowerCase()) check works for EVERYONE.
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. PERMANENT TRIGGER FIX: Ensure this never happens again
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    LOWER(NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Ensure default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 5. Final API Refresh
NOTIFY pgrst, 'reload schema';
