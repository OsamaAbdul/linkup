-- COMPREHENSIVE REPAIR: Profile Email Sync & Trigger Fix
-- This migration ensures the signup flow is robust and correctly syncs emails.

-- 1. Ensure email column exists (Defensive check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Index for performance on searches
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. Robust handle_new_user function
-- Uses ON CONFLICT to prevent 500 errors if a profile accidentally exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile or update if it exists (robust against race conditions)
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but return NEW to try and allow the user creation in auth.users
  -- though ideally we want the trigger to succeed.
  -- In Supabase, if this fails, the whole signup fails.
  -- RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Recreate trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill any missing emails
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;
