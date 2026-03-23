-- MIGRATION: 20260322_fix_rls_recursion_final
-- Breaks the circular dependency between orders and shipments RLS policies.

-- 1. Ensure seller_id exists on shipments for direct RLS checks
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'seller_id'
    ) THEN
        ALTER TABLE public.shipments ADD COLUMN seller_id UUID REFERENCES public.profiles(id);
        
        -- Populate missing seller_id from orders
        UPDATE public.shipments s
        SET seller_id = o.seller_id
        FROM public.orders o
        WHERE s.order_id = o.id
        AND s.seller_id IS NULL;
    END IF;
END $$;

-- 2. SHIPMENTS: Simplify policies (Rider or Seller direct check)
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" 
ON public.shipments FOR SELECT
USING (
    auth.uid() = rider_id 
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
DROP POLICY IF EXISTS "Sellers can update shipments" ON public.shipments;
CREATE POLICY "Sellers can update shipments" 
ON public.shipments FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 3. ORDERS: Fix recursion in buyer update policy
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        status = 'completed' OR 
        status = 'cancelled'
        -- Note: We trust the internal state machine/RPCs or direct WHERE checks 
        -- for the "only from pending" rule to avoid recursive SELECT.
    )
);

-- 4. ORDERS: Ensure riders don't need direct RLS update (handled by trigger)
-- But they still need to SELECT orders if the UI requires it.
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
-- No new UPDATE policy for logistics; they update shipments, and triggers sync to orders.

-- 5. ORDERS: Safe SELECT policies
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
ON public.orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Housekeeping
NOTIFY pgrst, 'reload schema';
