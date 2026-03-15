-- CLEAN SYSTEM SCHEMA v2
-- High-fidelity, idempotent database definition for Linkup Marketplace.
-- Standardizes table names (order_items_new -> order_items) and reconciles all history.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. ENUMS
DO $type_safe$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'promoter', 'logistics', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'awaiting_agent', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
        CREATE TYPE public.shipment_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'abuja_zone') THEN
        CREATE TYPE public.abuja_zone AS ENUM ('Zone 1 (Gwarinpa & Life Camp)', 'Zone 2 (Wuse & Utako)', 'Zone 3 (Kubwa Central)', 'Zone 4 (Lugbe & Apo)', 'Zone 5 (Gwagwalada Districts)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
    END IF;
END $type_safe$;

-- 3. LOCATION ARCHITECTURE
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    delivery_fee NUMERIC DEFAULT 1500,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(city_id, name)
);

-- Seed initial Abuja data
INSERT INTO public.cities (name) VALUES ('Abuja') ON CONFLICT (name) DO NOTHING;
DO $seed$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    INSERT INTO public.delivery_zones (city_id, name) VALUES
    (v_city_id, 'Zone 1 (Gwarinpa & Life Camp)'),
    (v_city_id, 'Zone 2 (Wuse & Utako)'),
    (v_city_id, 'Zone 3 (Kubwa Central)'),
    (v_city_id, 'Zone 4 (Lugbe & Apo)'),
    (v_city_id, 'Zone 5 (Gwagwalada Districts)')
    ON CONFLICT (city_id, name) DO NOTHING;
END $seed$;

-- 4. CORE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(), -- Compatibility column
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    zone public.abuja_zone, -- Legacy enum support
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    category TEXT,
    inventory INTEGER NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nullable for multi-merchant
    status public.order_status DEFAULT 'pending',
    payment_status public.payment_status DEFAULT 'pending',
    total NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) GENERATED ALWAYS AS (total) STORED, -- Mirror for legacy
    shipping_address JSONB,
    items JSONB, -- Cache for item manifest
    zone public.abuja_zone, -- Legacy
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Normalized to 'order_items' (Standardized)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10, 2) NOT NULL,
    shipment_id UUID, -- Added later to avoid circularity if needed, but safe here
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. INFRASTRUCTURE & LOGISTICS
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(id),
    seller_id UUID REFERENCES public.profiles(id),
    status public.shipment_status DEFAULT 'pending',
    pickup_address JSONB,
    delivery_address JSONB NOT NULL,
    pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
    delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
    tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
    delivery_fee NUMERIC DEFAULT 0,
    zone public.abuja_zone, -- Legacy
    zone_id UUID REFERENCES public.delivery_zones(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fix circular reference
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_shipment_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) UNIQUE,
    seller_id UUID REFERENCES auth.users(id), -- Historical
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    escrow_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    UNIQUE(user_id)
);

-- 6. PROMOTER & SOCIAL
CREATE TABLE IF NOT EXISTS public.promoter_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    commission_rate DECIMAL(5, 2) NOT NULL CHECK (commission_rate > 0 AND commission_rate <= 100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    promoter_id UUID NOT NULL REFERENCES public.profiles(id),
    campaign_id UUID NOT NULL REFERENCES public.promoter_campaigns(id),
    order_id UUID REFERENCES public.orders(id),
    status TEXT CHECK (status IN ('click', 'conversion')) DEFAULT 'click',
    earnings DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 8. SECURITY (RLS)
DO $rls$ BEGIN
    ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.promoter_campaigns ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
END $rls$;

-- Policies
DO $pol$ BEGIN
    -- Public viewing
    DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
    CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Anyone can view delivery zones" ON public.delivery_zones;
    CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);

    -- Profiles
    DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
    CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "User update profile" ON public.profiles;
    CREATE POLICY "User update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    -- Products
    DROP POLICY IF EXISTS "Public products" ON public.products;
    CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Seller manage product" ON public.products;
    CREATE POLICY "Seller manage product" ON public.products FOR ALL USING (auth.uid() = seller_id);

    -- Orders
    DROP POLICY IF EXISTS "User view orders" ON public.orders;
    CREATE POLICY "User view orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
    DROP POLICY IF EXISTS "Buyer create order" ON public.orders;
    CREATE POLICY "Buyer create order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

    -- Order Items
    DROP POLICY IF EXISTS "User view own items" ON public.order_items;
    CREATE POLICY "User view own items" ON public.order_items FOR SELECT USING (
        auth.uid() = seller_id OR 
        auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id)
    );

    -- Shipments
    DROP POLICY IF EXISTS "Logistics view zone shipments" ON public.shipments;
    CREATE POLICY "Logistics view zone shipments" ON public.shipments FOR SELECT
    USING (
      rider_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.user_id = auth.uid() AND ur.role = 'logistics' AND p.zone_id = shipments.zone_id
      )
    );
    DROP POLICY IF EXISTS "Rider update assigned" ON public.shipments;
    CREATE POLICY "Rider update assigned" ON public.shipments FOR UPDATE USING (rider_id = auth.uid());

    -- Cart
    DROP POLICY IF EXISTS "Users manage own cart" ON public.cart_items;
    CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id);
END $pol$;

-- 9. FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $trigger$ BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN OTHERS THEN NULL;
END $trigger$;

-- Order Placement RPC (Scalable v3)
CREATE OR REPLACE FUNCTION public.create_order(
    p_items JSONB,
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_city_id UUID DEFAULT NULL,
    p_zone_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_item RECORD;
    v_first_seller_id UUID;
BEGIN
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total, shipping_address, items, city_id, zone_id)
    VALUES (auth.uid(), v_first_seller_id, 'pending', 'paid', p_total, p_shipping_address, p_items, p_city_id, p_zone_id)
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
        VALUES (v_order_id, v_item.product_id, v_item.seller_id, v_item.quantity, v_item.price);

        UPDATE public.products SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id AND inventory >= v_item.quantity;

        IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory for product ID %', v_item.product_id; END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- Settlement Function
CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order             RECORD;
    v_total             NUMERIC;
    v_seller_wallet_id  UUID;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND buyer_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found or access denied'); END IF;

    v_total := v_order.total;

    UPDATE public.wallets SET balance = balance + v_total, updated_at = NOW()
    WHERE user_id = v_order.seller_id
    RETURNING id INTO v_seller_wallet_id;

    IF v_seller_wallet_id IS NOT NULL THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, v_total, 'settlement', 'Order #' || LEFT(p_order_id::TEXT, 8));
    END IF;

    UPDATE public.orders SET status = 'completed', updated_at = NOW() WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. STORAGE
DO $st$ BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
END $st$;
