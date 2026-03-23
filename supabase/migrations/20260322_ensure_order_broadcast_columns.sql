-- MIGRATION: 20260322_ensure_order_broadcast_columns
-- Ensures the orders table has the necessary columns for broadcasting.

DO $$ 
BEGIN
    -- 1. broadcast_zone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'broadcast_zone'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN broadcast_zone TEXT;
    END IF;

    -- 2. city_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'city_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;

    -- 3. zone_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'zone_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;
END $$;
