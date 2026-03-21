-- migration: 20260317_add_new_zones.sql
-- This migration adds new delivery zones to both the legacy enum and the modern table.

-- 1. Update Legacy Enum
-- Note: PostgreSQL requires this to be run outside of a transaction if adding multiple values to an enum.
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Gwarinpa';
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Wuse';
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Apo';

-- 2. Update Modern delivery_zones Table
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    -- Ensure Abuja exists in the cities table
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    
    -- Insert the new zone(s)
    INSERT INTO public.delivery_zones (city_id, name, delivery_fee)
    VALUES 
    (v_city_id, 'Gwarinpa', 1500),
    (v_city_id, 'Wuse', 1500),
    (v_city_id, 'Apo', 1500)
    ON CONFLICT (city_id, name) DO NOTHING;
END $$;
