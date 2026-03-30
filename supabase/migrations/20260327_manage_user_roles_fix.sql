-- FIX: manage_user_roles FK Violation
-- This migration restores the correct foreign key for user_roles to ensure 
-- that the Auth ID (user_id) can be used consistently across the app.

-- 1. Redefine user_roles.user_id FK to point to auth.users(id) instead of profiles(id)
-- This ensures that p_user_id sent via RPC always matches the Auth ID.
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. Update handle_new_user to be slightly more robust (Defensive)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update profile. We keep id synchronized with NEW.id for consistency.
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role into user_roles
  -- Now uses the NEW.id pointing to auth.users, which we just ensured is the FK target.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Signup identity sync failed: %', SQLERRM;
END;
$$;
