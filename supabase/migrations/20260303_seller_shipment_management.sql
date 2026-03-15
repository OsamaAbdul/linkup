-- MIGRATION: 20260303_seller_shipment_management
-- This migration allows sellers to create and manage shipments for their orders.

-- 1. Allow Sellers to INSERT shipments for their orders
CREATE POLICY "Sellers can create shipments for their orders"
ON public.shipments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = shipments.order_id 
    AND seller_id = auth.uid()
  ) OR
  seller_id = auth.uid()
);

-- 2. Allow Sellers to UPDATE shipments for their orders
-- (e.g., to assign a rider or update status)
CREATE POLICY "Sellers can update shipments for their orders"
ON public.shipments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = shipments.order_id 
    AND seller_id = auth.uid()
  ) OR
  seller_id = auth.uid()
);

-- 3. Ensure Sellers can view their own shipments (redundant but safe)
DROP POLICY IF EXISTS "Sellers can view shipments for their products" ON public.shipments;
CREATE POLICY "Sellers can view shipments for their products"
ON public.shipments FOR SELECT
USING (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.order_items_new oi
    WHERE oi.order_id = shipments.order_id 
    AND oi.seller_id = auth.uid()
  )
);
