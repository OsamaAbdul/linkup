-- FIX order_items_new RLS POLICIES FOR VISIBILITY
-- The previous policy used a subquery which is correct but we want to ensure it's fully covered.

-- 1. Ensure RLS is enabled
ALTER TABLE public.order_items_new ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing view policy if any to recreate it robustly
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;

-- 3. Create a policy for Sellers to view items they sold
CREATE POLICY "Sellers can view own sold items" ON public.order_items_new
FOR SELECT USING (auth.uid() = seller_id);

-- 4. Create a policy for Buyers to view items they bought
CREATE POLICY "Buyers can view own bought items" ON public.order_items_new
FOR SELECT USING (
    auth.uid() IN (
        SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id
    )
);

-- Note: We intentionally DO NOT add an INSERT policy for public users.
-- This ensures that orders MUST be created via the Secure Edge Function
-- which uses the Service Role Key to bypass RLS.
