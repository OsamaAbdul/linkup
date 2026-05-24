-- Migration: 20260524_marketplace_loading_performance.sql
-- Optimizes the products loading speed, indexing, and RPC efficiency.

-- 1. Drop existing get_nearby_products function to change signature (returns table structure)
DROP FUNCTION IF EXISTS public.get_nearby_products(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  NUMERIC,
  NUMERIC,
  TEXT,
  INTEGER,
  INTEGER
);

-- 2. Re-create get_nearby_products RPC with avg_rating and reviews_count, using the denormalized likes_count column
CREATE OR REPLACE FUNCTION public.get_nearby_products(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  images TEXT[],
  category TEXT,
  inventory INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  likes_count INTEGER,
  city_name TEXT,
  zone_name TEXT,
  distance_meters DOUBLE PRECISION,
  avg_rating NUMERIC,
  reviews_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.seller_id,
    p.title,
    p.description,
    p.price,
    p.images,
    p.category,
    p.inventory,
    p.latitude,
    p.longitude,
    COALESCE(p.likes_count, 0) as likes_count,
    c.name as city_name,
    z.name as zone_name,
    (
      6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * sin(radians(p.latitude))
      )
    ) AS distance_meters,
    COALESCE(p.avg_rating, 0) as avg_rating,
    COALESCE(p.reviews_count, 0) as reviews_count
  FROM 
    public.products p
  LEFT JOIN 
    public.cities c ON p.city_id = c.id
  LEFT JOIN 
    public.delivery_zones z ON p.zone_id = z.id
  WHERE 
    p.inventory > 0
    AND (p_category IS NULL OR p_category = 'All Products' OR p.category = p_category)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (
      p_search IS NULL OR 
      p.title ILIKE '%' || p_search || '%' OR 
      p.description ILIKE '%' || p_search || '%'
    )
    AND p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
  ORDER BY 
    distance_meters ASC
  LIMIT p_limit 
  OFFSET p_offset;
END;
$$;

-- 3. Add performance index on zone_id for regional filtering
CREATE INDEX IF NOT EXISTS idx_products_zone_id ON public.products (zone_id);
