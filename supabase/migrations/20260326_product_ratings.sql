
-- Migration: 20260326_product_ratings.sql
-- Implements user-driven product ratings and reviews.

-- Ensure updated_at handle exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create product_reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- Ensure foreign key points to profiles (for PostgREST joins)
DO $$ 
BEGIN
    -- Drop old constraint if it exists (it might point to auth.users)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_reviews_user_id_fkey') THEN
        ALTER TABLE public.product_reviews DROP CONSTRAINT product_reviews_user_id_fkey;
    END IF;
    
    -- Add the correct one pointing to public.profiles
    ALTER TABLE public.product_reviews 
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END $$;

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view product reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view product reviews" ON public.product_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.product_reviews;
CREATE POLICY "Users can insert own reviews" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.product_reviews;
CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.product_reviews;
CREATE POLICY "Users can delete own reviews" ON public.product_reviews FOR DELETE USING (auth.uid() = user_id);

-- 2. Add stats columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- 3. Function to update product rating stats
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE public.products
        SET 
            avg_rating = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.product_reviews WHERE product_id = NEW.product_id),
            reviews_count = (SELECT COUNT(*) FROM public.product_reviews WHERE product_id = NEW.product_id)
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.products
        SET 
            avg_rating = COALESCE((SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.product_reviews WHERE product_id = OLD.product_id), 0),
            reviews_count = (SELECT COUNT(*) FROM public.product_reviews WHERE product_id = OLD.product_id)
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger for product rating stats
DROP TRIGGER IF EXISTS on_product_review_change ON public.product_reviews;
CREATE TRIGGER on_product_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

-- 5. Updated_at trigger for reviews
DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER update_product_reviews_updated_at 
BEFORE UPDATE ON public.product_reviews 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
