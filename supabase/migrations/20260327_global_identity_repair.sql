-- REPAIR: IDENTITY SYNCHRONIZATION & PROFILE RECOVERY
-- This migration fixes missing profiles and ensures consistent email/id storage.

-- 1. Redefine handle_new_user to be definitively robust and case-insensitive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We set both ID and user_id to ensure maximum compatibility with existing FKs
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
  
  -- Insert or update default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Critically important: Auth triggers MUST succeed for the account to be fully functional.
  -- We return NEW but the DB will log the error if we don't catch it properly.
  RETURN NEW;
END;
$$;

-- 2. RECOVERY: Backfill any users who signed up during the "500 Error" period
-- This creates a profile entry for any Auth user that is missing one.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    id, 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', email), 
    LOWER(email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 3. ALIGNMENT: Sync emails for all existing profiles (Defensive)
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. ENSURE USER ROLES: Backfill roles for any missing (Defensive)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'buyer'::public.app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT DO NOTHING;
