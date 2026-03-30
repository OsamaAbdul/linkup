-- COMPREHENSIVE BASELINE MIGRATION
-- Consolidates 130+ incremental migrations into a single production-ready file.

BEGIN;

-- Source: 20240216_complete_architecture.sql
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

-- Source: 20240216_consolidated_fixes.sql
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

-- Source: 20240216_create_order_rpc.sql
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

-- Source: 20240216_fix_cart_and_fk.sql
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

-- Source: 20240216_fix_enum.sql
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

-- Source: 20240216_fix_product_profile_fk.sql
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

-- Source: 20240216_fix_profiles_rls.sql
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

-- Source: 20240216_fix_rls.sql
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

-- Source: 20240216_full_schema.sql
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

-- Source: 20240216_logistics_codes.sql
-- Add verification codes to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Comment
COMMENT ON COLUMN public.shipments.pickup_code IS 'Code rider needs from seller to confirm pickup';
COMMENT ON COLUMN public.shipments.delivery_code IS 'Code rider needs from buyer to confirm delivery';

-- Source: 20240216_robust_orders.sql
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

-- Source: 20240216_secure_order_rpc.sql
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

-- Source: 20240216_seller_kyc.sql
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

-- Source: 20240216_system_roles.sql
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

-- Source: 20240216_wishlist_fix.sql
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

-- Source: 20260215124017_6093fc62-2be2-4700-ab1b-8b744c81ec90.sql
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

-- Source: 20260220_fix_order_items_rls.sql
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

-- Source: 20260220_inventory_decrement_trigger.sql
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

-- Source: 20260220_inventory_stock_management.sql
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

-- Source: 20260220_performance_indices_and_likes.sql
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

-- Source: 20260220_scalability_overhaul.sql
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

-- Source: 20260223_admin_kyc_fixes.sql
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

-- Source: 20260223_dynamic_categories.sql
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

-- Source: 20260223_order_notifications.sql
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

-- Source: 20260224_admin_orders_rls.sql
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

-- Source: 20260224_admin_overhaul_infra.sql
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

-- Source: 20260224_admin_user_roles_rls.sql
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

-- Source: 20260224_fix_analytics_rpc.sql
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

-- Source: 20260224_fix_orders_relationship.sql
-- Fix relationship between orders and profiles (buyer/seller)
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT orders_buyer_id_fkey ON public.orders IS 'PostgREST join reference for buyer profile';
COMMENT ON CONSTRAINT orders_seller_id_fkey ON public.orders IS 'PostgREST join reference for seller profile';

-- Source: 20260224_fix_rls_recursion.sql
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

-- Source: 20260224_fix_user_roles_relationship.sql
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

-- Source: 20260224_logistics_dashboard_updates.sql
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

-- Source: 20260224_logistics_verification_schema.sql
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

-- Source: 20260224_orders_rls_and_realtime.sql
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

-- Source: 20260224_reconcile_orders_schema.sql
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

-- Source: 20260224_settlement_on_delivery.sql
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

-- Source: 20260225_add_missing_issue_columns.sql
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

-- Source: 20260225_fix_rider_visibility.sql
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

-- Source: 20260225_fix_rls_recursion_master.sql
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

-- Source: 20260225_logistics_discovery_rls.sql
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

-- Source: 20260227_fix_shipment_schema.sql
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

-- Source: 20260227_hyperlocal_delivery_zones.sql
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

-- Source: 20260227_hyperlocal_delivery_zonesv2.sql
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

-- Source: 20260227_mutual_live_tracking.sql
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

-- Source: 20260227_rider_online_status.sql
-- MIGRATION: 20260227_rider_online_status
-- Adds is_online column to profiles to track logistics agent availability.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Ensure riders can update their own status
-- (Profiles table already has update policy for auth.uid() = id)

-- Source: 20260228_add_category_icons.sql
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

-- Source: 20260228_add_onboarding_completed.sql
-- Add onboarding_completed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users: if they have a role, mark as completed
UPDATE profiles 
SET onboarding_completed = TRUE 
WHERE id IN (SELECT user_id FROM user_roles);

-- Alternatively, keep it simple and just let them complete it once more if they haven't.
-- But marking based on role presence is safer for existing users.

-- Source: 20260228_fix_user_roles_recursion.sql
-- Migration: 20260228_fix_user_roles_recursion
-- Safely breaks the infinite recursion in user_roles RLS.

-- 1. Create a truly safe is_admin function that doesn't trigger the same policy
-- We use SECURITY DEFINER and a specific search path.
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

-- Source: 20260228_master_recursion_fix.sql
-- MASTER RECURSION FIX (Run this in Supabase SQL Editor)
-- This breaks infinite loops caused by policies checking roles.

-- 1. Create a safe role checker that BYPASSES RLS
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

-- Source: 20260301_inventory_decrement_rpc.sql
-- 20260301_inventory_decrement_rpc.sql
-- This migration provides the RPC function used by the create-order Edge Function.

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

-- Source: 20260301_ultimate_recursion_fix.sql
-- 20260301_ultimate_recursion_fix.sql
-- This migration provides a truly non-recursive way to check roles.

-- 1. Create the base check_user_role function with SECURITY DEFINER
-- This function runs as the owner (postgres) and thus bypasses RLS
-- We must make sure it doesn't call any other recursive functions.
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

-- Source: 20260302_create_chat_system.sql
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
CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can initiate conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = buyer_id);

-- 5. Policies for Messages
CREATE POLICY "Users can view messages in their conversations" 
ON public.messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = messages.conversation_id 
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
);

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Source: 20260302_create_order_v3_rpc.sql
-- 20260302_create_order_v3_rpc.sql
-- Atomic Order Creation with Inventory Protection

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

-- Source: 20260302_enable_likes_realtime.sql
-- MIGRATION: 20260302_enable_likes_realtime
-- Enables Supabase Realtime for the likes table to allow instant wishlist updates.

BEGIN;
  -- Add the likes table to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;

-- Source: 20260303_add_order_pickup_address.sql
-- MIGRATION: 20260303_add_order_pickup_address
-- Adds pickup_address to orders and updates creation RPC.

-- 1. Add pickup_address column to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_address JSONB;

-- 2. Update create_order_v3 to handle pickup_address
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

-- Source: 20260303_add_product_locations.sql
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

-- Source: 20260303_buyer_completion_rls.sql
-- MIGRATION: 20260303_buyer_completion_rls.sql
-- The buyer "Confirm Receipt & Finalize" button sets status = 'completed'.
-- The existing buyer UPDATE policy only allows status = 'pending' (cancel-only).
-- This migration adds a new policy so buyers can mark 'delivered' orders as 'completed'.

-- Drop the old cancel-only policy
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;

-- Recreate it split into two specific policies for clarity:

-- 1. Buyers can cancel orders that are still pending
CREATE POLICY "Buyers can cancel pending orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'pending'
);

-- 2. Buyers can confirm receipt of delivered orders (marks as 'completed')
CREATE POLICY "Buyers can confirm receipt of delivered orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'completed'
    -- But the current row must be 'delivered' — enforced at query level by the client
);

-- Source: 20260303_complete_order_rpc.sql
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

-- Source: 20260303_create_avatars_bucket.sql
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

-- Source: 20260303_escrow_and_withdrawals.sql
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
CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Only admins can approve/reject
CREATE POLICY "Admins can manage all withdrawal requests"
ON public.withdrawal_requests FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;

-- ============================================================
-- 4. UPDATED SETTLEMENT TRIGGER
-- When order = 'awaiting_agent' (broadcast): funds go into BUYER's escrow
-- When order = 'completed' (buyer confirms): escrow releases to seller (95%) and rider (5%)
-- ============================================================
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

-- Source: 20260303_fix_rpc_ambiguity.sql
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

-- Source: 20260303_fix_settlement_trigger.sql
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

-- Source: 20260303_granular_statuses.sql
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

-- Source: 20260303_restore_logistics_discovery.sql
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

-- Source: 20260303_scalable_zones_v2.sql
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

-- Source: 20260303_seed_agent_zones.sql
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

-- Source: 20260303_seller_shipment_management.sql
-- MIGRATION: 20260303_seller_shipment_management
-- This migration allows sellers to create and manage shipments for their orders.

-- 1. Allow Sellers to INSERT shipments for their orders
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

-- Source: 20260303_settlement_definitive_fix.sql
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

-- Source: 20260303_settlement_final.sql
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

-- Source: 20260303_settlement_on_completion.sql
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

-- Source: 20260303_state_machine_overhaul.sql
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

-- Source: 20260303_verify_existing_agents.sql
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

-- Source: 20260303_zone_broadcast_claim.sql
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

    -- NEW: Verify the rider's KYC status is 'verified'
    IF NOT EXISTS (
        SELECT 1 FROM public.logistics_kyc
        WHERE user_id = p_rider_id AND status = 'verified'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your KYC must be verified by an admin before you can claim missions');
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
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
            AND lk.status = 'verified'
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
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
            AND lk.status = 'verified'
        )
    )
);

-- Source: 20260303_zone_broadcast_enum.sql
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

-- Source: 20260308230215_15d571bc-b8e1-4a32-aa19-134369ed964e.sql
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
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Sellers can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Create cities table
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Riders can view assigned shipments" ON public.shipments FOR SELECT TO authenticated USING (rider_id = auth.uid() OR status = 'broadcast');
CREATE POLICY "Riders can update assigned shipments" ON public.shipments FOR UPDATE TO authenticated USING (rider_id = auth.uid());
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
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
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
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
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
CREATE POLICY "Users can view own kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own kyc" ON public.logistics_kyc FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 11. Foreign keys for city/zone references
ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);
ALTER TABLE public.products ADD CONSTRAINT products_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.products ADD CONSTRAINT products_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);

-- 12. Create trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Insert default city
INSERT INTO public.cities (name, is_active) VALUES ('Abuja', true) ON CONFLICT (name) DO NOTHING;

-- 14. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;

-- 15. Allow user_roles insert for onboarding
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Source: 20260308230232_299afa4c-61f2-4e25-b8f5-c1d0981b8e70.sql
-- Fix overly permissive RLS policies
DROP POLICY "Sellers can insert categories" ON public.categories;
CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));

DROP POLICY "Authenticated can insert shipments" ON public.shipments;
CREATE POLICY "Sellers can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));

-- Source: 20260308231200_c73df64d-30dd-4e51-a3ab-6b3f6dd0bf3a.sql
-- Create seller verification storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-verifications', 'seller-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own files
CREATE POLICY "Users can view own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Source: 20260308231414_fd36c66a-17e5-44ee-a2ec-c52e8153cc28.sql
-- Create kyc-documents bucket used by both seller and logistics verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users can upload own kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own files
CREATE POLICY "Users can view own kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Source: 20260308231551_669ecab2-24da-4502-9f25-a0409a379929.sql
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

CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own verification" ON public.seller_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Source: 20260308231731_e9ee22b0-f77c-4f02-81d5-5de461252924.sql
ALTER TABLE public.seller_verifications
  ADD COLUMN IF NOT EXISTS bank_details jsonb,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS zone text;

-- Source: 20260308232339_be1b88b6-d339-470c-bd98-8f25652c6bba.sql
-- Allow admin to view all seller verifications
CREATE POLICY "Admins can view all verifications"
ON public.seller_verifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to update all seller verifications (approve/reject)
CREATE POLICY "Admins can update all verifications"
ON public.seller_verifications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Source: 20260309003101_3b7916d0-b0ee-4266-98fe-647bbdb791be.sql
-- Allow buyers to SELECT shipments for their own orders (retry - policy may already exist from partial success)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view shipments for own orders' AND tablename = 'shipments'
  ) THEN
    CREATE POLICY "Buyers can view shipments for own orders"
    ON public.shipments FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipments.order_id AND orders.buyer_id = auth.uid()
    ));
  END IF;
END $$;

-- Source: 20260309005553_5cf1216a-5765-4d29-88a9-21d52982d528.sql
-- Table to log every shipment status change with timestamp
CREATE TABLE public.shipment_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    status text NOT NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    changed_by uuid DEFAULT NULL
);

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Buyers can view history for their shipments
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
CREATE POLICY "Sellers can insert shipment history"
ON public.shipment_status_history
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'seller'::app_role) OR has_role(auth.uid(), 'logistics'::app_role)
);

-- Trigger to auto-log status changes on the shipments table
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

CREATE TRIGGER trg_log_shipment_status
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_status_change();

-- Also log initial status on insert
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

CREATE TRIGGER trg_log_shipment_initial_status
AFTER INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_initial_status();

-- Source: 20260309041858_e46fdf8a-3c4b-449c-a44d-c751d46d6ab4.sql
-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any order (for reconciliation)
CREATE POLICY "Admins can update any order"
ON public.orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Source: 20260316_add_missing_payment_columns.sql
-- Migration: Add missing columns to orders table
-- This fix addresses the "Could not find the 'payment_method' column of 'orders' in the schema cache" error.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_ref TEXT,
ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS shipping_info JSONB;

-- Reload the PostgREST schema cache to ensure Edge Functions and API see the new columns immediately.
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_architectural_hardening.sql
-- Migration: Architectural Hardening & Refinement
-- 1. Price Spoofing Protection in create_order
-- 2. Automated Escrow Release on Shipment Delivery
-- 3. Location Normalization (Removing legacy Enum usage)
-- 4. Shipment Data Integrity (Enforcing Enum)

-- ============================================================
-- 1. HARDEN create_order RPC
-- ============================================================
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
    -- Preliminary: Get the first seller for the order table (legacy column)
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- Initial insert with provided total (will be updated or validated)
    INSERT INTO public.orders (
        buyer_id, seller_id, status, payment_status, total, 
        shipping_address, items, city_id, zone_id
    )
    VALUES (
        auth.uid(), v_first_seller_id, 'pending', 'paid', p_total, 
        p_shipping_address, p_items, p_city_id, p_zone_id
    )
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

        -- Inventory management
        UPDATE public.products SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id AND inventory >= v_item.quantity;

        IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory for product ID %', v_item.product_id; END IF;
    END LOOP;

    -- Update order total with calculated value if it differs (hardening against price spoofing)
    UPDATE public.orders SET total = v_calculated_total WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'final_total', v_calculated_total);
END;
$$;

-- ============================================================
-- 2. AUTOMATED ESCROW RELEASE
-- ============================================================
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

-- ============================================================
-- 3. LOCATION NORMALIZATION (Drop legacy Enum columns)
-- ============================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS zone;
ALTER TABLE public.seller_verifications DROP COLUMN IF EXISTS zone;
ALTER TABLE public.orders DROP COLUMN IF EXISTS zone;

-- ============================================================
-- 4. SHIPMENT DATA INTEGRITY
-- ============================================================
-- IMPORTANT: Alter column type BEFORE creating the trigger to avoid dependency errors
ALTER TABLE public.shipments 
ALTER COLUMN status TYPE public.shipment_status USING status::public.shipment_status;

-- ============================================================
-- 2. AUTOMATED ESCROW RELEASE (Trigger Creation)
-- ============================================================
DROP TRIGGER IF EXISTS tr_release_escrow_on_delivery ON public.shipments;
CREATE TRIGGER tr_release_escrow_on_delivery
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_shipment_delivery_settlement();

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_ensure_orders_rls.sql
-- Migration: Ensure Order Update RLS Policies
-- 20260316_ensure_orders_rls.sql
-- Restores missing UPDATE policies to allow sellers to accept orders and buyers to manage them.

-- 1. Enable RLS (just in case)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Sellers: Can update status to confirm, process, or broadcast
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;
CREATE POLICY "Sellers can update order status" 
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 3. Buyers: Can update status to completed (via confirmed receipt) or cancel if pending
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status::TEXT = 'completed') OR -- Allowed via complete_order RPC or direct update
        (status::TEXT = 'cancelled' AND (SELECT status FROM public.orders WHERE id = orders.id)::TEXT = 'pending')
    )
);

-- 4. Admins: Full control
DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
ON public.orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 5. SHIPMENTS: Ensure sellers can also update shipments related to their orders
DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
CREATE POLICY "Sellers can update related shipments"
ON public.shipments FOR UPDATE
USING (
    seller_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.orders WHERE id = shipments.order_id AND seller_id = auth.uid())
);

-- Housekeeping: Reload PostgREST
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_expand_acceptance_statuses.sql
-- Migration: Expand Acceptance Statuses
-- 20260316_expand_acceptance_statuses.sql
-- Allows buyers to "Accept" orders that are in any active transit state.

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
    -- Expanded to allow transition from 'delivered', 'shipped', 'out_for_delivery', 'picked_up'
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status::TEXT IN ('delivered', 'shipped', 'out_for_delivery', 'picked_up')
    FOR UPDATE;  -- Row lock to prevent race conditions

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found, not yours, or not in an acceptable transit state (shipped/delivered)'
        );
    END IF;

    -- Order total = product price as listed by seller
    v_order_total := COALESCE(NULLIF(v_order.total, 0), 0);
    -- Platform takes 10% (tracked for accounting, NOT deducted from seller)
    v_platform_fee := ROUND(v_order_total * 0.10, 2);

    -- 2. Mark order as completed
    UPDATE public.orders
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. If total is zero, complete but skip earnings (edge case for test orders)
    IF v_order_total = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'warning', 'Order completed but total was zero — no earnings credited',
            'seller_credited', 0,
            'rider_credited', 0
        );
    END IF;

    -- 4. Credit seller wallet
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

    -- 5. Credit rider wallet — flat ₦1,500 per delivery
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
        SET status = 'delivered', delivery_fee = v_rider_flat_fee, updated_at = NOW()
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

-- Source: 20260316_fix_products_rls.sql
-- Fix Product RLS Violation (v3 - Direct Query for maximum reliability)
-- Relax the insert policy to allow any user with the 'seller' role to list products.
-- This version uses a direct EXISTS check on user_roles to avoid dependency on custom functions.

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

-- Ensure other policies remains robust
DROP POLICY IF EXISTS "Seller update product" ON public.products;
CREATE POLICY "Seller update product" ON public.products 
FOR UPDATE USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Seller delete product" ON public.products;
CREATE POLICY "Seller delete product" ON public.products 
FOR DELETE USING (auth.uid() = seller_id);

-- Source: 20260316_fix_rls_recursion.sql
-- Migration: Master RLS Recursion Fix
-- 20260316_fix_rls_recursion.sql
-- Resolves circular dependencies between orders and shipments RLS policies.

-- 1. FIX SHIPMENTS POLICIES
-- Break the dependency on the 'orders' table to prevent circular lookup
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" 
ON public.shipments FOR SELECT
USING (auth.uid() = rider_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
DROP POLICY IF EXISTS "Sellers can update shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can update shipments" 
ON public.shipments FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 2. FIX ORDERS POLICIES
-- A. Sellers: Can update status (no change needed but re-applying for consistency)
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;
CREATE POLICY "Sellers can update order status" 
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- B. Buyers: Safe cancellation and completion (NO subqueries)
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status::TEXT = 'completed') OR 
        (status::TEXT = 'cancelled')
    )
);

-- C. Logistics: Safe because shipments policy no longer calls orders
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
CREATE POLICY "Logistics can update order status" 
ON public.orders FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.shipments 
        WHERE shipments.order_id = orders.id 
        AND shipments.rider_id = auth.uid()
    )
);

-- 3. ENSURE ORDER ITEMS ACCESSIBILITY
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view their order items" ON public.order_items;
CREATE POLICY "Sellers can view their order items"
ON public.order_items FOR SELECT
USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can view their order items" ON public.order_items;
CREATE POLICY "Buyers can view their order items"
ON public.order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND buyer_id = auth.uid()));

-- Housekeeping
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_reconcile_shipments_schema.sql
-- Migration: Reconcile Shipments Schema
-- Adds missing columns required by the frontend and architectural refinements.

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS rider_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS rider_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Ensure tracking_code is TEXT if it wasn't already (usually is, but for safety)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='tracking_code') THEN
        ALTER TABLE public.shipments ADD COLUMN tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12);
    END IF;
END $$;

-- Convert address columns if they are still JSONB (from old migrations)
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='shipments' AND column_name='pickup_address') = 'jsonb' 
    THEN
        ALTER TABLE public.shipments ALTER COLUMN pickup_address TYPE TEXT USING pickup_address::TEXT;
    END IF;

    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='shipments' AND column_name='delivery_address') = 'jsonb' 
    THEN
        ALTER TABLE public.shipments ALTER COLUMN delivery_address TYPE TEXT USING delivery_address::TEXT;
    END IF;
END $$;

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_recovery_and_missing_tables.sql
-- 20260316_recovery_and_missing_tables.sql
-- 1. Create missing Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create PROMOTER_CODES table
CREATE TABLE IF NOT EXISTS public.promoter_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. Create ISSUES table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority public.issue_priority DEFAULT 'medium',
    status public.issue_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.promoter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Promoter Codes
DROP POLICY IF EXISTS "Anyone can view codes" ON public.promoter_codes;
CREATE POLICY "Anyone can view codes" ON public.promoter_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own codes" ON public.promoter_codes;
CREATE POLICY "Users can manage own codes" ON public.promoter_codes FOR ALL USING (auth.uid() = user_id);

-- Issues
DROP POLICY IF EXISTS "Users can view own reported issues" ON public.issues;
CREATE POLICY "Users can view own reported issues" ON public.issues FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Sellers can view issues against them" ON public.issues;
CREATE POLICY "Sellers can view issues against them" ON public.issues FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_restore_analytics_rpc.sql
-- Restore missing get_seller_analytics RPC
-- This function provides revenue and order stats for the seller dashboard.

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

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO service_role;

-- Source: 20260316_unified_reconciliation.sql
-- Migration: Final Unified Schema Reconciliation
-- Consolidates all missing columns across Categories, Shipments, and Wallets.

-- 1. CATEGORIES: Add icon support
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;

-- Update existing categories with icons
UPDATE public.categories SET icon = 'Laptop' WHERE name = 'Electronics';
UPDATE public.categories SET icon = 'Shirt' WHERE name = 'Fashion';
UPDATE public.categories SET icon = 'Home' WHERE name = 'Home & Kitchen';
UPDATE public.categories SET icon = 'Sparkles' WHERE name = 'Health & Beauty';
UPDATE public.categories SET icon = 'Heart' WHERE name = 'Sports';
UPDATE public.categories SET icon = 'ShoppingBag' WHERE name = 'Toys';
UPDATE public.categories SET icon = 'Settings' WHERE name = 'Automotive';
UPDATE public.categories SET icon = 'Apple' WHERE name = 'Grocery';
UPDATE public.categories SET icon = 'MapPin' WHERE name = 'Services';
UPDATE public.categories SET icon = 'Grid' WHERE name = 'Other';

-- 2. SHIPMENTS: Coordindates and Tracking
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS rider_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS rider_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS buyer_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Ensure tracking_code exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='tracking_code') THEN
        ALTER TABLE public.shipments ADD COLUMN tracking_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12);
    END IF;
END $$;

-- 3. WALLETS: Escrow Support
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4. HOUSEKEEPING: Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';

-- Source: 20260316_unified_status_sync.sql
-- Migration: Unified Status State Machine (REFINED)
-- 20260316_unified_status_sync.sql
-- Synchronizes orders and shipments tables to work "hand in hand".

-- 1. Helper to sync Shipment status back to Order
CREATE OR REPLACE FUNCTION public.sync_shipment_to_order_status()
RETURNS TRIGGER AS $$
DECLARE
    v_new_order_status public.order_status;
BEGIN
    -- Map shipment status to order status
    v_new_order_status := CASE 
        WHEN NEW.status::TEXT = 'broadcast' THEN 'awaiting_agent'::public.order_status
        WHEN NEW.status::TEXT = 'accepted' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'out_for_pickup' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'arrived_at_seller' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'picked_up' THEN 'picked_up'::public.order_status
        WHEN NEW.status::TEXT = 'out_for_delivery' THEN 'out_for_delivery'::public.order_status
        WHEN NEW.status::TEXT = 'arrived_at_destination' THEN 'out_for_delivery'::public.order_status
        WHEN NEW.status::TEXT = 'delivered' THEN 'delivered'::public.order_status
        WHEN NEW.status::TEXT = 'cancelled' THEN 'cancelled'::public.order_status
        WHEN NEW.status::TEXT = 'failed' THEN 'cancelled'::public.order_status
        ELSE NULL
    END;

    IF v_new_order_status IS NOT NULL THEN
        UPDATE public.orders
        SET status = v_new_order_status,
            updated_at = NOW()
        WHERE id = NEW.order_id
        AND status::TEXT != v_new_order_status::TEXT;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper to sync Order status to Shipment (and handle auto-creation)
CREATE OR REPLACE FUNCTION public.sync_order_to_shipment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_shipment_id UUID;
BEGIN
    -- A. AUTO-CREATION: When order is accepted (confirmed) or broadcast (awaiting_agent)
    IF NEW.status::TEXT IN ('confirmed', 'awaiting_agent') AND OLD.status::TEXT = 'pending' THEN
        -- Check if shipment already exists
        SELECT id INTO v_shipment_id FROM public.shipments WHERE order_id = NEW.id;
        
        IF v_shipment_id IS NULL THEN
            INSERT INTO public.shipments (
                order_id,
                seller_id,
                status,
                tracking_code,
                delivery_address,
                zone_id,
                city_id,
                pickup_address -- Placeholder or derived if available
            ) VALUES (
                NEW.id,
                NEW.seller_id,
                CASE WHEN NEW.status::TEXT = 'awaiting_agent' THEN 'broadcast'::public.shipment_status ELSE 'assigned'::public.shipment_status END,
                'LK-' || UPPER(substring(md5(random()::text) from 1 for 8)),
                NEW.shipping_address::TEXT,
                NEW.zone_id,
                NEW.city_id,
                'Seller Shop' -- Default placeholder
            ) RETURNING id INTO v_shipment_id;
            
            -- Automatically link all order items to this shipment
            UPDATE public.order_items
            SET shipment_id = v_shipment_id
            WHERE order_id = NEW.id AND shipment_id IS NULL;
        END IF;
    END IF;

    -- B. SYNC: If order moves to awaiting_agent, ensure shipment is broadcast
    IF NEW.status::TEXT = 'awaiting_agent' AND OLD.status::TEXT != 'awaiting_agent' THEN
        UPDATE public.shipments
        SET status = 'broadcast', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'broadcast';
    END IF;

    -- C. FINALIZATION: If buyer completes order, mark shipment as delivered
    IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT != 'completed' THEN
        UPDATE public.shipments
        SET status = 'delivered', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'delivered';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECREATE TRIGGERS
DROP TRIGGER IF EXISTS tr_sync_shipment_to_order ON public.shipments;
CREATE TRIGGER tr_sync_shipment_to_order
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipment_to_order_status();

DROP TRIGGER IF EXISTS tr_sync_order_to_shipment ON public.orders;
CREATE TRIGGER tr_sync_order_to_shipment
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_to_shipment_status();

-- 4. HOUSEKEEPING: Reload schema
NOTIFY pgrst, 'reload schema';

-- Source: 20260317_add_new_zones.sql
-- migration: 20260317_add_new_zones.sql
-- This migration adds new delivery zones to both the legacy enum and the modern table.

-- 1. Update Legacy Enum
-- Note: PostgreSQL requires this to be run outside of a transaction if adding multiple values to an enum.
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Gwarinpa';
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Wuse';
ALTER TYPE public.abuja_zone ADD VALUE IF NOT EXISTS 'Apo';

-- 2. Update Modern delivery_zones Table
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    -- Ensure Abuja exists in the cities table
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    
    -- Insert the new zone(s)
    INSERT INTO public.delivery_zones (city_id, name, delivery_fee)
    VALUES 
    (v_city_id, 'Gwarinpa', 1500),
    (v_city_id, 'Wuse', 1500),
    (v_city_id, 'Apo', 1500)
    ON CONFLICT (city_id, name) DO NOTHING;
END $$;

-- Source: 20260317_role_management.sql
-- Migration: 20260317_role_management.sql
-- Description: Enforces Seller vs Promoter exclusivity and provides role management utilities.

-- 1. Trigger function to enforce exclusivity
CREATE OR REPLACE FUNCTION public.check_role_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
    -- If adding 'seller', check if 'promoter' already exists
    IF NEW.role = 'seller' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.user_id AND role = 'promoter'
        ) THEN
            RAISE EXCEPTION 'User cannot be both a seller and a promoter.';
        END IF;
    END IF;

    -- If adding 'promoter', check if 'seller' already exists
    IF NEW.role = 'promoter' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.user_id AND role = 'seller'
        ) THEN
            RAISE EXCEPTION 'User cannot be both a seller and a promoter.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_ensure_role_exclusivity ON public.user_roles;
CREATE TRIGGER trg_ensure_role_exclusivity
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.check_role_exclusivity();

-- 3. RPC for role management
-- This allows setting multiple roles at once securely.
CREATE OR REPLACE FUNCTION public.manage_user_roles(
    p_user_id UUID,
    p_roles TEXT[]
)
RETURNS VOID AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Delete existing roles
    DELETE FROM public.user_roles WHERE user_id = p_user_id;

    -- Insert new roles
    -- The trigger will automatically validate the Seller/Promoter exclusivity
    FOREACH v_role IN ARRAY p_roles
    LOOP
        INSERT INTO public.user_roles (user_id, role)
        VALUES (p_user_id, v_role::public.app_role);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20260318_add_missing_kyc_columns.sql
-- Migration: 20260318_add_missing_kyc_columns.sql
-- Description: Add missing 'zone' and 'updated_at' columns to logistics_kyc table to fix submission error.

ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS zone TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update existing rows to have an updated_at value equal to created_at
UPDATE public.logistics_kyc 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.logistics_kyc;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.logistics_kyc
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Source: 20260318_admin_kyc_access.sql
-- Migration: 20260318_admin_kyc_access.sql
-- Goal: Enable Admin management for Logistics KYC

-- 1. Add review tracking columns to logistics_kyc
ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- 1.1 Ensure explicit foreign key to profiles for PostgREST joins
ALTER TABLE public.logistics_kyc 
DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_profiles_fkey,
ADD CONSTRAINT logistics_kyc_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add RLS policies for Admins on logistics_kyc
-- Admin view policy
DO $$ BEGIN
    CREATE POLICY "Admins can view all logistics kyc" ON public.logistics_kyc
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Admin update policy
DO $$ BEGIN
    CREATE POLICY "Admins can update logistics kyc" ON public.logistics_kyc
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create RPC for verifying logistics KYC
CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(
    p_verification_id UUID,
    p_review_status TEXT -- 'verified' or 'rejected'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Validate admin status
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can verify KYC');
    END IF;

    -- Get user_id from verification
    SELECT user_id INTO v_user_id
    FROM public.logistics_kyc
    WHERE id = p_verification_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'KYC submission not found');
    END IF;

    -- Update KYC status and tracking
    UPDATE public.logistics_kyc
    SET 
        status = p_review_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_verification_id;

    -- If approved, ensure the user has the 'logistics' role
    IF p_review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'logistics')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'status', p_review_status
    );
END;
$$;

COMMENT ON FUNCTION public.verify_logistics_kyc IS 'Allows admins to approve or reject logistics rider KYC and atomically grant the logistics role.';

-- Source: 20260318_expand_logistics_kyc.sql
-- Migration: 20260318_expand_logistics_kyc.sql
-- Description: Add NIN number and ID card photo columns to logistics_kyc

ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS nin_number TEXT,
ADD COLUMN IF NOT EXISTS id_card_photo_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.logistics_kyc.nin_number IS 'National Identification Number (NIN) of the rider';
COMMENT ON COLUMN public.logistics_kyc.id_card_photo_url IS 'Storage path for the uploaded ID card (NIN or Voter''s Card)';

-- Source: 20260321_financial_engine_overhaul.sql
-- 1. DROP DEPENDENT POLICIES & TRIGGERS
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update order status" ON public.orders;
DROP TRIGGER IF EXISTS tr_sync_order_to_shipment ON public.orders;

-- 2. UPDATE SYNC FUNCTIONS TO BE ENUM-INDEPENDENT
CREATE OR REPLACE FUNCTION public.sync_shipment_to_order_status()
RETURNS TRIGGER AS $$
DECLARE
    v_new_order_status TEXT;
BEGIN
    v_new_order_status := CASE 
        WHEN NEW.status::TEXT = 'broadcast' THEN 'awaiting_agent'
        WHEN NEW.status::TEXT = 'accepted' THEN 'accepted'
        WHEN NEW.status::TEXT = 'out_for_pickup' THEN 'accepted'
        WHEN NEW.status::TEXT = 'arrived_at_seller' THEN 'accepted'
        WHEN NEW.status::TEXT = 'picked_up' THEN 'picked_up'
        WHEN NEW.status::TEXT = 'out_for_delivery' THEN 'out_for_delivery'
        WHEN NEW.status::TEXT = 'arrived_at_destination' THEN 'out_for_delivery'
        WHEN NEW.status::TEXT = 'delivered' THEN 'delivered'
        WHEN NEW.status::TEXT = 'cancelled' THEN 'cancelled'
        WHEN NEW.status::TEXT = 'failed' THEN 'cancelled'
        ELSE NULL
    END;

    IF v_new_order_status IS NOT NULL THEN
        UPDATE public.orders
        SET status = v_new_order_status,
            updated_at = NOW()
        WHERE id = NEW.order_id
        AND status != v_new_order_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_order_to_shipment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_shipment_id UUID;
BEGIN
    IF NEW.status IN ('confirmed', 'awaiting_agent') AND OLD.status = 'pending' THEN
        SELECT id INTO v_shipment_id FROM public.shipments WHERE order_id = NEW.id;
        IF v_shipment_id IS NULL THEN
            INSERT INTO public.shipments (
                order_id,
                seller_id,
                status,
                tracking_code,
                delivery_address,
                zone_id,
                city_id,
                pickup_address
            ) VALUES (
                NEW.id,
                NEW.seller_id,
                CASE WHEN NEW.status = 'awaiting_agent' THEN 'broadcast'::public.shipment_status ELSE 'assigned'::public.shipment_status END,
                'LK-' || UPPER(substring(md5(random()::text) from 1 for 8)),
                NEW.shipping_address::TEXT,
                NEW.zone_id,
                NEW.city_id,
                'Seller Shop'
            ) RETURNING id INTO v_shipment_id;
            
            UPDATE public.order_items
            SET shipment_id = v_shipment_id
            WHERE order_id = NEW.id AND shipment_id IS NULL;
        END IF;
    END IF;

    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        UPDATE public.shipments
        SET status = 'broadcast', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'broadcast';
    END IF;

    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.shipments
        SET status = 'delivered', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'delivered';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CONVERT ENUMS TO TEXT FOR FLEXIBILITY & FIX CONFLICTS
ALTER TABLE public.orders ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE public.orders ALTER COLUMN payment_status TYPE TEXT USING payment_status::TEXT;

-- 4. MIGRATE LEGACY DATA BEFORE APPLYING CONSTRAINTS
UPDATE public.orders SET status = 'awaiting_agent' WHERE status = 'processing';
UPDATE public.orders SET status = 'in_transit' WHERE status = 'shipped';

-- 5. RECREATE TRIGGERS & POLICIES
CREATE TRIGGER tr_sync_order_to_shipment
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_to_shipment_status();

CREATE POLICY "Sellers can update order status" 
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status = 'completed') OR 
        (status = 'cancelled' AND (SELECT status FROM public.orders WHERE id = orders.id) = 'pending')
    )
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN (
    'pending', 
    'confirmed',
    'processing',
    'awaiting_agent', 
    'picked_up',
    'shipped',
    'in_transit', 
    'out_for_delivery',
    'delivered',
    'completed', 
    'cancelled', 
    'refunded', 
    'disputed'
));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN (
    'pending',
    'paid',
    'failed',
    'refunded',
    'disputed'
));

-- 2. DYNAMIC FEE ENGINE
CREATE TABLE IF NOT EXISTS public.fee_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    fee_type TEXT NOT NULL CHECK (fee_type IN ('platform', 'rider', 'promoter')),
    rate NUMERIC NOT NULL DEFAULT 0, -- e.g. 0.05 for 5%
    flat_fee NUMERIC NOT NULL DEFAULT 0,
    min_amount NUMERIC DEFAULT 0,
    priority INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.fee_config (name, fee_type, rate, flat_fee) VALUES
('Default Platform Fee', 'platform', 0.02, 0),
('Default Rider Fee', 'rider', 0.05, 0),
('Default Promoter Fee', 'promoter', 0.05, 0)
ON CONFLICT DO NOTHING;

-- 4. PLATFORM REVENUE MODEL
CREATE TABLE IF NOT EXISTS public.platform_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'NGN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.platform_wallets ADD COLUMN IF NOT EXISTS name TEXT;

-- Ensure singleton platform wallet
INSERT INTO public.platform_wallets (id, balance) 
VALUES ('00000000-0000-0000-0000-000000000000', 0)
ON CONFLICT DO NOTHING;

-- 4. DISPUTE SYSTEM
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    initiator_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_url TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    resolution_meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ORDER EXTENSIONS
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS settlement_due_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'none' CHECK (settlement_status IN ('none', 'pending', 'settled', 'failed')),
ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;

-- 6. WALLET TRANSACTION AUDITABILITY
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 7. DISTANCE CALCULATION HELPER
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 NUMERIC, lon1 NUMERIC, 
    lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    dist NUMERIC := 0;
    rad_lat1 NUMERIC; rad_lat2 NUMERIC;
    delta_lat NUMERIC; delta_lon NUMERIC;
    a NUMERIC; c NUMERIC;
    R NUMERIC := 6371; -- Earth radius in KM
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 0;
    END IF;

    rad_lat1 := radians(lat1);
    rad_lat2 := radians(lat2);
    delta_lat := radians(lat2 - lat1);
    delta_lon := radians(lon2 - lon1);

    a := sin(delta_lat/2)^2 + cos(rad_lat1) * cos(rad_lat2) * sin(delta_lon/2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    dist := R * c;

    RETURN ROUND(dist, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. DYNAMIC FEE CALCULATION
CREATE OR REPLACE FUNCTION public.calculate_order_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total NUMERIC;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
BEGIN
    SELECT total INTO v_total FROM public.orders WHERE id = p_order_id;
    
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE ORDER BY priority DESC) 
    LOOP
        v_fees := v_fees || jsonb_build_object(
            v_rec.fee_type, 
            ROUND((v_total * v_rec.rate) + v_rec.flat_fee, 2)
        );
    END LOOP;
    
    RETURN v_fees;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. FRAUD-PROOF PROMOTER ATTRIBUTION (Extend existing table)
ALTER TABLE public.referrals 
ADD COLUMN IF NOT EXISTS visitor_id TEXT,
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Seed visitor_id for old records if null
UPDATE public.referrals SET visitor_id = 'unknown' WHERE visitor_id IS NULL;
ALTER TABLE public.referrals ALTER COLUMN visitor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_visitor_id ON public.referrals(visitor_id);
-- 11. PROFILE LOCATION SUPPORT
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);


-- 11. REFACTORED REVENUE SETTLEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
BEGIN
    -- STEP 1: Capture Geometry & Initial Fees on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- Validate Promoter Attribution (Last-Click Wins within window)
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals 
                WHERE promoter_id = NEW.promoter_id 
                AND (product_id = (SELECT (items->0->>'product_id')::UUID FROM public.orders WHERE id = NEW.id) OR product_id IS NULL)
                AND created_at >= v_attribution_threshold
                AND expires_at > NOW()
            ) THEN
                NEW.promoter_id := NULL; -- Invalidate fraudulent/expired attribution
            END IF;
        END IF;

        -- Find seller wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id LIMIT 1;
        
        -- Hold seller funds in escrow (Order total - estimated rider/platform fees)
        UPDATE public.wallets 
        SET escrow_balance = escrow_balance + (NEW.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
        WHERE id = v_seller_wallet_id;
    END IF;

    -- STEP 2: Initiate Delayed Settlement on Stage transition to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';
    END IF;

    -- STEP 3: Handle Disputes
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none'; -- Halt settlement
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for revenue settlement logic
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
CREATE TRIGGER trg_revenue_settlement
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- 12. WALLET BALANCE INTEGRITY (Strictly Additive)
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.wallets
    SET balance = balance + NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.wallet_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

-- 13. FULL DELAYED SETTLEMENT RUNNER
CREATE OR REPLACE FUNCTION public.run_settlements()
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_rider_id UUID;
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND settlement_due_at <= NOW()
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            v_fees := public.calculate_order_fees(v_order.id);
            
            -- 1. Deduct from Seller Escrow
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
            WHERE id = v_seller_wallet_id;

            -- 2. Credit Seller Balance
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_seller_wallet_id, (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC - (v_fees->>'promoter')::NUMERIC), 
                    'settlement', 'Settlement: Order #' || v_order.id);

            -- 3. Credit Platform
            UPDATE public.platform_wallets SET balance = balance + (v_fees->>'platform')::NUMERIC WHERE id = v_platform_wallet_id;

            -- 4. Credit Promoter
            IF v_order.promoter_id IS NOT NULL THEN
                SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = v_order.promoter_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (v_promoter_wallet_id, (v_fees->>'promoter')::NUMERIC, 'commission', 'Commission: Order #' || v_order.id);
            END IF;

            -- 5. Credit Rider
            SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = v_order.id LIMIT 1;
            IF v_rider_id IS NOT NULL THEN
                SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (v_rider_wallet_id, (v_fees->>'rider')::NUMERIC, 'delivery_fee', 'Delivery: Order #' || v_order.id);
            END IF;

            UPDATE public.orders SET settlement_status = 'settled' WHERE id = v_order.id;
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 14. COMPREHENSIVE REFUND ENGINE
CREATE OR REPLACE FUNCTION public.process_refund(p_order_id UUID, p_reason TEXT DEFAULT 'Customer requested')
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_seller_wallet_id UUID;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    
    IF v_order.status = 'refunded' THEN RETURN TRUE; END IF;
    
    -- Only allow if not yet settled or manually by admin
    IF v_order.settlement_status = 'settled' THEN
        -- Complex reversal required if already settled
        -- For MVP, we assume refunds happen before 48h settlement
        RAISE EXCEPTION 'Cannot refund settled order via automated flow';
    END IF;

    -- Reverse Escrow
    SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
    v_fees := public.calculate_order_fees(v_order.id);
    
    UPDATE public.wallets 
    SET escrow_balance = escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders 
    SET status = 'refunded', settlement_status = 'none' 
    WHERE id = p_order_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. SEED DEFAULT FEE CONFIGURATIONS
INSERT INTO public.fee_config (fee_type, name, rate, flat_fee, priority, is_active)
VALUES 
    ('platform', 'Standard Platform Fee', 0.02, 0, 1, true),
    ('rider', 'Standard Rider Fee (Base + KM)', 200, 500, 1, true),
    ('promoter', 'Standard Promoter Commission', 0.05, 0, 1, true)
ON CONFLICT DO NOTHING;

-- 13. SEED PLATFORM WALLET
INSERT INTO public.platform_wallets (id, name, balance)
VALUES ('00000000-0000-0000-0000-000000000000', 'Main Platform Revenue', 0)
ON CONFLICT DO NOTHING;

-- Source: 20260321_promoter_settlement.sql
-- Migration: 20260321_promoter_settlement.sql
-- Automates promoter commission payouts when an order is completed.

CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_promoter_commission NUMERIC := 0;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- ── CASE 1: Order CONFIRMED (accepted) → Lock funds into escrow ──
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

        -- Increase escrow balance
        UPDATE public.wallets
        SET escrow_balance = escrow_balance + (v_order_total - v_delivery_fee),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, (v_order_total - v_delivery_fee), 'escrow_hold',
                'Escrow hold for Order #' || LEFT(NEW.id::TEXT, 8));

    END IF;

    -- ── CASE 2: Order COMPLETED (buyer confirms) → Release escrow to seller + rider + promoter ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        
        -- Check for promoter commission
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT amount INTO v_promoter_commission
            FROM public.commissions
            WHERE order_id = NEW.id AND promoter_id = NEW.promoter_id
            LIMIT 1;
            
            v_promoter_commission := COALESCE(v_promoter_commission, 0);
        END IF;

        v_seller_payout := v_order_total - v_delivery_fee - v_promoter_commission;

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
        -- Note: We subtract the full (order_total - delivery_fee) from escrow because that's what we put in.
        -- But the seller only keeps v_seller_payout.
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            escrow_balance = GREATEST(0, escrow_balance - (v_order_total - v_delivery_fee)),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
                'Settlement released: Order #' || LEFT(NEW.id::TEXT, 8));

        -- ── Promoter wallet ──
        IF v_promoter_commission > 0 THEN
            SELECT id INTO v_promoter_wallet_id
            FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;

            IF v_promoter_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.promoter_id, 0, 0)
                RETURNING id INTO v_promoter_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_promoter_commission,
                updated_at = NOW()
            WHERE id = v_promoter_wallet_id;

            UPDATE public.commissions
            SET status = 'paid', paid_at = NOW()
            WHERE order_id = NEW.id AND promoter_id = NEW.promoter_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_promoter_wallet_id, v_promoter_commission, 'commission',
                    'Promoter commission: Order #' || LEFT(NEW.id::TEXT, 8));

            INSERT INTO public.notifications (user_id, type, message)
            VALUES (NEW.promoter_id, 'payment',
                    '₦' || TO_CHAR(v_promoter_commission, 'FM999,999,999') ||
                    ' commission earned! Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

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

            UPDATE public.shipments
            SET delivery_fee = v_delivery_fee
            WHERE order_id = NEW.id AND rider_id = v_rider_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                    'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20260322_add_zone_coordinates.sql
-- MIGRATION: 20260322_add_zone_coordinates.sql
-- Add latitude and longitude to delivery_zones for automatic proximity matching.

ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Seed coordinates for initial Abuja zones
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    
    IF v_city_id IS NOT NULL THEN
        UPDATE public.delivery_zones SET latitude = 9.0967, longitude = 7.3732 WHERE city_id = v_city_id AND name = 'Zone 1 (Gwarinpa & Life Camp)';
        UPDATE public.delivery_zones SET latitude = 9.0600, longitude = 7.4700 WHERE city_id = v_city_id AND name = 'Zone 2 (Wuse & Utako)';
        UPDATE public.delivery_zones SET latitude = 9.1550, longitude = 7.3330 WHERE city_id = v_city_id AND name = 'Zone 3 (Kubwa Central)';
        UPDATE public.delivery_zones SET latitude = 8.9800, longitude = 7.3800 WHERE city_id = v_city_id AND name = 'Zone 4 (Lugbe & Apo)';
        UPDATE public.delivery_zones SET latitude = 8.9400, longitude = 7.0800 WHERE city_id = v_city_id AND name = 'Zone 5 (Gwagwalada Districts)';
    END IF;
END $$;

-- Source: 20260322_comprehensive_architecture_hardening.sql
-- COMPREHENSIVE MIGRATION: 20260322_comprehensive_architecture_hardening
-- Consolidated migration for schema fixes, RLS hardening, and role-unification.
-- Target Tables: messages, orders, shipments, wallets.

-- ==========================================
-- 1. ENUM UPDATES
-- ==========================================
-- NOTE: If running in a script that wraps this in a transaction, the following may fail.
-- Run this line separately if your environment does not allow ALTER TYPE ADD VALUE in transactions.
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'broadcast' BEFORE 'assigned';

-- ==========================================
-- 2. SCHEMA CHANGES (COLUMNS)
-- ==========================================
DO $$ 
BEGIN
    -- Messages: Rename text to content
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'text') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
        ALTER TABLE public.messages RENAME COLUMN "text" TO "content";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
        ALTER TABLE public.messages ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
    END IF;

    -- Orders: Add broadcast columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'broadcast_zone') THEN
        ALTER TABLE public.orders ADD COLUMN broadcast_zone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'city_id') THEN
        ALTER TABLE public.orders ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;

    -- Shipments: Add broadcast columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'pickup_time') THEN
        ALTER TABLE public.shipments ADD COLUMN pickup_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone') THEN
        ALTER TABLE public.shipments ADD COLUMN zone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone_id') THEN
        ALTER TABLE public.shipments ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'city_id') THEN
        ALTER TABLE public.shipments ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;

    -- Shipments: Ensure seller_id exists for RLS hardening
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'seller_id') THEN
        ALTER TABLE public.shipments ADD COLUMN seller_id UUID REFERENCES public.profiles(id);
        UPDATE public.shipments s SET seller_id = o.seller_id FROM public.orders o WHERE s.order_id = o.id AND s.seller_id IS NULL;
    END IF;
END $$;

-- ==========================================
-- 3. RLS - WALLETS (UNIFICATION)
-- ==========================================
DROP POLICY IF EXISTS "Sellers can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Sellers can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR auth.uid() = seller_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- ==========================================
-- 4. RLS - SHIPMENTS (RECURSION FIX)
-- ==========================================
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments FOR SELECT
USING (auth.uid() = rider_id OR auth.uid() = seller_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Sellers can update shipments" ON public.shipments;
CREATE POLICY "Sellers can update shipments" ON public.shipments FOR UPDATE
USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

-- ==========================================
-- 5. RLS - ORDERS (RECURSION FIX)
-- ==========================================
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id AND (status = 'completed' OR status = 'cancelled'));

DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders" ON public.orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ==========================================
-- 6. FINAL REFRESH
-- ==========================================
NOTIFY pgrst, 'reload schema';

-- Source: 20260322_ensure_order_broadcast_columns.sql
-- MIGRATION: 20260322_ensure_order_broadcast_columns
-- Ensures the orders table has the necessary columns for broadcasting.

DO $$ 
BEGIN
    -- 1. broadcast_zone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'broadcast_zone'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN broadcast_zone TEXT;
    END IF;

    -- 2. city_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'city_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;

    -- 3. zone_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'zone_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;
END $$;

-- Source: 20260322_ensure_shipment_broadcast_columns.sql
-- MIGRATION: 20260322_ensure_shipment_broadcast_columns
-- Ensures the shipments table has the necessary columns for broadcasting.

DO $$ 
BEGIN
    -- 1. pickup_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'pickup_time') THEN
        ALTER TABLE public.shipments ADD COLUMN pickup_time TIMESTAMPTZ;
    END IF;

    -- 2. zone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone') THEN
        ALTER TABLE public.shipments ADD COLUMN zone TEXT;
    END IF;

    -- 3. zone_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'zone_id') THEN
        ALTER TABLE public.shipments ADD COLUMN zone_id UUID REFERENCES public.delivery_zones(id);
    END IF;

    -- 4. city_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'city_id') THEN
        ALTER TABLE public.shipments ADD COLUMN city_id UUID REFERENCES public.cities(id);
    END IF;
END $$;

-- Source: 20260322_fix_rls_recursion_final.sql
-- MIGRATION: 20260322_fix_rls_recursion_final
-- Breaks the circular dependency between orders and shipments RLS policies.

-- 1. Ensure seller_id exists on shipments for direct RLS checks
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'seller_id'
    ) THEN
        ALTER TABLE public.shipments ADD COLUMN seller_id UUID REFERENCES public.profiles(id);
        
        -- Populate missing seller_id from orders
        UPDATE public.shipments s
        SET seller_id = o.seller_id
        FROM public.orders o
        WHERE s.order_id = o.id
        AND s.seller_id IS NULL;
    END IF;
END $$;

-- 2. SHIPMENTS: Simplify policies (Rider or Seller direct check)
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" 
ON public.shipments FOR SELECT
USING (
    auth.uid() = rider_id 
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Sellers can update related shipments" ON public.shipments;
DROP POLICY IF EXISTS "Sellers can update shipments" ON public.shipments;
CREATE POLICY "Sellers can update shipments" 
ON public.shipments FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 3. ORDERS: Fix recursion in buyer update policy
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        status = 'completed' OR 
        status = 'cancelled'
        -- Note: We trust the internal state machine/RPCs or direct WHERE checks 
        -- for the "only from pending" rule to avoid recursive SELECT.
    )
);

-- 4. ORDERS: Ensure riders don't need direct RLS update (handled by trigger)
-- But they still need to SELECT orders if the UI requires it.
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
-- No new UPDATE policy for logistics; they update shipments, and triggers sync to orders.

-- 5. ORDERS: Safe SELECT policies
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
ON public.orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Housekeeping
NOTIFY pgrst, 'reload schema';

-- Source: 20260322_fix_shipment_status_enum.sql
-- NOTE: Run this command OUTSIDE of any transaction block in the Supabase SQL Editor.
-- PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction block or DO block.

-- 1. Check if 'broadcast' exists first (manually or via metadata check)
-- 2. Run this command:
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'broadcast' BEFORE 'assigned';

-- Source: 20260322_fix_wallets_rls_unification.sql
-- Migration: Unify Wallets RLS
-- This migration ensures that all users (riders, promoters, sellers) can access their own wallets
-- by checking both user_id and seller_id columns.

-- 1. DROP OLD RESTRICTIVE POLICIES
DROP POLICY IF EXISTS "Sellers can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Sellers can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallet" ON public.wallets;

-- 2. CREATE NEW UNIFIED POLICIES
-- Allow users to see their own wallet
CREATE POLICY "Users can view own wallet"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- Allow users to create their own wallet (ensures existence on first access)
CREATE POLICY "Users can insert own wallet"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);

-- Allow users to update their own wallet metadata (though balance is managed by triggers)
CREATE POLICY "Users can update own wallet"
ON public.wallets FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';

-- Source: 20260322_get_nearby_products.sql
-- MIGRATION: 20260322_get_nearby_products.sql
-- RPC to fetch products sorted by distance from a given point.

CREATE OR REPLACE FUNCTION public.get_nearby_products(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  images TEXT[],
  category TEXT,
  inventory INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  likes_count BIGINT,
  city_name TEXT,
  zone_name TEXT,
  distance_meters DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.seller_id,
    p.title,
    p.description,
    p.price,
    p.images,
    p.category,
    p.inventory,
    p.latitude,
    p.longitude,
    (SELECT COUNT(*) FROM public.likes l WHERE l.product_id = p.id) as likes_count,
    c.name as city_name,
    z.name as zone_name,
    (
      6371000 * acos(
        cos(radians(p_latitude)) * cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * sin(radians(p.latitude))
      )
    ) AS distance_meters
  FROM 
    public.products p
  LEFT JOIN 
    public.cities c ON p.city_id = c.id
  LEFT JOIN 
    public.delivery_zones z ON p.zone_id = z.id
  WHERE 
    p.inventory > 0
    AND (p_category IS NULL OR p_category = 'All Products' OR p.category = p_category)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (
      p_search IS NULL OR 
      p.title ILIKE '%' || p_search || '%' OR 
      p.description ILIKE '%' || p_search || '%'
    )
    AND p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
  ORDER BY 
    distance_meters ASC
  LIMIT p_limit 
  OFFSET p_offset;
END;
$$;

-- Source: 20260322_rename_message_text_to_content.sql
-- MIGRATION: 20260322_rename_message_text_to_content
-- Renames the 'text' column to 'content' in the 'messages' table to match frontend expectations.

DO $$ 
BEGIN
    -- Check if 'text' column exists and 'content' column does not
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'text'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.messages RENAME COLUMN "text" TO "content";
    END IF;

    -- If 'content' doesn't exist at all (rare but possible), add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Source: 20260323_add_logistics_notifs_column.sql
-- ADD NOTIFICATION SETTINGS TO LOGISTICS DETAILS
-- This column will store user-specific toggle states for various alerts.

ALTER TABLE public.logistics_details
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "new_order": true,
    "order_delivered": true,
    "issue_reported": true,
    "promoter_earnings": true
}'::JSONB;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260323_create_vehicle_types.sql
-- Create vehicle_types table
CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read labels
CREATE POLICY "Allow all authenticated users to read vehicle_types"
ON public.vehicle_types
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage
-- (Assuming there is a way to check for admin role, similar to existing policies)
CREATE POLICY "Allow admins to manage vehicle_types"
ON public.vehicle_types
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Seed defaults
INSERT INTO public.vehicle_types (name)
VALUES 
    ('Bicycle'),
    ('Motorcycle'),
    ('Car/Sedan'),
    ('Van/Mini-bus'),
    ('Truck/Delivery Van')
ON CONFLICT (name) DO NOTHING;

-- Source: 20260323_fix_kyc_tracking.sql
-- Migration: 20260323_fix_kyc_tracking.sql
-- Description: Fix logistics_kyc foreign key and add missing RLS update policies

-- 1. Temporarily drop the NOT NULL constraint to allow data fixing
-- This handles cases where data might already be inconsistent or become temporarily null during mapping.
ALTER TABLE public.logistics_kyc ALTER COLUMN user_id DROP NOT NULL;

-- 2. Unify user_id in logistics_kyc to use auth ID (auth.uid())
-- Map any profile-ID-based user_ids back to their associated auth UUID.
UPDATE public.logistics_kyc l
SET user_id = p.user_id
FROM public.profiles p
WHERE l.user_id = p.id;

-- 3. Delete any orphaned or invalid records
-- This ensures that when we re-enable NOT NULL and the Foreign Key, the data is valid.
DELETE FROM public.logistics_kyc 
WHERE user_id IS NULL 
   OR user_id NOT IN (SELECT id FROM auth.users);

-- 4. Re-enable NOT NULL constraint
ALTER TABLE public.logistics_kyc ALTER COLUMN user_id SET NOT NULL;

-- 5. Correct the Foreign Key to reference auth.users(id)
-- We use separate DO blocks to ensure each drop is handled gracefully.
DO $$ BEGIN
    ALTER TABLE public.logistics_kyc DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_profiles_fkey;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.logistics_kyc DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_auth_fkey;
EXCEPTION
    WHEN others THEN null;
END $$;

ALTER TABLE public.logistics_kyc 
ADD CONSTRAINT logistics_kyc_user_id_auth_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. RLS Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can update own kyc" ON public.logistics_kyc
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can view own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can view own kyc" ON public.logistics_kyc
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can insert own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can insert own kyc" ON public.logistics_kyc
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Profiles unique constraint and update policy
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND contype = 'u' 
        AND conkey @> array[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id')]
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
    END IF;
    
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON CONSTRAINT logistics_kyc_user_id_auth_fkey ON public.logistics_kyc IS 'Ensure logistics KYC records correctly reference the auth users table.';

-- Source: 20260323_fix_user_roles_fk.sql
-- FIX RELATIONSHIP BETWEEN PROFILES AND USER_ROLES
-- This migration ensures PostgREST can perform joins (embeddings) between these tables.

-- 1. Ensure the foreign key exists and points to profiles(id)
-- We use profiles(id) because profiles.id is typically synchronized with auth.users.id
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Add an index for performance if not exists
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260323_harden_shipment_visibility.sql
-- MIGRATION: 20260323_harden_shipment_visibility.sql
-- Hardens mission visibility by making RLS policies more resilient to string mismatches.

-- 1. Ensure the RLS policy for shipments handles both zone_id (robust) and zone (legacy/fallback).
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;

CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
    -- Case A: Agent sees their own assigned shipments
    rider_id = auth.uid()
    OR
    -- Case B: Agent sees unassigned/broadcast orders in their zone
    (
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND lk.status = 'verified'
            AND (
                -- Robust Match: Zone IDs match
                (p.zone_id IS NOT NULL AND shipments.zone_id IS NOT NULL AND p.zone_id = shipments.zone_id)
                OR
                -- Fallback Match: Zone Names match (case-insensitive and trimmed)
                (TRIM(LOWER(p.zone)) = TRIM(LOWER(shipments.zone)))
            )
        )
    )
    OR
    -- Case C: Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. Update the UPDATE policy to match the SELECT policy logic for claiming
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
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND lk.status = 'verified'
            AND (
                (p.zone_id IS NOT NULL AND shipments.zone_id IS NOT NULL AND p.zone_id = shipments.zone_id)
                OR
                (TRIM(LOWER(p.zone)) = TRIM(LOWER(shipments.zone)))
            )
        )
    )
);

-- 3. Add performance indexes for zone-based lookups
CREATE INDEX IF NOT EXISTS idx_shipments_zone_id ON public.shipments(zone_id);
CREATE INDEX IF NOT EXISTS idx_profiles_zone_id ON public.profiles(zone_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260323_logistics_details_final_fix.sql
-- FINAL FIX FOR LOGISTICS DETAILS SCHEMA
-- This ensures the table and all required columns exist for the settings page.

-- 1. Create table if missing
CREATE TABLE IF NOT EXISTS public.logistics_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Add missing columns
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "new_order": true,
  "order_delivered": true,
  "issue_reported": true,
  "promoter_earnings": true
}'::JSONB;
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- 3. Enable RLS
ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Users can manage own logistics details" ON public.logistics_details;
CREATE POLICY "Users can manage own logistics details" ON public.logistics_details
FOR ALL USING (auth.uid() = user_id);

-- 5. RELOAD SCHEMA CACHE (Crucial for PostgREST to see new columns)
NOTIFY pgrst, 'reload schema';

-- Source: 20260323_logistics_rls_hardening.sql
-- RLS HARDENING FOR LOGISTICS METADATA
-- Target Tables: cities, delivery_zones, vehicle_types

-- 1. CITIES
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view cities" ON public.cities;
CREATE POLICY "Allow all users to view cities" 
ON public.cities FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to cities" ON public.cities;
CREATE POLICY "Admins have full access to cities" 
ON public.cities FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- 2. DELIVERY ZONES
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view delivery_zones" ON public.delivery_zones;
CREATE POLICY "Allow all users to view delivery_zones" 
ON public.delivery_zones FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to delivery_zones" ON public.delivery_zones;
CREATE POLICY "Admins have full access to delivery_zones" 
ON public.delivery_zones FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- 3. VEHICLE TYPES (Ensure robustness)
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view vehicle_types" ON public.vehicle_types;
CREATE POLICY "Allow all users to view vehicle_types" 
ON public.vehicle_types FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admins have full access to vehicle_types" 
ON public.vehicle_types FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- Source: 20260324_fix_issues_relationship.sql
-- Migration to fix relationship between issues and profiles
-- This allows joining issues on user_id to profiles to get display_name

ALTER TABLE public.issues
ADD CONSTRAINT issues_reporter_profile_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';

-- Source: 20260324_payout_system_complete.sql
-- Payout Request System Migration (Unified for Sellers & Logistics)

-- 1. System Settings for Global Config
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('withdrawal_fee', '{"amount": 500, "type": "flat"}'::JSONB, 'Flat fee deducted from each withdrawal request'),
    ('payout_interval_days', '7'::JSONB, 'Minimum number of days between payout requests')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- RLS for System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings" 
ON public.system_settings FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Unified Payout Requests Table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    fee_amount NUMERIC NOT NULL DEFAULT 0,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handle renaming if it already existed with seller_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_requests' AND column_name = 'seller_id') THEN
        ALTER TABLE public.payout_requests RENAME COLUMN seller_id TO user_id;
    END IF;
END $$;

-- RLS Policies
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view own payout requests" 
ON public.payout_requests FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sellers can create own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can create own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create own payout requests" 
ON public.payout_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can manage all payout requests" 
ON public.payout_requests FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. Wallet Integration Logic (Fixed to prevent double deduction)
CREATE OR REPLACE FUNCTION public.handle_payout_request()
RETURNS TRIGGER AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_last_request_date TIMESTAMP;
    v_interval_days INTEGER;
BEGIN
    -- Get wallet balance
    SELECT balance INTO v_wallet_balance FROM public.wallets WHERE id = NEW.wallet_id FOR UPDATE;
    
    -- Check if balance is sufficient (amount + fee)
    IF v_wallet_balance < (NEW.amount + NEW.fee_amount) THEN
        RAISE EXCEPTION 'Insufficient balance for payout (including fee)';
    END IF;

    -- Check payout interval
    SELECT (value->>0)::INTEGER INTO v_interval_days FROM public.system_settings WHERE key = 'payout_interval_days';
    
    SELECT MAX(created_at) INTO v_last_request_date 
    FROM public.payout_requests 
    WHERE user_id = NEW.user_id AND status != 'rejected';

    IF v_last_request_date IS NOT NULL AND (NOW() - v_last_request_date) < (v_interval_days || ' days')::INTERVAL THEN
        RAISE EXCEPTION 'Payout interval not met. You can only request payouts every % days.', v_interval_days;
    END IF;

    -- Create wallet transaction for the deduction (Auto-syncs balance via trg_sync_wallet_balance)
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
    VALUES (
        NEW.wallet_id, 
        -(NEW.amount + NEW.fee_amount), 
        'withdrawal', 
        'Payout Request: ' || NEW.id,
        'pending'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_payout_request ON public.payout_requests;
CREATE TRIGGER tr_handle_payout_request
BEFORE INSERT ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_payout_request();

-- 4. Payout Rejection (Refund) Logic (Fixed to prevent double credit)
CREATE OR REPLACE FUNCTION public.handle_payout_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If rejected, create refund transaction (Auto-syncs balance)
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
        VALUES (
            NEW.wallet_id, 
            (NEW.amount + NEW.fee_amount), 
            'refund', 
            'Refund: Rejected Payout ' || NEW.id,
            'success'
        );
        
        -- Update the original withdrawal transaction to failed
        UPDATE public.wallet_transactions 
        SET status = 'failed' 
        WHERE reference = 'Payout Request: ' || NEW.id;
    END IF;

    -- If completed, mark transaction as success
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.wallet_transactions 
        SET status = 'success' 
        WHERE reference = 'Payout Request: ' || NEW.id;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_payout_update ON public.payout_requests;
CREATE TRIGGER tr_handle_payout_update
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_payout_update();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- Source: 20260324_update_settlement_metadata.sql
-- Update run_settlements to include order_id in metadata for easier UI reconciliation
CREATE OR REPLACE FUNCTION public.run_settlements()
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_rider_id UUID;
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND settlement_due_at <= NOW()
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            v_fees := public.calculate_order_fees(v_order.id);
            
            -- 1. Deduct from Seller Escrow
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
            WHERE id = v_seller_wallet_id;

            -- 2. Credit Seller Balance (WITH METADATA)
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
            VALUES (
                v_seller_wallet_id, 
                (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC - (v_fees->>'promoter')::NUMERIC), 
                'settlement', 
                'Settlement: Order #' || v_order.id,
                jsonb_build_object('order_id', v_order.id)
            );

            -- 3. Credit Platform
            UPDATE public.platform_wallets SET balance = balance + (v_fees->>'platform')::NUMERIC WHERE id = v_platform_wallet_id;

            -- 4. Credit Promoter (WITH METADATA)
            IF v_order.promoter_id IS NOT NULL THEN
                SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = v_order.promoter_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
                VALUES (
                    v_promoter_wallet_id, 
                    (v_fees->>'promoter')::NUMERIC, 
                    'commission', 
                    'Commission: Order #' || v_order.id,
                    jsonb_build_object('order_id', v_order.id)
                );
            END IF;

            -- 5. Credit Rider (WITH METADATA)
            SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = v_order.id LIMIT 1;
            IF v_rider_id IS NOT NULL THEN
                SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
                VALUES (
                    v_rider_wallet_id, 
                    (v_fees->>'rider')::NUMERIC, 
                    'delivery_fee', 
                    'Delivery: Order #' || v_order.id,
                    jsonb_build_object('order_id', v_order.id)
                );
            END IF;

            UPDATE public.orders SET settlement_status = 'settled' WHERE id = v_order.id;
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Source: 20260325_instant_pending_settlement.sql
-- 1. Refactor sync_wallet_balance trigger to only affect balance on 'success'
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only affect balance if status is 'success'
    -- If INSERTED as success, add to balance
    IF (TG_OP = 'INSERT' AND NEW.status = 'success') THEN
        UPDATE public.wallets
        SET balance = balance + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    -- If UPDATED from pending to success, add to balance
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'success') THEN
        UPDATE public.wallets
        SET balance = balance + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    -- If UPDATED from success to failed (e.g. payout failure), subtract from balance
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'success' AND NEW.status = 'failed') THEN
        UPDATE public.wallets
        SET balance = balance - OLD.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update handle_revenue_settlement to insert PENDING transactions immediately on Completion
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
    v_hold_reason TEXT := '48-hour security hold for dispute resolution';
BEGIN
    -- STEP 1: Capture Geometry & Initial Fees on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- Validate Promoter Attribution
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals 
                WHERE promoter_id = NEW.promoter_id 
                AND (product_id = (SELECT (items->0->>'product_id')::UUID FROM public.orders WHERE id = NEW.id) OR product_id IS NULL)
                AND created_at >= v_attribution_threshold
                AND expires_at > NOW()
            ) THEN
                NEW.promoter_id := NULL;
            END IF;
        END IF;

        -- Find seller wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id LIMIT 1;
        
        -- Initial escrow capture
        IF v_seller_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + (NEW.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
            WHERE id = v_seller_wallet_id;
        END IF;
    END IF;

    -- STEP 2: Initiate PENDING Transactions on Completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        -- Calculations
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- 1. Seller Pending Tx
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC - (v_fees->>'promoter')::NUMERIC), 
                'settlement', 
                'Settlement: Order #' || NEW.id,
                'pending',
                jsonb_build_object(
                    'order_id', NEW.id,
                    'reason', v_hold_reason,
                    'hold_until', NEW.settlement_due_at
                )
            );
        END IF;

        -- 2. Promoter Pending Tx & Commission Sync
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id;
            IF v_promoter_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_promoter_wallet_id, 
                    (v_fees->>'promoter')::NUMERIC, 
                    'commission', 
                    'Commission: Order #' || NEW.id,
                    'pending',
                    jsonb_build_object(
                        'order_id', NEW.id,
                        'reason', v_hold_reason,
                        'hold_until', NEW.settlement_due_at
                    )
                );
            END IF;

            -- Always keep commissions table in sync for the dashboard
            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE SET status = 'pending', amount = EXCLUDED.amount;
        END IF;

        -- 3. Rider Pending Tx
        SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = NEW.id LIMIT 1;
        IF v_rider_id IS NOT NULL THEN
            SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
            IF v_rider_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_rider_wallet_id, 
                    (v_fees->>'rider')::NUMERIC, 
                    'delivery_fee', 
                    'Delivery: Order #' || NEW.id,
                    'pending',
                    jsonb_build_object(
                        'order_id', NEW.id,
                        'reason', v_hold_reason,
                        'hold_until', NEW.settlement_due_at
                    )
                );
            END IF;
        END IF;
    END IF;

    -- STEP 3: Handle Disputes
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none';
        -- Optional: cancel pending transactions here
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update run_settlements to finalize pending transactions & commissions
CREATE OR REPLACE FUNCTION public.run_settlements()
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND settlement_due_at <= NOW()
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            v_fees := public.calculate_order_fees(v_order.id);
            
            -- Deduct from Seller Escrow
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
            IF v_seller_wallet_id IS NOT NULL THEN
                UPDATE public.wallets 
                SET escrow_balance = GREATEST(0, escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC))
                WHERE id = v_seller_wallet_id;
            END IF;

            -- Finalize Wallet Transactions
            UPDATE public.wallet_transactions
            SET status = 'success',
                updated_at = NOW()
            WHERE (metadata->>'order_id' = v_order.id::TEXT)
            AND status = 'pending';

            -- Finalize Commissions
            UPDATE public.commissions 
            SET status = 'paid', 
                paid_at = NOW()
            WHERE order_id = v_order.id;

            -- Credit Platform
            UPDATE public.platform_wallets 
            SET balance = balance + (v_fees->>'platform')::NUMERIC 
            WHERE id = v_platform_wallet_id;

            -- Mark settled
            UPDATE public.orders SET settlement_status = 'settled' WHERE id = v_order.id;
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement finalization failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Source: 20260326_product_ratings.sql
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

-- Source: 20260326_sync_ratings.sql
-- Synchronize existing products with their reviews
UPDATE public.products p
SET 
  avg_rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 1) 
    FROM public.product_reviews 
    WHERE product_id = p.id
  ), 0),
  reviews_count = (
    SELECT COUNT(*) 
    FROM public.product_reviews 
    WHERE product_id = p.id
  );

-- Source: 20260327_conflict_free_sync.sql
-- UNIVERSAL IDENTITY SYNC: CONFLICT-FREE EDITION
-- This migration fixes the "Duplicate Key" error by using a safer synchronization strategy.

-- 1. Sync all EXISTING profiles first
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 2. Insert MISSING profiles safely
-- We use a simpler INSERT that generates a new ID if needed, or preserves user_id.
-- We use the WHERE NOT EXISTS check on user_id to ensure NO duplicates are attempted.
INSERT INTO public.profiles (user_id, display_name, email)
SELECT 
    u.id, 
    COALESCE(u.raw_user_meta_data->>'display_name', 'LinkUp Member'), 
    LOWER(u.email)
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
);

-- 3. Restore Public Visibility
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 4. Refresh API Cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260327_definitive_identity_repair.sql
-- DEFINITIVE IDENTITY RECOVERY: Case-Insensitive Alignment & Public Visibility
-- This migration ensures that the identity check is foolproof and visible to all.

-- 1. Ensure Schema Visibility
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Explicit Column Privileges (Just in case table-level is blocked)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 3. Definitive Case-Insensitive Backfill
-- We lowercase everything globally to ensure the .toLowerCase() check in React matches.
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 4. Target the specific user ibrahimabdulosama@gmail.com
-- This ensures that even if the trigger failed previously, the profile is now active and visible.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT u.id, u.id, COALESCE(u.raw_user_meta_data->>'display_name', 'User'), LOWER(u.email)
FROM auth.users u
WHERE LOWER(u.email) = 'ibrahimabdulosama@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- 5. Public Discovery Policy (Re-Verified)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 6. Reload the API Cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260327_final_identity_repair.sql
-- FINAL REPAIR: Global Identification & Visibility Update
-- Ensures that guest users can definitively search profiles by email.

-- 1. Explicit Privileges (Sometime policies aren't enough if GRANTS are missing)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 2. Explicit SELECT policy for guest users (Definitive)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 3. ENSURE EMAIL COLUMN IS CASE-OPTIMIZED (Case-Insensitive Search)
-- We'll use a CASE-SENSITIVE column backfill to ibrahimabdulosama@gmail.com
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id;

-- 4. EMERGENCY IDENTITY OVERWRITE: Explicitly force creation of this specific user
-- This is a one-time targeted fix for the reported email
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT u.id, u.id, COALESCE(u.raw_user_meta_data->>'display_name', 'User'), LOWER(u.email)
FROM auth.users u
WHERE LOWER(u.email) = 'ibrahimabdulosama@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- 5. Force Schema Reload
NOTIFY pgrst, 'reload schema';

-- Source: 20260327_final_visibility_fix.sql
-- FINAL FIX: Public Profile Visibility & Email Recovery
-- This migration ensures that guest users can check for a profile by email 
-- during the "Forgot Password" flow.

-- 1. Ensure public visibility for profiles (SELECT only)
-- Drop existing select policies to avoid ambiguity
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create the definitive visibility policy
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- 2. Ensure RLS is enabled but the policy allows the check
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. CASE-INSENSITIVE BACKFILL: Align ibrahimabdulosama@gmail.com and all others
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. EMERGENCY IDENTITY SYNC: Create profile if STILL missing
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    id, 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', email), 
    LOWER(email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';

-- Source: 20260327_global_identity_repair.sql
-- REPAIR: IDENTITY SYNCHRONIZATION & PROFILE RECOVERY
-- This migration fixes missing profiles and ensures consistent email/id storage.

-- 1. Redefine handle_new_user to be definitively robust and case-insensitive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We set both ID and user_id to ensure maximum compatibility with existing FKs
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    LOWER(NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert or update default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Critically important: Auth triggers MUST succeed for the account to be fully functional.
  -- We return NEW but the DB will log the error if we don't catch it properly.
  RETURN NEW;
END;
$$;

-- 2. RECOVERY: Backfill any users who signed up during the "500 Error" period
-- This creates a profile entry for any Auth user that is missing one.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    id, 
    id, 
    COALESCE(raw_user_meta_data->>'display_name', email), 
    LOWER(email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 3. ALIGNMENT: Sync emails for all existing profiles (Defensive)
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. ENSURE USER ROLES: Backfill roles for any missing (Defensive)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'buyer'::public.app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT DO NOTHING;

-- Source: 20260327_identity_alignment_fix.sql
-- DEFINITIVE FIX: Profile and User Roles Identity Alignment
-- This migration ensures profiles and user_roles are correctly linked using the Auth ID.

-- 1. Robust handle_new_user function
-- We explicitly set profiles.id to NEW.id to ensure children (like user_roles) 
-- can correctly reference it via foreign keys.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile, setting ID (PK) explicitly to Auth ID for relational consistency
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, -- Primary Key = Auth ID
    NEW.id, -- User Reference = Auth ID
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role into user_roles
  -- Since user_roles.user_id references profiles.id, and we just ensured profiles.id = NEW.id,
  -- this insertion will now succeed against the foreign key constraint.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error if needed, but in Supabase Auth Triggers, failure blocks the user creation
  RAISE EXCEPTION 'Identity sync failed: %', SQLERRM;
END;
$$;

-- 2. Re-apply trigger to be certain
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Cleanup existing mismatches if any (Defensive)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Source: 20260327_manage_user_roles_fix.sql
-- FIX: manage_user_roles FK Violation
-- This migration restores the correct foreign key for user_roles to ensure 
-- that the Auth ID (user_id) can be used consistently across the app.

-- 1. Redefine user_roles.user_id FK to point to auth.users(id) instead of profiles(id)
-- This ensures that p_user_id sent via RPC always matches the Auth ID.
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. Update handle_new_user to be slightly more robust (Defensive)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update profile. We keep id synchronized with NEW.id for consistency.
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role into user_roles
  -- Now uses the NEW.id pointing to auth.users, which we just ensured is the FK target.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Signup identity sync failed: %', SQLERRM;
END;
$$;

-- Source: 20260327_profile_email_sync.sql
-- Migration to add email to profiles and handle registration checks
-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update existing profiles with emails from auth.users
-- This requires a JOIN with auth.users which public schema can do if permitted, 
-- or we can use a loop/update. Note: In Supabase, public can read auth.users if granted, 
-- but usually it's cleaner to sync on creation.
DO $$ 
BEGIN 
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.user_id = u.id AND p.email IS NULL;
END $$;

-- 3. Update handle_new_user trigger to sync email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

-- 4. Ensure everyone can SELECT profiles (already exists, but just in case)
-- This allows checking if an email exists before sending reset link.
-- IMPORTANT: We should add an index for performance.
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Source: 20260327_profile_email_sync_repair.sql
-- COMPREHENSIVE REPAIR: Profile Email Sync & Trigger Fix
-- This migration ensures the signup flow is robust and correctly syncs emails.

-- 1. Ensure email column exists (Defensive check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Index for performance on searches
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. Robust handle_new_user function
-- Uses ON CONFLICT to prevent 500 errors if a profile accidentally exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile or update if it exists (robust against race conditions)
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but return NEW to try and allow the user creation in auth.users
  -- though ideally we want the trigger to succeed.
  -- In Supabase, if this fails, the whole signup fails.
  -- RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Recreate trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill any missing emails
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Source: 20260327_universal_identity_sync.sql
-- UNIVERSAL IDENTITY ALIGNMENT: Full Account Synchronizer
-- This migration fixes the "Email Not Recognized" issue for ALL users once and for all.

-- 1. Sync All Schemas & Permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- 2. UNIVERSAL BACKFILL: Fix EVERY missing profile
-- This ensures that EVERY user in auth.users has a matching profile record.
INSERT INTO public.profiles (id, user_id, display_name, email)
SELECT 
    u.id, 
    u.id, 
    COALESCE(u.raw_user_meta_data->>'display_name', 'User'), 
    LOWER(u.email)
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO UPDATE SET 
    id = EXCLUDED.id,
    email = EXCLUDED.email;

-- 3. CASE-INSENSITIVE EMAIL SYNC: Correct ALL existing emails
-- This ensures the .eq("email", email.toLowerCase()) check works for EVERYONE.
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email != LOWER(u.email));

-- 4. PERMANENT TRIGGER FIX: Ensure this never happens again
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    LOWER(NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = NOW();
  
  -- Ensure default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 5. Final API Refresh
NOTIFY pgrst, 'reload schema';

COMMIT;
