-- MIGRATION: 20260303_restore_logistics_discovery
-- Restores the ability for authenticated users to find logistics agents.
-- This was accidentally removed in a previous recursion fix.

DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;
CREATE POLICY "Anyone can view logistics roles"
ON public.user_roles FOR SELECT
USING (role = 'logistics');

-- Also ensure logistics verifications are discoverable if they are verified
DROP POLICY IF EXISTS "Discovery of logistics partners" ON public.logistics_verifications;
CREATE POLICY "Discovery of logistics partners"
ON public.logistics_verifications FOR SELECT
USING (status = 'verified');
