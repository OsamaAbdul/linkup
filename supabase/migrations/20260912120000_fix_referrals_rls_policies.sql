-- Migration: 20260912120000_fix_referrals_rls_policies.sql
-- Description: Add missing referral tracking columns, adjust constraints, and fix RLS policies

-- 1. Ensure required tracking columns exist on public.referrals
ALTER TABLE public.referrals 
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Allow campaign_id to be nullable for general store or direct promoter code referrals
ALTER TABLE public.referrals ALTER COLUMN campaign_id DROP NOT NULL;

-- Create indexes for efficient attribution lookups
CREATE INDEX IF NOT EXISTS idx_referrals_promoter_id ON public.referrals(promoter_id);
CREATE INDEX IF NOT EXISTS idx_referrals_visitor_id ON public.referrals(visitor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_buyer_id ON public.referrals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_order_id ON public.referrals(order_id);

-- 2. Enable Row Level Security
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 3. Allow any visitor (anon & authenticated) to insert click records
DROP POLICY IF EXISTS "Anyone can insert referral clicks" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can insert referrals" ON public.referrals;
CREATE POLICY "Anyone can insert referral clicks" 
ON public.referrals 
FOR INSERT 
TO public
WITH CHECK (true);

-- 4. Allow promoters, buyers, and admins to view their referral records
DROP POLICY IF EXISTS "Promoters and buyers can view their referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Promoters and buyers can view their referrals" 
ON public.referrals 
FOR SELECT 
TO public
USING (
  auth.uid() = promoter_id 
  OR auth.uid() = buyer_id 
  OR (order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id = referrals.order_id AND orders.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Allow admins to update referrals (Edge Functions using service_role bypass RLS)
DROP POLICY IF EXISTS "Admins can update referrals" ON public.referrals;
CREATE POLICY "Admins can update referrals" 
ON public.referrals 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
