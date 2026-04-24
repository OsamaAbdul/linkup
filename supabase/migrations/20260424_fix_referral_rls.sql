-- Fix RLS for Referrals to allow visibility for both promoters and buyers, and enable anonymous click tracking
-- This ensures the Promoter Dashboard can actually see the data when logged in.

-- 1. Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Promoters view their referrals" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can insert referrals" ON public.referrals;

-- 2. Create more inclusive Select policy
-- Allows promoters to see their earnings and buyers to see their referral history
CREATE POLICY "Users can view relevant referrals"
ON public.referrals FOR SELECT
USING (
    promoter_id = auth.uid() 
    OR buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Create Public Insert policy
-- Critical for tracking clicks from users who aren't logged in yet
CREATE POLICY "Enable public insert for referral tracking"
ON public.referrals FOR INSERT
WITH CHECK (true);

-- 4. Create Update policy for conversion
-- Allows the system/buyer to mark a referral as converted
CREATE POLICY "Users can update their own referrals"
ON public.referrals FOR UPDATE
USING (
    promoter_id = auth.uid() 
    OR buyer_id = auth.uid()
)
WITH CHECK (true);

-- 5. Ensure RLS is enabled
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 6. Grant access to authenticated and anon users
GRANT ALL ON public.referrals TO authenticated;
GRANT INSERT ON public.referrals TO anon;
GRANT SELECT ON public.referrals TO anon;
