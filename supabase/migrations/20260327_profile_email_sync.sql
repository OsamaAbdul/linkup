-- Migration to add email to profiles and handle registration checks
-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update existing profiles with emails from auth.users
-- This requires a JOIN with auth.users which public schema can do if permitted, 
-- or we can use a loop/update. Note: In Supabase, public can read auth.users if granted, 
-- but usually it's cleaner to sync on creation.
DO $$ 
BEGIN 
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.user_id = u.id AND p.email IS NULL;
END $$;

-- 3. Update handle_new_user trigger to sync email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

-- 4. Ensure everyone can SELECT profiles (already exists, but just in case)
-- This allows checking if an email exists before sending reset link.
-- IMPORTANT: We should add an index for performance.
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
