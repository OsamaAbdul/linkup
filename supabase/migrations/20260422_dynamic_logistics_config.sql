-- MIGRATION: 20260422_dynamic_logistics_config.sql
-- TARGET: Move hardcoded fees (1500, 300) to Admin Configuration.

BEGIN;

-- 1. Extend fee_config to support the logistical cut
ALTER TABLE public.fee_config DROP CONSTRAINT IF EXISTS fee_config_fee_type_check;
ALTER TABLE public.fee_config ADD CONSTRAINT fee_config_fee_type_check 
CHECK (fee_type IN ('platform', 'rider', 'promoter', 'settlement', 'rider_out_of_zone', 'rider_distance', 'buyer_cross_zone', 'rider_logistical_cut'));

-- Seed the logistical cut (default 300)
INSERT INTO public.fee_config (name, fee_type, rate, flat_fee, priority, is_active)
VALUES ('Rider Logistical Cut', 'rider_logistical_cut', 0, 300, 10, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Redefine Fee Engine (Subtotal-Aware & Dynamic Config)
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(
    p_order_id UUID,
    p_total_amount NUMERIC DEFAULT NULL,
    p_promoter_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_total NUMERIC;
    v_order_promoter_id UUID;
    v_subtotal NUMERIC := 0;
    v_shipment_fees RECORD;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_rider_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_cross_zone_fee NUMERIC := 0;
    v_shipment_count INTEGER := 0;
    v_logistical_cut NUMERIC := 0;
BEGIN
    -- Determine order inputs
    IF p_total_amount IS NOT NULL THEN
        v_order_total := p_total_amount;
        v_order_promoter_id := p_promoter_id;
    ELSE
        SELECT total_amount, promoter_id INTO v_order_total, v_order_promoter_id 
        FROM public.orders WHERE id = p_order_id;
    END IF;

    IF v_order_total IS NULL THEN RETURN NULL; END IF;

    -- CALCULATE SUBTOTAL (The actual price of products)
    SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1)) INTO v_subtotal 
    FROM public.order_items WHERE order_id = p_order_id;
    
    -- Fallback: If no order items (unexpected), subtotal is the whole amount
    IF v_subtotal IS NULL OR v_subtotal = 0 THEN
        v_subtotal := v_order_total; 
    END IF;

    -- Look up shipment data
    SELECT 
        SUM(COALESCE(delivery_fee_amount, 0)) as total_delivery,
        SUM(COALESCE(cross_zone_fee_amount, 0)) as total_cross_zone,
        COUNT(*) as shipment_count
    INTO v_shipment_fees FROM public.shipments WHERE order_id = p_order_id;

    v_rider_fee := COALESCE(v_shipment_fees.total_delivery, 0);
    v_cross_zone_fee := COALESCE(v_shipment_fees.total_cross_zone, 0);
    v_shipment_count := COALESCE(v_shipment_fees.shipment_count, 0);

    -- Fetch Configs
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order_promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'rider_logistical_cut' THEN
            v_logistical_cut := v_rec.flat_fee;
        END IF;
    END LOOP;

    -- Fallback cut if not found in config
    IF v_logistical_cut = 0 THEN v_logistical_cut := 300; END IF;

    -- Adjust for Linkup Last-Mile (if shipments exist)
    IF v_shipment_count > 0 THEN
        v_platform_fee := v_platform_fee + (v_logistical_cut * v_shipment_count);
        v_rider_fee := v_rider_fee - (v_logistical_cut * v_shipment_count);
    END IF;
    
    RETURN jsonb_build_object(
        'subtotal', ROUND(v_subtotal, 2),
        'delivery_pool', ROUND(v_order_total - v_subtotal, 2),
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'cross_zone', ROUND(v_cross_zone_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'rider_total', ROUND(GREATEST(0, v_rider_fee) + v_cross_zone_fee, 2),
        'seller', ROUND(v_subtotal - v_platform_fee - v_promoter_fee, 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Update Shipment Fee Integrity Trigger
CREATE OR REPLACE FUNCTION public.ensure_shipment_fee_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_default_fee NUMERIC;
    v_shipment_subtotal NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_rider_fee NUMERIC := 0;
    v_logistical_cut NUMERIC := 0;
    v_config RECORD;
    v_parent_order RECORD;
BEGIN
    -- STEP A: Preservation Logic
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.delivery_fee_amount <= 0 AND OLD.delivery_fee_amount > 0) THEN
            NEW.delivery_fee_amount := OLD.delivery_fee_amount;
        END IF;
        
        IF (NEW.cross_zone_fee_amount <= 0 AND OLD.cross_zone_fee_amount > 0) THEN
            NEW.cross_zone_fee_amount := OLD.cross_zone_fee_amount;
        END IF;
    END IF;

    -- STEP B: Zone & Metadata Integrity
    IF NEW.broadcast_zone IS NULL AND NEW.zone_id IS NOT NULL THEN
        SELECT name INTO NEW.broadcast_zone FROM public.delivery_zones WHERE id = NEW.zone_id;
    END IF;
    
    -- Ensure bonus_amount is never NULL
    IF NEW.bonus_amount IS NULL THEN
        NEW.bonus_amount := 0;
    END IF;

    -- STEP C/D: Inheritance Logic (High-Fidelity)
    IF (NEW.delivery_fee_amount IS NULL OR NEW.delivery_fee_amount = 0) THEN
        -- Get the order total and the sum of all its items
        SELECT total_amount INTO v_default_fee FROM public.orders WHERE id = NEW.order_id;
        
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal
        FROM public.order_items WHERE order_id = NEW.order_id;
        
        -- The logistics portion is the remainder of the total paid
        NEW.delivery_fee_amount := COALESCE(v_default_fee, 0) - COALESCE(v_shipment_subtotal, 0);
        NEW.cross_zone_fee_amount := 0; 
    END IF;

    -- STEP E: Global Fee Breakdown Calculation
    IF (NEW.fee_breakdown IS NULL OR NEW.fee_breakdown = '{}'::JSONB OR (NEW.fee_breakdown->>'seller' ~ '[A-Za-z]')) THEN
        -- 1. Calculate the sub-total for THIS seller
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal
        FROM public.order_items
        WHERE order_id = NEW.order_id AND seller_id = NEW.seller_id;

        -- 2. Fetch Order basics
        -- Some systems use total, some total_amount. We prioritize total_amount if available.
        SELECT * INTO v_parent_order FROM public.orders WHERE id = NEW.order_id;
        
        -- 3. Calculate Platform Commission & Logistical Cut
        FOR v_config IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
            IF v_config.fee_type = 'platform' THEN
                v_platform_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
            ELSIF v_config.fee_type = 'promoter' AND v_parent_order.promoter_id IS NOT NULL THEN
                v_promoter_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
            ELSIF v_config.fee_type = 'rider_logistical_cut' THEN
                v_logistical_cut := v_config.flat_fee;
            END IF;
        END LOOP;

        IF v_logistical_cut = 0 THEN v_logistical_cut := 300; END IF;

        -- 4. Calculate Net Portions
        -- Seller pays Commission (v_platform_fee)
        -- Rider pays Logistical Cut (v_logistical_cut)
        v_rider_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - v_logistical_cut;

        NEW.fee_breakdown := jsonb_build_object(
            'subtotal', ROUND(COALESCE(v_shipment_subtotal, 0), 2),
            'delivery_paid', ROUND(COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0), 2),
            'platform', ROUND(COALESCE(v_platform_fee, 0) + v_logistical_cut, 2), -- Combined earnings
            'rider', ROUND(GREATEST(0, v_rider_fee), 2),
            'promoter', ROUND(COALESCE(v_promoter_fee, 0), 2),
            'seller', ROUND(COALESCE(v_shipment_subtotal, 0) - v_platform_fee - v_promoter_fee, 2)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the shipment payout trigger to use Dynamic Logistical Cut
CREATE OR REPLACE FUNCTION public.handle_shipment_delivered_payout()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_shipment_fee NUMERIC;
    v_settlement_hours INTEGER;
    v_logistical_cut NUMERIC := 0;
    v_config RECORD;
BEGIN
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        
        -- Fetch Configs
        FOR v_config IN (SELECT fee_type, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
            IF v_config.fee_type = 'settlement' THEN
                v_settlement_hours := v_config.flat_fee;
            ELSIF v_config.fee_type = 'rider_logistical_cut' THEN
                v_logistical_cut := v_config.flat_fee;
            END IF;
        END LOOP;
        
        IF v_settlement_hours IS NULL THEN v_settlement_hours := 48; END IF;
        IF v_logistical_cut = 0 THEN v_logistical_cut := 300; END IF;
        
        v_shipment_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - v_logistical_cut;
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id;
        
        IF v_rider_wallet_id IS NOT NULL AND v_shipment_fee > 0 THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata) 
            VALUES (
                v_rider_wallet_id,
                v_shipment_fee,
                'delivery_fee',
                'Delivery: Order #' || UPPER(RIGHT(NEW.order_id::TEXT, 6)),
                'pending',
                jsonb_build_object(
                    'order_id', NEW.order_id,
                    'shipment_id', NEW.id,
                    'hold_until', NOW() + (v_settlement_hours || ' hours')::INTERVAL,
                    'is_instant_recognition', true
                )
            );

            INSERT INTO public.revenue_ledgers (order_id, total_order_amount, rider_fee, platform_fee, status) 
            VALUES (NEW.order_id, 0, v_shipment_fee, v_logistical_cut, 'pending')
            ON CONFLICT (order_id) DO UPDATE SET
                rider_fee = public.revenue_ledgers.rider_fee + EXCLUDED.rider_fee,
                platform_fee = public.revenue_ledgers.platform_fee + EXCLUDED.platform_fee;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

