-- CLEAN SYSTEM SCHEMA v3
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
DO $seed_zones$
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
END $seed_zones$;

-- 4. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT, -- Lucide icon name
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Categories
INSERT INTO public.categories (name, slug, icon) VALUES 
('Electronics', 'electronics', 'Laptop'),
('Fashion', 'fashion', 'Shirt'),
('Home & Kitchen', 'home-kitchen', 'Home'),
('Health & Beauty', 'health-beauty', 'Sparkles'),
('Sports', 'sports', 'Heart'),
('Toys', 'toys', 'ShoppingBag'),
('Automotive', 'automotive', 'Settings'),
('Grocery', 'grocery', 'Apple'),
('Services', 'services', 'MapPin'),
('Other', 'other', 'Grid')
ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon;

CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Vehicle Types
INSERT INTO public.vehicle_types (name) VALUES 
('Motorcycle (Bike)'),
('Car (Sedan)'),
('Minivan'),
('Box Truck')
ON CONFLICT (name) DO NOTHING;

-- 5. CORE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(), -- Compatibility column
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    last_seen TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT false,
    address TEXT,
    phone TEXT,
    email TEXT,
    payout_bank_name TEXT,
    payout_account_number TEXT,
    payout_account_name TEXT,
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
    category TEXT, -- Kept as text for legacy, but maps to categories.name
    category_id UUID REFERENCES public.categories(id),
    inventory INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    sizes TEXT[] DEFAULT '{}',
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
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
    subtotal NUMERIC(10, 2) DEFAULT 0,
    shipping_fee NUMERIC(10, 2) DEFAULT 0,
    platform_fee NUMERIC(10, 2) DEFAULT 0,
    promoter_fee NUMERIC(10, 2) DEFAULT 0,
    seller_earnings NUMERIC(10, 2) DEFAULT 0,
    grand_total NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) GENERATED ALWAYS AS (total) STORED, -- Mirror for legacy
    shipping_address JSONB,
    shipping_info JSONB, -- Consolidated shipping data
    payment_method TEXT,
    payment_ref TEXT,
    promoter_id UUID REFERENCES public.profiles(id),
    items JSONB, -- Cache for item manifest
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
    shipment_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_recipient (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    address_line TEXT,
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. INFRASTRUCTURE & LOGISTICS
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES auth.users(id),
    seller_id UUID REFERENCES public.profiles(id),
    status public.shipment_status NOT NULL DEFAULT 'pending',
    pickup_address TEXT,
    delivery_address TEXT,
    buyer_latitude DOUBLE PRECISION,
    buyer_longitude DOUBLE PRECISION,
    rider_latitude DOUBLE PRECISION,
    rider_longitude DOUBLE PRECISION,
    last_seen TIMESTAMPTZ,
    pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
    delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
    tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
    delivery_fee NUMERIC DEFAULT 1500,
    zone_id UUID REFERENCES public.delivery_zones(id),
    distance_km NUMERIC,
    rider_fee_breakdown JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- 7. CHAT SYSTEM
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. VERIFICATION & KYC
CREATE TABLE IF NOT EXISTS public.logistics_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    home_address TEXT NOT NULL,
    date_of_birth DATE,
    nin_number TEXT,
    passport_photo_url TEXT,
    id_card_photo_url TEXT,
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    next_of_kin JSONB,
    vehicle_type TEXT,
    notification_settings JSONB DEFAULT '{"new_order": true, "order_delivered": true, "issue_reported": true, "promoter_earnings": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_address TEXT NOT NULL,
    national_id_url TEXT NOT NULL,
    store_photo_url TEXT NOT NULL,
    bank_details JSONB NOT NULL,
    status public.verification_status DEFAULT 'pending',
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 9. PROMOTER & SOCIAL
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
    size TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
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

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 11. SECURITY (RLS)
DO $rls$ BEGIN
    ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.order_recipient ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;
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
    DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
    CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public insert categories" ON public.categories;
    CREATE POLICY "Public insert categories" ON public.categories FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Anyone can view vehicle types" ON public.vehicle_types;
    CREATE POLICY "Anyone can view vehicle types" ON public.vehicle_types FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public manage vehicle types" ON public.vehicle_types;
    CREATE POLICY "Public manage vehicle types" ON public.vehicle_types FOR ALL USING (true);

    -- Profiles
    DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
    CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "User update profile" ON public.profiles;
    CREATE POLICY "User update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    -- User Roles
    DROP POLICY IF EXISTS "Anyone view roles" ON public.user_roles;
    CREATE POLICY "Anyone view roles" ON public.user_roles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
    CREATE POLICY "Users insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Products
    DROP POLICY IF EXISTS "Public products" ON public.products;
    CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Seller manage product" ON public.products;
    
    DROP POLICY IF EXISTS "Seller insert product" ON public.products;
    CREATE POLICY "Seller insert product" ON public.products 
    FOR INSERT WITH CHECK (
        auth.uid() = seller_id 
        AND (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() AND role = 'seller'::public.app_role
            )
            OR EXISTS (
                SELECT 1 FROM public.seller_verifications 
                WHERE user_id = auth.uid() AND status = 'verified'
            )
        )
    );

    DROP POLICY IF EXISTS "Seller update product" ON public.products;
    CREATE POLICY "Seller update product" ON public.products 
    FOR UPDATE USING (auth.uid() = seller_id);

    DROP POLICY IF EXISTS "Seller delete product" ON public.products;
    CREATE POLICY "Seller delete product" ON public.products 
    FOR DELETE USING (auth.uid() = seller_id);

    -- Orders
    DROP POLICY IF EXISTS "User view orders" ON public.orders;
    CREATE POLICY "User view orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
    DROP POLICY IF EXISTS "Logistics view orders" ON public.orders;
    CREATE POLICY "Logistics view orders" ON public.orders FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'logistics')
    );
    DROP POLICY IF EXISTS "Buyer create order" ON public.orders;
    CREATE POLICY "Buyer create order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
    DROP POLICY IF EXISTS "Users update own orders" ON public.orders;
    CREATE POLICY "Users update own orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

    -- Wallets
    DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
    CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users create own wallet" ON public.wallets;
    CREATE POLICY "Users create own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Order Items
    DROP POLICY IF EXISTS "User view own items" ON public.order_items;
    CREATE POLICY "User view own items" ON public.order_items FOR SELECT USING (
        auth.uid() = seller_id OR 
        auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id)
    );

    -- Order Recipient
    DROP POLICY IF EXISTS "User view own order recipients" ON public.order_recipient;
    CREATE POLICY "User view own order recipients" ON public.order_recipient FOR SELECT USING (
        auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_recipient.order_id) OR
        auth.uid() IN (SELECT seller_id FROM public.orders WHERE id = order_recipient.order_id)
    );
    DROP POLICY IF EXISTS "Logistics view order recipients" ON public.order_recipient;
    CREATE POLICY "Logistics view order recipients" ON public.order_recipient FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'logistics')
    );
    DROP POLICY IF EXISTS "Buyer insert own order recipients" ON public.order_recipient;
    CREATE POLICY "Buyer insert own order recipients" ON public.order_recipient FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_recipient.order_id)
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
    DROP POLICY IF EXISTS "Seller insert shipment" ON public.shipments;
    CREATE POLICY "Seller insert shipment" ON public.shipments FOR INSERT WITH CHECK (auth.uid() = seller_id);

    -- Chat
    DROP POLICY IF EXISTS "User view conversations" ON public.conversations;
    CREATE POLICY "User view conversations" ON public.conversations FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
    DROP POLICY IF EXISTS "User insert conversations" ON public.conversations;
    CREATE POLICY "User insert conversations" ON public.conversations FOR INSERT WITH CHECK (buyer_id = auth.uid());
    
    DROP POLICY IF EXISTS "User view messages" ON public.messages;
    CREATE POLICY "User view messages" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
    DROP POLICY IF EXISTS "User insert messages" ON public.messages;
    CREATE POLICY "User insert messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());

    -- Cart & Likes
    DROP POLICY IF EXISTS "Users manage own cart" ON public.cart_items;
    CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users manage own likes" ON public.likes;
    CREATE POLICY "Users manage own likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

    -- KYC & Verifications
    DROP POLICY IF EXISTS "Users view own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users view own kyc" ON public.logistics_kyc FOR SELECT USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users manage own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users manage own kyc" ON public.logistics_kyc FOR ALL USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Admins can view all logistics kyc" ON public.logistics_kyc;
    CREATE POLICY "Admins can view all logistics kyc" ON public.logistics_kyc FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

    DROP POLICY IF EXISTS "Admins can manage all logistics kyc" ON public.logistics_kyc;
    CREATE POLICY "Admins can manage all logistics kyc" ON public.logistics_kyc FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

    DROP POLICY IF EXISTS "Users view own details" ON public.logistics_details;
    CREATE POLICY "Users view own details" ON public.logistics_details FOR SELECT USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users manage own details" ON public.logistics_details;
    CREATE POLICY "Users manage own details" ON public.logistics_details FOR ALL USING (user_id = auth.uid());
    
    DROP POLICY IF EXISTS "Users view own verification" ON public.seller_verifications;
    CREATE POLICY "Users view own verification" ON public.seller_verifications FOR SELECT USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users manage own verification" ON public.seller_verifications;
    CREATE POLICY "Users manage own verification" ON public.seller_verifications FOR ALL USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Admins can view all seller verifications" ON public.seller_verifications;
    CREATE POLICY "Admins can view all seller verifications" ON public.seller_verifications FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

    DROP POLICY IF EXISTS "Admins can manage all seller verifications" ON public.seller_verifications;
    CREATE POLICY "Admins can manage all seller verifications" ON public.seller_verifications FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

    -- Notifications
    DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
    CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
    CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
END $pol$;

-- 12. FUNCTIONS & TRIGGERS
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

-- Manage User Roles RPC
CREATE OR REPLACE FUNCTION public.manage_user_roles(
    p_user_id UUID,
    p_roles TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_name TEXT;
BEGIN
    -- Verify the user is updating their own roles or is an admin
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authorized to manage these roles';
    END IF;

    -- Delete existing roles for this user
    DELETE FROM public.user_roles WHERE user_id = p_user_id;

    -- Insert new roles
    FOREACH role_name IN ARRAY p_roles
    LOOP
        INSERT INTO public.user_roles (user_id, role)
        VALUES (p_user_id, role_name::public.app_role);
    END LOOP;
END;
$$;

-- Order Placement RPC (Scalable v3 - Hardened)
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
    v_product_price NUMERIC;
    v_calculated_total NUMERIC := 0;
BEGIN
    -- v_first_seller_id := (p_items->0->>'seller_id')::UUID; -- Legacy: might be wrong if multiple sellers

    -- Preliminary check to get first seller for the order table (legacy requirement)
    -- Though we should probably eventually remove seller_id from orders table.
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- Create order record
    -- Note: We use the input p_total for now, but we'll verify it below.
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total, shipping_address, items, city_id, zone_id)
    VALUES (auth.uid(), v_first_seller_id, 'pending', 'paid', p_total, p_shipping_address, p_items, p_city_id, p_zone_id)
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, seller_id UUID)
    LOOP
        -- SECURITY: Fetch AUTHENTIC price from products table
        SELECT price INTO v_product_price FROM public.products WHERE id = v_item.product_id;
        
        IF v_product_price IS NULL THEN
            RAISE EXCEPTION 'Product % not found', v_item.product_id;
        END IF;

        v_calculated_total := v_calculated_total + (v_product_price * v_item.quantity);

        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
        VALUES (v_order_id, v_item.product_id, v_item.seller_id, v_item.quantity, v_product_price);

        UPDATE public.products SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id AND inventory >= v_item.quantity;

        IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory for product ID %', v_item.product_id; END IF;
    END LOOP;

    -- Update order total with calculated value if it differs (hardening against price spoofing)
    UPDATE public.orders SET total = v_calculated_total WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'final_total', v_calculated_total);
END;
$$;

-- Seller Escrow Funding Trigger (On Order Creation/Paid)
CREATE OR REPLACE FUNCTION public.handle_seller_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
BEGIN
    IF NEW.payment_status::TEXT = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status::TEXT != 'paid') THEN
        -- Safely get seller earnings (fallback to total)
        v_seller_earnings := NEW.total;
        
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        
        IF v_seller_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + v_seller_earnings,
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_fund_seller_escrow
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_seller_escrow_funding();

-- Rider Escrow Funding Trigger (On Assignment)
CREATE OR REPLACE FUNCTION public.handle_rider_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
BEGIN
    -- Fund when status changes to 'assigned'
    IF NEW.status::TEXT = 'assigned' AND OLD.status::TEXT != 'assigned' AND NEW.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = NEW.rider_id OR seller_id = NEW.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            -- Use rider_fee_breakdown->>total, fallback to delivery_fee
            v_rider_fee := COALESCE((NEW.rider_fee_breakdown->>'total')::NUMERIC, NEW.delivery_fee, 0);
            
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + v_rider_fee,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;
        END IF;
    END IF;
    
    -- Refund if un-assigned
    IF NEW.status::TEXT = 'pending' AND OLD.status::TEXT = 'assigned' AND OLD.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = OLD.rider_id OR seller_id = OLD.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            v_rider_fee := COALESCE((OLD.rider_fee_breakdown->>'total')::NUMERIC, OLD.delivery_fee, 0);
            
            UPDATE public.wallets 
            SET escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_fund_rider_escrow
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_rider_escrow_funding();


-- Escrow Release Trigger (On Order Completion - No Dispute)
CREATE OR REPLACE FUNCTION public.handle_order_completion_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
    v_shipment RECORD;
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
BEGIN
    -- Release funds when order is 'completed'
    IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT != 'completed' THEN
        
        -- Default to total if seller_earnings column doesn't exist yet
        v_seller_earnings := NEW.total;

        -- Find seller's wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;

        IF v_seller_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET balance = balance + v_seller_earnings,
                escrow_balance = GREATEST(0, escrow_balance - v_seller_earnings),
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_seller_wallet_id, v_seller_earnings, 'settlement', 'Escrow release for Order #' || NEW.id);
            
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (NEW.seller_id, 'payment', 'Payment of ₦' || v_seller_earnings || ' released from escrow for order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

        -- Find and pay the Rider
        FOR v_shipment IN SELECT rider_id, delivery_fee, rider_fee_breakdown FROM public.shipments WHERE order_id = NEW.id AND rider_id IS NOT NULL
        LOOP
            SELECT id INTO v_rider_wallet_id FROM public.wallets 
            WHERE user_id = v_shipment.rider_id OR seller_id = v_shipment.rider_id LIMIT 1;

            IF v_rider_wallet_id IS NOT NULL THEN
                v_rider_fee := COALESCE((v_shipment.rider_fee_breakdown->>'total')::NUMERIC, v_shipment.delivery_fee, 0);

                UPDATE public.wallets 
                SET balance = balance + v_rider_fee,
                    escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                    updated_at = NOW()
                WHERE id = v_rider_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (v_rider_wallet_id, v_rider_fee, 'settlement', 'Delivery payout for Order #' || NEW.id);
                
                INSERT INTO public.notifications (user_id, type, message)
                VALUES (v_shipment.rider_id, 'payment', 'Delivery fee of ₦' || v_rider_fee || ' released for order #' || LEFT(NEW.id::TEXT, 8));
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_release_escrow_on_completion
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_completion_settlement();

-- 13. STORAGE
DO $st$ BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

    -- Storage Policies (storage.objects)
    -- product-images
    DROP POLICY IF EXISTS "Public view product images" ON storage.objects;
    CREATE POLICY "Public view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
    DROP POLICY IF EXISTS "Sellers upload product images" ON storage.objects;
    CREATE POLICY "Sellers upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Sellers delete product images" ON storage.objects;
    CREATE POLICY "Sellers delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- avatars
    DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
    CREATE POLICY "Public view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
    DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
    CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
    CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- kyc-documents
    DROP POLICY IF EXISTS "Users view own kyc" ON storage.objects;
    CREATE POLICY "Users view own kyc" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Users upload kyc" ON storage.objects;
    CREATE POLICY "Users upload kyc" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Admins can view all kyc" ON storage.objects;
    CREATE POLICY "Admins can view all kyc" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $st$;

-- 14. REALTIME
DO $rt$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $rt$;

-- 15. COLUMN RECONCILIATION
-- Ensures essential columns exist even if tables were created previously.
DO $recon$ BEGIN
    -- Profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

    -- Products
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

    -- Orders
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

    -- Shipments
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS rider_fee_breakdown JSONB;
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 1500;

    -- Logistics KYC
    ALTER TABLE public.logistics_kyc ADD COLUMN IF NOT EXISTS date_of_birth DATE;
END $recon$;

-- 16. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users on system_settings" ON public.system_settings
    FOR ALL USING (true);

INSERT INTO public.system_settings (key, value)
VALUES
('withdrawal_fee', '{"amount": 100, "type": "flat"}'::jsonb),
('payout_interval_days', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 17. PRODUCTS PATCH
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Fee Config Table
CREATE TABLE IF NOT EXISTS public.fee_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fee_type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    rate NUMERIC(10,4) DEFAULT 0,
    flat_fee NUMERIC(15,2) DEFAULT 0,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee config" ON public.fee_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage fee config" ON public.fee_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Seed data
INSERT INTO public.fee_config (fee_type, name, rate, flat_fee, priority) VALUES
('platform', 'Platform Base Fee', 0.10, 0, 100),
('rider', 'Rider Base Delivery', 0, 1000, 90),
('promoter', 'Promoter Commission', 0.05, 0, 80),
('rider_out_of_zone', 'Out of Zone Delivery', 0, 2000, 85),
('rider_distance', 'Distance Delivery (Per KM)', 0, 100, 70),
FOR EACH ROW
EXECUTE FUNCTION public.handle_rider_escrow_funding();


-- Escrow Release Trigger (On Order Completion - No Dispute)
CREATE OR REPLACE FUNCTION public.handle_order_completion_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
    v_shipment RECORD;
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
BEGIN
    -- Release funds when order is 'completed'
    IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT != 'completed' THEN
        
        -- Default to total if seller_earnings column doesn't exist yet
        v_seller_earnings := NEW.total;

        -- Find seller's wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;

        IF v_seller_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET balance = balance + v_seller_earnings,
                escrow_balance = GREATEST(0, escrow_balance - v_seller_earnings),
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_seller_wallet_id, v_seller_earnings, 'settlement', 'Escrow release for Order #' || NEW.id);
            
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (NEW.seller_id, 'payment', 'Payment of ₦' || v_seller_earnings || ' released from escrow for order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

        -- Find and pay the Rider
        FOR v_shipment IN SELECT rider_id, delivery_fee, rider_fee_breakdown FROM public.shipments WHERE order_id = NEW.id AND rider_id IS NOT NULL
        LOOP
            SELECT id INTO v_rider_wallet_id FROM public.wallets 
            WHERE user_id = v_shipment.rider_id OR seller_id = v_shipment.rider_id LIMIT 1;

            IF v_rider_wallet_id IS NULL AND v_shipment.rider_id IS NOT NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance) 
                VALUES (v_shipment.rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
            END IF;

            IF v_rider_wallet_id IS NOT NULL THEN
                v_rider_fee := COALESCE((v_shipment.rider_fee_breakdown->>'total')::NUMERIC, v_shipment.delivery_fee, 0);

                UPDATE public.wallets 
                SET balance = balance + v_rider_fee,
                    escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                    updated_at = NOW()
                WHERE id = v_rider_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (v_rider_wallet_id, v_rider_fee, 'settlement', 'Delivery payout for Order #' || NEW.id);
                
                INSERT INTO public.notifications (user_id, type, message)
                VALUES (v_shipment.rider_id, 'payment', 'Delivery fee of ₦' || v_rider_fee || ' released for order #' || LEFT(NEW.id::TEXT, 8));
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_release_escrow_on_completion
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_completion_settlement();

-- 13. STORAGE
DO $st$ BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

    -- Storage Policies (storage.objects)
    -- product-images
    DROP POLICY IF EXISTS "Public view product images" ON storage.objects;
    CREATE POLICY "Public view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
    DROP POLICY IF EXISTS "Sellers upload product images" ON storage.objects;
    CREATE POLICY "Sellers upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Sellers delete product images" ON storage.objects;
    CREATE POLICY "Sellers delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- avatars
    DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
    CREATE POLICY "Public view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
    DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
    CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
    CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- kyc-documents
    DROP POLICY IF EXISTS "Users view own kyc" ON storage.objects;
    CREATE POLICY "Users view own kyc" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Users upload kyc" ON storage.objects;
    CREATE POLICY "Users upload kyc" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Admins can view all kyc" ON storage.objects;
    CREATE POLICY "Admins can view all kyc" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $st$;

-- 14. REALTIME
DO $rt$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $rt$;

-- 15. COLUMN RECONCILIATION
-- Ensures essential columns exist even if tables were created previously.
DO $recon$ BEGIN
    -- Profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

    -- Products
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

    -- Orders
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

    -- Shipments
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS rider_fee_breakdown JSONB;
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 1500;

    -- Logistics KYC
    ALTER TABLE public.logistics_kyc ADD COLUMN IF NOT EXISTS date_of_birth DATE;
END $recon$;

-- 16. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users on system_settings" ON public.system_settings
    FOR ALL USING (true);

INSERT INTO public.system_settings (key, value)
VALUES
('withdrawal_fee', '{"amount": 100, "type": "flat"}'::jsonb),
('payout_interval_days', '1'::jsonb),
('escrow_release_days', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 17. PRODUCTS PATCH
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Fee Config Table
CREATE TABLE IF NOT EXISTS public.fee_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fee_type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    rate NUMERIC(10,4) DEFAULT 0,
    flat_fee NUMERIC(15,2) DEFAULT 0,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee config" ON public.fee_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage fee config" ON public.fee_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Seed data
INSERT INTO public.fee_config (fee_type, name, rate, flat_fee, priority) VALUES
('platform', 'Platform Base Fee', 0.10, 0, 100),
('rider', 'Rider Base Delivery', 0, 1000, 90),
('promoter', 'Promoter Commission', 0.05, 0, 80),
('rider_out_of_zone', 'Out of Zone Delivery', 0, 2000, 85),
('rider_distance', 'Distance Delivery (Per KM)', 0, 100, 70),
('buyer_cross_zone', 'Cross Zone Delivery', 0, 2500, 85),
('settlement', 'Settlement Wait Time', 0, 48, 10)
ON CONFLICT (fee_type) DO NOTHING;

-- 3. NEW TABLE: escrow_transactions

CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'held' CHECK (status IN ('held', 'released', 'disputed', 'refunded', 'manual_release')),
    held_at TIMESTAMPTZ DEFAULT now(),
    release_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10, 2) NOT NULL,
    size TEXT,
    shipment_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Product Reviews Table
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product reviews" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reviews" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.product_reviews FOR UPDATE USING (auth.uid() = user_id);

-- End of schema

-- 18. SCHEMA RELOAD
-- Refreshes PostgREST cache to prevent 'column not found in schema cache' errors.
NOTIFY pgrst, 'reload schema';
-- Migration: Financial Architecture Upgrade v4
-- Adds order_settlements, wallet concurrency, escrow_transactions, order_promotions
-- Updates orders table with fee breakdown

-- 1. ALTERS TO WALLETS & TRANSACTIONS
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- 2. NEW TABLE: order_settlements
CREATE TABLE IF NOT EXISTS public.order_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
    gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    seller_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    rider_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    platform_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    promoter_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'settled', 'partially_settled', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. NEW TABLE: order_promotions
CREATE TABLE IF NOT EXISTS public.order_promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES public.profiles(id),
    commission_rate DECIMAL(5, 2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ALTER orders TABLE
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS promoter_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2) DEFAULT 0;

-- Optional: You may want to populate grand_total from total if it's already there
UPDATE public.orders SET grand_total = total WHERE grand_total = 0 AND total > 0;

-- 6. SECURITY / RLS
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order settlements" ON public.order_settlements 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_settlements.order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users view own escrow transactions" ON public.escrow_transactions 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE id = escrow_transactions.wallet_id AND (user_id = auth.uid() OR seller_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 7. UPDATED FUNCTIONS & TRIGGERS

-- A. Seller Escrow Funding
CREATE OR REPLACE FUNCTION public.handle_seller_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
BEGIN
    IF NEW.payment_status::TEXT = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status::TEXT != 'paid') THEN
        
        -- Pull earnings from settlement if it exists, otherwise fallback to NEW.subtotal or NEW.total
        SELECT seller_amount INTO v_seller_earnings FROM public.order_settlements WHERE order_id = NEW.id LIMIT 1;
        
        IF v_seller_earnings IS NULL THEN
            v_seller_earnings := COALESCE(NEW.subtotal, NEW.total, 0);
        END IF;
        
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        
        IF v_seller_wallet_id IS NOT NULL AND v_seller_earnings > 0 THEN
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + v_seller_earnings,
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;

            INSERT INTO public.escrow_transactions (order_id, wallet_id, amount, status)
            VALUES (NEW.id, v_seller_wallet_id, v_seller_earnings, 'held');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Rider Escrow Funding
CREATE OR REPLACE FUNCTION public.handle_rider_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
BEGIN
    IF NEW.status::TEXT = 'assigned' AND OLD.status::TEXT != 'assigned' AND NEW.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = NEW.rider_id OR seller_id = NEW.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            SELECT rider_amount INTO v_rider_fee FROM public.order_settlements WHERE order_id = NEW.order_id LIMIT 1;
            IF v_rider_fee IS NULL THEN
                v_rider_fee := COALESCE((NEW.rider_fee_breakdown->>'total')::NUMERIC, NEW.delivery_fee, 0);
            END IF;
            
            IF v_rider_fee > 0 THEN
                UPDATE public.wallets 
                SET escrow_balance = escrow_balance + v_rider_fee,
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = v_rider_wallet_id;

                INSERT INTO public.escrow_transactions (order_id, wallet_id, amount, status)
                VALUES (NEW.order_id, v_rider_wallet_id, v_rider_fee, 'held');
            END IF;
        END IF;
    END IF;
    
    IF NEW.status::TEXT = 'pending' AND OLD.status::TEXT = 'assigned' AND OLD.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = OLD.rider_id OR seller_id = OLD.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            SELECT rider_amount INTO v_rider_fee FROM public.order_settlements WHERE order_id = NEW.order_id LIMIT 1;
            IF v_rider_fee IS NULL THEN
                v_rider_fee := COALESCE((OLD.rider_fee_breakdown->>'total')::NUMERIC, OLD.delivery_fee, 0);
            END IF;
            
            UPDATE public.wallets 
            SET escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            -- Mark escrow as refunded/cancelled
            UPDATE public.escrow_transactions 
            SET status = 'refunded', updated_at = NOW()
            WHERE order_id = NEW.order_id AND wallet_id = v_rider_wallet_id AND status = 'held';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Escrow Release
CREATE OR REPLACE FUNCTION public.handle_order_completion_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
    v_shipment RECORD;
    v_rider_wallet_id UUID;
-- End of schema

-- 18. SCHEMA RELOAD
-- Refreshes PostgREST cache to prevent 'column not found in schema cache' errors.
NOTIFY pgrst, 'reload schema';
-- Migration: Financial Architecture Upgrade v4
-- Adds order_settlements, wallet concurrency, escrow_transactions, order_promotions
-- Updates orders table with fee breakdown

-- 1. ALTERS TO WALLETS & TRANSACTIONS
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- 2. NEW TABLE: order_settlements
CREATE TABLE IF NOT EXISTS public.order_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
    gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    seller_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    rider_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    platform_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    promoter_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'settled', 'partially_settled', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. NEW TABLE: order_promotions
CREATE TABLE IF NOT EXISTS public.order_promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    promoter_id UUID REFERENCES public.profiles(id),
    commission_rate DECIMAL(5, 2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ALTER orders TABLE
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS promoter_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2) DEFAULT 0;

-- Optional: You may want to populate grand_total from total if it's already there
UPDATE public.orders SET grand_total = total WHERE grand_total = 0 AND total > 0;

-- 6. SECURITY / RLS
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order settlements" ON public.order_settlements 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_settlements.order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users view own escrow transactions" ON public.escrow_transactions 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE id = escrow_transactions.wallet_id AND (user_id = auth.uid() OR seller_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 7. UPDATED FUNCTIONS & TRIGGERS

-- A. Seller Escrow Funding
CREATE OR REPLACE FUNCTION public.handle_seller_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
BEGIN
    IF NEW.payment_status::TEXT = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status::TEXT != 'paid') THEN
        
        -- Pull earnings from settlement if it exists, otherwise fallback to NEW.subtotal or NEW.total
        SELECT seller_amount INTO v_seller_earnings FROM public.order_settlements WHERE order_id = NEW.id LIMIT 1;
        
        IF v_seller_earnings IS NULL THEN
            v_seller_earnings := COALESCE(NEW.subtotal, NEW.total, 0);
        END IF;
        
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        
        IF v_seller_wallet_id IS NOT NULL AND v_seller_earnings > 0 THEN
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + v_seller_earnings,
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;

            INSERT INTO public.escrow_transactions (order_id, wallet_id, amount, status)
            VALUES (NEW.id, v_seller_wallet_id, v_seller_earnings, 'held');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Rider Escrow Funding
CREATE OR REPLACE FUNCTION public.handle_rider_escrow_funding()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
BEGIN
    IF NEW.status::TEXT = 'assigned' AND OLD.status::TEXT != 'assigned' AND NEW.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = NEW.rider_id OR seller_id = NEW.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            SELECT rider_amount INTO v_rider_fee FROM public.order_settlements WHERE order_id = NEW.order_id LIMIT 1;
            IF v_rider_fee IS NULL THEN
                v_rider_fee := COALESCE((NEW.rider_fee_breakdown->>'total')::NUMERIC, NEW.delivery_fee, 0);
            END IF;
            
            IF v_rider_fee > 0 THEN
                UPDATE public.wallets 
                SET escrow_balance = escrow_balance + v_rider_fee,
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = v_rider_wallet_id;

                INSERT INTO public.escrow_transactions (order_id, wallet_id, amount, status)
                VALUES (NEW.order_id, v_rider_wallet_id, v_rider_fee, 'held');
            END IF;
        END IF;
    END IF;
    
    IF NEW.status::TEXT = 'pending' AND OLD.status::TEXT = 'assigned' AND OLD.rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets 
        WHERE user_id = OLD.rider_id OR seller_id = OLD.rider_id LIMIT 1;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            SELECT rider_amount INTO v_rider_fee FROM public.order_settlements WHERE order_id = NEW.order_id LIMIT 1;
            IF v_rider_fee IS NULL THEN
                v_rider_fee := COALESCE((OLD.rider_fee_breakdown->>'total')::NUMERIC, OLD.delivery_fee, 0);
            END IF;
            
            UPDATE public.wallets 
            SET escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            -- Mark escrow as refunded/cancelled
            UPDATE public.escrow_transactions 
            SET status = 'refunded', updated_at = NOW()
            WHERE order_id = NEW.order_id AND wallet_id = v_rider_wallet_id AND status = 'held';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Escrow Release
CREATE OR REPLACE FUNCTION public.handle_order_completion_settlement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT != 'completed' THEN
        -- Mark settlement as processing (awaiting admin release)
        UPDATE public.order_settlements SET status = 'processing', updated_at = NOW() WHERE order_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for manual settlement release
CREATE OR REPLACE FUNCTION public.handle_settlement_release()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_seller_earnings NUMERIC;
    v_shipment RECORD;
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC;
    v_order RECORD;
BEGIN
    IF NEW.status::TEXT = 'settled' AND OLD.status::TEXT != 'settled' THEN
        
        SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id LIMIT 1;
        
        -- Seller Payout
        v_seller_earnings := NEW.seller_amount;
        
        SELECT id INTO v_seller_wallet_id FROM public.wallets 
        WHERE user_id = v_order.seller_id OR seller_id = v_order.seller_id LIMIT 1;

        IF v_seller_wallet_id IS NOT NULL AND v_seller_earnings > 0 THEN
            UPDATE public.wallets 
            SET balance = balance + v_seller_earnings,
                escrow_balance = GREATEST(0, escrow_balance - v_seller_earnings),
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_seller_wallet_id;

            INSERT INTO public.wallet_transactions (wallet_id, order_id, amount, type, reference, idempotency_key)
            VALUES (v_seller_wallet_id, NEW.order_id, v_seller_earnings, 'settlement', 'Escrow release for Order #' || NEW.order_id, 'seller_settlement_' || NEW.order_id)
            ON CONFLICT (idempotency_key) DO NOTHING;

            UPDATE public.escrow_transactions 
            SET status = 'released', released_at = NOW(), updated_at = NOW()
            WHERE order_id = NEW.order_id AND wallet_id = v_seller_wallet_id AND status = 'held';
            
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_order.seller_id, 'payment', 'Payment of ₦' || v_seller_earnings || ' released from escrow for order #' || LEFT(NEW.order_id::TEXT, 8));
        END IF;

        -- Rider Payout
        FOR v_shipment IN SELECT rider_id, delivery_fee, rider_fee_breakdown FROM public.shipments WHERE order_id = NEW.order_id AND rider_id IS NOT NULL
        LOOP
            SELECT id INTO v_rider_wallet_id FROM public.wallets 
            WHERE user_id = v_shipment.rider_id OR seller_id = v_shipment.rider_id LIMIT 1;

            IF v_rider_wallet_id IS NOT NULL THEN
                v_rider_fee := NEW.rider_amount;

                IF v_rider_fee > 0 THEN
                    UPDATE public.wallets 
                    SET balance = balance + v_rider_fee,
                        escrow_balance = GREATEST(0, escrow_balance - v_rider_fee),
                        version = version + 1,
                        updated_at = NOW()
                    WHERE id = v_rider_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, order_id, amount, type, reference, idempotency_key)
                    VALUES (v_rider_wallet_id, NEW.order_id, v_rider_fee, 'settlement', 'Delivery earnings for Order #' || NEW.order_id, 'rider_settlement_' || NEW.order_id)
                    ON CONFLICT (idempotency_key) DO NOTHING;

                    UPDATE public.escrow_transactions 
                    SET status = 'released', released_at = NOW(), updated_at = NOW()
                    WHERE order_id = NEW.order_id AND wallet_id = v_rider_wallet_id AND status = 'held';
                    
                    INSERT INTO public.notifications (user_id, type, message)
                    VALUES (v_shipment.rider_id, 'payment', 'Delivery fee of ₦' || v_rider_fee || ' added to wallet for order #' || LEFT(NEW.order_id::TEXT, 8));
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_settlement_release ON public.order_settlements;
CREATE TRIGGER trigger_settlement_release
    AFTER UPDATE ON public.order_settlements
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_release();

-- Restore profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    zone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Restore seller_verifications table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    full_name TEXT,
    phone_number TEXT,
    business_address TEXT,
    zone TEXT,
    national_id_url TEXT,
    store_photo_url TEXT,
    bank_details JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own verification" ON public.seller_verifications;
CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own verification" ON public.seller_verifications;
CREATE POLICY "Users can insert own verification" ON public.seller_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own verification" ON public.seller_verifications;
CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all seller verifications" ON public.seller_verifications;
CREATE POLICY "Admins can view all seller verifications" ON public.seller_verifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update all seller verifications" ON public.seller_verifications;
CREATE POLICY "Admins can update all seller verifications" ON public.seller_verifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Restore logistics_kyc table
CREATE TABLE IF NOT EXISTS public.logistics_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone_number TEXT,
    nin_number TEXT,
    home_address TEXT,
    zone TEXT,
    passport_photo_url TEXT,
    id_card_photo_url TEXT,
    bank_details JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own logistics_kyc" ON public.logistics_kyc;
CREATE POLICY "Users can view own logistics_kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own logistics_kyc" ON public.logistics_kyc;
CREATE POLICY "Users can insert own logistics_kyc" ON public.logistics_kyc FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own logistics_kyc" ON public.logistics_kyc;
CREATE POLICY "Users can update own logistics_kyc" ON public.logistics_kyc FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all logistics_kyc" ON public.logistics_kyc;
CREATE POLICY "Admins can view all logistics_kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update all logistics_kyc" ON public.logistics_kyc;
CREATE POLICY "Admins can update all logistics_kyc" ON public.logistics_kyc FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Restore verification RPCs
CREATE OR REPLACE FUNCTION public.verify_seller_kyc(verification_id UUID, review_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.seller_verifications
    SET status = review_status::public.verification_status, updated_at = now()
    WHERE id = verification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(p_verification_id UUID, p_review_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.logistics_kyc
    SET status = p_review_status::public.verification_status, updated_at = now()
    WHERE id = p_verification_id;
END;
$$;

-- Payout Requests Table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES public.wallets(id),
    amount NUMERIC(10, 2) NOT NULL,
    fee_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payout requests" 
ON public.payout_requests FOR SELECT 
TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create own payout requests" 
ON public.payout_requests FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update payout requests" 
ON public.payout_requests FOR UPDATE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Issues/Disputes Table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'low',
    category TEXT,
    reporter_id UUID CONSTRAINT issues_reporter_profile_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
    seller_id UUID CONSTRAINT issues_seller_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    evidence_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all issues" 
ON public.issues FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own issues" 
ON public.issues FOR SELECT 
TO authenticated 
USING (reporter_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create issues" 
ON public.issues FOR INSERT 
TO authenticated 
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can update issues" 
ON public.issues FOR UPDATE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Admin Revenue Aggregation RPC
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_received', COALESCE(os.gross, 0),
    'seller_total', COALESCE(os.seller, 0),
    'rider_total', COALESCE(os.rider, 0),
    'platform_total', COALESCE(os.platform, 0) + COALESCE(pr.fees, 0),
    'promoter_total', COALESCE(os.promoter, 0)
  )
  FROM (
    SELECT 
      SUM(gross_amount) as gross,
      SUM(seller_amount) as seller,
      SUM(rider_amount) as rider,
      SUM(platform_amount) as platform,
      SUM(promoter_amount) as promoter
    FROM public.order_settlements
    WHERE status IN ('pending', 'processing', 'settled', 'partially_settled')
  ) os
  CROSS JOIN (
    SELECT SUM(fee_amount) as fees
    FROM public.payout_requests
    WHERE status IN ('approved', 'completed')
  ) pr;
$$;

-- Add settlement_status to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'settled', 'partially_settled', 'failed', 'refunded'));

-- Force release all funds RPC
CREATE OR REPLACE FUNCTION public.force_release_all_funds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE public.orders 
    SET status = 'completed',
        settlement_status = 'settled'
    WHERE status = 'delivered';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN json_build_object(
        'success', true,
        'message', 'Successfully released funds for ' || v_updated_count || ' orders.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

-- Test/Debug RPC to force release all held escrow funds immediately
CREATE OR REPLACE FUNCTION public.test_move_all_escrow_to_balance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Force transition all active orders to 'completed'
    -- This triggers handle_order_completion_settlement() to set order_settlements to processing
    UPDATE public.orders 
    SET status = 'completed',
        settlement_status = 'settled'
    WHERE status NOT IN ('completed', 'cancelled');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Now force all processing settlements to 'settled'
    -- This triggers handle_settlement_release() which actually moves the funds to the wallet balances
    UPDATE public.order_settlements
    SET status = 'settled',
        updated_at = NOW()
    WHERE status IN ('pending', 'processing');

    RETURN json_build_object(
        'success', true,
        'message', 'Successfully forced completion and settlement for ' || v_updated_count || ' active orders.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

-- RLS Policies for Admins to manage cities and zones
CREATE POLICY "Admins can insert cities" ON public.cities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update cities" ON public.cities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete cities" ON public.cities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert delivery zones" ON public.delivery_zones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update delivery zones" ON public.delivery_zones FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete delivery zones" ON public.delivery_zones FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Missing RPC Function for Logistics
CREATE OR REPLACE FUNCTION public.claim_order_mission(p_shipment_id UUID, p_rider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
    v_shipment record;
    v_result JSONB;
BEGIN
    -- p_shipment_id could actually be an order_id from the broadcast feed
    -- Let's check if it's an order_id first.
    SELECT * INTO v_order FROM public.orders WHERE id = p_shipment_id;

    IF v_order.id IS NOT NULL THEN
        -- It's an order ID. Check if a shipment already exists.
        SELECT * INTO v_shipment FROM public.shipments WHERE order_id = v_order.id;
        
        IF v_shipment.id IS NULL THEN
            -- Create the shipment
            INSERT INTO public.shipments (
                order_id, 
                rider_id, 
                seller_id, 
                status,
                delivery_fee
            ) VALUES (
                v_order.id,
                p_rider_id,
                v_order.seller_id,
                'assigned',
                COALESCE(v_order.shipping_fee, 1500)
            ) RETURNING * INTO v_shipment;
        ELSE
            IF v_shipment.rider_id IS NOT NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'Mission already accepted');
            END IF;
            
            -- Update existing shipment
            UPDATE public.shipments
            SET rider_id = p_rider_id,
                status = 'assigned',
                updated_at = NOW()
            WHERE id = v_shipment.id
            RETURNING * INTO v_shipment;
        END IF;

        -- Also update the order status
        UPDATE public.orders 
        SET status = 'accepted', updated_at = NOW()
        WHERE id = v_order.id;

        RETURN jsonb_build_object('success', true, 'order_id', v_order.id, 'shipment_id', v_shipment.id);
    ELSE
        -- It's a shipment ID.
        SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id;
        
        IF v_shipment.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
        END IF;
        
        IF v_shipment.rider_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Mission already accepted');
        END IF;
        
        UPDATE public.shipments
        SET rider_id = p_rider_id,
            status = 'assigned',
            updated_at = NOW()
        WHERE id = v_shipment.id
        RETURNING * INTO v_shipment;
        
        UPDATE public.orders
        SET status = 'accepted', updated_at = NOW()
        WHERE id = v_shipment.order_id;

        RETURN jsonb_build_object('success', true, 'order_id', v_shipment.order_id, 'shipment_id', v_shipment.id);
    END IF;
END;
$$;

-- Trigger to sync shipment status to order status
CREATE OR REPLACE FUNCTION public.sync_order_status_with_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'picked_up' THEN
            UPDATE public.orders SET status = 'picked_up', updated_at = NOW() WHERE id = NEW.order_id;
        ELSIF NEW.status = 'in_transit' THEN
            UPDATE public.orders SET status = 'out_for_delivery', updated_at = NOW() WHERE id = NEW.order_id;
        ELSIF NEW.status = 'delivered' THEN
            UPDATE public.orders SET status = 'delivered', updated_at = NOW() WHERE id = NEW.order_id;
        ELSIF NEW.status = 'cancelled' THEN
            UPDATE public.orders SET status = 'cancelled', updated_at = NOW() WHERE id = NEW.order_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status ON public.shipments;
CREATE TRIGGER trg_sync_order_status
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_status_with_shipment();

-- RPC Function for settling completed orders
CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
BEGIN
    -- 1. Fetch order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF v_order.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is already completed');
    END IF;

    -- 2. Update order status to completed
    -- This will automatically trigger the handle_order_status_change() function 
    -- which perfectly handles the escrow release, rider payouts, and wallet transactions!
    UPDATE public.orders 
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Also mark shipment as delivered if not already
    UPDATE public.shipments
    SET status = 'delivered', updated_at = NOW()
    WHERE order_id = p_order_id AND status != 'delivered';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Trigger for deducting wallet balance on payout request
CREATE OR REPLACE FUNCTION public.handle_payout_request_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_total_deduction NUMERIC;
BEGIN
    v_total_deduction := NEW.amount + NEW.fee_amount;

    -- Check if balance is sufficient
    IF NOT EXISTS (
        SELECT 1 FROM public.wallets 
        WHERE id = NEW.wallet_id AND balance >= v_total_deduction
    ) THEN
        RAISE EXCEPTION 'Insufficient balance to cover withdrawal amount and fee';
    END IF;

    -- Deduct from balance
    UPDATE public.wallets
    SET balance = balance - v_total_deduction,
        updated_at = NOW()
    WHERE id = NEW.wallet_id;

    -- Insert wallet transaction for the withdrawal
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (NEW.wallet_id, -NEW.amount, 'withdrawal', 'Withdrawal Request');

    -- Insert wallet transaction for the fee
    IF NEW.fee_amount > 0 THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (NEW.wallet_id, -NEW.fee_amount, 'withdrawal_fee', 'Withdrawal Fee');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_payout_request_insert
    BEFORE INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payout_request_insert();


-- Trigger for refunding wallet balance if payout is rejected
CREATE OR REPLACE FUNCTION public.handle_payout_request_update()
RETURNS TRIGGER AS $$
DECLARE
    v_total_refund NUMERIC;
BEGIN
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        v_total_refund := NEW.amount + NEW.fee_amount;

        -- Refund balance
        UPDATE public.wallets
        SET balance = balance + v_total_refund,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;

        -- Insert refund transaction
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (NEW.wallet_id, v_total_refund, 'refund', 'Withdrawal Request Rejected');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_payout_request_update
    AFTER UPDATE ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payout_request_update();

-- Function for automated escrow releases
CREATE OR REPLACE FUNCTION public.process_automated_escrow_releases()
RETURNS void AS $$
DECLARE
    v_release_days INT;
    v_updated_count INT;
BEGIN
    -- Get the configured release days from settings
    SELECT (value->>0)::int INTO v_release_days 
    FROM public.system_settings 
    WHERE key = 'escrow_release_days';
    
    IF v_release_days IS NULL THEN
        v_release_days := 3; -- fallback
    END IF;

    -- Update settlements that have been processing for > v_release_days
    -- This triggers handle_settlement_release() to move the funds to wallets
    UPDATE public.order_settlements
    SET status = 'settled',
        updated_at = NOW()
    WHERE status = 'processing' 
    AND updated_at <= (NOW() - (v_release_days || ' days')::INTERVAL);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE LOG 'Automated escrow release processed % settlements', v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To run this automatically, execute the following in the Supabase SQL editor:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('process_automated_escrow_releases', '0 * * * *', 'SELECT public.process_automated_escrow_releases()');


-- Admin Policies for Orders and Shipments
DO $admin_pol$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
    CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
    CREATE POLICY "Admins can update all orders" ON public.orders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all order_items" ON public.order_items;
    CREATE POLICY "Admins can view all order_items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all order_recipients" ON public.order_recipient;
    CREATE POLICY "Admins can view all order_recipients" ON public.order_recipient FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all shipments" ON public.shipments;
    CREATE POLICY "Admins can view all shipments" ON public.shipments FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all shipments" ON public.shipments;
    CREATE POLICY "Admins can update all shipments" ON public.shipments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $admin_pol$;

-- Admin Policies for Order Settlements
DO $admin_pol_os$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all order_settlements" ON public.order_settlements;
    CREATE POLICY "Admins can view all order_settlements" ON public.order_settlements FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all order_settlements" ON public.order_settlements;
    CREATE POLICY "Admins can update all order_settlements" ON public.order_settlements FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $admin_pol_os$;
