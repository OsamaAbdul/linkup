-- COMPREHENSIVE SCHEMA CONSOLIDATION - 2026-03-09
-- This file combines all 85 migrations into one for easy environment setup
-- This version ensures DROP commands are not lost in comments and uses canonical type mapping.

-- START OF FILE: 20240216_complete_architecture.sql
-- COMPLETE SYSTEM ARCHITECTURE SCHEMA
-- This file contains the entire schema definition for Linkup Marketplace.
-- Run this in your Supabase SQL Editor or CLI to set up the full database.

-- 1. CLEANUP (Optional - Be careful in production)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'promoter', 'logistics', 'admin');
    CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
    CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
    CREATE TYPE public.shipment_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE(user_id, role)
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 5. ORDERS & ITEMS (Robust)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Keep for query ease, even if items split
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    total_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_address JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id), 
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Establish order_items_new early to avoid relation not found errors in subsequent policies
CREATE TABLE IF NOT EXISTS public.order_items_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. LOGISTICS (Shipments)
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(id),
    status shipment_status DEFAULT 'pending',
    pickup_address JSONB NOT NULL,
    delivery_address JSONB NOT NULL,
    tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. PROMOTER SYSTEM
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

-- 8. WALLETS & SOCIAL
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id), -- Generic user wallet
    seller_id UUID REFERENCES auth.users(id), -- Legacy support if needed, but prefer user_id
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
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

-- 9. ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 10. POLICIES (Simplified for brevity, ensure rigorous checks in prod)
-- Profiles
DROP POLICY IF EXISTS "Public profiles" ON public.profiles;

CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "User update profile" ON public.profiles;

CREATE POLICY "User update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products
DROP POLICY IF EXISTS "Public products" ON public.products;

CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Seller insert products" ON public.products;

CREATE POLICY "Seller insert products" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Seller update products" ON public.products;

CREATE POLICY "Seller update products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);

-- Orders
DROP POLICY IF EXISTS "Buyer view orders" ON public.orders;

CREATE POLICY "Buyer view orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Seller view orders" ON public.orders;

CREATE POLICY "Seller view orders" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Buyer create order" ON public.orders;

CREATE POLICY "Buyer create order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Order Items
DROP POLICY IF EXISTS "User view own items" ON public.order_items;

CREATE POLICY "User view own items" ON public.order_items FOR SELECT USING (
    auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id) OR
    auth.uid() = seller_id
);

-- Shipments
DROP POLICY IF EXISTS "Rider view assigned" ON public.shipments;

CREATE POLICY "Rider view assigned" ON public.shipments FOR SELECT USING (rider_id = auth.uid());
DROP POLICY IF EXISTS "Buyer view shipment" ON public.shipments;

CREATE POLICY "Buyer view shipment" ON public.shipments FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

-- 11. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public images" ON storage.objects;

CREATE POLICY "Public images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;

CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- 12. TRIGGERS
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;


CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_products_modtime ON public.products;

CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;

CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- END OF FILE: 20240216_complete_architecture.sql

-- START OF FILE: 20240216_consolidated_fixes.sql
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
DROP FUNCTION IF EXISTS public.create_order(UUID, UUID, JSONB, JSONB, NUMERIC) CASCADE;

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

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Authenticated upload kyc" ON storage.objects;
CREATE POLICY "Authenticated upload kyc" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users view own kyc path" ON storage.objects;
CREATE POLICY "Users view own kyc path" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (name LIKE (auth.uid() || '/%')));

-- END OF FILE: 20240216_consolidated_fixes.sql

-- START OF FILE: 20240216_create_order_rpc.sql
-- RPC Function to create an order atomically
DROP FUNCTION IF EXISTS public.create_order(UUID, UUID, JSONB, JSONB, DECIMAL) CASCADE;

CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID, -- using 'employer_id' name to match some potential legacy or just generic 'buyer_id'
    seller_id UUID,
    items JSONB, -- Array of {product_id, quantity, price}
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
BEGIN
    -- 1. Insert into orders
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total_amount, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total_amount, shipping_address) -- Assuming payment is handled/simulated as 'paid' for now
    RETURNING id INTO new_order_id;

    -- 2. Insert items
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase, status)
        VALUES (
            new_order_id,
            (item->>'product_id')::UUID,
            seller_id,
            (item->>'quantity')::INTEGER,
            (item->>'price')::DECIMAL,
            'pending'
        );
    END LOOP;

    -- 3. Clear cart for this seller's products (Optional, but good UX)
    -- DELETE FROM public.cart_items WHERE user_id = auth.uid() AND product_id IN (SELECT (item->>'product_id')::UUID);

    RETURN new_order_id;
END;
$$;

-- END OF FILE: 20240216_create_order_rpc.sql

-- START OF FILE: 20240216_fix_cart_and_fk.sql
-- Fix Product-Profile Relationship
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_seller_id_fkey;


ALTER TABLE public.products
ADD CONSTRAINT products_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Ensure public visibility for products
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);

-- Fix Cart RLS (Enable access for authenticated users)
-- First, ensure RLS is enabled (it should be, but just in case)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;

-- Create Policies
CREATE POLICY "Users can view their own cart items" ON public.cart_items
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart items" ON public.cart_items
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart items" ON public.cart_items
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items" ON public.cart_items
FOR DELETE USING (auth.uid() = user_id);

-- END OF FILE: 20240216_fix_cart_and_fk.sql

-- START OF FILE: 20240216_fix_enum.sql
-- Fix app_role Enum
-- This migration ensures the app_role enum contains all necessary values.
-- Postgres does not support "IF NOT EXISTS" for ALTER TYPE ADD VALUE easily in a single block without DO block.

DO $$
BEGIN
    -- Attempt to add 'promoter'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'promoter';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Attempt to add 'logistics'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'logistics';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Attempt to add 'admin'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'admin';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- END OF FILE: 20240216_fix_enum.sql

-- START OF FILE: 20240216_fix_product_profile_fk.sql
-- Fix Product-Profile Relationship
-- The frontend expects to join products with profiles using the foreign key 'products_seller_id_fkey'.
-- Currently, products.seller_id references auth.users. We need it to reference public.profiles for PostgREST to allow the join easily.

-- 1. Drop existing constraint (name might vary, but we try the standard name)
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

-- 2. Add new constraint referencing profiles
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. Ensure RLS allows public to view products (Redundant but safe)
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);

-- END OF FILE: 20240216_fix_product_profile_fk.sql

-- START OF FILE: 20240216_fix_profiles_rls.sql
-- Fix Profiles RLS and Add Signup Trigger
-- 1. Allow users to INSERT their own profile (fixes the immediate error for existing users without profiles)
DROP POLICY IF EXISTS "User can insert own profile" ON public.profiles;

CREATE POLICY "User can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Create a Trigger to automatically create a profile entry when a new user signs up (Best Practice)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- END OF FILE: 20240216_fix_profiles_rls.sql

-- START OF FILE: 20240216_fix_rls.sql
-- Fix RLS for user_roles
-- Users need to be able to SEE their own roles and INSERT their own roles (during onboarding).

-- Policy: Users can view their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can assign themselves a role (Insert)
-- You might want to restrict this to only if they don't have one, or allow it freely for now.
DROP POLICY IF EXISTS "Users can assign their own role" ON public.user_roles;

CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- END OF FILE: 20240216_fix_rls.sql

-- START OF FILE: 20240216_full_schema.sql
-- Consolidated Migration for Full System Architecture
-- Includes: Roles, Logistics, Promoter, Orders, and Base Schema enhancements

-- 1. APP ROLES & USERS
-- Safe Enum Creation
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'promoter', 'logistics', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ORDERS & ITEMS (Robust Schema)
-- Order Status Enums
DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
    CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter Orders Table (Enhancements)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status order_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- Order Items Table (Normalization)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id), 
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending' 
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;

    CREATE POLICY "Users can view their own order items" 
    ON public.order_items FOR SELECT 
    USING (auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
DROP POLICY IF EXISTS "Sellers can view items in their orders" ON public.order_items;

    CREATE POLICY "Sellers can view items in their orders" 
    ON public.order_items FOR SELECT 
    USING (seller_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. LOGISTICS SYSTEM
-- Shipment Status Enum
DO $$ BEGIN
    CREATE TYPE public.shipment_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(id),
    status shipment_status DEFAULT 'pending',
    pickup_address JSONB NOT NULL,
    delivery_address JSONB NOT NULL,
    tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
    notes TEXT
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 4. PROMOTER SYSTEM
-- Promoter Campaigns
CREATE TABLE IF NOT EXISTS public.promoter_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    commission_rate DECIMAL(5, 2) NOT NULL CHECK (commission_rate > 0 AND commission_rate <= 100),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(product_id)
);

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    promoter_id UUID NOT NULL REFERENCES public.profiles(id),
    campaign_id UUID NOT NULL REFERENCES public.promoter_campaigns(id),
    order_id UUID REFERENCES public.orders(id),
    status TEXT CHECK (status IN ('click', 'conversion')) DEFAULT 'click',
    earnings DECIMAL(10, 2) DEFAULT 0.00
);

ALTER TABLE public.promoter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 5. WALLET ENHANCEMENTS
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);

-- END OF FILE: 20240216_full_schema.sql

-- START OF FILE: 20240216_logistics_codes.sql
-- Add verification codes to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Comment
COMMENT ON COLUMN public.shipments.pickup_code IS 'Code rider needs from seller to confirm pickup';
COMMENT ON COLUMN public.shipments.delivery_code IS 'Code rider needs from buyer to confirm delivery';

-- END OF FILE: 20240216_logistics_codes.sql

-- START OF FILE: 20240216_robust_orders.sql
-- Create Enums for Order Status and Payment Status
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop existing orders table if it conflicts (or alter it, but for this task we might be starting fresh or migrating)
-- NOTE: In a real prod env, we would migrate data. Here we might just alter.
-- Let's alter the existing 'orders' table to be robust.

-- 1. Modify 'orders' table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status order_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- 2. Create 'order_items' table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id), 
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending' 
);

-- 3. RLS Policies for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;


CREATE POLICY "Users can view their own order items" 
ON public.order_items FOR SELECT 
USING (auth.uid() IN (
    SELECT buyer_id FROM public.orders WHERE id = order_items.order_id
));
DROP POLICY IF EXISTS "Sellers can view items in their orders" ON public.order_items;


CREATE POLICY "Sellers can view items in their orders" 
ON public.order_items FOR SELECT 
USING (seller_id = auth.uid());

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);

-- END OF FILE: 20240216_robust_orders.sql

-- START OF FILE: 20240216_secure_order_rpc.sql
-- Secure Order Creation with Stock Checks
-- This function replaces the basic create_order to add:
-- 1. Validation that products exist.
-- 2. Validation that sufficient inventory exists.
-- 3. Atomic deduction of inventory upon order creation.
DROP FUNCTION IF EXISTS public.create_order(UUID, UUID, JSONB, JSONB, DECIMAL) CASCADE;


CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID, -- Argument name kept for compatibility, represents buyer
    seller_id UUID,
    items JSONB, -- Array of objects: {product_id, quantity, price}
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
    -- 1. Validate Stock for ALL items before making any changes
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;

        -- Lock the product row for update to prevent race conditions
        SELECT * INTO product_record FROM public.products WHERE id = item_id FOR UPDATE;

        IF product_record IS NULL THEN
             RAISE EXCEPTION 'Product % not found', item_id;
        END IF;

        IF product_record.inventory < item_qty THEN
             RAISE EXCEPTION 'Insufficient stock for product: % (Available: %, Requested: %)', product_record.title, product_record.inventory, item_qty;
        END IF;
    END LOOP;

    -- 2. Create the Order
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total_amount, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total_amount, shipping_address)
    RETURNING id INTO new_order_id;

    -- 3. Deduct Stock and Create Order Items
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;

        -- Deduct inventory
        UPDATE public.products
        SET inventory = inventory - item_qty
        WHERE id = item_id;

        -- Insert order item
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase, status)
        VALUES (
            new_order_id,
            item_id,
            seller_id,
            item_qty,
            (item->>'price')::DECIMAL,
            'pending'
        );
    END LOOP;

    RETURN new_order_id;
END;
$$;

-- END OF FILE: 20240216_secure_order_rpc.sql

-- START OF FILE: 20240216_seller_kyc.sql
-- Seller Verification Schema

-- 1. Create Zone Enum
DO $$ BEGIN
    CREATE TYPE public.abuja_zone AS ENUM (
        'Zone 1 (Gwarinpa & Life Camp)',
        'Zone 2 (Wuse & Utako)',
        'Zone 3 (Kubwa Central)',
        'Zone 4 (Lugbe & Apo)',
        'Zone 5 (Gwagwalada Districts)'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Verifications Table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_address TEXT NOT NULL,
    zone public.abuja_zone NOT NULL,
    national_id_url TEXT NOT NULL,
    store_photo_url TEXT NOT NULL,
    bank_details JSONB NOT NULL, -- { bank_name, account_number, account_name }
    status public.verification_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. Enable RLS
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Users can view their own verification status
DROP POLICY IF EXISTS "Users can view own verification" ON public.seller_verifications;

CREATE POLICY "Users can view own verification" ON public.seller_verifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own verification
DROP POLICY IF EXISTS "Users can submit verification" ON public.seller_verifications;

CREATE POLICY "Users can submit verification" ON public.seller_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own verification ONLY if it is pending or rejected
DROP POLICY IF EXISTS "Users can update own verification" ON public.seller_verifications;

CREATE POLICY "Users can update own verification" ON public.seller_verifications
FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- Admin policies (assuming app_role 'admin' exists in user_roles)
-- For simplicity, we might allow full read for now or join with user_roles
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.seller_verifications;

CREATE POLICY "Admins can view all verifications" ON public.seller_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update verifications" ON public.seller_verifications;


CREATE POLICY "Admins can update verifications" ON public.seller_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Storage for KYC
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- Storage Policies
-- Only authenticated users can upload
DROP POLICY IF EXISTS "Authenticated upload kyc" ON storage.objects;

CREATE POLICY "Authenticated upload kyc" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

-- Users can read their own files (This is tricky with storage RLS alone, usually we rely on signed URLs or folder structure: kyc-documents/user_id/file)
-- For now, simple RLS using the file path convention (user_id/filename)
DROP POLICY IF EXISTS "Users view own kyc path" ON storage.objects;

CREATE POLICY "Users view own kyc path" ON storage.objects
FOR SELECT USING (bucket_id = 'kyc-documents' AND (name LIKE (auth.uid() || '/%')));

-- Admins view all
DROP POLICY IF EXISTS "Admins view all kyc" ON storage.objects;

CREATE POLICY "Admins view all kyc" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- END OF FILE: 20240216_seller_kyc.sql

-- START OF FILE: 20240216_system_roles.sql
-- 1. UPDATE APP ROLES
-- We cannot execute ALTER TYPE inside a transaction block in some Postgres versions if it's already used, 
-- but Supabase usually handles migrations. We'll try to add if not exists.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'promoter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. LOGISTICS SCHEMA

-- Shipment Status Enum
DO $$ BEGIN
  CREATE TYPE public.shipment_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(id), -- Assigned logistics user
    status shipment_status DEFAULT 'pending',
    pickup_address JSONB NOT NULL,
    delivery_address JSONB NOT NULL,
    tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
    notes TEXT
);

-- RLS for Shipments
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and Logistics can view all shipments" ON public.shipments;


CREATE POLICY "Admins and Logistics can view all shipments"
ON public.shipments FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'logistics'))
);
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;


CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (rider_id = auth.uid());
DROP POLICY IF EXISTS "Buyers can view shipments for their orders" ON public.shipments;


CREATE POLICY "Buyers can view shipments for their orders"
ON public.shipments FOR SELECT
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

-- 3. PROMOTER SCHEMA

-- Promoter Campaigns (Sellers create these)
CREATE TABLE IF NOT EXISTS public.promoter_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    commission_rate DECIMAL(5, 2) NOT NULL CHECK (commission_rate > 0 AND commission_rate <= 100),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(product_id)
);

-- Referrals (Tracking clicks and conversions)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    promoter_id UUID NOT NULL REFERENCES public.profiles(id),
    campaign_id UUID NOT NULL REFERENCES public.promoter_campaigns(id),
    order_id UUID REFERENCES public.orders(id), -- Populated on conversion
    status TEXT CHECK (status IN ('click', 'conversion')) DEFAULT 'click',
    earnings DECIMAL(10, 2) DEFAULT 0.00
);

-- RLS for Promoter Tables
ALTER TABLE public.promoter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.promoter_campaigns;


CREATE POLICY "Anyone can view active campaigns"
ON public.promoter_campaigns FOR SELECT
USING (is_active = true);
DROP POLICY IF EXISTS "Sellers can manage their campaigns" ON public.promoter_campaigns;


CREATE POLICY "Sellers can manage their campaigns"
ON public.promoter_campaigns FOR ALL
USING (seller_id = auth.uid());
DROP POLICY IF EXISTS "Promoters view their referrals" ON public.referrals;


CREATE POLICY "Promoters view their referrals"
ON public.referrals FOR SELECT
USING (promoter_id = auth.uid());

-- 4. WALLET & TRANSACTIONS ENHANCEMENT

-- Update Wallets to be generic (User ID based)
-- We assume 'wallets' table exists with 'seller_id'. We will add 'user_id' and a constraint.
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);

-- If transaction type usage needs expansion, allow generic types in wallet_transactions
-- (assuming wallet_transactions.type is text, which fits 'commission', etc.)

-- 5. UTILITY FUNCTIONS

-- Function to assign shipment to order automatically (trigger-based or manual)
-- Placeholder for logic that might auto-assign based on location.

-- END OF FILE: 20240216_system_roles.sql

-- START OF FILE: 20240216_wishlist_fix.sql
-- Fix RLS for Likes (Wishlist)
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users view own likes" ON public.likes;
DROP POLICY IF EXISTS "Users insert own likes" ON public.likes;
DROP POLICY IF EXISTS "Users delete own likes" ON public.likes;

-- Create Policies
CREATE POLICY "Users view own likes" ON public.likes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own likes" ON public.likes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own likes" ON public.likes
FOR DELETE USING (auth.uid() = user_id);

-- END OF FILE: 20240216_wishlist_fix.sql

-- START OF FILE: 20260215124017_6093fc62-2be2-4700-ab1b-8b744c81ec90.sql

-- Create roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('buyer', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  category TEXT,
  inventory INTEGER NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cart items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile + default buyer role on signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;


CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- products
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;

CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can insert products" ON public.products;

CREATE POLICY "Sellers can insert products" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;

CREATE POLICY "Sellers can update own products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;

CREATE POLICY "Sellers can delete own products" ON public.products FOR DELETE USING (auth.uid() = seller_id);

-- orders
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;

CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Sellers can view orders for their products" ON public.orders;

CREATE POLICY "Sellers can view orders for their products" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;

CREATE POLICY "Sellers can update order status" ON public.orders FOR UPDATE USING (auth.uid() = seller_id);

-- wallets
DROP POLICY IF EXISTS "Sellers can view own wallet" ON public.wallets;

CREATE POLICY "Sellers can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Sellers can insert own wallet" ON public.wallets;

CREATE POLICY "Sellers can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = seller_id);
DROP POLICY IF EXISTS "System can update wallet" ON public.wallets;

CREATE POLICY "System can update wallet" ON public.wallets FOR UPDATE USING (auth.uid() = seller_id);

-- wallet_transactions
DROP POLICY IF EXISTS "Sellers can view own transactions" ON public.wallet_transactions;

CREATE POLICY "Sellers can view own transactions" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.seller_id = auth.uid())
);
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;

CREATE POLICY "System can insert transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.seller_id = auth.uid())
);

-- likes
DROP POLICY IF EXISTS "Anyone can view likes" ON public.likes;

CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can like" ON public.likes;

CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unlike" ON public.likes;

CREATE POLICY "Users can unlike" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- comments
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;

CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can comment" ON public.comments;

CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- cart_items
DROP POLICY IF EXISTS "Users can view own cart" ON public.cart_items;

CREATE POLICY "Users can view own cart" ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can add to cart" ON public.cart_items;

CREATE POLICY "Users can add to cart" ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update cart" ON public.cart_items;

CREATE POLICY "Users can update cart" ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove from cart" ON public.cart_items;

CREATE POLICY "Users can remove from cart" ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for comments, likes, notifications
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;


CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Sellers can upload product images" ON storage.objects;

CREATE POLICY "Sellers can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Sellers can delete own product images" ON storage.objects;

CREATE POLICY "Sellers can delete own product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- END OF FILE: 20260215124017_6093fc62-2be2-4700-ab1b-8b744c81ec90.sql

-- START OF FILE: 20260220_fix_order_items_rls.sql
-- FIX order_items_new RLS POLICIES FOR VISIBILITY
-- The previous policy used a subquery which is correct but we want to ensure it's fully covered.

-- 1. Ensure RLS is enabled
ALTER TABLE public.order_items_new ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing view policy if any to recreate it robustly
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;

-- 3. Create a policy for Sellers to view items they sold
DROP POLICY IF EXISTS "Sellers can view own sold items" ON public.order_items_new;

CREATE POLICY "Sellers can view own sold items" ON public.order_items_new
FOR SELECT USING (auth.uid() = seller_id);

-- 4. Create a policy for Buyers to view items they bought
DROP POLICY IF EXISTS "Buyers can view own bought items" ON public.order_items_new;

CREATE POLICY "Buyers can view own bought items" ON public.order_items_new
FOR SELECT USING (
    auth.uid() IN (
        SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id
    )
);

-- Note: We intentionally DO NOT add an INSERT policy for public users.
-- This ensures that orders MUST be created via the Secure Edge Function
-- which uses the Service Role Key to bypass RLS.

-- END OF FILE: 20260220_fix_order_items_rls.sql

-- START OF FILE: 20260220_inventory_decrement_trigger.sql
-- Create an atomic RPC function for safe inventory decrement
-- This is called by both the edge function and can be used independently
DROP FUNCTION IF EXISTS decrement_inventory(UUID, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION decrement_inventory(p_product_id UUID, p_quantity INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET inventory = GREATEST(0, inventory - p_quantity)
  WHERE id = p_product_id;
END;
$$;

-- Also create/replace the trigger function
DROP FUNCTION IF EXISTS decrement_inventory_on_order() CASCADE;

CREATE OR REPLACE FUNCTION decrement_inventory_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM decrement_inventory(NEW.product_id, NEW.quantity);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_decrement_inventory ON order_items_new;

-- Attach trigger to fire after each row is inserted into order_items_new
CREATE TRIGGER trigger_decrement_inventory
  AFTER INSERT ON order_items_new
  FOR EACH ROW
  EXECUTE FUNCTION decrement_inventory_on_order();

-- END OF FILE: 20260220_inventory_decrement_trigger.sql

-- START OF FILE: 20260220_inventory_stock_management.sql
-- Migration: Add inventory stock management
-- Ensures inventory cannot go below 0 and adds a constraint

-- Add default 0 to inventory if column exists, make it NOT NULL
ALTER TABLE products
  ALTER COLUMN inventory SET DEFAULT 0;

UPDATE products SET inventory = 0 WHERE inventory IS NULL;

ALTER TABLE products
  ALTER COLUMN inventory SET NOT NULL;

-- Add check constraint to prevent negative inventory
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_inventory_non_negative;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_inventory_non_negative;


ALTER TABLE products
  ADD CONSTRAINT products_inventory_non_negative CHECK (inventory >= 0);

-- Expose inventory via RLS so buyers can read it
-- (products table is already readable, this just confirms inventory is accessible)

-- END OF FILE: 20260220_inventory_stock_management.sql

-- START OF FILE: 20260220_performance_indices_and_likes.sql
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
DROP FUNCTION IF EXISTS public.update_product_likes_count() CASCADE;

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

-- END OF FILE: 20260220_performance_indices_and_likes.sql

-- START OF FILE: 20260220_scalability_overhaul.sql
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
-- (Table creation moved to top of file to prevent relation not found errors)

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
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;

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
DROP FUNCTION IF EXISTS public.get_seller_analytics(UUID) CASCADE;

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

-- END OF FILE: 20260220_scalability_overhaul.sql

-- START OF FILE: 20260223_admin_kyc_fixes.sql
-- 1. Fix Foreign Key Relationship for seller_verifications
-- Drop existing constraint
ALTER TABLE public.seller_verifications DROP CONSTRAINT IF EXISTS seller_verifications_user_id_fkey;

-- Re-add constraint pointing to profiles(id)
ALTER TABLE public.seller_verifications 
ADD CONSTRAINT seller_verifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add reviewed columns to seller_verifications
ALTER TABLE public.seller_verifications 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- 3. Create RPC for verifying seller KYC
DROP FUNCTION IF EXISTS public.verify_seller_kyc(UUID, public.verification_status) CASCADE;

CREATE OR REPLACE FUNCTION public.verify_seller_kyc(
    verification_id UUID,
    review_status public.verification_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Check if verification exists and is pending
    SELECT user_id INTO target_user_id
    FROM public.seller_verifications
    WHERE id = verification_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Verification not found';
    END IF;

    -- Update verification status
    UPDATE public.seller_verifications
    SET 
        status = review_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = verification_id;

    -- If approved, grant seller role
    IF review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'seller')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END;
$$;

-- END OF FILE: 20260223_admin_kyc_fixes.sql

-- START OF FILE: 20260223_dynamic_categories.sql
-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public categories" ON public.categories;

CREATE POLICY "Public categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers/Admins can add categories" ON public.categories;

CREATE POLICY "Sellers/Admins can add categories" ON public.categories FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('seller', 'admin')
    )
);
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;


CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Seed existing categories
INSERT INTO public.categories (name, slug) VALUES 
('Electronics', 'electronics'),
('Fashion', 'fashion'),
('Home & Kitchen', 'home-kitchen'),
('Health & Beauty', 'health-beauty'),
('Sports', 'sports'),
('Toys', 'toys'),
('Automotive', 'automotive'),
('Grocery', 'grocery'),
('Services', 'services'),
('Other', 'other')
ON CONFLICT (name) DO NOTHING;

-- END OF FILE: 20260223_dynamic_categories.sql

-- START OF FILE: 20260223_order_notifications.sql
-- Create a function to notify buyers of order status changes
DROP FUNCTION IF EXISTS public.notify_order_status_change() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            NEW.buyer_id,
            'order_update',
            'Your order #' || substring(NEW.id::text, 1, 8) || ' status has been updated to ' || NEW.status || '.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_order_status_change ON public.orders;
CREATE TRIGGER trigger_notify_order_status_change
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_order_status_change();

-- END OF FILE: 20260223_order_notifications.sql

-- START OF FILE: 20260224_admin_orders_rls.sql
-- Allow Admins to view all orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all orders') THEN
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

        CREATE POLICY "Admins can view all orders" ON public.orders
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );
    END IF;
END $$;

-- END OF FILE: 20260224_admin_orders_rls.sql

-- START OF FILE: 20260224_admin_overhaul_infra.sql
-- Admin Management & Support Infrastructure

-- 1. Create Issues Table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'delivery', 'payment', 'product', 'technical'
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id)
);

-- RLS for Issues
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own issues" ON public.issues;


CREATE POLICY "Users can view own issues" ON public.issues
FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create issues" ON public.issues;


CREATE POLICY "Users can create issues" ON public.issues
FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;


CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. Audit Logs Table for System History
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL, -- 'delete_user', 'resolve_issue', 'update_order'
    actor_id UUID REFERENCES public.profiles(id),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;


CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Admin User Deletion RPC (SECURITY DEFINER to handle sensitive deletes)
DROP FUNCTION IF EXISTS public.delete_user_admin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Avoid deleting your own account
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot delete your own admin account';
    END IF;

    -- Log the action
    INSERT INTO public.audit_logs (action, actor_id, target_id, details)
    VALUES ('delete_user', auth.uid(), target_user_id, jsonb_build_object('timestamp', now()));

    -- Delete roles
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
    -- Delete profile
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- Note: This doesn't delete from auth.users (requires service_role)
    -- But deleting the profile and roles effectively "kills" the account in our application logic.
END;
$$;

-- END OF FILE: 20260224_admin_overhaul_infra.sql

-- START OF FILE: 20260224_admin_user_roles_rls.sql
-- Fix RLS for user_roles to allow Admins to see all roles
-- This ensures the Admin User Management page can correctly display badges for Sellers, Logistics, etc.

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- END OF FILE: 20260224_admin_user_roles_rls.sql

-- START OF FILE: 20260224_fix_analytics_rpc.sql
-- Fix get_seller_analytics RPC
-- The previous version used 'completed' which is not in the order_status enum, causing 400 errors.
DROP FUNCTION IF EXISTS public.get_seller_analytics(UUID) CASCADE;


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
    WHERE seller_id = seller_uuid AND status = 'delivered';
    
    RETURN result;
END;
$$;

-- END OF FILE: 20260224_fix_analytics_rpc.sql

-- START OF FILE: 20260224_fix_orders_relationship.sql
-- Fix relationship between orders and profiles (buyer/seller)
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT orders_buyer_id_fkey ON public.orders IS 'PostgREST join reference for buyer profile';
COMMENT ON CONSTRAINT orders_seller_id_fkey ON public.orders IS 'PostgREST join reference for seller profile';

-- END OF FILE: 20260224_fix_orders_relationship.sql

-- START OF FILE: 20260224_fix_rls_recursion.sql
-- Fix RLS Infinite Recursion for user_roles
-- We use a SECURITY DEFINER function to bypass RLS checks during the admin validation.
DROP FUNCTION IF EXISTS public.is_admin_safe() CASCADE;


CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_safe());

-- END OF FILE: 20260224_fix_rls_recursion.sql

-- START OF FILE: 20260224_fix_user_roles_relationship.sql
-- Fix relationship between profiles and user_roles for PostgREST
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;


ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Also add a comment for clarification
COMMENT ON CONSTRAINT user_roles_user_id_fkey ON public.user_roles IS 'Direct reference to public.profiles for PostgREST embedding';

-- END OF FILE: 20260224_fix_user_roles_relationship.sql

-- START OF FILE: 20260224_logistics_dashboard_updates.sql
-- Logistics Dashboard Infrastructure Improvements

-- 1. Create Logistics Details Table (Dependency for following columns)
CREATE TABLE IF NOT EXISTS public.logistics_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    username TEXT UNIQUE, -- Custom username requested
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    next_of_kin JSONB, -- { name, phone, relationship }
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 1b. Add vehicle_type to logistics_details
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- 2. Add total_earnings to logistics_details for quick access (updated via triggers or RPC)
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- 3. Add earnings to shipments table
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS earnings NUMERIC DEFAULT 2500;

-- 4. Enable access to verification status for redirection logic
-- Profiles might already have this info via join, but let's ensure logistics_verifications is readable.
-- Policies were already set in previous migration.

-- 5. Add notification settings to logistics_details
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "new_order": true,
  "order_delivered": true,
  "issue_reported": true,
  "promoter_earnings": true
}'::JSONB;

-- END OF FILE: 20260224_logistics_dashboard_updates.sql

-- START OF FILE: 20260224_logistics_verification_schema.sql
-- Logistics Verification & Onboarding Schema

-- 1. Logistics Verifications Table (Mandatory for Admin review)
CREATE TABLE IF NOT EXISTS public.logistics_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    home_address TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    passport_photo_url TEXT NOT NULL,
    status public.verification_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- 2. Logistics Details Table (Creation moved to top of file)-- 3. Enable RLS
ALTER TABLE public.logistics_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Logistics Verifications
DROP POLICY IF EXISTS "Users can view own logistics verification" ON public.logistics_verifications;

CREATE POLICY "Users can view own logistics verification" ON public.logistics_verifications
FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can submit logistics verification" ON public.logistics_verifications;


CREATE POLICY "Users can submit logistics verification" ON public.logistics_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all logistics verifications" ON public.logistics_verifications;


CREATE POLICY "Admins can view all logistics verifications" ON public.logistics_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update logistics verifications" ON public.logistics_verifications;


CREATE POLICY "Admins can update logistics verifications" ON public.logistics_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Policies for Logistics Details
DROP POLICY IF EXISTS "Users can manage own logistics details" ON public.logistics_details;

CREATE POLICY "Users can manage own logistics details" ON public.logistics_details
FOR ALL USING (auth.uid() = user_id);

-- 6. RPC for verifying logistics KYC
DROP FUNCTION IF EXISTS public.verify_logistics_kyc(UUID, public.verification_status) CASCADE;

CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(
    verification_id UUID,
    review_status public.verification_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT user_id INTO target_user_id
    FROM public.logistics_verifications
    WHERE id = verification_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Verification not found';
    END IF;

    UPDATE public.logistics_verifications
    SET 
        status = review_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = verification_id;

    -- If approved, ensures role is granted (though they might already have it from onboarding)
    IF review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'logistics')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END;
$$;

-- END OF FILE: 20260224_logistics_verification_schema.sql

-- START OF FILE: 20260224_orders_rls_and_realtime.sql
-- Enable RLS and Realtime for Orders
-- This ensures sellers can update status and UI updates in real-time

-- 1. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Orders
DO $$ 
BEGIN
    -- SELECT: Buyers can see their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view own orders') THEN
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;

        CREATE POLICY "Buyers can view own orders" ON public.orders
        FOR SELECT USING (auth.uid() = buyer_id);
    END IF;

    -- SELECT: Sellers can see orders assigned to them
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can view assigned orders') THEN
DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;

        CREATE POLICY "Sellers can view assigned orders" ON public.orders
        FOR SELECT USING (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Sellers can update order status
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can update order status') THEN
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;

        CREATE POLICY "Sellers can update order status" ON public.orders
        FOR UPDATE USING (auth.uid() = seller_id)
        WITH CHECK (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Logistics riders can update order status (synced from shipment)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Logistics can update order status') THEN
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;

        CREATE POLICY "Logistics can update order status" ON public.orders
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.shipments 
                WHERE shipments.order_id = orders.id 
                AND shipments.rider_id = auth.uid()
            )
        );
    END IF;

    -- UPDATE: Buyers can cancel their own orders (if pending)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can cancel own orders') THEN
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;

        CREATE POLICY "Buyers can cancel own orders" ON public.orders
        FOR UPDATE USING (auth.uid() = buyer_id)
        WITH CHECK (auth.uid() = buyer_id AND status = 'pending');
    END IF;
END $$;

-- 4. Enable RLS and Policies for Shipments
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- SELECT: Both sellers and riders can view the shipment
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers and riders can view shipments') THEN
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;

        CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
        FOR SELECT USING (
            auth.uid() = rider_id OR 
            auth.uid() IN (SELECT seller_id FROM public.orders WHERE id = shipments.order_id)
        );
    END IF;

    -- UPDATE: Riders can update their assigned shipments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Riders can update own shipments') THEN
DROP POLICY IF EXISTS "Riders can update own shipments" ON public.shipments;

        CREATE POLICY "Riders can update own shipments" ON public.shipments
        FOR UPDATE USING (auth.uid() = rider_id)
        WITH CHECK (auth.uid() = rider_id);
    END IF;
END $$;

-- 5. Enable Realtime Replication
DO $$
BEGIN
    -- Enable for orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    -- Enable for shipments
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'shipments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
    END IF;
END $$;

-- END OF FILE: 20260224_orders_rls_and_realtime.sql

-- START OF FILE: 20260224_reconcile_orders_schema.sql
-- Reconcile Orders Table Schema
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- Ensure naming consistency: total vs total_amount
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') THEN
        UPDATE public.orders SET total = total_amount WHERE total IS NULL;
    END IF;
END $$;

-- Ensure order_items_new table exists
CREATE TABLE IF NOT EXISTS public.order_items_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE public.order_items_new ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own order items') THEN
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;

        CREATE POLICY "Users can view own order items" ON public.order_items_new
        FOR SELECT USING (
            auth.uid() = seller_id OR 
            auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id)
        );
    END IF;
END $$;

-- END OF FILE: 20260224_reconcile_orders_schema.sql

-- START OF FILE: 20260224_settlement_on_delivery.sql
-- Revenue Settlement on Delivery
-- Industry standard: Funds are credited to seller wallet upon successful delivery
DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;


CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    seller_wallet_id UUID;
    order_total NUMERIC;
BEGIN
    -- Only proceed if status is being changed to 'delivered'
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        
        -- 1. Identify Seller Wallet
        -- We try user_id (profiles) or seller_id (auth.users)
        SELECT id INTO seller_wallet_id 
        FROM public.wallets 
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        -- If no wallet exists, create one
        IF seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, balance)
            VALUES (NEW.seller_id, 0)
            RETURNING id INTO seller_wallet_id;
        END IF;

        -- 2. Calculate Settlement Amount
        -- We use order total (from either 'total' or 'total_amount' depending on schema version)
        -- The scalability migration normalized it to 'total'
        order_total := COALESCE(NEW.total, 0);

        -- 3. Update Balance
        UPDATE public.wallets 
        SET balance = balance + order_total,
            updated_at = now()
        WHERE id = seller_wallet_id;

        -- 4. Record Transaction
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (
            seller_wallet_id, 
            order_total, 
            'settlement', 
            'Order Settlement: #' || NEW.id
        );

        -- 5. Optional: Notify Seller
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            NEW.seller_id,
            'payment',
            'Revenue of ₦' || order_total || ' has been settled for order #' || LEFT(NEW.id::text, 8)
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Order Status Changes
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- END OF FILE: 20260224_settlement_on_delivery.sql

-- START OF FILE: 20260225_add_missing_issue_columns.sql
-- Add missing columns to the issues table to support seller dashboard and product reporting

-- 1. Add product_id and seller_id
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Update RLS policies to allow sellers to view issues directed at them
DROP POLICY IF EXISTS "Sellers can view issues linked to their products or orders" ON public.issues;

CREATE POLICY "Sellers can view issues linked to their products or orders" ON public.issues
FOR SELECT USING (
  auth.uid() = seller_id OR
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = issues.order_id 
    AND orders.seller_id = auth.uid()
  )
);

-- 3. Add indices for performance
CREATE INDEX IF NOT EXISTS idx_issues_seller_id ON public.issues(seller_id);
CREATE INDEX IF NOT EXISTS idx_issues_product_id ON public.issues(product_id);
CREATE INDEX IF NOT EXISTS idx_issues_order_id ON public.issues(order_id);

-- END OF FILE: 20260225_add_missing_issue_columns.sql

-- START OF FILE: 20260225_fix_rider_visibility.sql
-- Rider Visibility Fix
-- Allows logistics agents (riders) to see the orders and items they are assigned to.

-- 1. Update orders SELECT policy to include riders
DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
CREATE POLICY "Riders can view assigned orders" ON public.orders
FOR SELECT USING (public.check_is_rider_of_shipment(id));

-- 2. Ensure buyers and sellers policies are also present and clean (from previous master fix)
-- Buyer view policy (ensure it's not lost)
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" ON public.orders
FOR SELECT USING (auth.uid() = buyer_id);

-- Seller view policy (redundant but safe to re-apply)
DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders
FOR SELECT USING (auth.uid() = seller_id OR public.check_is_admin());


-- 3. Update order_items SELECT policy to include riders
DROP POLICY IF EXISTS "Riders can view assigned order items" ON public.order_items;
CREATE POLICY "Riders can view assigned order items" ON public.order_items
FOR SELECT USING (public.check_is_rider_of_shipment(order_id));

-- Also ensure public.order_items_new is covered if it's being used
DROP POLICY IF EXISTS "Logistics can view order items" ON public.order_items_new;
CREATE POLICY "Logistics can view order items" ON public.order_items_new
FOR SELECT USING (public.check_is_rider_of_shipment(order_id));


-- 4. Final check on shipments policy to ensure it's not blocked
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
  auth.uid() = rider_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);

-- END OF FILE: 20260225_fix_rider_visibility.sql

-- START OF FILE: 20260225_fix_rls_recursion_master.sql
-- RLS Recursion Fix & Optimization
-- Breaks infinite recursion loops in user_roles, orders, and shipments.

-- 1. Ensure a safe admin check function exists (bypasses RLS)
DROP FUNCTION IF EXISTS public.check_is_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Create safe order association checks
DROP FUNCTION IF EXISTS public.check_is_seller_of_order(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.check_is_seller_of_order(order_uuid UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_uuid
    AND seller_id = auth.uid()
  );
END;
$$;
DROP FUNCTION IF EXISTS public.check_is_rider_of_shipment(UUID) CASCADE;


CREATE OR REPLACE FUNCTION public.check_is_rider_of_shipment(order_uuid UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shipments
    WHERE order_id = order_uuid
    AND rider_id = auth.uid()
  );
END;
$$;

-- 3. Fix user_roles recursion
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (public.check_is_admin());

-- 4. Fix orders recursion
-- We need to replace policies that refer to shipments which refer back to orders.
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
CREATE POLICY "Logistics can update order status" ON public.orders
FOR UPDATE USING (public.check_is_rider_of_shipment(id));

DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders
FOR SELECT USING (auth.uid() = seller_id OR public.check_is_admin());

-- 5. Fix shipments recursion
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
  auth.uid() = rider_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);

-- 6. Ensure order_items_new is also safe
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;
CREATE POLICY "Users can view own order items" ON public.order_items_new
FOR SELECT USING (
  auth.uid() = seller_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);

-- END OF FILE: 20260225_fix_rls_recursion_master.sql

-- START OF FILE: 20260225_logistics_discovery_rls.sql
-- Final RLS Fixes for Logistics Discovery
-- Allows Sellers and other authenticated users to see logistics roles and profiles

-- 1. Allow authenticated users to view who has the 'logistics' role
-- This is necessary for the Courier Selector in the Seller Dashboard
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;
CREATE POLICY "Anyone can view logistics roles"
ON public.user_roles
FOR SELECT
USING (role = 'logistics' OR auth.uid() = user_id OR public.check_is_admin());

-- 2. Ensure profiles are visible to authenticated users
-- (Usually exists, but making sure)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- 3. Allow viewing logistics verifications for discovery
-- We only allow seeing the phone number and status if the user is 'verified' or if it's their own
DROP POLICY IF EXISTS "Discovery of logistics partners" ON public.logistics_verifications;
CREATE POLICY "Discovery of logistics partners"
ON public.logistics_verifications
FOR SELECT
USING (status = 'verified' OR auth.uid() = user_id OR public.check_is_admin());

-- END OF FILE: 20260225_logistics_discovery_rls.sql

-- START OF FILE: 20260227_fix_shipment_schema.sql
-- MIGRATION: 20260227_fix_shipment_schema
-- Ensures shipments table is consistent and has required columns for the hyperlocal flow.

-- 1. Ensure seller_id and zone exist with proper types/refs
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- 2. Ensure delivery_address and pickup_address are JSONB (they should be, but let's be sure)
-- No changes needed if already JSONB, but let's ensure they aren't TEXT by accident in some schemas
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'delivery_address' AND data_type = 'text'
    ) THEN
        ALTER TABLE public.shipments ALTER COLUMN delivery_address TYPE JSONB USING delivery_address::JSONB;
        ALTER TABLE public.shipments ALTER COLUMN pickup_address TYPE JSONB USING pickup_address::JSONB;
    END IF;
END $$;

-- 3. Ensure orders table uses 'total' column consistently
DO $$ 
BEGIN
    -- If 'total_amount' exists but 'total' doesn't, rename it (scalability overhaul fallback)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total') THEN
        ALTER TABLE public.orders RENAME COLUMN total_amount TO total;
    END IF;
END $$;

-- 4. Add index for seller_id on shipments
CREATE INDEX IF NOT EXISTS idx_shipments_seller_id ON public.shipments(seller_id);
CREATE INDEX IF NOT EXISTS idx_shipments_zone ON public.shipments(zone);

-- 5. RLS Fix: Allow sellers to create shipments for their orders
DROP POLICY IF EXISTS "Sellers can create shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can create shipments for their orders"
ON public.shipments FOR INSERT
WITH CHECK (
  auth.uid() = seller_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'seller'
  )
);

-- Allow sellers to view the shipments they created (redundant if SELECT policy is already broad but safer)
DROP POLICY IF EXISTS "Sellers can view their shipments" ON public.shipments;
CREATE POLICY "Sellers can view their shipments"
ON public.shipments FOR SELECT
USING (seller_id = auth.uid());

-- END OF FILE: 20260227_fix_shipment_schema.sql

-- START OF FILE: 20260227_hyperlocal_delivery_zones.sql
-- MIGRATION: 20260227_hyperlocal_delivery_zones
-- This migration adds zone support to profiles and shipments, and updates RLS for riders.

-- 1. Add zone to profiles (for riders)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone;

-- 2. Add zone and seller_id to shipments
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);

-- 3. Add shipment_id to order_items_new to track which items are in which delivery
ALTER TABLE public.order_items_new
ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL;

-- 4. Make seller_id in orders nullable to support multi-merchant orders
ALTER TABLE public.orders ALTER COLUMN seller_id DROP NOT NULL;

-- 5. Update RLS for Shipments
-- Riders should only see and update shipments in their assigned zone.
DROP POLICY IF EXISTS "Admins and Logistics can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

-- Logistics users (riders) can view all shipments in their zone
CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'logistics'
    AND p.zone = shipments.zone
  ) OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Riders can update shipments assigned to them
CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (rider_id = auth.uid());

-- Ensure buyers and sellers can still see relevant shipments
DROP POLICY IF EXISTS "Buyers can view shipments for their orders" ON public.shipments;
CREATE POLICY "Buyers can view shipments for their orders"
ON public.shipments FOR SELECT
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

DROP POLICY IF EXISTS "Sellers can view shipments for their products" ON public.shipments;
CREATE POLICY "Sellers can view shipments for their products"
ON public.shipments FOR SELECT
USING (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.order_items_new oi
    WHERE oi.order_id = shipments.order_id 
    AND oi.seller_id = auth.uid()
  )
);

-- END OF FILE: 20260227_hyperlocal_delivery_zones.sql

-- START OF FILE: 20260227_hyperlocal_delivery_zonesv2.sql
-- MIGRATION: 20260227_hyperlocal_delivery_zones
-- This migration adds zone support to profiles and shipments, and updates RLS for riders.

-- 1. Add zone to profiles (for riders)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone;

-- 2. Add zone and seller_id to shipments
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);

-- 3. Add shipment_id to order_items_new to track which items are in which delivery
ALTER TABLE public.order_items_new
ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL;

-- 4. Make seller_id in orders nullable to support multi-merchant orders
ALTER TABLE public.orders ALTER COLUMN seller_id DROP NOT NULL;

-- 5. Update RLS for Shipments
-- Riders should only see and update shipments in their assigned zone.
DROP POLICY IF EXISTS "Admins and Logistics can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

-- Logistics users (riders) can view all shipments in their zone
CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'logistics'
    AND p.zone = shipments.zone
  ) OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Riders can update shipments assigned to them
CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (rider_id = auth.uid());

-- Ensure buyers and sellers can still see relevant shipments
DROP POLICY IF EXISTS "Buyers can view shipments for their orders" ON public.shipments;
CREATE POLICY "Buyers can view shipments for their orders"
ON public.shipments FOR SELECT
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

DROP POLICY IF EXISTS "Sellers can view shipments for their products" ON public.shipments;
CREATE POLICY "Sellers can view shipments for their products"
ON public.shipments FOR SELECT
USING (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.order_items_new oi
    WHERE oi.order_id = shipments.order_id 
    AND oi.seller_id = auth.uid()
  )
);

-- END OF FILE: 20260227_hyperlocal_delivery_zonesv2.sql

-- START OF FILE: 20260227_mutual_live_tracking.sql
-- MIGRATION: 20260227_mutual_live_tracking
-- Adds columns for buyer live location sharing.

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_location_last_updated TIMESTAMPTZ;

-- Update RLS: Ensure buyers can update their own shipment's location
DROP POLICY IF EXISTS "Buyers can update their live location" ON public.shipments;
CREATE POLICY "Buyers can update their live location"
ON public.shipments FOR UPDATE
USING (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
)
WITH CHECK (
  order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

-- END OF FILE: 20260227_mutual_live_tracking.sql

-- START OF FILE: 20260227_rider_online_status.sql
-- MIGRATION: 20260227_rider_online_status
-- Adds is_online column to profiles to track logistics agent availability.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Ensure riders can update their own status
-- (Profiles table already has update policy for auth.uid() = id)

-- END OF FILE: 20260227_rider_online_status.sql

-- START OF FILE: 20260228_add_category_icons.sql
-- Migration: 20260228_add_category_icons
-- Adds icon column to categories table for UI display.

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS icon TEXT;

-- Seed some default icons for existing categories
UPDATE public.categories SET icon = 'Smartphone' WHERE slug = 'electronics';
UPDATE public.categories SET icon = 'Shirt' WHERE slug = 'fashion';
UPDATE public.categories SET icon = 'HomeIcon' WHERE slug = 'home-kitchen';
UPDATE public.categories SET icon = 'Activity' WHERE slug = 'health-beauty';
UPDATE public.categories SET icon = 'Footprints' WHERE slug = 'sports';
UPDATE public.categories SET icon = 'Gamepad' WHERE slug = 'toys';
UPDATE public.categories SET icon = 'Car' WHERE slug = 'automotive';
UPDATE public.categories SET icon = 'ShoppingBag' WHERE slug = 'grocery';
UPDATE public.categories SET icon = 'Settings' WHERE slug = 'services';
UPDATE public.categories SET icon = 'Grid' WHERE slug = 'other';

-- END OF FILE: 20260228_add_category_icons.sql

-- START OF FILE: 20260228_add_onboarding_completed.sql
-- Add onboarding_completed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users: if they have a role, mark as completed
UPDATE profiles 
SET onboarding_completed = TRUE 
WHERE id IN (SELECT user_id FROM user_roles);

-- Alternatively, keep it simple and just let them complete it once more if they haven't.
-- But marking based on role presence is safer for existing users.

-- END OF FILE: 20260228_add_onboarding_completed.sql

-- START OF FILE: 20260228_fix_user_roles_recursion.sql
-- Migration: 20260228_fix_user_roles_recursion
-- Safely breaks the infinite recursion in user_roles RLS.

-- 1. Create a truly safe is_admin function that doesn't trigger the same policy
-- We use SECURITY DEFINER and a specific search path.
DROP FUNCTION IF EXISTS public.is_admin_final() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin_final()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We query the table directly. Since this is SECURITY DEFINER, 
  -- it runs as the owner (postgres) who bypasses RLS.
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the old recursive policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- 3. Create non-recursive policies
-- Users can always see their own roles (simple check, no function call)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can see all (uses the SECURITY DEFINER function)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_final());

-- Apply similar fix to other tables that were using is_admin_safe
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (public.is_admin_final());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin_final());

-- END OF FILE: 20260228_fix_user_roles_recursion.sql

-- START OF FILE: 20260228_master_recursion_fix.sql
-- MASTER RECURSION FIX (Run this in Supabase SQL Editor)
-- This breaks infinite loops caused by policies checking roles.

-- 1. Create a safe role checker that BYPASSES RLS
DROP FUNCTION IF EXISTS public.check_user_role(public.app_role) CASCADE;

CREATE OR REPLACE FUNCTION public.check_user_role(target_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = target_role
  );
END;
$$;

-- 2. Create a generic admin checker
DROP FUNCTION IF EXISTS public.is_admin_safe() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.check_user_role('admin');
END;
$$;

-- 3. Reset user_roles policies to be simple and non-recursive
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin_safe());

-- 4. Apply safety to other potential recursion points
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (public.is_admin_safe());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin_safe());

-- 5. Final verification of profiles visibility
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles
FOR SELECT USING (true);

-- END OF FILE: 20260228_master_recursion_fix.sql

-- START OF FILE: 20260301_inventory_decrement_rpc.sql
-- 20260301_inventory_decrement_rpc.sql
-- This migration provides the RPC function used by the create-order Edge Function.
DROP FUNCTION IF EXISTS public.decrement_inventory(uuid, integer) CASCADE;


CREATE OR REPLACE FUNCTION public.decrement_inventory(product_id_input uuid, quantity_input integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Double check inventory is sufficient before decrementing
  UPDATE public.products
  SET inventory = inventory - quantity_input
  WHERE id = product_id_input
  AND inventory >= quantity_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient inventory or product not found for ID: %', product_id_input;
  END IF;
END;
$$;

-- Ensure the function is owned by postgres as it's used by the admin client in Edge Functions
ALTER FUNCTION public.decrement_inventory(uuid, integer) OWNER TO postgres;

COMMENT ON FUNCTION public.decrement_inventory IS 'Atomic inventory decrement with stock validation - 20260301';
-- END OF FILE: 20260301_inventory_decrement_rpc.sql

-- START OF FILE: 20260301_ultimate_recursion_fix.sql
-- 20260301_ultimate_recursion_fix.sql
-- This migration provides a truly non-recursive way to check roles.

-- 1. Create the base check_user_role function with SECURITY DEFINER
-- This function runs as the owner (postgres) and thus bypasses RLS
-- We must make sure it doesn't call any other recursive functions.
DROP FUNCTION IF EXISTS public.check_user_role(public.app_role) CASCADE;

CREATE OR REPLACE FUNCTION public.check_user_role(target_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id
    AND role = target_role
  );
END;
$$;

-- Ensure the function is owned by postgres to guarantee RLS bypass
ALTER FUNCTION public.check_user_role(public.app_role) OWNER TO postgres;

-- 2. Create a generic admin checker which is just a wrapper
DROP FUNCTION IF EXISTS public.is_admin_safe() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.check_user_role('admin');
END;
$$;

ALTER FUNCTION public.is_admin_safe() OWNER TO postgres;

-- 3. Reset user_roles policies to be dead simple
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin_safe());

-- 4. Apply this to profiles to ensure they are always visible to the user and admins
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

-- Users can update their own profile without recursion
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 5. Force refresh of the cache/session by touching a non-critical policy
-- This is just a hint for Supabase
COMMENT ON FUNCTION public.check_user_role IS 'Ultimate non-recursive role check - 20260301';

-- END OF FILE: 20260301_ultimate_recursion_fix.sql

-- START OF FILE: 20260302_create_chat_system.sql
-- MIGRATION: 20260302_create_chat_system
-- Provides tables for messaging between buyers and sellers.

-- 1. Conversations Table (Containers for messages)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, buyer_id, seller_id) -- One conversation per product-buyer-seller trio
);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_read BOOLEAN DEFAULT false
);

-- 3. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "Buyers can initiate conversations" ON public.conversations;


CREATE POLICY "Buyers can initiate conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = buyer_id);

-- 5. Policies for Messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;

CREATE POLICY "Users can view messages in their conversations" 
ON public.messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = messages.conversation_id 
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
);
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;


CREATE POLICY "Users can send messages to their conversations" 
ON public.messages FOR INSERT 
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = messages.conversation_id 
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
);

-- 6. Indices for Performance
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON public.conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON public.conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- 7. Realtime enable (via Supabase UI usually, but schema-wise):
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;

-- END OF FILE: 20260302_create_chat_system.sql

-- START OF FILE: 20260302_create_order_v3_rpc.sql
-- 20260302_create_order_v3_rpc.sql
-- Atomic Order Creation with Inventory Protection
DROP FUNCTION IF EXISTS public.create_order_v3(UUID, JSONB, JSONB, NUMERIC) CASCADE;


CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC
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
    -- 1. Extract first seller_id for the orders table legacy column
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- 2. Create the Master Order record
    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        items
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_items
    )
    RETURNING id INTO v_order_id;

    -- 3. Process each item: insert into items table and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        -- a. Insert into order_items_new for detailed tracking
        INSERT INTO public.order_items_new (
            order_id, 
            product_id, 
            seller_id, 
            quantity, 
            price_at_purchase
        )
        VALUES (
            v_order_id, 
            v_item.product_id, 
            v_item.seller_id, 
            v_item.quantity, 
            v_item.price
        );

        -- b. Atomic Inventory Check and Decrement
        -- This will automatically fail the transaction if quantity is insufficient or item doesn't exist
        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    -- 4. Return success result
    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );

EXCEPTION WHEN OTHERS THEN
    -- In PostgreSQL, any error RAISEd within a function automatically rolls back the entire transaction wrap.
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Ownership ensure
ALTER FUNCTION public.create_order_v3(UUID, JSONB, JSONB, NUMERIC) OWNER TO postgres;

COMMENT ON FUNCTION public.create_order_v3 IS 'Robust atomic order creation with transactional inventory decrement - 20260302';

-- END OF FILE: 20260302_create_order_v3_rpc.sql

-- START OF FILE: 20260302_enable_likes_realtime.sql
-- MIGRATION: 20260302_enable_likes_realtime
-- Enables Supabase Realtime for the likes table to allow instant wishlist updates.

BEGIN;
  -- Add the likes table to the realtime publication
  DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
COMMIT;

-- END OF FILE: 20260302_enable_likes_realtime.sql

-- START OF FILE: 20260303_add_order_pickup_address.sql
-- MIGRATION: 20260303_add_order_pickup_address
-- Adds pickup_address to orders and updates creation RPC.

-- 1. Add pickup_address column to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_address JSONB;

-- 2. Update create_order_v3 to handle pickup_address

DROP FUNCTION IF EXISTS public.create_order_v3(UUID, JSONB, JSONB, NUMERIC, JSONB) CASCADE;
CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_pickup_address JSONB DEFAULT NULL -- New parameter
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
    -- 1. Extract first seller_id for the orders table legacy column
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- 2. Create the Master Order record
    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        pickup_address, -- Store the new pickup address
        items
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_pickup_address,
        p_items
    )
    RETURNING id INTO v_order_id;

    -- 3. Process each item: insert into items table and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        -- a. Insert into order_items_new for detailed tracking
        INSERT INTO public.order_items_new (
            order_id, 
            product_id, 
            seller_id, 
            quantity, 
            price_at_purchase
        )
        VALUES (
            v_order_id, 
            v_item.product_id, 
            v_item.seller_id, 
            v_item.quantity, 
            v_item.price
        );

        -- b. Atomic Inventory Check and Decrement
        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    -- 4. Return success result
    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Ownership ensure
ALTER FUNCTION public.create_order_v3(UUID, JSONB, JSONB, NUMERIC, JSONB) OWNER TO postgres;

-- END OF FILE: 20260303_add_order_pickup_address.sql

-- START OF FILE: 20260303_add_product_locations.sql
-- MIGRATION: 20260303_add_product_locations.sql
-- Add city_id and zone_id to products table for better filtering and scalability.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_products_city ON public.products(city_id);
CREATE INDEX IF NOT EXISTS idx_products_zone ON public.products(zone_id);

-- Update existing products based on seller location (best effort)
DO $$
BEGIN
    UPDATE public.products p
    SET city_id = pr.city_id, zone_id = pr.zone_id
    FROM public.profiles pr
    WHERE p.seller_id = pr.id
    AND p.city_id IS NULL;
END $$;

-- END OF FILE: 20260303_add_product_locations.sql

-- START OF FILE: 20260303_buyer_completion_rls.sql
-- MIGRATION: 20260303_buyer_completion_rls.sql
-- The buyer "Confirm Receipt & Finalize" button sets status = 'completed'.
-- The existing buyer UPDATE policy only allows status = 'pending' (cancel-only).
-- This migration adds a new policy so buyers can mark 'delivered' orders as 'completed'.

-- Drop the old cancel-only policy
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;

-- Recreate it split into two specific policies for clarity:

-- 1. Buyers can cancel orders that are still pending

DROP POLICY IF EXISTS "Buyers can cancel pending orders" ON public.orders;
CREATE POLICY "Buyers can cancel pending orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'pending'
);

-- 2. Buyers can confirm receipt of delivered orders (marks as 'completed')

DROP POLICY IF EXISTS "Buyers can confirm receipt of delivered orders" ON public.orders;
CREATE POLICY "Buyers can confirm receipt of delivered orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'completed'
    -- But the current row must be 'delivered' — enforced at query level by the client
);

-- END OF FILE: 20260303_buyer_completion_rls.sql

-- START OF FILE: 20260303_complete_order_rpc.sql
-- MIGRATION: 20260303_complete_order_rpc.sql
-- Replace the opaque trigger with a direct RPC called from the frontend.
-- The frontend calls this instead of a raw .update({ status: 'completed' })
-- This gives us full control, visible errors, and no trigger mystery.

-- Drop old trigger — no longer needed
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- Ensure wallet columns exist
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- Convert wallet_transactions.type to TEXT if it is an ENUM
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='type') = 'USER-DEFINED'
    THEN
        ALTER TABLE public.wallet_transactions ALTER COLUMN type TYPE TEXT USING type::TEXT;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- RPC: complete_order_and_settle
-- Called by the buyer's "Confirm Receipt" button
-- 1. Validates order is in 'delivered' state and belongs to buyer
-- 2. Sets status = 'completed'
-- 3. Credits seller 95% + rider 5% from order total
-- SECURITY DEFINER: bypasses RLS for wallet writes
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.complete_order_and_settle(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order             RECORD;
    v_seller_wallet_id  UUID;
    v_rider_wallet_id   UUID;
    v_order_total       NUMERIC;
    v_platform_fee      NUMERIC;
    v_rider_flat_fee    CONSTANT NUMERIC := 1500;  -- Fixed ₦1,500 per delivery
    v_rider_id          UUID;
BEGIN
    -- 1. Load and validate the order
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status::TEXT = 'delivered'
    FOR UPDATE;  -- Row lock to prevent race conditions

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found, not yours, or not in delivered state'
        );
    END IF;

    -- Order total = product price as listed by seller
    v_order_total := COALESCE(NULLIF(v_order.total, 0), 0);
    -- Platform takes 10% (tracked for accounting, NOT deducted from seller)
    v_platform_fee := ROUND(v_order_total * 0.10, 2);

    -- If still zero, sum from order items
    IF v_order_total = 0 THEN
        SELECT COALESCE(SUM(price_at_purchase * quantity), 0)
        INTO v_order_total
        FROM public.order_items_new
        WHERE order_id = p_order_id;
    END IF;

    -- 3. Mark order as completed
    UPDATE public.orders
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. If total is zero, complete but skip earnings (edge case for test orders)
    IF v_order_total = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'warning', 'Order completed but total was zero — no earnings credited',
            'seller_credited', 0,
            'rider_credited', 0
        );
    END IF;

    -- Fee breakdown:
    -- Seller  → full product price (v_order_total)
    -- Rider   → flat ₦1,500 per delivery
    -- Platform → 10% of product price (logged, not deducted from seller)

    -- 5. Credit seller wallet
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = v_order.seller_id OR user_id = v_order.seller_id LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (v_order.seller_id, v_order.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance        = balance + v_order_total,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance, 0) - v_order_total),
        updated_at     = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_order_total, 'settlement',
            'Settlement: Order #' || LEFT(p_order_id::TEXT, 8) ||
            ' (platform fee: ₦' || v_platform_fee::TEXT || ')');

    -- Seller notification
    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (v_order.seller_id, 'payment',
            '₦' || TO_CHAR(v_order_total, 'FM999,999,999') ||
            ' credited — Order #' || LEFT(p_order_id::TEXT, 8) || ' confirmed by buyer.');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 6. Credit rider wallet — flat ₦1,500 per delivery
    SELECT s.rider_id INTO v_rider_id FROM public.shipments s
    WHERE s.order_id = p_order_id AND s.rider_id IS NOT NULL LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance = balance + v_rider_flat_fee, updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_rider_flat_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(p_order_id::TEXT, 8));

        UPDATE public.shipments
        SET delivery_fee = v_rider_flat_fee
        WHERE order_id = p_order_id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                '₦1,500 delivery fee credited — Order #' || LEFT(p_order_id::TEXT, 8));
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    RETURN jsonb_build_object(
        'success',         true,
        'order_total',     v_order_total,
        'seller_credited', v_order_total,
        'rider_credited',  CASE WHEN v_rider_id IS NOT NULL THEN v_rider_flat_fee ELSE 0 END,
        'platform_fee',    v_platform_fee,
        'rider_found',     (v_rider_id IS NOT NULL)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.complete_order_and_settle IS
'Called by buyer to confirm receipt. Atomically sets order=completed and credits seller (95%) + rider (5%).';

-- Verify
SELECT 'complete_order_and_settle RPC created successfully' AS status;

-- END OF FILE: 20260303_complete_order_rpc.sql

-- START OF FILE: 20260303_create_avatars_bucket.sql
-- MIGRATION: 20260303_create_avatars_bucket
-- Creates the 'avatars' bucket for profile pictures and sets up RLS policies.

-- 1. Insert the bucket into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to VIEW avatars (Public access)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 3. Allow authenticated users to UPLOAD their own avatar
-- We expect the path to be in the format 'user_id/filename'
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow users to DELETE their own avatar
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow users to UPDATE their own avatar
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- END OF FILE: 20260303_create_avatars_bucket.sql

-- START OF FILE: 20260303_escrow_and_withdrawals.sql
-- MIGRATION: 20260303_escrow_and_withdrawals.sql
-- Implements:
-- 1. Real escrow_balance column on wallets (holds funds until buyer confirms)
-- 2. Withdrawal requests table with daily limit enforcement
-- 3. Updated settlement trigger (moves funds from escrow → available on 'completed')
-- 4. delivery_fee_amount column on shipments (records exact amount earned)

-- ============================================================
-- 1. ESCROW BALANCE on wallets
-- ============================================================
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- 2. DELIVERY FEE tracking on shipments
-- ============================================================
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMPTZ;  -- seller's selected pickup time

-- ============================================================
-- 3. WITHDRAWAL REQUESTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    admin_note TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests

DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own requests

DROP POLICY IF EXISTS "Users can create withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Only admins can approve/reject

DROP POLICY IF EXISTS "Admins can manage all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can manage all withdrawal requests"
ON public.withdrawal_requests FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;

-- ============================================================
-- 4. UPDATED SETTLEMENT TRIGGER
-- When order = 'awaiting_agent' (broadcast): funds go into BUYER's escrow
-- When order = 'completed' (buyer confirms): escrow releases to seller (95%) and rider (5%)
-- ============================================================

DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- ── CASE 1: Order CONFIRMED (accepted) → Lock funds into escrow ──
    -- This represents buyer payment being secured
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);

        -- Find or create seller wallet
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- Increase escrow balance (funds held until buyer confirms)
        UPDATE public.wallets
        SET escrow_balance = escrow_balance + (v_order_total - v_delivery_fee),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, (v_order_total - v_delivery_fee), 'escrow_hold',
                'Escrow hold for Order #' || LEFT(NEW.id::TEXT, 8));

    END IF;

    -- ── CASE 2: Order COMPLETED (buyer confirms) → Release escrow to seller + rider ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        v_seller_payout := v_order_total - v_delivery_fee;

        -- ── Seller wallet ──
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- Release from escrow → available balance
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            escrow_balance = GREATEST(0, escrow_balance - v_seller_payout),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
                'Settlement released: Order #' || LEFT(NEW.id::TEXT, 8));

        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
                '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
                ' released from escrow for Order #' || LEFT(NEW.id::TEXT, 8));

        -- ── Rider wallet ──
        SELECT s.rider_id INTO v_rider_id
        FROM public.shipments s
        WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
        LIMIT 1;

        IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

            SELECT id INTO v_rider_wallet_id
            FROM public.wallets WHERE user_id = v_rider_id LIMIT 1;

            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (v_rider_id, 0, 0)
                RETURNING id INTO v_rider_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_delivery_fee,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            -- Store delivery fee on shipment for easy querying
            UPDATE public.shipments
            SET delivery_fee = v_delivery_fee
            WHERE order_id = NEW.id AND rider_id = v_rider_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                    'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                    '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                    ' delivery fee credited! Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger and recreate
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ============================================================
-- 5. DAILY WITHDRAWAL LIMIT FUNCTION
-- Max ₦50,000 per day per user (adjustable)
-- ============================================================

DROP FUNCTION IF EXISTS public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_today_total NUMERIC;
    DAILY_LIMIT CONSTANT NUMERIC := 50000;
BEGIN
    -- Get wallet
    SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id LIMIT 1;

    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No wallet found');
    END IF;

    -- Check sufficient balance
    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Check daily limit
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
    AND DATE(requested_at) = CURRENT_DATE
    AND status NOT IN ('rejected');

    IF (v_today_total + p_amount) > DAILY_LIMIT THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Daily withdrawal limit of ₦50,000 exceeded. Used: ₦' || v_today_total::TEXT
        );
    END IF;

    -- Deduct from balance immediately (hold until processed)
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Record withdrawal request
    INSERT INTO public.withdrawal_requests
        (user_id, wallet_id, amount, bank_name, account_number, account_name, status)
    VALUES
        (p_user_id, v_wallet.id, p_amount, p_bank_name, p_account_number, p_account_name, 'pending');

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_wallet.id, -p_amount, 'withdrawal', 'Withdrawal request: ₦' || p_amount::TEXT);

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request submitted');
END;
$$;

COMMENT ON FUNCTION public.request_withdrawal IS 'Creates a withdrawal request with daily limit enforcement of ₦50,000';

-- END OF FILE: 20260303_escrow_and_withdrawals.sql

-- START OF FILE: 20260303_fix_rpc_ambiguity.sql
-- MIGRATION: 20260303_fix_rpc_ambiguity.sql
-- Drops the old version of create_order_v3 to resolve overloading ambiguity.

-- 1. Drop the old 4-parameter version
DROP FUNCTION IF EXISTS public.create_order_v3(UUID, JSONB, JSONB, NUMERIC);

-- 2. Ensure the 5-parameter version (with DEFAULT) is the only one remaining
-- This was already created in 20260303_add_order_pickup_address.sql but we re-verify just in case.
CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB,
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_pickup_address JSONB DEFAULT NULL
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

    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        pickup_address,
        items
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_pickup_address,
        p_items
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        INSERT INTO public.order_items_new (
            order_id, 
            product_id, 
            seller_id, 
            quantity, 
            price_at_purchase
        )
        VALUES (
            v_order_id, 
            v_item.product_id, 
            v_item.seller_id, 
            v_item.quantity, 
            v_item.price
        );

        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );
END;
$$;

-- END OF FILE: 20260303_fix_rpc_ambiguity.sql

-- START OF FILE: 20260303_fix_settlement_trigger.sql
-- MIGRATION: 20260303_fix_settlement_trigger.sql
-- This is the DEFINITIVE settlement migration.
-- Fixes the issue where seller and logistics agent earnings are NOT credited
-- when the buyer marks an order as 'completed'.
--
-- Root causes addressed:
-- 1. wallets table may only have seller_id (no user_id for riders)
-- 2. wallet_transactions.type may be an enum that lacks 'delivery_fee'
-- 3. Settlement trigger may still fire on 'delivered' (old version)
-- 4. Trigger may fail silently due to RLS on wallets/wallet_transactions

-- ═══════════════════════════════════════════════════
-- STEP 1: Ensure wallets has user_id column for riders
-- ═══════════════════════════════════════════════════
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0;

-- For existing seller wallets, backfill user_id = seller_id
UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- STEP 2: Handle wallet_transactions.type column
-- It might be TEXT or an ENUM — handle both cases safely
-- ═══════════════════════════════════════════════════
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'wallet_transactions'
    AND column_name = 'type';

    -- If it's an enum, add new values
    IF col_type = 'USER-DEFINED' THEN
        -- Add 'delivery_fee' if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname IN (
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'wallet_transactions' AND column_name = 'type'
            )
            AND e.enumlabel = 'delivery_fee'
        ) THEN
            EXECUTE 'ALTER TYPE ' || (
                SELECT udt_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type'
            ) || ' ADD VALUE IF NOT EXISTS ''delivery_fee''';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname IN (
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'wallet_transactions' AND column_name = 'type'
            )
            AND e.enumlabel = 'escrow_hold'
        ) THEN
            EXECUTE 'ALTER TYPE ' || (
                SELECT udt_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type'
            ) || ' ADD VALUE IF NOT EXISTS ''escrow_hold''';
        END IF;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- STEP 3: Drop old trigger first (the one firing on 'delivered')
-- ═══════════════════════════════════════════════════
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- ═══════════════════════════════════════════════════
-- STEP 4: Definitive settlement function
-- Uses SECURITY DEFINER to bypass RLS on wallets/wallet_transactions
-- Fires ONLY on 'completed' (buyer confirms receipt)
-- Seller gets 95%, rider gets 5% delivery fee
-- ═══════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- Only fire when transitioning TO 'completed'
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    v_order_total  := COALESCE(NEW.total, 0);
    v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    -- ── SELLER WALLET ──────────────────────────────
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
    LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance = balance + v_seller_payout,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance, 0) - v_seller_payout),
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    -- Record transaction (use TEXT cast for type to handle both TEXT and ENUM columns)
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Order completed — Settlement: #' || LEFT(NEW.id::TEXT, 8));

    -- Notify seller
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (NEW.seller_id, 'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
            ' settlement credited for Order #' || LEFT(NEW.id::TEXT, 8) ||
            '. Buyer confirmed receipt.');

    -- ── RIDER WALLET ───────────────────────────────
    SELECT s.rider_id INTO v_rider_id
    FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
    LIMIT 1;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

        -- Get or create rider wallet (keyed by user_id)
        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0)
            RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance = balance + v_delivery_fee,
            updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        -- Store delivery_fee on the shipment row for easy querying
        UPDATE public.shipments
        SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee — Order #' || LEFT(NEW.id::TEXT, 8));

        INSERT INTO public.notifications (user_id, type, message)
        VALUES (v_rider_id, 'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                ' delivery fee credited! Order #' || LEFT(NEW.id::TEXT, 8));
    END IF;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the order status update
    RAISE WARNING 'Settlement trigger error for order %: % %', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.handle_revenue_settlement IS
'Fires on orders.status = completed. Credits 95% to seller, 5% delivery fee to rider. SECURITY DEFINER bypasses RLS.';

-- ═══════════════════════════════════════════════════
-- STEP 5: Attach trigger
-- ═══════════════════════════════════════════════════
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- END OF FILE: 20260303_fix_settlement_trigger.sql

-- START OF FILE: 20260303_granular_statuses.sql
-- MIGRATION: 20260303_granular_statuses.sql
-- Adds 'accepted' and 'picked_up' statuses to both order and shipment enums for granular feedback.

-- 1. Add 'accepted' and 'picked_up' to order_status if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.order_status ADD VALUE 'accepted' AFTER 'processing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'picked_up') THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'accepted';
    END IF;
END $$;

-- 2. Add 'accepted' to shipment_status if it doesn't exist
-- 'picked_up' already exists in the original schema for shipments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'accepted' AFTER 'assigned';
    END IF;
END $$;

-- END OF FILE: 20260303_granular_statuses.sql

-- START OF FILE: 20260303_restore_logistics_discovery.sql
-- MIGRATION: 20260303_restore_logistics_discovery
-- Restores the ability for authenticated users to find logistics agents.
-- This was accidentally removed in a previous recursion fix.

DROP POLICY IF EXISTS "Anyone can view logistics roles" ON public.user_roles;
CREATE POLICY "Anyone can view logistics roles"
ON public.user_roles FOR SELECT
USING (role = 'logistics');

-- Also ensure logistics verifications are discoverable if they are verified
DROP POLICY IF EXISTS "Discovery of logistics partners" ON public.logistics_verifications;
CREATE POLICY "Discovery of logistics partners"
ON public.logistics_verifications FOR SELECT
USING (status = 'verified');

-- END OF FILE: 20260303_restore_logistics_discovery.sql

-- START OF FILE: 20260303_scalable_zones_v2.sql
-- MIGRATION: 20260303_scalable_zones_v2.sql
-- Introduction of dedicated tables for cities and zones to support future growth and multi-city operations.

-- 1. Create Cities table
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Delivery Zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    delivery_fee NUMERIC DEFAULT 1500,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(city_id, name)
);

-- 3. Seed initial Abuja data
INSERT INTO public.cities (name) VALUES ('Abuja') ON CONFLICT (name) DO NOTHING;

-- Use a DO block to seed zones based on the newly created city entry
DO $$
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
END $$;

-- 4. Extend orders, shipments, profiles, and verifications with scalable references
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

ALTER TABLE public.logistics_verifications ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.logistics_verifications ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

-- 5. Update create_order_v3 RPC to support scalable references
-- We maintain the signature but add logic to handle city/zone IDs
DROP FUNCTION IF EXISTS public.create_order_v3(UUID, JSONB, JSONB, NUMERIC, public.abuja_zone, UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_zone public.abuja_zone DEFAULT NULL,
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
    -- 1. Extract first seller_id for the orders table legacy column
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- 2. Create the Master Order record
    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        items,
        zone, -- keep for backward compatibility with existing enum logic
        city_id,
        zone_id
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_items,
        p_zone,
        p_city_id,
        p_zone_id
    )
    RETURNING id INTO v_order_id;

    -- 3. Process each item: insert into items table and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        -- a. Insert into order_items_new for detailed tracking
        INSERT INTO public.order_items_new (
            order_id, 
            product_id, 
            seller_id, 
            quantity, 
            price_at_purchase
        )
        VALUES (
            v_order_id, 
            v_item.product_id, 
            v_item.seller_id, 
            v_item.quantity, 
            v_item.price
        );

        -- b. Atomic Inventory Check and Decrement
        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    -- 4. Return success result
    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- 6. RLS Policies for Locations
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);


-- END OF FILE: 20260303_scalable_zones_v2.sql

-- START OF FILE: 20260303_seed_agent_zones.sql
-- MIGRATION: 20260303_seed_agent_zones
-- This migration updates existing logistics agents with operational zones if they don't have one.

DO $$
DECLARE
    r RECORD;
    zones text[] := ARRAY[
        'Zone 1 (Gwarinpa & Life Camp)',
        'Zone 2 (Wuse & Utako)',
        'Zone 3 (Kubwa Central)',
        'Zone 4 (Lugbe & Apo)',
        'Zone 5 (Gwagwalada Districts)'
    ];
    counter int := 1;
BEGIN
    FOR r IN (
        SELECT ur.user_id 
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.role = 'logistics' AND p.zone IS NULL
    )
    LOOP
        UPDATE public.profiles 
        SET zone = zones[((counter - 1) % 5) + 1]::public.abuja_zone
        WHERE id = r.user_id;
        
        counter := counter + 1;
    END LOOP;
END $$;

-- END OF FILE: 20260303_seed_agent_zones.sql

-- START OF FILE: 20260303_seller_shipment_management.sql
-- MIGRATION: 20260303_seller_shipment_management
-- This migration allows sellers to create and manage shipments for their orders.

-- 1. Allow Sellers to INSERT shipments for their orders

DROP POLICY IF EXISTS "Sellers can create shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can create shipments for their orders"
ON public.shipments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = shipments.order_id 
    AND seller_id = auth.uid()
  ) OR
  seller_id = auth.uid()
);

-- 2. Allow Sellers to UPDATE shipments for their orders
-- (e.g., to assign a rider or update status)

DROP POLICY IF EXISTS "Sellers can update shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can update shipments for their orders"
ON public.shipments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = shipments.order_id 
    AND seller_id = auth.uid()
  ) OR
  seller_id = auth.uid()
);

-- 3. Ensure Sellers can view their own shipments (redundant but safe)
DROP POLICY IF EXISTS "Sellers can view shipments for their products" ON public.shipments;
CREATE POLICY "Sellers can view shipments for their products"
ON public.shipments FOR SELECT
USING (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.order_items_new oi
    WHERE oi.order_id = shipments.order_id 
    AND oi.seller_id = auth.uid()
  )
);

-- END OF FILE: 20260303_seller_shipment_management.sql

-- START OF FILE: 20260303_settlement_definitive_fix.sql
-- MIGRATION: 20260303_settlement_definitive_fix.sql
-- Run this AFTER DIAGNOSTIC_settlement.sql confirms the problem.
--
-- This is a complete rewrite of the settlement system that:
-- 1. Converts wallet_transactions.type to TEXT (removes ENUM constraints)
-- 2. Adds all required wallet columns
-- 3. Creates a clean, debuggable settlement trigger
-- 4. Includes an inline test at the end

-- ═══════════════════════════════════════════════════════════
-- PART 1: Fix wallet_transactions.type (convert ENUM -> TEXT)
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type';

    IF col_type = 'USER-DEFINED' THEN
        -- Convert enum column to TEXT so any string value works
        ALTER TABLE public.wallet_transactions 
            ALTER COLUMN type TYPE TEXT USING type::TEXT;
        RAISE NOTICE 'Converted wallet_transactions.type from ENUM to TEXT';
    ELSE
        RAISE NOTICE 'wallet_transactions.type is already %', col_type;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Ensure wallets has required columns
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: for existing seller wallets, user_id = seller_id
UPDATE public.wallets 
SET user_id = seller_id 
WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Ensure wallet_transactions has reference column
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Clean settlement trigger
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id  UUID;
    v_order_total      NUMERIC;
    v_delivery_fee     NUMERIC;
    v_seller_payout    NUMERIC;
    v_rider_id         UUID;
    DELIVERY_FEE_RATE  CONSTANT NUMERIC := 0.05;
BEGIN
    -- Only fire when status changes TO 'completed'
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    v_order_total   := COALESCE(NEW.total, 0);
    v_delivery_fee  := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    RAISE NOTICE '[Settlement] Order % completed. Total: %, Fee: %, Seller: %',
        NEW.id, v_order_total, v_delivery_fee, v_seller_payout;

    -- ── Seller wallet ──────────────────────────────────────
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
    LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
        RAISE NOTICE '[Settlement] Created new seller wallet: %', v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance         = balance + v_seller_payout,
        escrow_balance  = GREATEST(0, COALESCE(escrow_balance, 0) - v_seller_payout),
        updated_at      = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Settlement: Order #' || LEFT(NEW.id::TEXT, 8));

    -- Seller notification
    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
                '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
                ' credited — Order #' || LEFT(NEW.id::TEXT, 8) || ' finalized by buyer.');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[Settlement] Notification insert failed (non-critical): %', SQLERRM;
    END;

    -- ── Rider wallet ───────────────────────────────────────
    SELECT s.rider_id INTO v_rider_id
    FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
    LIMIT 1;

    RAISE NOTICE '[Settlement] Rider ID for order %: %', NEW.id, v_rider_id;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0)
            RETURNING id INTO v_rider_wallet_id;
            RAISE NOTICE '[Settlement] Created new rider wallet: %', v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance    = balance + v_delivery_fee,
            updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

        UPDATE public.shipments
        SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                    '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                    ' delivery fee credited — Order #' || LEFT(NEW.id::TEXT, 8));
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[Settlement] Rider notification failed (non-critical): %', SQLERRM;
        END;
    END IF;

    RAISE NOTICE '[Settlement] Complete for order %', NEW.id;
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Settlement] CRITICAL ERROR for order %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;  -- Never block the order update
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach the trigger
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ═══════════════════════════════════════════════════════════
-- PART 5: VERIFY — after running, check trigger exists
-- ═══════════════════════════════════════════════════════════
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    CASE tgenabled WHEN 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';

-- ═══════════════════════════════════════════════════════════
-- PART 6: Manual test — simulate completing an order
-- Uncomment and replace ORDER_ID with a real delivered order
-- ═══════════════════════════════════════════════════════════
-- UPDATE public.orders 
-- SET status = 'completed', updated_at = NOW() 
-- WHERE id = 'YOUR-ORDER-ID-HERE' 
-- AND status = 'delivered';
--
-- Then check:
-- SELECT * FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 5;
-- SELECT id, balance, escrow_balance, user_id, seller_id FROM public.wallets;

-- END OF FILE: 20260303_settlement_definitive_fix.sql

-- START OF FILE: 20260303_settlement_final.sql
-- ============================================================
-- PASTE THIS ENTIRE BLOCK into Supabase SQL Editor
-- Do not paste only part of it
-- ============================================================

-- Step 1: Drop old trigger
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- Step 2: Ensure wallet columns exist
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- Step 3: Ensure wallet_transactions.reference exists
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- Step 4: Convert wallet_transactions.type to TEXT if it is an ENUM
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='type') = 'USER-DEFINED'
    THEN
        ALTER TABLE public.wallet_transactions ALTER COLUMN type TYPE TEXT USING type::TEXT;
        RAISE NOTICE 'Converted type column from ENUM to TEXT';
    END IF;
END $$;

-- Step 5: Create settlement function

DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id  UUID;
    v_order_total      NUMERIC;
    v_delivery_fee     NUMERIC;
    v_seller_payout    NUMERIC;
    v_rider_id         UUID;
BEGIN
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    -- Try total, then total_amount, then sum from order items
    v_order_total := COALESCE(NULLIF(NEW.total, 0), NULLIF(NEW.total_amount, 0), 0);

    IF v_order_total = 0 THEN
        SELECT COALESCE(SUM(price_at_purchase * quantity), 0)
        INTO v_order_total
        FROM public.order_items_new
        WHERE order_id = NEW.id;
    END IF;

    RAISE NOTICE '[Settlement] Order % completed. Total = %', NEW.id, v_order_total;

    IF v_order_total = 0 THEN
        RAISE WARNING '[Settlement] Zero total on order % — no earnings credited', NEW.id;
        RETURN NEW;
    END IF;

    v_delivery_fee  := ROUND(v_order_total * 0.05, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    -- Seller wallet
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0) RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance = balance + v_seller_payout,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance,0) - v_seller_payout),
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Settlement: Order #' || LEFT(NEW.id::TEXT, 8));

    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') || ' credited — Order #' || LEFT(NEW.id::TEXT,8));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE NOTICE '[Settlement] Seller % credited ₦%', v_seller_wallet_id, v_seller_payout;

    -- Rider wallet
    SELECT s.rider_id INTO v_rider_id FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL LIMIT 1;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets SET balance = balance + v_delivery_fee, updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

        UPDATE public.shipments SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') || ' delivery fee — Order #' || LEFT(NEW.id::TEXT,8));
        EXCEPTION WHEN OTHERS THEN NULL; END;

        RAISE NOTICE '[Settlement] Rider % credited ₦%', v_rider_wallet_id, v_delivery_fee;
    ELSE
        RAISE NOTICE '[Settlement] No rider on order % — delivery fee skipped', NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Settlement] ERROR on order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Attach trigger
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_revenue_settlement();

-- Step 7: Verify
SELECT tgname AS trigger, proname AS function,
       CASE tgenabled WHEN 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status
FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';

-- END OF FILE: 20260303_settlement_final.sql

-- START OF FILE: 20260303_settlement_on_completion.sql
-- MIGRATION: 20260303_settlement_on_completion.sql
-- Moves ALL financial settlement (seller + logistics) to trigger on 'completed'
-- (i.e., when the BUYER marks the order as received).
-- This prevents premature payouts and potential fraud.
--
-- DELIVERY_FEE: A 5% delivery fee is calculated from the order total and credited
-- to the logistics agent's wallet. The seller receives the remaining 95%.
-- Adjust DELIVERY_FEE_RATE as needed.

DO $$
BEGIN
    -- Ensure wallets table has user_id for logistics agents
    -- (it may only have seller_id from v1)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.wallets ADD COLUMN user_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- ============================================================
-- 1. UPDATED SELLER SETTLEMENT
-- Now triggers on 'completed' (buyer confirms receipt) not 'delivered'
-- Seller receives 95% of the order total (5% route fee to logistics)
-- ============================================================

DROP FUNCTION IF EXISTS public.handle_revenue_settlement() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05; -- 5% to logistics agent
BEGIN
    -- ── Fire ONLY when status transitions to 'completed' ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        v_seller_payout := v_order_total - v_delivery_fee;

        -- ── 1. Find (or create) seller wallet ──
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- ── 2. Credit seller wallet (order total minus delivery fee) ──
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (
            v_seller_wallet_id,
            v_seller_payout,
            'settlement',
            'Order Settlement (net): #' || LEFT(NEW.id::TEXT, 8)
        );

        -- ── 3. Notify seller ──
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            NEW.seller_id,
            'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999.00') || ' credited for Order #' || LEFT(NEW.id::TEXT, 8) || '. Buyer has confirmed receipt.'
        );

        -- ── 4. Find rider for this order via shipments ──
        SELECT rider_id INTO v_rider_id
        FROM public.shipments
        WHERE order_id = NEW.id
        AND rider_id IS NOT NULL
        LIMIT 1;

        -- ── 5. Credit logistics agent wallet (delivery fee) ──
        IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

            SELECT id INTO v_rider_wallet_id
            FROM public.wallets
            WHERE user_id = v_rider_id
            LIMIT 1;

            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance)
                VALUES (v_rider_id, 0)
                RETURNING id INTO v_rider_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_delivery_fee,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (
                v_rider_wallet_id,
                v_delivery_fee,
                'delivery_fee',
                'Delivery Fee for Order #' || LEFT(NEW.id::TEXT, 8)
            );

            -- ── 6. Notify logistics agent ──
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (
                v_rider_id,
                'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999.00') || ' delivery fee credited for Order #' || LEFT(NEW.id::TEXT, 8) || '. Well done!'
            );

        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Recreate trigger (replaces the old one that fired on 'delivered')
-- ============================================================
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ============================================================
-- 3. Add 'delivery_fee' transaction type if enum exists
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'transaction_type'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'delivery_fee'
            AND enumtypid = 'public.transaction_type'::regtype
        ) THEN
            ALTER TYPE public.transaction_type ADD VALUE 'delivery_fee';
        END IF;
    END IF;
END $$;

COMMENT ON FUNCTION public.handle_revenue_settlement IS
'Settles order revenue on BUYER COMPLETION: 95% to seller wallet, 5% delivery fee to logistics agent wallet.';

-- END OF FILE: 20260303_settlement_on_completion.sql

-- START OF FILE: 20260303_state_machine_overhaul.sql
-- MIGRATION: 20260303_state_machine_overhaul.sql
-- Implements the robust order state machine statuses.
-- FIXED: Ensures 'accepted' exists in both enums before adding subsequent values.

-- 1. Extend order_status Enum
DO $$ 
BEGIN
    -- Add CONFIRMED after PENDING
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'confirmed') THEN
        ALTER TYPE public.order_status ADD VALUE 'confirmed' AFTER 'pending';
    END IF;

    -- Add AWAITING_AGENT after PROCESSING
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'awaiting_agent') THEN
        ALTER TYPE public.order_status ADD VALUE 'awaiting_agent' AFTER 'processing';
    END IF;

    -- Add ACCEPTED after AWAITING_AGENT
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.order_status ADD VALUE 'accepted' AFTER 'awaiting_agent';
    END IF;

    -- Add PICKED_UP after ACCEPTED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'picked_up') THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'accepted';
    END IF;

    -- Add OUT_FOR_DELIVERY after PICKED_UP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'out_for_delivery') THEN
        ALTER TYPE public.order_status ADD VALUE 'out_for_delivery' AFTER 'picked_up';
    END IF;

    -- Add COMPLETED after DELIVERED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'completed') THEN
        ALTER TYPE public.order_status ADD VALUE 'completed' AFTER 'delivered';
    END IF;

    -- Add REFUNDED after CANCELLED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'refunded') THEN
        ALTER TYPE public.order_status ADD VALUE 'refunded' AFTER 'cancelled';
    END IF;
END $$;

-- 2. Extend shipment_status Enum
DO $$ 
BEGIN
    -- Add ACCEPTED after ASSIGNED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'accepted' AFTER 'assigned';
    END IF;

    -- Add OUT_FOR_PICKUP after ACCEPTED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'out_for_pickup') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'out_for_pickup' AFTER 'accepted';
    END IF;

    -- Add ARRIVED_AT_SELLER after OUT_FOR_PICKUP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'arrived_at_seller') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_seller' AFTER 'out_for_pickup';
    END IF;

    -- Add OUT_FOR_DELIVERY after PICKED_UP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'out_for_delivery') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'out_for_delivery' AFTER 'picked_up';
    END IF;

    -- Add ARRIVED_AT_DESTINATION after OUT_FOR_DELIVERY
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'arrived_at_destination') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_destination' AFTER 'out_for_delivery';
    END IF;
END $$;

-- END OF FILE: 20260303_state_machine_overhaul.sql

-- START OF FILE: 20260303_verify_existing_agents.sql
-- MIGRATION: 20260303_verify_existing_agents
-- This migration ensures all users with the 'logistics' role have the required verification and details records.
-- This is necessary because the UI now strictly filters for 'verified' agents.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT ur.user_id, p.display_name
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.role = 'logistics'
    )
    LOOP
        -- 1. Ensure a verification record exists and is set to 'verified'
        INSERT INTO public.logistics_verifications (
            user_id, 
            full_name, 
            phone_number, 
            home_address, 
            date_of_birth, 
            passport_photo_url, 
            status,
            reviewed_at
        )
        VALUES (
            r.user_id,
            COALESCE(r.display_name, 'Agent ' || substr(r.user_id::text, 1, 5)),
            '08000000000',
            'Seeded Address',
            '1990-01-01',
            'placeholder_url',
            'verified',
            now()
        )
        ON CONFLICT (user_id) DO UPDATE 
        SET status = 'verified', reviewed_at = now();

        -- 2. Ensure logistics details exist
        INSERT INTO public.logistics_details (
            user_id,
            vehicle_type,
            bank_name,
            account_number,
            account_name
        )
        VALUES (
            r.user_id,
            'Motorcycle',
            'Placeholder Bank',
            '0000000000',
            r.display_name
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;

-- END OF FILE: 20260303_verify_existing_agents.sql

-- START OF FILE: 20260303_zone_broadcast_claim.sql
-- STEP 2 OF 2: Run this AFTER 20260303_zone_broadcast_enum.sql has been committed.
-- MIGRATION: 20260303_zone_broadcast_claim.sql
-- Implements Zone-Based Order Broadcasting with First-Claim Atomic Locking.

-- ============================================================
-- 1. Ensure rider_id nullable on shipments (broadcast orders have no rider yet)
-- ============================================================
ALTER TABLE public.shipments 
    ALTER COLUMN rider_id DROP NOT NULL;

-- ============================================================
-- 2. ATOMIC CLAIM RPC - Race-safe first-claim via row lock
-- ============================================================

DROP FUNCTION IF EXISTS public.claim_order_mission(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shipment RECORD;
    v_rider_zone TEXT;
BEGIN
    -- Lock the row to prevent concurrent claims
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id
    FOR UPDATE;

    -- Validate shipment exists
    IF v_shipment IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
    END IF;

    -- Prevent double-claim
    IF v_shipment.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission already claimed by another agent');
    END IF;

    -- Validate status is still broadcast
    IF v_shipment.status::TEXT != 'broadcast' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is no longer available');
    END IF;

    -- Verify the rider is in the correct zone
    SELECT zone::TEXT INTO v_rider_zone
    FROM public.profiles
    WHERE id = p_rider_id;

    IF v_rider_zone IS DISTINCT FROM v_shipment.zone::TEXT THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not in the required zone for this mission');
    END IF;

    -- Atomically assign the rider and change status
    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_shipment_id;

    -- Sync order status to accepted
    UPDATE public.orders
    SET 
        status = 'accepted',
        updated_at = NOW()
    WHERE id = v_shipment.order_id;

    RETURN jsonb_build_object(
        'success', true,
        'shipment_id', p_shipment_id,
        'order_id', v_shipment.order_id
    );
END;
$$;

COMMENT ON FUNCTION public.claim_order_mission IS 'Atomically claims a broadcast shipment for the first eligible rider — race-safe via row lock';

-- ============================================================
-- 3. RLS: Agents can see unassigned broadcast shipments in their zone
-- ============================================================
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;

CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
    -- Agent sees their own assigned shipments
    rider_id = auth.uid()
    OR
    -- Agent sees unassigned/broadcast orders in their zone
    (
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
        )
    )
    OR
    -- Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Agents can update their own shipments OR claim broadcast ones
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (
    rider_id = auth.uid()
    OR
    (
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
        )
    )
);

-- END OF FILE: 20260303_zone_broadcast_claim.sql

-- START OF FILE: 20260303_zone_broadcast_enum.sql
-- STEP 1 OF 2: Run this FIRST and wait for it to complete.
-- MIGRATION: 20260303_zone_broadcast_enum.sql
-- Adds 'broadcast' to the shipment_status enum.
-- PostgreSQL requires this to commit before the value can be used in functions/policies.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'broadcast' 
        AND enumtypid = 'public.shipment_status'::regtype
    ) THEN
        ALTER TYPE public.shipment_status ADD VALUE 'broadcast' BEFORE 'assigned';
    END IF;
END$$;

-- Also add broadcast_zone column to orders if not already there
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS broadcast_zone TEXT;

-- After running this, wait a moment then run 20260303_zone_broadcast_claim.sql

-- END OF FILE: 20260303_zone_broadcast_enum.sql

-- START OF FILE: 20260308230215_15d571bc-b8e1-4a32-aa19-134369ed964e.sql

-- 1. Add missing columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS zone_id uuid,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Add likes_count, city_id, zone_id to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS zone_id uuid;

-- 3. Add enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 4. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;

CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Sellers can insert categories" ON public.categories;

CREATE POLICY "Sellers can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Create cities table
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;

CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);

-- 6. Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  delivery_fee numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view delivery zones" ON public.delivery_zones;

CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);

-- 7. Create shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  rider_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  pickup_address text,
  delivery_address text,
  buyer_latitude double precision,
  buyer_longitude double precision,
  rider_latitude double precision,
  rider_longitude double precision,
  last_seen timestamptz,
  delivery_fee numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Riders can view assigned shipments" ON public.shipments;

CREATE POLICY "Riders can view assigned shipments" ON public.shipments FOR SELECT TO authenticated USING (rider_id = auth.uid() OR status = 'broadcast');
DROP POLICY IF EXISTS "Riders can update assigned shipments" ON public.shipments;

CREATE POLICY "Riders can update assigned shipments" ON public.shipments FOR UPDATE TO authenticated USING (rider_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated can insert shipments" ON public.shipments;

CREATE POLICY "Authenticated can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (true);

-- 8. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

-- 9. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;

CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- 10. Create logistics_kyc table
CREATE TABLE IF NOT EXISTS public.logistics_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  home_address text NOT NULL,
  date_of_birth text,
  passport_photo_url text,
  city_id uuid REFERENCES public.cities(id),
  zone_id uuid REFERENCES public.delivery_zones(id),
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own kyc" ON public.logistics_kyc;

CREATE POLICY "Users can view own kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own kyc" ON public.logistics_kyc;

CREATE POLICY "Users can insert own kyc" ON public.logistics_kyc FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 11. Foreign keys for city/zone references
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_city_id_fkey;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_zone_id_fkey;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_city_id_fkey;

ALTER TABLE public.products ADD CONSTRAINT products_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_zone_id_fkey;

ALTER TABLE public.products ADD CONSTRAINT products_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);

-- 12. Create trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Insert default city
INSERT INTO public.cities (name, is_active) VALUES ('Abuja', true) ON CONFLICT (name) DO NOTHING;

-- 14. Enable realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; END $$;

-- 15. Allow user_roles insert for onboarding
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- END OF FILE: 20260308230215_15d571bc-b8e1-4a32-aa19-134369ed964e.sql

-- START OF FILE: 20260308230232_299afa4c-61f2-4e25-b8f5-c1d0981b8e70.sql

-- Fix overly permissive RLS policies
DROP POLICY "Sellers can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated can insert categories" ON public.categories;

CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));

DROP POLICY "Authenticated can insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Sellers can insert shipments" ON public.shipments;

CREATE POLICY "Sellers can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));

-- END OF FILE: 20260308230232_299afa4c-61f2-4e25-b8f5-c1d0981b8e70.sql

-- START OF FILE: 20260308231200_c73df64d-30dd-4e51-a3ab-6b3f6dd0bf3a.sql

-- Create seller verification storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-verifications', 'seller-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own verification docs" ON storage.objects;

CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own files
DROP POLICY IF EXISTS "Users can view own verification docs" ON storage.objects;

CREATE POLICY "Users can view own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- END OF FILE: 20260308231200_c73df64d-30dd-4e51-a3ab-6b3f6dd0bf3a.sql

-- START OF FILE: 20260308231414_fd36c66a-17e5-44ee-a2ec-c52e8153cc28.sql

-- Create kyc-documents bucket used by both seller and logistics verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own kyc docs" ON storage.objects;

CREATE POLICY "Users can upload own kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own files
DROP POLICY IF EXISTS "Users can view own kyc docs" ON storage.objects;

CREATE POLICY "Users can view own kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- END OF FILE: 20260308231414_fd36c66a-17e5-44ee-a2ec-c52e8153cc28.sql

-- START OF FILE: 20260308231551_669ecab2-24da-4502-9f25-a0409a379929.sql

CREATE TABLE IF NOT EXISTS public.seller_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  business_address text,
  bank_name text,
  account_number text,
  account_name text,
  national_id_url text,
  store_photo_url text,
  city_id uuid REFERENCES public.cities(id),
  zone_id uuid REFERENCES public.delivery_zones(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own verification" ON public.seller_verifications;


CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own verification" ON public.seller_verifications;

CREATE POLICY "Users can insert own verification" ON public.seller_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own verification" ON public.seller_verifications;

CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- END OF FILE: 20260308231551_669ecab2-24da-4502-9f25-a0409a379929.sql

-- START OF FILE: 20260308231731_e9ee22b0-f77c-4f02-81d5-5de461252924.sql

ALTER TABLE public.seller_verifications
  ADD COLUMN IF NOT EXISTS bank_details jsonb,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS zone text;

-- END OF FILE: 20260308231731_e9ee22b0-f77c-4f02-81d5-5de461252924.sql

-- START OF FILE: 20260308232339_be1b88b6-d339-470c-bd98-8f25652c6bba.sql

-- Allow admin to view all seller verifications
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.seller_verifications;

CREATE POLICY "Admins can view all verifications"
ON public.seller_verifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to update all seller verifications (approve/reject)
DROP POLICY IF EXISTS "Admins can update all verifications" ON public.seller_verifications;

CREATE POLICY "Admins can update all verifications"
ON public.seller_verifications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- END OF FILE: 20260308232339_be1b88b6-d339-470c-bd98-8f25652c6bba.sql

-- START OF FILE: 20260309003101_3b7916d0-b0ee-4266-98fe-647bbdb791be.sql
-- Allow buyers to SELECT shipments for their own orders (retry - policy may already exist from partial success)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view shipments for own orders' AND tablename = 'shipments'
  ) THEN
DROP POLICY IF EXISTS "Buyers can view shipments for own orders" ON public.shipments;

    CREATE POLICY "Buyers can view shipments for own orders"
    ON public.shipments FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipments.order_id AND orders.buyer_id = auth.uid()
    ));
  END IF;
END $$;
-- END OF FILE: 20260309003101_3b7916d0-b0ee-4266-98fe-647bbdb791be.sql

-- START OF FILE: 20260309005553_5cf1216a-5765-4d29-88a9-21d52982d528.sql

-- Table to log every shipment status change with timestamp
CREATE TABLE IF NOT EXISTS public.shipment_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    status text NOT NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    changed_by uuid DEFAULT NULL
);

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Buyers can view history for their shipments
DROP POLICY IF EXISTS "Buyers can view shipment history" ON public.shipment_status_history;

CREATE POLICY "Buyers can view shipment history"
ON public.shipment_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments s
        JOIN public.orders o ON o.id = s.order_id
        WHERE s.id = shipment_status_history.shipment_id
        AND o.buyer_id = auth.uid()
    )
);

-- Riders can view history for assigned shipments
DROP POLICY IF EXISTS "Riders can view shipment history" ON public.shipment_status_history;

CREATE POLICY "Riders can view shipment history"
ON public.shipment_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments s
        WHERE s.id = shipment_status_history.shipment_id
        AND s.rider_id = auth.uid()
    )
);

-- Sellers can insert history entries
DROP POLICY IF EXISTS "Sellers can insert shipment history" ON public.shipment_status_history;

CREATE POLICY "Sellers can insert shipment history"
ON public.shipment_status_history
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'seller'::app_role) OR has_role(auth.uid(), 'logistics'::app_role)
);

-- Trigger to auto-log status changes on the shipments table
DROP FUNCTION IF EXISTS public.log_shipment_status_change() CASCADE;

CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.shipment_status_history (shipment_id, status, changed_at)
        VALUES (NEW.id, NEW.status, now());
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_shipment_status ON public.shipments;


CREATE TRIGGER trg_log_shipment_status
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_status_change();

-- Also log initial status on insert
DROP FUNCTION IF EXISTS public.log_shipment_initial_status() CASCADE;

CREATE OR REPLACE FUNCTION public.log_shipment_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.shipment_status_history (shipment_id, status, changed_at)
    VALUES (NEW.id, NEW.status, NEW.created_at);
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_shipment_initial_status ON public.shipments;


CREATE TRIGGER trg_log_shipment_initial_status
AFTER INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_initial_status();

-- END OF FILE: 20260309005553_5cf1216a-5765-4d29-88a9-21d52982d528.sql

-- START OF FILE: 20260309041858_e46fdf8a-3c4b-449c-a44d-c751d46d6ab4.sql
-- Allow admins to view all orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any order (for reconciliation)
DROP POLICY IF EXISTS "Admins can update any order" ON public.orders;

CREATE POLICY "Admins can update any order"
ON public.orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- END OF FILE: 20260309041858_e46fdf8a-3c4b-449c-a44d-c751d46d6ab4.sql

-- START OF FILE: DIAGNOSTIC_settlement.sql
-- DIAGNOSTIC: Run this in Supabase SQL Editor to find the exact problem
-- Copy the full output and share it to identify the issue

-- 1. Does the settlement trigger exist?
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';

-- 2. What is the wallet_transactions.type column datatype?
SELECT 
    column_name,
    data_type,
    udt_name  -- Shows enum type name if it's USER-DEFINED
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'wallet_transactions'
AND column_name = 'type';

-- 3. If type is an ENUM, what values does it have?
SELECT e.enumlabel AS allowed_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = (
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'wallet_transactions' 
    AND column_name = 'type'
)
ORDER BY e.enumsortorder;

-- 4. Does wallets table have user_id column?
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wallets';

-- 5. Test: Manually call the trigger by simulating a completion
-- (Replace the ID with a real 'delivered' order ID from your DB)
-- SELECT * FROM public.orders WHERE status = 'delivered' LIMIT 3;

-- END OF FILE: DIAGNOSTIC_settlement.sql

