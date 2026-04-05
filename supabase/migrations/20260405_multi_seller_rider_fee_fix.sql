
-- MULTI-SELLER RIDER FEE HARDENING
-- This migration ensures riders are paid based on the actual delivery fee collected per shipment.

-- 1. ENRICH SHIPMENTS SCHEMA
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS delivery_fee_amount NUMERIC DEFAULT 0;

-- 2. REFACTOR FEE CALCULATION (Partitioned Version)
-- Updated to pull the delivery_fee_amount from the shipments table instead of recalculating from a global config.
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_shipment RECORD;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_rider_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
BEGIN
    -- Get order basics
    SELECT total, promoter_id INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- Get shipment-specific delivery fee if available
    SELECT delivery_fee_amount INTO v_shipment FROM public.shipments WHERE order_id = p_order_id LIMIT 1;
    v_rider_fee := COALESCE(v_shipment.delivery_fee_amount, 0);

    -- Fetch Configured Rates for Platform and Promoter
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) 
    LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        -- NOTE: We explicitly ignore 'rider' fee_type here to favor the shipment's recorded split fee
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(v_rider_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'seller', ROUND(v_order.total - v_platform_fee - v_promoter_fee, 2) -- Rider fee is already outside sub-total in multi-seller split?
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. ENSURE REDEFINED TRIGGER SYSTEM USES THE NEW LOGIC
-- Overriding the old handle_revenue_settlement to be ultra-precise
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_shipment_rider_fee NUMERIC;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
BEGIN
    -- STEP 1: Metadata Capture on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        
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
    END IF;

    -- STEP 2: Initiate PENDING Transactions on Completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        -- Get Precise Fees (Using partitioned shipment fee for rider)
        v_fees := public.calculate_precise_fees(NEW.id);
        
        -- 1. Seller Pending Tx
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total - (v_fees->>'platform')::NUMERIC - COALESCE((v_fees->>'promoter')::NUMERIC, 0)), 
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

        -- 2. Promoter Pending Tx
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
        END IF;

        -- 3. Rider Pending Tx (Using partitioned shipment fee)
        SELECT rider_id, delivery_fee_amount INTO v_rider_id, v_shipment_rider_fee FROM public.shipments WHERE order_id = NEW.id LIMIT 1;
        IF v_rider_id IS NOT NULL AND v_shipment_rider_fee > 0 THEN
            SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
            IF v_rider_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_rider_wallet_id, 
                    v_shipment_rider_fee, 
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
