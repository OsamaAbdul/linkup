-- Fix RLS for user_roles to allow Admins to see all roles
-- This ensures the Admin User Management page can correctly display badges for Sellers, Logistics, etc.

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);
