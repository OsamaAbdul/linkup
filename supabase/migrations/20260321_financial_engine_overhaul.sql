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
