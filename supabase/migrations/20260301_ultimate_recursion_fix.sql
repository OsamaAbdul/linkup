-- 20260301_ultimate_recursion_fix.sql
-- This migration provides a truly non-recursive way to check roles.

-- 1. Create the base check_user_role function with SECURITY DEFINER
-- This function runs as the owner (postgres) and thus bypasses RLS
-- We must make sure it doesn't call any other recursive functions.
CREATE OR REPLACE FUNCTION public.check_user_role(target_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id
    AND role = target_role
  );
END;
$$;

-- Ensure the function is owned by postgres to guarantee RLS bypass
ALTER FUNCTION public.check_user_role(public.app_role) OWNER TO postgres;

-- 2. Create a generic admin checker which is just a wrapper
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.check_user_role('admin');
END;
$$;

ALTER FUNCTION public.is_admin_safe() OWNER TO postgres;

-- 3. Reset user_roles policies to be dead simple
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin_safe());

-- 4. Apply this to profiles to ensure they are always visible to the user and admins
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

-- Users can update their own profile without recursion
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 5. Force refresh of the cache/session by touching a non-critical policy
-- This is just a hint for Supabase
COMMENT ON FUNCTION public.check_user_role IS 'Ultimate non-recursive role check - 20260301';
