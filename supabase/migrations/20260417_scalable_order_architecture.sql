-- PHASE 4: SCALABLE ARCHITECTURE PIVOT
-- TARGET: Decouple Transaction (Orders), Recipient (Address/Contact), and Logistics (Shipments)

BEGIN;

-- 1. Evolve order_shipping into order_recipient
ALTER TABLE IF EXISTS public.order_shipping RENAME TO order_recipient;

-- 2. Enhance order_recipient with spatial coordinates
ALTER TABLE public.order_recipient ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.order_recipient ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 3. Standardize shipments table for high-performance logistics
-- Rename existing columns to standard concise format
ALTER TABLE public.shipments RENAME COLUMN pickup_latitude TO pickup_lat;
ALTER TABLE public.shipments RENAME COLUMN pickup_longitude TO pickup_lng;
ALTER TABLE public.shipments RENAME COLUMN buyer_latitude TO delivery_lat;
ALTER TABLE public.shipments RENAME COLUMN buyer_longitude TO delivery_lng;

-- Add logistics audit timestamps
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 4. Sync Recipient coordinates from Shipments (Backfill)
-- If we have drop-off coordinates in shipments, move them to the recipient record as well
UPDATE public.order_recipient r
SET 
    lat = s.delivery_lat,
    lng = s.delivery_lng
FROM public.shipments s
WHERE r.order_id = s.order_id AND r.lat IS NULL;

-- 5. FINAL ENSURANCE: Strip any logistics artifacts from orders
-- (Already handled in previous turn, but safety guard)
ALTER TABLE public.orders DROP COLUMN IF EXISTS zone_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS broadcast_zone;
ALTER TABLE public.orders DROP COLUMN IF EXISTS city_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS distance_km;

COMMIT;
