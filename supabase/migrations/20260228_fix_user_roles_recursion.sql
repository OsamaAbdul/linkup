-- Migration: 20260228_fix_user_roles_recursion
-- Safely breaks the infinite recursion in user_roles RLS.

-- 1. Create a truly safe is_admin function that doesn't trigger the same policy
-- We use SECURITY DEFINER and a specific search path.
CREATE OR REPLACE FUNCTION public.is_admin_final()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We query the table directly. Since this is SECURITY DEFINER, 
  -- it runs as the owner (postgres) who bypasses RLS.
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the old recursive policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- 3. Create non-recursive policies
-- Users can always see their own roles (simple check, no function call)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can see all (uses the SECURITY DEFINER function)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_final());

-- Apply similar fix to other tables that were using is_admin_safe
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (public.is_admin_final());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin_final());
