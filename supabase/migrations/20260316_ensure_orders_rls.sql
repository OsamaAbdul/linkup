-- Migration: Ensure Order Update RLS Policies
-- 20260316_ensure_orders_rls.sql
-- Restores missing UPDATE policies to allow sellers to accept orders and buyers to manage them.

-- 1. Enable RLS (just in case)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Sellers: Can update status to confirm, process, or broadcast
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;
CREATE POLICY "Sellers can update order status" 
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 3. Buyers: Can update status to completed (via confirmed receipt) or cancel if pending
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status::TEXT = 'completed') OR -- Allowed via complete_order RPC or direct update
        (status::TEXT = 'cancelled' AND (SELECT status FROM public.orders WHERE id = orders.id)::TEXT = 'pending')
    )
);

-- 4. Admins: Full control
DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
ON public.orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 5. SHIPMENTS: Ensure sellers can also update shipments related to their orders
DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
CREATE POLICY "Sellers can update related shipments"
ON public.shipments FOR UPDATE
USING (
    seller_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.orders WHERE id = shipments.order_id AND seller_id = auth.uid())
);

-- Housekeeping: Reload PostgREST
NOTIFY pgrst, 'reload schema';
