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
