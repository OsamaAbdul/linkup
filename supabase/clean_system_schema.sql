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
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    home_address TEXT NOT NULL,
    passport_photo_url TEXT,
    city_id UUID REFERENCES public.cities(id),
    zone_id UUID REFERENCES public.delivery_zones(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
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

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 11. SECURITY (RLS)
DO $rls$ BEGIN
    ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
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
    
    DROP POLICY IF EXISTS "Users view own verification" ON public.seller_verifications;
    CREATE POLICY "Users view own verification" ON public.seller_verifications FOR SELECT USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "Users manage own verification" ON public.seller_verifications;

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

-- Escrow Release Trigger
CREATE OR REPLACE FUNCTION public.handle_shipment_delivery_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_total NUMERIC;
    v_seller_id UUID;
    v_wallet_id UUID;
BEGIN
    -- release funds when shipment is 'delivered'
    IF NEW.status::TEXT = 'delivered' AND OLD.status::TEXT != 'delivered' THEN
        v_order_id := NEW.order_id;
        
        -- Get order details
        SELECT total, seller_id INTO v_total, v_seller_id 
        FROM public.orders WHERE id = v_order_id;

        -- Find seller's wallet
        SELECT id INTO v_wallet_id FROM public.wallets 
        WHERE user_id = v_seller_id OR seller_id = v_seller_id LIMIT 1;

        IF v_wallet_id IS NOT NULL THEN
            -- Move from escrow to balance
            UPDATE public.wallets 
            SET balance = balance + v_total,
                escrow_balance = GREATEST(0, escrow_balance - v_total),
                updated_at = NOW()
            WHERE id = v_wallet_id;

            -- Record Transaction
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_wallet_id, v_total, 'settlement', 'Escrow release for Order #' || v_order_id);
            
            -- Notify Seller
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_seller_id, 'payment', 'Payment of ₦' || v_total || ' released from escrow for order #' || LEFT(v_order_id::TEXT, 8));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_release_escrow_on_delivery
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_shipment_delivery_settlement();

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
END $st$;

-- 14. REALTIME
DO $rt$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
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
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 1500;
END $recon$;

-- 16. SCHEMA RELOAD
-- Refreshes PostgREST cache to prevent 'column not found in schema cache' errors.
NOTIFY pgrst, 'reload schema';
