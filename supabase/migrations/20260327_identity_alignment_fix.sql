-- DEFINITIVE FIX: Profile and User Roles Identity Alignment
-- This migration ensures profiles and user_roles are correctly linked using the Auth ID.

-- 1. Robust handle_new_user function
-- We explicitly set profiles.id to NEW.id to ensure children (like user_roles) 
-- can correctly reference it via foreign keys.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile, setting ID (PK) explicitly to Auth ID for relational consistency
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, -- Primary Key = Auth ID
    NEW.id, -- User Reference = Auth ID
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role into user_roles
  -- Since user_roles.user_id references profiles.id, and we just ensured profiles.id = NEW.id,
  -- this insertion will now succeed against the foreign key constraint.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error if needed, but in Supabase Auth Triggers, failure blocks the user creation
  RAISE EXCEPTION 'Identity sync failed: %', SQLERRM;
END;
$$;

-- 2. Re-apply trigger to be certain
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Cleanup existing mismatches if any (Defensive)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;
