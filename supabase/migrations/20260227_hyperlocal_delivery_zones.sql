-- MIGRATION: 20260227_hyperlocal_delivery_zones
-- This migration adds zone support to profiles and shipments, and updates RLS for riders.

-- 1. Add zone to profiles (for riders)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone;

-- 2. Add zone and seller_id to shipments
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);

-- 3. Add shipment_id to order_items_new to track which items are in which delivery
ALTER TABLE public.order_items_new
ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL;

-- 4. Make seller_id in orders nullable to support multi-merchant orders
ALTER TABLE public.orders ALTER COLUMN seller_id DROP NOT NULL;

-- 5. Update RLS for Shipments
-- Riders should only see and update shipments in their assigned zone.
DROP POLICY IF EXISTS "Admins and Logistics can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

-- Logistics users (riders) can view all shipments in their zone
CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'logistics'
    AND p.zone = shipments.zone
  ) OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Riders can update shipments assigned to them
CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (rider_id = auth.uid());

-- Ensure buyers and sellers can still see relevant shipments
DROP POLICY IF EXISTS "Buyers can view shipments for their orders" ON public.shipments;
CREATE POLICY "Buyers can view shipments for their orders"
ON public.shipments FOR SELECT
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

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
