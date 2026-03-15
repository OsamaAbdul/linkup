-- PERFORMANCE OPTIMIZATION: INDEXES AND DENORMALIZED LIKES

-- 1. Add indexes for common marketplace filters
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_inventory ON public.products (inventory);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products (price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);

-- 2. Add likes_count column to products table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='likes_count') THEN
        ALTER TABLE public.products ADD COLUMN likes_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Backfill likes_count for existing products
UPDATE public.products p
SET likes_count = (
    SELECT COUNT(*)
    FROM public.likes l
    WHERE l.product_id = p.id
);

-- 4. Create trigger to maintain likes_count automatically
CREATE OR REPLACE FUNCTION public.update_product_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.products
        SET likes_count = likes_count + 1
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.products
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_likes_count ON public.likes;

-- Attach trigger to likes table
CREATE TRIGGER trigger_update_likes_count
    AFTER INSERT OR DELETE ON public.likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_likes_count();
