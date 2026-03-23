-- MIGRATION: 20260322_ensure_shipment_broadcast_columns
-- Ensures the shipments table has the necessary columns for broadcasting.

DO $$ 
BEGIN
    -- 1. pickup_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'pickup_time') THEN
        ALTER TABLE public.shipments ADD COLUMN pickup_time TIMESTAMPTZ;
    END IF;

    -- 2. zone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone') THEN
        ALTER TABLE public.shipments ADD COLUMN zone TEXT;
    END IF;

    -- 3. zone_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone_id') THEN
        ALTER TABLE public.shipments ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;

    -- 4. city_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'city_id') THEN
        ALTER TABLE public.shipments ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;
END $$;
