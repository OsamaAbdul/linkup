-- Restores rider (logistics agent) visibility for orders and shipments.
-- Some recent hardening migrations inadvertently removed these SELECT policies.

-- 1. Orders: Allow riders to see assigned orders and broadcast pool orders
DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
CREATE POLICY "Riders can view assigned orders" ON public.orders
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.shipments
        WHERE shipments.order_id = orders.id
        AND (
            shipments.rider_id = auth.uid() OR
            shipments.status = 'broadcast'
        )
    )
    OR auth.uid() = seller_id -- Already allowed but added for clarity
);

-- 2. Shipments: Ensure riders can view their own AND broadcast shipments
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
    auth.uid() = rider_id OR 
    auth.uid() = seller_id OR
    (status = 'broadcast' AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'logistics') OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    ))
);

-- Note: No new update policies needed yet as riders already have 
-- 'Riders can update own shipments' in 20260224_orders_rls_and_realtime.sql
