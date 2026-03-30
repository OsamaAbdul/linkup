-- MIGRATION: 20260327_add_shipment_pickup_coords
-- Adds precise pickup coordinates to shipments for rider navigation.

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC;

COMMENT ON COLUMN public.shipments.pickup_latitude IS 'Precise latitude of the product pickup point (set by seller during broadcast)';
COMMENT ON COLUMN public.shipments.pickup_longitude IS 'Precise longitude of the product pickup point (set by seller during broadcast)';
