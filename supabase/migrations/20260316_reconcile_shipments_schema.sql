-- Migration: Reconcile Shipments Schema
-- Adds missing columns required by the frontend and architectural refinements.

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS rider_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS rider_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Ensure tracking_code is TEXT if it wasn't already (usually is, but for safety)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='tracking_code') THEN
        ALTER TABLE public.shipments ADD COLUMN tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12);
    END IF;
END $$;

-- Convert address columns if they are still JSONB (from old migrations)
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='shipments' AND column_name='pickup_address') = 'jsonb' 
    THEN
        ALTER TABLE public.shipments ALTER COLUMN pickup_address TYPE TEXT USING pickup_address::TEXT;
    END IF;

    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='shipments' AND column_name='delivery_address') = 'jsonb' 
    THEN
        ALTER TABLE public.shipments ALTER COLUMN delivery_address TYPE TEXT USING delivery_address::TEXT;
    END IF;
END $$;

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';
