
-- MIGRATION: 20260413_fix_referral_schema.sql
-- Fixes schema mismatch for the create-order Edge Function.

-- 1. Add buyer_id to referrals for logged-in tracking
ALTER TABLE public.referrals 
ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Make campaign_id nullable
-- Some promoter links might be generic (e.g., to the homepage) and not tied to a specific product campaign.
ALTER TABLE public.referrals 
ALTER COLUMN campaign_id DROP NOT NULL;

-- 3. Add indices for faster lookup during checkout
CREATE INDEX IF NOT EXISTS idx_referrals_buyer_id ON public.referrals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_visitor_id ON public.referrals(visitor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_promoter_id ON public.referrals(promoter_id);

-- 4. RLS Policy for click tracking
CREATE POLICY "Anyone can log a referral click" 
ON public.referrals FOR INSERT 
WITH CHECK (true);
