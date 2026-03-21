-- MIGRATION: 20260322_get_nearby_products.sql
-- RPC to fetch products sorted by distance from a given point.

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
  likes_count BIGINT,
  city_name TEXT,
  zone_name TEXT,
  distance_meters DOUBLE PRECISION
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
    (SELECT COUNT(*) FROM public.likes l WHERE l.product_id = p.id) as likes_count,
    c.name as city_name,
    z.name as zone_name,
    (
      6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * sin(radians(p.latitude))
      )
    ) AS distance_meters
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
