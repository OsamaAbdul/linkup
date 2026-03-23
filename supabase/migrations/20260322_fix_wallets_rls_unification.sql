-- Migration: Unify Wallets RLS
-- This migration ensures that all users (riders, promoters, sellers) can access their own wallets
-- by checking both user_id and seller_id columns.

-- 1. DROP OLD RESTRICTIVE POLICIES
DROP POLICY IF EXISTS "Sellers can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Sellers can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallet" ON public.wallets;

-- 2. CREATE NEW UNIFIED POLICIES
-- Allow users to see their own wallet
CREATE POLICY "Users can view own wallet"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- Allow users to create their own wallet (ensures existence on first access)
CREATE POLICY "Users can insert own wallet"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);

-- Allow users to update their own wallet metadata (though balance is managed by triggers)
CREATE POLICY "Users can update own wallet"
ON public.wallets FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';
