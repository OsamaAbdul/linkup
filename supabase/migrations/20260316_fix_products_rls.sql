-- Fix Product RLS Violation (v3 - Direct Query for maximum reliability)
-- Relax the insert policy to allow any user with the 'seller' role to list products.
-- This version uses a direct EXISTS check on user_roles to avoid dependency on custom functions.

DROP POLICY IF EXISTS "Seller insert product" ON public.products;

CREATE POLICY "Seller insert product" ON public.products 
FOR INSERT WITH CHECK (
    auth.uid() = seller_id 
    AND (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'seller'::public.app_role
        )
        OR EXISTS (
            SELECT 1 FROM public.seller_verifications 
            WHERE user_id = auth.uid() AND status = 'verified'
        )
    )
);

-- Ensure other policies remains robust
DROP POLICY IF EXISTS "Seller update product" ON public.products;
CREATE POLICY "Seller update product" ON public.products 
FOR UPDATE USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Seller delete product" ON public.products;
CREATE POLICY "Seller delete product" ON public.products 
FOR DELETE USING (auth.uid() = seller_id);
