-- Migration: Add product sizes for clothing
-- Description: Adds sizes to products and selected size to cart and order items.

-- 1. Add sizes array to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}';

-- 2. Ensure order_items_new exists (active relational items used by Edge Function)
CREATE TABLE IF NOT EXISTS public.order_items_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add size column to relational tracking tables
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.order_items_new ADD COLUMN IF NOT EXISTS size TEXT;

-- 4. Enable RLS and setup policies for order_items_new if missing
ALTER TABLE public.order_items_new ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own order items') THEN
        CREATE POLICY "Users can view own order items" ON public.order_items_new
        FOR SELECT USING (
            auth.uid() = seller_id OR 
            auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id)
        );
    END IF;
END $$;

-- 5. Add selected size to cart_items and update unique constraint
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_size_key;
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_product_id_size_key UNIQUE(user_id, product_id, size);
