-- MIGRATION: 20260303_add_product_locations.sql
-- Add city_id and zone_id to products table for better filtering and scalability.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_products_city ON public.products(city_id);
CREATE INDEX IF NOT EXISTS idx_products_zone ON public.products(zone_id);

-- Update existing products based on seller location (best effort)
DO $$
BEGIN
    UPDATE public.products p
    SET city_id = pr.city_id, zone_id = pr.zone_id
    FROM public.profiles pr
    WHERE p.seller_id = pr.id
    AND p.city_id IS NULL;
END $$;
