-- Migration: Master RLS Recursion Fix
-- 20260316_fix_rls_recursion.sql
-- Resolves circular dependencies between orders and shipments RLS policies.

-- 1. FIX SHIPMENTS POLICIES
-- Break the dependency on the 'orders' table to prevent circular lookup
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" 
ON public.shipments FOR SELECT
USING (auth.uid() = rider_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
DROP POLICY IF EXISTS "Sellers can update shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can update shipments" 
ON public.shipments FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 2. FIX ORDERS POLICIES
-- A. Sellers: Can update status (no change needed but re-applying for consistency)
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;
CREATE POLICY "Sellers can update order status" 
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- B. Buyers: Safe cancellation and completion (NO subqueries)
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status::TEXT = 'completed') OR 
        (status::TEXT = 'cancelled')
    )
);

-- C. Logistics: Safe because shipments policy no longer calls orders
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
CREATE POLICY "Logistics can update order status" 
ON public.orders FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.shipments 
        WHERE shipments.order_id = orders.id 
        AND shipments.rider_id = auth.uid()
    )
);

-- 3. ENSURE ORDER ITEMS ACCESSIBILITY
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view their order items" ON public.order_items;
CREATE POLICY "Sellers can view their order items"
ON public.order_items FOR SELECT
USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can view their order items" ON public.order_items;
CREATE POLICY "Buyers can view their order items"
ON public.order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND buyer_id = auth.uid()));

-- Housekeeping
NOTIFY pgrst, 'reload schema';
