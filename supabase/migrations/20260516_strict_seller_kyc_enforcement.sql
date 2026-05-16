-- 1. Drop existing permissive and overlapping insert policies
DROP POLICY IF EXISTS "Seller insert product" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert products" ON public.products;
DROP POLICY IF EXISTS "Seller insert products" ON public.products;

-- 2. Create the strict, KYC-enforced policy
CREATE POLICY "Seller insert product" ON public.products 
FOR INSERT WITH CHECK (
    auth.uid() = seller_id 
    AND EXISTS (
        SELECT 1 FROM public.seller_verifications 
        WHERE user_id = auth.uid() AND status = 'verified'
    )
);
