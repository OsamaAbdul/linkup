-- MASTER RECURSION FIX (Run this in Supabase SQL Editor)
-- This breaks infinite loops caused by policies checking roles.

-- 1. Create a safe role checker that BYPASSES RLS
CREATE OR REPLACE FUNCTION public.check_user_role(target_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = target_role
  );
END;
$$;

-- 2. Create a generic admin checker
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

-- 3. Reset user_roles policies to be simple and non-recursive
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin_safe());

-- 4. Apply safety to other potential recursion points
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (public.is_admin_safe());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin_safe());

-- 5. Final verification of profiles visibility
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles
FOR SELECT USING (true);
