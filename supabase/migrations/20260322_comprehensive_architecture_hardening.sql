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
