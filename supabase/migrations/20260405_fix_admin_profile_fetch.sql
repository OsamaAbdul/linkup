
-- FIX ADMIN PROFILE FETCHING & RELATIONSHIPS
-- This migration repairs the link between profiles and user_roles for proper API joins.

-- 1. Repair Foreign Key Relationship
-- Drop the generic auth.users reference and point it directly to public.profiles(id)
-- This allows PostgREST to perform 'embed' joins between profiles and user_roles.
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Ensure RLS Policy for Admins
-- This allows anyone with the 'admin' role to view ALL user profiles.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- 3. Reload PostgREST schema cache for instant API updates
NOTIFY pgrst, 'reload schema';
