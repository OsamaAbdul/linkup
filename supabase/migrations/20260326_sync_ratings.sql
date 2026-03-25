-- Synchronize existing products with their reviews
UPDATE public.products p
SET 
  avg_rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 1) 
    FROM public.product_reviews 
    WHERE product_id = p.id
  ), 0),
  reviews_count = (
    SELECT COUNT(*) 
    FROM public.product_reviews 
    WHERE product_id = p.id
  );
