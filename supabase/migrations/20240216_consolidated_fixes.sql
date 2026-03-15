-- CONSOLIDATED MIGRATION
-- This applies all pending fixes: Wishlist, Cart, Product FK, Order RPC, Seller KYC

-- 1. Fix Product-Profile FK (Missing Products Fix)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_seller_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);

-- 2. Fix Cart RLS (Add to Cart Fix)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;
CREATE POLICY "Users can view their own cart items" ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cart items" ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cart items" ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cart items" ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- 3. Fix Likes RLS (Wishlist Fix)
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own likes" ON public.likes;
DROP POLICY IF EXISTS "Users insert own likes" ON public.likes;
DROP POLICY IF EXISTS "Users delete own likes" ON public.likes;
CREATE POLICY "Users view own likes" ON public.likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- 4. Secure Order RPC (Stock Check Fix)
CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID,
    seller_id UUID,
    items JSONB,
    shipping_address JSONB,
    total_amount DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id UUID;
    item JSONB;
    product_record RECORD;
    item_qty INTEGER;
    item_id UUID;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;
        SELECT * INTO product_record FROM public.products WHERE id = item_id FOR UPDATE;
        IF product_record IS NULL THEN RAISE EXCEPTION 'Product % not found', item_id; END IF;
        IF product_record.inventory < item_qty THEN RAISE EXCEPTION 'Insufficient stock for product: %', product_record.title; END IF;
    END LOOP;

    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total_amount, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total_amount, shipping_address)
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;
        UPDATE public.products SET inventory = inventory - item_qty WHERE id = item_id;
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase, status)
        VALUES (new_order_id, item_id, seller_id, item_qty, (item->>'price')::DECIMAL, 'pending');
    END LOOP;
    RETURN new_order_id;
END;
$$;

-- 5. Seller KYC Schema
DO $$ BEGIN
    CREATE TYPE public.abuja_zone AS ENUM ('Zone 1 (Gwarinpa & Life Camp)', 'Zone 2 (Wuse & Utako)', 'Zone 3 (Kubwa Central)', 'Zone 4 (Lugbe & Apo)', 'Zone 5 (Gwagwalada Districts)');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_address TEXT NOT NULL,
    zone public.abuja_zone NOT NULL,
    national_id_url TEXT NOT NULL,
    store_photo_url TEXT NOT NULL,
    bank_details JSONB NOT NULL,
    status public.verification_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own verification" ON public.seller_verifications;
CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can submit verification" ON public.seller_verifications;
CREATE POLICY "Users can submit verification" ON public.seller_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own verification" ON public.seller_verifications;
CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "Authenticated upload kyc" ON storage.objects;
CREATE POLICY "Authenticated upload kyc" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users view own kyc path" ON storage.objects;
CREATE POLICY "Users view own kyc path" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (name LIKE (auth.uid() || '/%')));
