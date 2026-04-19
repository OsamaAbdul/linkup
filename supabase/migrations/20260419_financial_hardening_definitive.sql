-- MIGRATION: 20260419_financial_hardening_definitive.sql
-- TARGET: Ensure automatic wallet creation and reliable fund splitting across all roles.
-- SUBTOTAL FIX: Ensures Seller only receives product price (minus fees), NOT delivery fees.

BEGIN;

-- 1. CLEANUP
DROP FUNCTION IF EXISTS public.ensure_wallet_exists(p_user_id UUID);
DROP FUNCTION IF EXISTS public.ensure_wallet_exists(p_user_id UUID, p_seller_id UUID);

-- 2. Definitive Wallet Helper
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id LIMIT 1;
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance, escrow_balance)
        VALUES (p_user_id, 0, 0) RETURNING id INTO v_wallet_id;
    END IF;
    RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine Fee Engine (Subtotal-Aware)
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
    SELECT SUM(price_at_purchase * quantity) INTO v_subtotal 
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

    -- Apply Fee Configs (BASED ON SUBTOTAL)
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order_promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        END IF;
    END LOOP;

    -- Adjust for Linkup Last-Mile (if shipments exist)
    IF v_shipment_count > 0 THEN
        v_platform_fee := v_platform_fee + (300 * v_shipment_count);
        v_rider_fee := v_rider_fee - (300 * v_shipment_count);
    END IF;
    
    RETURN jsonb_build_object(
        'subtotal', ROUND(v_subtotal, 2),
        'delivery_pool', ROUND(v_order_total - v_subtotal, 2),
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'cross_zone', ROUND(v_cross_zone_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'rider_total', ROUND(GREATEST(0, v_rider_fee) + v_cross_zone_fee, 2),
        'seller', ROUND(v_subtotal - v_platform_fee - v_promoter_fee, 2) -- THE FIX: Seller only gets subtotal pool
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Hardened Revenue Settlement Trigger
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
BEGIN
    -- PHASE 1: Initialization
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent')) THEN
        v_fees := public.calculate_precise_fees(NEW.id, NEW.total_amount, NEW.promoter_id);
        
        -- A. Seller Settlement (Corrected Subtotal)
        v_seller_wallet_id := public.ensure_wallet_exists(NEW.seller_id);
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
        VALUES (v_seller_wallet_id, (v_fees->>'seller')::NUMERIC, 'settlement', 
                'Pending: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment', 'subtotal', v_fees->>'subtotal'))
        ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;

        -- B. Promoter Commission
        IF NEW.promoter_id IS NOT NULL AND (v_fees->>'promoter')::NUMERIC > 0 THEN
            v_promoter_wallet_id := public.ensure_wallet_exists(NEW.promoter_id);
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_promoter_wallet_id, (v_fees->>'promoter')::NUMERIC, 'commission', 
                    'Commission: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment'))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;
    END IF;

    -- PHASE 2: Completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';
        v_fees := public.calculate_precise_fees(NEW.id, NEW.total_amount, NEW.promoter_id);

        -- C. Fallback/Sync for Seller
        v_seller_wallet_id := public.ensure_wallet_exists(NEW.seller_id);
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
        VALUES (v_seller_wallet_id, (v_fees->>'seller')::NUMERIC, 'settlement', 
                'Pending: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', v_hold_reason, 'hold_until', NEW.settlement_due_at, 'subtotal', v_fees->>'subtotal'))
        ON CONFLICT (wallet_id, reference) DO UPDATE SET 
            status = 'pending', amount = EXCLUDED.amount, metadata = wallet_transactions.metadata || EXCLUDED.metadata;

        -- D. Rider Payout (Include Delivery Pool if shipments logic needs it)
        SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = NEW.id AND status = 'delivered' LIMIT 1;
        IF v_rider_id IS NOT NULL THEN
            v_rider_wallet_id := public.ensure_wallet_exists(v_rider_id);
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_rider_wallet_id, (v_fees->>'rider_total')::NUMERIC, 'delivery_fee', 
                    'Delivery: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', v_hold_reason, 'hold_until', NEW.settlement_due_at))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET 
                status = 'pending', metadata = wallet_transactions.metadata || EXCLUDED.metadata;
        END IF;

        PERFORM public.run_settlements();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
