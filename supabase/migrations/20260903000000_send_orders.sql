-- ========================================================================
-- LINKUP SEND (SEND_ORDER) SCHEMA & REALTIME SPECIFICATION
-- ========================================================================

-- 1. Order Status Enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'send_order_status') THEN
        CREATE TYPE public.send_order_status AS ENUM (
            'pending_payment',
            'finding_rider',
            'assigned_rider',
            'pickup',
            'on_the_way',
            'delivered',
            'cancelled'
        );
    END IF;
END $$;

-- 2. Saved Addresses Table for Send Feature
CREATE TABLE IF NOT EXISTS public.send_saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL, -- e.g. "Home", "Office", "Victoria Island Branch"
    type VARCHAR(20) DEFAULT 'both', -- 'pickup', 'dropoff', 'both'
    contact_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    directions TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on saved addresses
ALTER TABLE public.send_saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own send saved addresses" ON public.send_saved_addresses;
CREATE POLICY "Users can manage their own send saved addresses"
    ON public.send_saved_addresses
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Send Orders Table
CREATE TABLE IF NOT EXISTS public.send_orders (
    id VARCHAR(30) PRIMARY KEY, -- Format: LSEND-XXXXXX-XXXX
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.send_order_status DEFAULT 'pending_payment',
    
    -- Sender / Pickup details
    sender_name VARCHAR(150) NOT NULL,
    sender_phone VARCHAR(30) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_lat NUMERIC(10, 8),
    pickup_lng NUMERIC(11, 8),
    pickup_directions TEXT,
    
    -- Drop-off details
    dropoff_recipient_name VARCHAR(150) NOT NULL,
    dropoff_recipient_phone VARCHAR(30) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat NUMERIC(10, 8),
    dropoff_lng NUMERIC(11, 8),
    dropoff_directions TEXT,
    
    -- Package specification
    package_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- JSON structure:
    -- {
    --   "weight_kg": 2.5,
    --   "dimensions": { "length": 20, "width": 15, "height": 10 },
    --   "contents": "Documents & Gadgets",
    --   "is_fragile": true,
    --   "declared_value": 50000
    -- }
    
    -- Rider Assignment
    rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rider_name VARCHAR(150),
    rider_phone VARCHAR(30),
    rider_avatar TEXT,
    rider_vehicle VARCHAR(100),
    rider_lat NUMERIC(10, 8),
    rider_lng NUMERIC(11, 8),
    
    -- Pricing & Payment
    delivery_fee NUMERIC NOT NULL DEFAULT 1500,
    currency VARCHAR(5) DEFAULT 'NGN',
    payment_status VARCHAR(30) DEFAULT 'pending',
    payment_ref VARCHAR(150) UNIQUE,
    paid_at TIMESTAMPTZ,
    
    -- Timestamps & Estimates
    estimated_delivery_time TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on send_orders
ALTER TABLE public.send_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_orders REPLICA IDENTITY FULL;

-- Public SELECT so any sender, recipient, or guest with tracking ID receives realtime events
DROP POLICY IF EXISTS "Users can view their own send orders" ON public.send_orders;
DROP POLICY IF EXISTS "Public can view send orders" ON public.send_orders;
CREATE POLICY "Public can view send orders"
    ON public.send_orders
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Users can create their own send orders" ON public.send_orders;
CREATE POLICY "Users can create their own send orders"
    ON public.send_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their pending send orders" ON public.send_orders;
CREATE POLICY "Users can update their pending send orders"
    ON public.send_orders
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Logistics agents & admins can read and update orders
DROP POLICY IF EXISTS "Logistics agents and admins can view and update orders" ON public.send_orders;
CREATE POLICY "Logistics agents and admins can view and update orders"
    ON public.send_orders
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'logistics')
        )
    );

-- 4. Send Order Tracking Logs / History
CREATE TABLE IF NOT EXISTS public.send_order_tracking_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(30) REFERENCES public.send_orders(id) ON DELETE CASCADE,
    status public.send_order_status NOT NULL,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.send_order_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_order_tracking_logs REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can view tracking logs of their send orders" ON public.send_order_tracking_logs;
DROP POLICY IF EXISTS "Public can view send order tracking logs" ON public.send_order_tracking_logs;
CREATE POLICY "Public can view send order tracking logs"
    ON public.send_order_tracking_logs
    FOR SELECT
    TO public
    USING (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_send_orders_user_id ON public.send_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_send_orders_status ON public.send_orders(status);
CREATE INDEX IF NOT EXISTS idx_send_orders_payment_ref ON public.send_orders(payment_ref);
CREATE INDEX IF NOT EXISTS idx_send_saved_addresses_user_id ON public.send_saved_addresses(user_id);

-- Enable Realtime publication for send_orders & tracking logs
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.send_orders;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.send_order_tracking_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 4B. Status Change Trigger & Delivery Email/Notification + Rider Payout
CREATE OR REPLACE FUNCTION public.handle_send_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rider_rate NUMERIC := 0.80;
    v_rider_min NUMERIC := 1000;
    v_rider_payout NUMERIC := 0;
    v_rider_wallet_id UUID;
BEGIN
    -- Record in tracking logs
    INSERT INTO public.send_order_tracking_logs (order_id, status, latitude, longitude, notes)
    VALUES (
        NEW.id, 
        NEW.status, 
        NEW.rider_lat, 
        NEW.rider_lng, 
        CASE NEW.status
            WHEN 'assigned_rider' THEN 'Rider accepted mission and is assigned'
            WHEN 'pickup' THEN 'Rider arrived at pickup location'
            WHEN 'on_the_way' THEN 'Package picked up and in transit'
            WHEN 'delivered' THEN 'Package successfully delivered'
            WHEN 'cancelled' THEN 'Package delivery cancelled'
            ELSE 'Status updated to ' || NEW.status::text
        END
    );

    -- If status transitioned to delivered
    IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
        IF NEW.delivered_at IS NULL THEN
            NEW.delivered_at := NOW();
        END IF;

        -- 1. Send in-app notification to sender (which also triggers send-email-notification Edge Function)
        IF NEW.user_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, message, read, created_at)
            VALUES (
                NEW.user_id,
                'Package Delivered',
                'Your package with tracking number ' || NEW.id || ' has been successfully delivered to ' || NEW.dropoff_recipient_name || ' at ' || NEW.dropoff_address || ' by ' || COALESCE(NEW.rider_name, 'your dispatch rider') || '.',
                false,
                NOW()
            );
        END IF;

        -- 2. Payout Rider Wallet with configured earnings
        IF NEW.rider_id IS NOT NULL THEN
            SELECT COALESCE(rate, 0.80) INTO v_rider_rate 
            FROM public.fee_config 
            WHERE fee_type = 'send_rider_payout_rate' AND is_active = true;
            IF v_rider_rate IS NULL OR v_rider_rate <= 0 THEN v_rider_rate := 0.80; END IF;

            SELECT COALESCE(flat_fee, 1000) INTO v_rider_min 
            FROM public.fee_config 
            WHERE fee_type = 'send_rider_min_payout' AND is_active = true;
            IF v_rider_min IS NULL THEN v_rider_min := 1000; END IF;

            v_rider_payout := GREATEST(v_rider_min, round(COALESCE(NEW.delivery_fee, 1500) * v_rider_rate));

            -- Find or create rider wallet
            SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id LIMIT 1;
            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
            END IF;

            IF v_rider_wallet_id IS NOT NULL THEN
                UPDATE public.wallets 
                SET balance = balance + v_rider_payout,
                    updated_at = NOW()
                WHERE id = v_rider_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (v_rider_wallet_id, v_rider_payout, 'delivery_payout', 'Delivery earnings for Package ' || NEW.id);

                INSERT INTO public.notifications (user_id, type, message, read, created_at)
                VALUES (
                    NEW.rider_id,
                    'payment',
                    'Delivery payout of ₦' || v_rider_payout || ' credited to your wallet for package ' || NEW.id,
                    false,
                    NOW()
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_order_status_change ON public.send_orders;
CREATE TRIGGER trg_send_order_status_change
    BEFORE UPDATE OF status ON public.send_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_send_order_status_change();

-- 5. RPC Function for Logistics Riders to Claim a Send Order Mission
CREATE OR REPLACE FUNCTION public.claim_send_order_mission(p_order_id VARCHAR, p_rider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
    v_rider record;
BEGIN
    -- 1. Fetch the send order
    SELECT * INTO v_order FROM public.send_orders WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF v_order.rider_id IS NOT NULL AND v_order.status != 'finding_rider' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission already accepted by another rider');
    END IF;

    -- 2. Fetch rider profile details
    SELECT * INTO v_rider FROM public.profiles WHERE id = p_rider_id;

    -- 3. Assign rider & transition status
    UPDATE public.send_orders
    SET rider_id = p_rider_id,
        rider_name = COALESCE(v_rider.display_name, 'Logistics Rider'),
        rider_phone = COALESCE(v_rider.phone, '08000000000'),
        rider_avatar = v_rider.avatar_url,
        rider_vehicle = 'Motorcycle Dispatch',
        rider_lat = v_rider.latitude,
        rider_lng = v_rider.longitude,
        status = 'assigned_rider',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. Record tracking event log
    INSERT INTO public.send_order_tracking_logs (order_id, status, latitude, longitude, notes)
    VALUES (p_order_id, 'assigned_rider', v_rider.latitude, v_rider.longitude, 'Rider accepted mission and is heading to pickup');

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- 6. Seed LinkUp SEND Delivery Fee Configurations
-- Formula: Delivery fee = Base fee + (Distance x Per-km rate) + Package surcharge + Optional service fees
INSERT INTO public.fee_config (fee_type, name, rate, flat_fee, priority, is_active) VALUES
('send_base_fee', 'Send: Base Delivery Fee', 0, 500, 65, true),
('send_per_km_rate', 'Send: Per KM Rate', 0, 100, 64, true),
('send_pkg_small_surcharge', 'Send: Small Package (Under 2kg)', 0, 0, 63, true),
('send_pkg_medium_surcharge', 'Send: Medium Package (2 - 5kg)', 0, 200, 62, true),
('send_pkg_large_surcharge', 'Send: Large Package (5 - 10kg)', 0, 500, 61, true),
('send_pkg_xlarge_surcharge', 'Send: Extra Large Package (10kg+)', 0, 1000, 60, true),
('send_service_fee', 'Send: Service Fee', 0, 200, 59, true),
('send_fragile_surcharge', 'Send: Fragile Handling', 0, 300, 58, true),
('send_rider_payout_rate', 'Send: Rider Earnings Share (%)', 0.80, 0, 57, true),
('send_rider_min_payout', 'Send: Minimum Rider Guaranteed Payout', 0, 1000, 56, true)
ON CONFLICT (fee_type) DO UPDATE SET
  name = EXCLUDED.name,
  rate = COALESCE(NULLIF(EXCLUDED.rate, 0), fee_config.rate, EXCLUDED.rate),
  flat_fee = EXCLUDED.flat_fee,
  priority = EXCLUDED.priority;

-- 7. Secure Backend Calculation Function for LinkUp SEND Packages
-- Strictly executed and verified on backend so frontend values cannot be forged.
CREATE OR REPLACE FUNCTION public.calculate_send_delivery_fee(
    p_pickup_lat NUMERIC,
    p_pickup_lng NUMERIC,
    p_dropoff_lat NUMERIC,
    p_dropoff_lng NUMERIC,
    p_weight_kg NUMERIC DEFAULT 1.0,
    p_is_fragile BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_fee NUMERIC := 500;
    v_per_km_rate NUMERIC := 100;
    v_pkg_surcharge NUMERIC := 0;
    v_service_fee NUMERIC := 200;
    v_fragile_fee NUMERIC := 0;
    v_distance_km NUMERIC := 0;
    v_distance_fee NUMERIC := 0;
    v_total_fee NUMERIC := 0;
    v_rider_rate NUMERIC := 0.80;
    v_rider_min NUMERIC := 1000;
    v_rider_earnings NUMERIC := 0;

    v_rec RECORD;
    v_dlat NUMERIC;
    v_dlon NUMERIC;
    v_lat1 NUMERIC;
    v_lat2 NUMERIC;
    v_a NUMERIC;
    v_c NUMERIC;
BEGIN
    -- 1. Calculate Haversine Distance in Kilometers
    IF p_pickup_lat IS NOT NULL AND p_pickup_lng IS NOT NULL AND p_dropoff_lat IS NOT NULL AND p_dropoff_lng IS NOT NULL THEN
        IF p_pickup_lat = p_dropoff_lat AND p_pickup_lng = p_dropoff_lng THEN
            v_distance_km := 1.0;
        ELSE
            v_lat1 := radians(p_pickup_lat);
            v_lat2 := radians(p_dropoff_lat);
            v_dlat := radians(p_dropoff_lat - p_pickup_lat);
            v_dlon := radians(p_dropoff_lng - p_pickup_lng);
            v_a := sin(v_dlat / 2)^2 + cos(v_lat1) * cos(v_lat2) * sin(v_dlon / 2)^2;
            v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
            v_distance_km := round((6371 * v_c)::numeric, 1);
            IF v_distance_km < 1.0 THEN
                v_distance_km := 1.0;
            END IF;
        END IF;
    ELSE
        v_distance_km := 5.0;
    END IF;

    -- 2. Fetch live fee configurations from public.fee_config (fallback to defaults if inactive)
    FOR v_rec IN 
        SELECT fee_type, flat_fee, is_active 
        FROM public.fee_config 
        WHERE fee_type IN (
            'send_base_fee', 
            'send_per_km_rate', 
            'send_pkg_small_surcharge', 
            'send_pkg_medium_surcharge', 
            'send_pkg_large_surcharge', 
            'send_pkg_xlarge_surcharge', 
            'send_service_fee', 
            'send_fragile_surcharge'
        ) AND is_active = true
    LOOP
        CASE v_rec.fee_type
            WHEN 'send_base_fee' THEN
                v_base_fee := COALESCE(v_rec.flat_fee, 500);
            WHEN 'send_per_km_rate' THEN
                v_per_km_rate := COALESCE(v_rec.flat_fee, 100);
            WHEN 'send_service_fee' THEN
                v_service_fee := COALESCE(v_rec.flat_fee, 200);
            WHEN 'send_fragile_surcharge' THEN
                IF p_is_fragile THEN
                    v_fragile_fee := COALESCE(v_rec.flat_fee, 300);
                END IF;
            ELSE
                -- handled below by weight bracket
        END CASE;
    END LOOP;

    -- 3. Determine Package Surcharge based on weight bracket
    IF p_weight_kg <= 2.0 THEN
        SELECT COALESCE(flat_fee, 0) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_small_surcharge' AND is_active = true;
    ELSIF p_weight_kg <= 5.0 THEN
        SELECT COALESCE(flat_fee, 200) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_medium_surcharge' AND is_active = true;
    ELSIF p_weight_kg <= 10.0 THEN
        SELECT COALESCE(flat_fee, 500) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_large_surcharge' AND is_active = true;
    ELSE
        SELECT COALESCE(flat_fee, 1000) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_xlarge_surcharge' AND is_active = true;
    END IF;

    IF v_pkg_surcharge IS NULL THEN
        IF p_weight_kg <= 2.0 THEN v_pkg_surcharge := 0;
        ELSIF p_weight_kg <= 5.0 THEN v_pkg_surcharge := 200;
        ELSIF p_weight_kg <= 10.0 THEN v_pkg_surcharge := 500;
        ELSE v_pkg_surcharge := 1000;
        END IF;
    END IF;

    -- 4. Calculate Distance Fee
    v_distance_fee := round(v_distance_km * v_per_km_rate);

    -- 5. Total Delivery Fee = Base fee + Distance fee + Package surcharge + Service fee + Fragile fee
    v_total_fee := v_base_fee + v_distance_fee + v_pkg_surcharge + v_service_fee + v_fragile_fee;

    -- 6. Calculate Rider Earnings & Platform Commission
    SELECT COALESCE(rate, 0.80) INTO v_rider_rate 
    FROM public.fee_config 
    WHERE fee_type = 'send_rider_payout_rate' AND is_active = true;
    IF v_rider_rate IS NULL OR v_rider_rate <= 0 THEN v_rider_rate := 0.80; END IF;

    SELECT COALESCE(flat_fee, 1000) INTO v_rider_min 
    FROM public.fee_config 
    WHERE fee_type = 'send_rider_min_payout' AND is_active = true;
    IF v_rider_min IS NULL THEN v_rider_min := 1000; END IF;

    v_rider_earnings := GREATEST(v_rider_min, round(v_total_fee * v_rider_rate));

    RETURN jsonb_build_object(
        'base_fee', v_base_fee,
        'per_km_rate', v_per_km_rate,
        'distance_km', v_distance_km,
        'distance_fee', v_distance_fee,
        'package_surcharge', v_pkg_surcharge,
        'service_fee', v_service_fee,
        'fragile_surcharge', v_fragile_fee,
        'total_fee', v_total_fee,
        'rider_earnings', v_rider_earnings,
        'platform_fee', GREATEST(0, v_total_fee - v_rider_earnings),
        'currency', 'NGN'
    );
END;
$$;
