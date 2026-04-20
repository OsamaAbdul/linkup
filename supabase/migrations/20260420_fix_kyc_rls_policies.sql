-- MIGRATION: 20260420_fix_kyc_rls_policies.sql
-- TARGET: Grant administrators permission to manage identity verification records.
-- FIX: Uses a SECURITY DEFINER function to prevent infinite recursion in RLS.

BEGIN;

-- 1. Create a security-definer function to check admin status
-- This function bypasses RLS, avoiding the recursion trap.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure RLS is active on the KYC tables
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing restrictive policies to prevent conflicts and recursion
DROP POLICY IF EXISTS "Admins can manage seller verifications" ON public.seller_verifications;
DROP POLICY IF EXISTS "Admins can manage logistics kyc" ON public.logistics_kyc;
DROP POLICY IF EXISTS "Users can view own seller verification" ON public.seller_verifications;
DROP POLICY IF EXISTS "Users can view own logistics kyc" ON public.logistics_kyc;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;

-- 4. Create Admin Management Policies
-- Using the is_admin() function prevents recursion.
CREATE POLICY "Admins can manage seller verifications" ON public.seller_verifications
FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage logistics kyc" ON public.logistics_kyc
FOR ALL
USING (public.is_admin(auth.uid()));

-- 5. Create User Visibility Policies
CREATE POLICY "Users can view own seller verification" ON public.seller_verifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own logistics kyc" ON public.logistics_kyc
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Fix user_roles Policy (Recursive fix)
-- This allows admins to see all roles and users to see their own.
CREATE POLICY "Admins can view all user roles" ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()) OR (auth.uid() = user_id));

COMMIT;
