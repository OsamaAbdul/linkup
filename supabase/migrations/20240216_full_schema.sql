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
