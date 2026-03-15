-- MIGRATION: 20260227_mutual_live_tracking
-- Adds columns for buyer live location sharing.

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_location_last_updated TIMESTAMPTZ;

-- Update RLS: Ensure buyers can update their own shipment's location
DROP POLICY IF EXISTS "Buyers can update their live location" ON public.shipments;
CREATE POLICY "Buyers can update their live location"
ON public.shipments FOR UPDATE
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
)
WITH CHECK (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);
