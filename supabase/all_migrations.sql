-- File: 20240216_complete_architecture.sql
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
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "User update profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Seller insert products" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller update products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);

-- Orders
CREATE POLICY "Buyer view orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Seller view orders" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Buyer create order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Order Items
CREATE POLICY "User view own items" ON public.order_items FOR SELECT USING (
    auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id) OR
    auth.uid() = seller_id
);

-- Shipments
CREATE POLICY "Rider view assigned" ON public.shipments FOR SELECT USING (rider_id = auth.uid());
CREATE POLICY "Buyer view shipment" ON public.shipments FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
);

-- 11. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Public images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- 12. TRIGGERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- File: 20240216_consolidated_fixes.sql
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


-- File: 20240216_create_order_rpc.sql
-- RPC Function to create an order atomically
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


-- File: 20240216_fix_cart_and_fk.sql
-- Fix Product-Profile Relationship
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

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


-- File: 20240216_fix_enum.sql
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


-- File: 20240216_fix_product_profile_fk.sql
-- Fix Product-Profile Relationship
-- The frontend expects to join products with profiles using the foreign key 'products_seller_id_fkey'.
-- Currently, products.seller_id references auth.users. We need it to reference public.profiles for PostgREST to allow the join easily.

-- 1. Drop existing constraint (name might vary, but we try the standard name)
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

-- 2. Add new constraint referencing profiles
ALTER TABLE public.products
ADD CONSTRAINT products_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. Ensure RLS allows public to view products (Redundant but safe)
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);


-- File: 20240216_fix_profiles_rls.sql
-- Fix Profiles RLS and Add Signup Trigger
-- 1. Allow users to INSERT their own profile (fixes the immediate error for existing users without profiles)
CREATE POLICY "User can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Create a Trigger to automatically create a profile entry when a new user signs up (Best Practice)
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


-- File: 20240216_fix_rls.sql
-- Fix RLS for user_roles
-- Users need to be able to SEE their own roles and INSERT their own roles (during onboarding).

-- Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can assign themselves a role (Insert)
-- You might want to restrict this to only if they don't have one, or allow it freely for now.
CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- File: 20240216_full_schema.sql
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
    CREATE POLICY "Users can view their own order items" 
    ON public.order_items FOR SELECT 
    USING (auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items.order_id));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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


-- File: 20240216_logistics_codes.sql
-- Add verification codes to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Comment
COMMENT ON COLUMN public.shipments.pickup_code IS 'Code rider needs from seller to confirm pickup';
COMMENT ON COLUMN public.shipments.delivery_code IS 'Code rider needs from buyer to confirm delivery';


-- File: 20240216_robust_orders.sql
-- Create Enums for Order Status and Payment Status
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

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

CREATE POLICY "Users can view their own order items" 
ON public.order_items FOR SELECT 
USING (auth.uid() IN (
    SELECT buyer_id FROM public.orders WHERE id = order_items.order_id
));

CREATE POLICY "Sellers can view items in their orders" 
ON public.order_items FOR SELECT 
USING (seller_id = auth.uid());

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);


-- File: 20240216_secure_order_rpc.sql
-- Secure Order Creation with Stock Checks
-- This function replaces the basic create_order to add:
-- 1. Validation that products exist.
-- 2. Validation that sufficient inventory exists.
-- 3. Atomic deduction of inventory upon order creation.

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


-- File: 20240216_seller_kyc.sql
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
CREATE POLICY "Users can view own verification" ON public.seller_verifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own verification
CREATE POLICY "Users can submit verification" ON public.seller_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own verification ONLY if it is pending or rejected
CREATE POLICY "Users can update own verification" ON public.seller_verifications
FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- Admin policies (assuming app_role 'admin' exists in user_roles)
-- For simplicity, we might allow full read for now or join with user_roles
CREATE POLICY "Admins can view all verifications" ON public.seller_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update verifications" ON public.seller_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Storage for KYC
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- Storage Policies
-- Only authenticated users can upload
CREATE POLICY "Authenticated upload kyc" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

-- Users can read their own files (This is tricky with storage RLS alone, usually we rely on signed URLs or folder structure: kyc-documents/user_id/file)
-- For now, simple RLS using the file path convention (user_id/filename)
CREATE POLICY "Users view own kyc path" ON storage.objects
FOR SELECT USING (bucket_id = 'kyc-documents' AND (name LIKE (auth.uid() || '/%')));

-- Admins view all
CREATE POLICY "Admins view all kyc" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);


-- File: 20240216_system_roles.sql
-- 1. UPDATE APP ROLES
-- We cannot execute ALTER TYPE inside a transaction block in some Postgres versions if it's already used, 
-- but Supabase usually handles migrations. We'll try to add if not exists.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'promoter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. LOGISTICS SCHEMA

-- Shipment Status Enum
CREATE TYPE public.shipment_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');

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

CREATE POLICY "Admins and Logistics can view all shipments"
ON public.shipments FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'logistics'))
);

CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (rider_id = auth.uid());

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

CREATE POLICY "Anyone can view active campaigns"
ON public.promoter_campaigns FOR SELECT
USING (is_active = true);

CREATE POLICY "Sellers can manage their campaigns"
ON public.promoter_campaigns FOR ALL
USING (seller_id = auth.uid());

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


-- File: 20240216_wishlist_fix.sql
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


-- File: 20260215124017_6093fc62-2be2-4700-ab1b-8b744c81ec90.sql

-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('buyer', 'seller');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.products (
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
CREATE TABLE public.orders (
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
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Likes table
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cart items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- profiles
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- products
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Sellers can insert products" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Sellers can update own products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own products" ON public.products FOR DELETE USING (auth.uid() = seller_id);

-- orders
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can view orders for their products" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Sellers can update order status" ON public.orders FOR UPDATE USING (auth.uid() = seller_id);

-- wallets
CREATE POLICY "Sellers can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "System can update wallet" ON public.wallets FOR UPDATE USING (auth.uid() = seller_id);

-- wallet_transactions
CREATE POLICY "Sellers can view own transactions" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.seller_id = auth.uid())
);
CREATE POLICY "System can insert transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.seller_id = auth.uid())
);

-- likes
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- comments
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- cart_items
CREATE POLICY "Users can view own cart" ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to cart" ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update cart" ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove from cart" ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for comments, likes, notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Sellers can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Sellers can delete own product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);


-- File: 20260220_fix_order_items_rls.sql
-- FIX order_items_new RLS POLICIES FOR VISIBILITY
-- The previous policy used a subquery which is correct but we want to ensure it's fully covered.

-- 1. Ensure RLS is enabled
ALTER TABLE public.order_items_new ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing view policy if any to recreate it robustly
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;

-- 3. Create a policy for Sellers to view items they sold
CREATE POLICY "Sellers can view own sold items" ON public.order_items_new
FOR SELECT USING (auth.uid() = seller_id);

-- 4. Create a policy for Buyers to view items they bought
CREATE POLICY "Buyers can view own bought items" ON public.order_items_new
FOR SELECT USING (
    auth.uid() IN (
        SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id
    )
);

-- Note: We intentionally DO NOT add an INSERT policy for public users.
-- This ensures that orders MUST be created via the Secure Edge Function
-- which uses the Service Role Key to bypass RLS.


-- File: 20260220_inventory_decrement_trigger.sql
-- Create an atomic RPC function for safe inventory decrement
-- This is called by both the edge function and can be used independently
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


-- File: 20260220_inventory_stock_management.sql
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

ALTER TABLE products
  ADD CONSTRAINT products_inventory_non_negative CHECK (inventory >= 0);

-- Expose inventory via RLS so buyers can read it
-- (products table is already readable, this just confirms inventory is accessible)


-- File: 20260220_performance_indices_and_likes.sql
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


-- File: 20260220_scalability_overhaul.sql
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


-- File: 20260223_admin_kyc_fixes.sql
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


-- File: 20260223_dynamic_categories.sql
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
CREATE POLICY "Public categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Sellers/Admins can add categories" ON public.categories FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('seller', 'admin')
    )
);

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


-- File: 20260223_order_notifications.sql
-- Create a function to notify buyers of order status changes
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


-- File: 20260224_admin_orders_rls.sql
-- Allow Admins to view all orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all orders') THEN
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


-- File: 20260224_admin_overhaul_infra.sql
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

CREATE POLICY "Users can view own issues" ON public.issues
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create issues" ON public.issues
FOR INSERT WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Admin User Deletion RPC (SECURITY DEFINER to handle sensitive deletes)
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


-- File: 20260224_admin_user_roles_rls.sql
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


-- File: 20260224_fix_analytics_rpc.sql
-- Fix get_seller_analytics RPC
-- The previous version used 'completed' which is not in the order_status enum, causing 400 errors.

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


-- File: 20260224_fix_orders_relationship.sql
-- Fix relationship between orders and profiles (buyer/seller)
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT orders_buyer_id_fkey ON public.orders IS 'PostgREST join reference for buyer profile';
COMMENT ON CONSTRAINT orders_seller_id_fkey ON public.orders IS 'PostgREST join reference for seller profile';


-- File: 20260224_fix_rls_recursion.sql
-- Fix RLS Infinite Recursion for user_roles
-- We use a SECURITY DEFINER function to bypass RLS checks during the admin validation.

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


-- File: 20260224_fix_user_roles_relationship.sql
-- Fix relationship between profiles and user_roles for PostgREST
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Also add a comment for clarification
COMMENT ON CONSTRAINT user_roles_user_id_fkey ON public.user_roles IS 'Direct reference to public.profiles for PostgREST embedding';


-- File: 20260224_logistics_dashboard_updates.sql
-- Logistics Dashboard Infrastructure Improvements

-- 1. Add vehicle_type to logistics_details
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


-- File: 20260224_logistics_verification_schema.sql
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

-- 2. Logistics Details Table (Skippable Onboarding)
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

-- 3. Enable RLS
ALTER TABLE public.logistics_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Logistics Verifications
CREATE POLICY "Users can view own logistics verification" ON public.logistics_verifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit logistics verification" ON public.logistics_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logistics verifications" ON public.logistics_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update logistics verifications" ON public.logistics_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Policies for Logistics Details
CREATE POLICY "Users can manage own logistics details" ON public.logistics_details
FOR ALL USING (auth.uid() = user_id);

-- 6. RPC for verifying logistics KYC
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


-- File: 20260224_orders_rls_and_realtime.sql
-- Enable RLS and Realtime for Orders
-- This ensures sellers can update status and UI updates in real-time

-- 1. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Orders
DO $$ 
BEGIN
    -- SELECT: Buyers can see their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view own orders') THEN
        CREATE POLICY "Buyers can view own orders" ON public.orders
        FOR SELECT USING (auth.uid() = buyer_id);
    END IF;

    -- SELECT: Sellers can see orders assigned to them
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can view assigned orders') THEN
        CREATE POLICY "Sellers can view assigned orders" ON public.orders
        FOR SELECT USING (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Sellers can update order status
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can update order status') THEN
        CREATE POLICY "Sellers can update order status" ON public.orders
        FOR UPDATE USING (auth.uid() = seller_id)
        WITH CHECK (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Logistics riders can update order status (synced from shipment)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Logistics can update order status') THEN
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
        CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
        FOR SELECT USING (
            auth.uid() = rider_id OR 
            auth.uid() IN (SELECT seller_id FROM public.orders WHERE id = shipments.order_id)
        );
    END IF;

    -- UPDATE: Riders can update their assigned shipments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Riders can update own shipments') THEN
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


-- File: 20260224_reconcile_orders_schema.sql
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
        CREATE POLICY "Users can view own order items" ON public.order_items_new
        FOR SELECT USING (
            auth.uid() = seller_id OR 
            auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_items_new.order_id)
        );
    END IF;
END $$;


-- File: 20260224_settlement_on_delivery.sql
-- Revenue Settlement on Delivery
-- Industry standard: Funds are credited to seller wallet upon successful delivery

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
            'Revenue of â‚¦' || order_total || ' has been settled for order #' || LEFT(NEW.id::text, 8)
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


-- File: 20260225_add_missing_issue_columns.sql
-- Add missing columns to the issues table to support seller dashboard and product reporting

-- 1. Add product_id and seller_id
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Update RLS policies to allow sellers to view issues directed at them
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


-- File: 20260225_fix_rider_visibility.sql
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


-- File: 20260225_fix_rls_recursion_master.sql
-- RLS Recursion Fix & Optimization
-- Breaks infinite recursion loops in user_roles, orders, and shipments.

-- 1. Ensure a safe admin check function exists (bypasses RLS)
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


-- File: 20260225_logistics_discovery_rls.sql
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


