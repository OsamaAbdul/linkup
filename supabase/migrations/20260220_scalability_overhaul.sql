-- SCALABILITY OVERHAUL MIGRATION (ROBUST VERSION)

-- 1. Normalize Orders Table Columns
DO $$ 
BEGIN
    -- If 'total_amount' exists but 'total' doesn't, rename it to 'total'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total') THEN
        ALTER TABLE public.orders RENAME COLUMN total_amount TO total;
    END IF;
    
    -- Ensure 'total' is NUMERIC if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total') THEN
        ALTER TABLE public.orders ALTER COLUMN total TYPE NUMERIC(10,2);
    END IF;
END $$;

-- 1b. Fix create_order RPC to use 'total'
-- PostgreSQL requires dropping the function if you want to change parameter names
DROP FUNCTION IF EXISTS public.create_order(uuid, uuid, jsonb, jsonb, numeric);
DROP FUNCTION IF EXISTS public.create_order(uuid, uuid, jsonb, jsonb, decimal);

CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID,
    seller_id UUID,
    items JSONB,
    shipping_address JSONB,
    total DECIMAL -- Consistent with normalized column name
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id UUID;
    item JSONB;
BEGIN
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total, shipping_address)
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        INSERT INTO public.order_items_new (order_id, product_id, seller_id, quantity, price_at_purchase)
        VALUES (
            new_order_id,
            (item->>'product_id')::UUID,
            seller_id,
            (item->>'quantity')::INTEGER,
            (item->>'price')::NUMERIC
        );
    END LOOP;

    RETURN new_order_id;
END;
$$;

-- 2. Restore order_items table for relational integrity
CREATE TABLE IF NOT EXISTS public.order_items_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migrate data from JSONB items (if column exists)
DO $$
DECLARE
    r RECORD;
    item JSONB;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='items') THEN
        FOR r IN SELECT id, items, seller_id FROM public.orders LOOP
            -- Check if it's actually an array
            IF jsonb_typeof(r.items) = 'array' AND jsonb_array_length(r.items) > 0 THEN
                FOR item IN SELECT * FROM jsonb_array_elements(r.items) LOOP
                    -- Robust insert with conflict handling
                    INSERT INTO public.order_items_new (order_id, product_id, seller_id, quantity, price_at_purchase)
                    VALUES (
                        r.id, 
                        (item->>'id')::UUID, 
                        r.seller_id, 
                        (item->>'quantity')::INTEGER, 
                        (item->>'price')::NUMERIC
                    ) ON CONFLICT DO NOTHING;
                END LOOP;
            END IF;
        END LOOP;
    END IF;
END $$;

-- Also sync from old order_items if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        INSERT INTO public.order_items_new (id, order_id, product_id, seller_id, quantity, price_at_purchase, created_at)
        SELECT id, order_id, product_id, seller_id, quantity, price_at_purchase, created_at
        FROM public.order_items
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Enable RLS on new table
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

-- 3. Add GIN indexes for search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON public.products USING GIN (description gin_trgm_ops);

-- 4. Add Index for Geolocation
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products (latitude, longitude);

-- 5. Server-side Analytics RPC
CREATE OR REPLACE FUNCTION public.get_seller_analytics(seller_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(total), 0),
        'total_orders', COUNT(*),
        'active_products', (SELECT COUNT(*) FROM public.products WHERE seller_id = seller_uuid),
        'avg_order_value', CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END
    ) INTO result
    FROM public.orders
    WHERE seller_id = seller_uuid AND status IN ('completed', 'delivered');
    
    RETURN result;
END;
$$;
