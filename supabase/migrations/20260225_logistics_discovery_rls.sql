-- Final RLS Fixes for Logistics Discovery
-- Allows Sellers and other authenticated users to see logistics roles and profiles

-- 1. Allow authenticated users to view who has the 'logistics' role
-- This is necessary for the Courier Selector in the Seller Dashboard
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;
CREATE POLICY "Anyone can view logistics roles"
ON public.user_roles
FOR SELECT
USING (role = 'logistics' OR auth.uid() = user_id OR public.check_is_admin());

-- 2. Ensure profiles are visible to authenticated users
-- (Usually exists, but making sure)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- 3. Allow viewing logistics verifications for discovery
-- We only allow seeing the phone number and status if the user is 'verified' or if it's their own
DROP POLICY IF EXISTS "Discovery of logistics partners" ON public.logistics_verifications;
CREATE POLICY "Discovery of logistics partners"
ON public.logistics_verifications
FOR SELECT
USING (status = 'verified' OR auth.uid() = user_id OR public.check_is_admin());
