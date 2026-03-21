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
