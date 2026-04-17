-- ARCHITECTURAL OVERHAUL V2: RELATIONAL NORMALIZATION
-- TARGET: Split Orders monlith into specialized concerns

BEGIN;

-- 1. Create order_shipping Table (The Address System)
CREATE TABLE IF NOT EXISTS public.order_shipping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    address_line TEXT,
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enhance shipments Table (The Logistics System)
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_address_text TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_address_text TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

-- 2.1 Spatial Support for enhanced shipments
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_location_new GEOGRAPHY(POINT, 4326);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_location_new GEOGRAPHY(POINT, 4326);

-- 3. DATA MIGRATION & BACKFILL
-- 3.1 Port JSONB shipping_info to order_shipping
INSERT INTO public.order_shipping (order_id, full_name, phone, address_line, city_id, zone_id)
SELECT 
    id, 
    COALESCE(shipping_info->>'name', shipping_info->>'full_name'),
    shipping_info->>'phone',
    COALESCE(shipping_info->>'address', shipping_info->>'address_line'),
    city_id,
    zone_id
FROM public.orders
ON CONFLICT (order_id) DO NOTHING;

-- 3.2 Port Coordinates and Text addresses to shipments
UPDATE public.shipments s
SET 
    pickup_latitude = COALESCE(s.pickup_latitude, o.pickup_lat),
    pickup_longitude = COALESCE(s.pickup_longitude, o.pickup_lng),
    buyer_latitude = COALESCE(s.buyer_latitude, o.delivery_lat),
    buyer_longitude = COALESCE(s.buyer_longitude, o.delivery_lng),
    pickup_address_text = s.pickup_address,
    delivery_address_text = s.delivery_address
FROM public.orders o
WHERE s.order_id = o.id;

-- 3.3 Ensure Spatial fields are populated
UPDATE public.shipments
SET 
    pickup_location_new = ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography,
    delivery_location_new = ST_SetSRID(ST_MakePoint(buyer_longitude, buyer_latitude), 4326)::geography
WHERE pickup_latitude IS NOT NULL AND buyer_latitude IS NOT NULL;

-- 4. CLEANUP LEGACY COLUMNS
-- WARNING: DANGEROUS OPERATIONS - Proceeding as requested by architect
-- We move columns only AFTER ensuring data is migrated above.

ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_info; -- Legacy JSONB
ALTER TABLE public.orders DROP COLUMN IF EXISTS items; -- Legacy JSONB (Already moved to order_items)
ALTER TABLE public.orders DROP COLUMN IF EXISTS pickup_lat;
ALTER TABLE public.orders DROP COLUMN IF EXISTS pickup_lng;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_lat;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_lng;

-- 5. PERFORMANCE INDEXING
CREATE INDEX IF NOT EXISTS idx_order_shipping_order_id ON public.order_shipping (order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipping_city_id ON public.order_shipping (city_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id_logistics ON public.shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_location_gist ON public.shipments USING GIST (pickup_location_new, delivery_location_new);

COMMIT;
