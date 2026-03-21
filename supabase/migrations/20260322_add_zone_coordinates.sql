-- MIGRATION: 20260322_add_zone_coordinates.sql
-- Add latitude and longitude to delivery_zones for automatic proximity matching.

ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Seed coordinates for initial Abuja zones
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    
    IF v_city_id IS NOT NULL THEN
        UPDATE public.delivery_zones SET latitude = 9.0967, longitude = 7.3732 WHERE city_id = v_city_id AND name = 'Zone 1 (Gwarinpa & Life Camp)';
        UPDATE public.delivery_zones SET latitude = 9.0600, longitude = 7.4700 WHERE city_id = v_city_id AND name = 'Zone 2 (Wuse & Utako)';
        UPDATE public.delivery_zones SET latitude = 9.1550, longitude = 7.3330 WHERE city_id = v_city_id AND name = 'Zone 3 (Kubwa Central)';
        UPDATE public.delivery_zones SET latitude = 8.9800, longitude = 7.3800 WHERE city_id = v_city_id AND name = 'Zone 4 (Lugbe & Apo)';
        UPDATE public.delivery_zones SET latitude = 8.9400, longitude = 7.0800 WHERE city_id = v_city_id AND name = 'Zone 5 (Gwagwalada Districts)';
    END IF;
END $$;
