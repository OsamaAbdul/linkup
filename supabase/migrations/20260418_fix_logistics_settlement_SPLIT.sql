-- =========================================================================
-- LOGISTICS SETTLEMENT FIX: SEQUENTIAL EXECUTION (DEADLOCK PREVENTION)
-- =========================================================================
-- VERSION: 2.1 (NULL-SAFE FOR ORDER CREATION)
-- =========================================================================

-- -------------------------------------------------------------------------
-- PHASE 1: Schema Cleanup & Logic Definition
-- -------------------------------------------------------------------------
SET lock_timeout = '10s';

-- 1. Stop active triggers
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
DROP TRIGGER IF EXISTS trg_shipment_delivery_payout ON public.shipments;
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.orders;
DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.shipments;

-- 2. Define New Fee Calculation Logic (NULL-SAFE)
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_shipment_fees RECORD;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_rider_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_cross_zone_fee NUMERIC := 0;
    v_shipment_count INTEGER := 0;
BEGIN
    SELECT total_amount, promoter_id INTO v_order FROM public.orders WHERE id = p_order_id;
    IF v_order IS NULL THEN RETURN NULL; END IF;

    -- CRITICAL FIX: Use COALESCE(SUM(...), 0) to prevent NULL during order creation
    SELECT 
        COALESCE(SUM(delivery_fee_amount), 0) as total_delivery,
        COALESCE(SUM(cross_zone_fee_amount), 0) as total_cross_zone,
        COUNT(*) as shipment_count
    INTO v_shipment_fees FROM public.shipments WHERE order_id = p_order_id;

    v_rider_fee := COALESCE(v_shipment_fees.total_delivery, 0);
    v_cross_zone_fee := COALESCE(v_shipment_fees.total_cross_zone, 0);
    v_shipment_count := COALESCE(v_shipment_fees.shipment_count, 0);

    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_order.total_amount * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_order.total_amount * v_rec.rate) + v_rec.flat_fee;
        END IF;
    END LOOP;

    -- Apply Platform Fee per Shipment
    IF v_shipment_count > 0 THEN
        v_platform_fee := v_platform_fee + (300 * v_shipment_count);
        v_rider_fee := v_rider_fee - (300 * v_shipment_count);
    END IF;
    
    RETURN jsonb_build_object(
        'platform', ROUND(COALESCE(v_platform_fee, 0), 2),
        'rider', ROUND(COALESCE(GREATEST(0, v_rider_fee), 0), 2),
        'cross_zone', ROUND(COALESCE(v_cross_zone_fee, 0), 2),
        'promoter', ROUND(COALESCE(v_promoter_fee, 0), 2),
        'rider_total', ROUND(COALESCE(GREATEST(0, v_rider_fee) + v_cross_zone_fee, 0), 2),
        'seller', ROUND(COALESCE(v_order.total_amount - v_platform_fee - v_promoter_fee - v_rider_fee - v_cross_zone_fee, v_order.total_amount), 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Define Settlement Trigger Logic
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
    v_amount NUMERIC;
BEGIN
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent')) THEN
        v_fees := public.calculate_precise_fees(NEW.id);
        
        -- SECURE: Ensure we don't insert NULL amounts
        v_amount := (v_fees->>'seller')::NUMERIC;
        
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NOT NULL AND v_amount IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_seller_wallet_id, v_amount, 'settlement', 
                    'Pending: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment'))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;

        IF NEW.promoter_id IS NOT NULL AND (v_fees->>'promoter')::NUMERIC IS NOT NULL THEN
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
            IF v_promoter_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (v_promoter_wallet_id, (v_fees->>'promoter')::NUMERIC, 'commission', 
                        'Commission: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                        jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment'))
                ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
            END IF;
        END IF;
    END IF;

    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';
        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object('reason', v_hold_reason, 'hold_until', NEW.settlement_due_at)
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
        PERFORM public.run_settlements();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Define Shipment Payout Logic (Rider)
CREATE OR REPLACE FUNCTION public.handle_shipment_delivered_payout()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_shipment_fee NUMERIC;
BEGIN
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        v_shipment_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - 300;
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id;
        IF v_rider_wallet_id IS NOT NULL AND v_shipment_fee > 0 THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata) 
            VALUES (v_rider_wallet_id, v_shipment_fee, 'delivery_fee', 
                    'Delivery: Order #' || UPPER(RIGHT(NEW.order_id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', NEW.order_id, 'shipment_id', NEW.id, 'is_instant_recognition', true))
            ON CONFLICT (wallet_id, reference) DO NOTHING;

            INSERT INTO public.revenue_ledgers (order_id, total_order_amount, rider_fee, platform_fee, status) 
            VALUES (NEW.order_id, 0, v_shipment_fee, 300, 'pending')
            ON CONFLICT (order_id) DO UPDATE SET
                rider_fee = public.revenue_ledgers.rider_fee + EXCLUDED.rider_fee,
                platform_fee = public.revenue_ledgers.platform_fee + EXCLUDED.platform_fee;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------
-- PHASE 2: Trigger Activation
-- -------------------------------------------------------------------------
-- (Run this ONLY after Phase 1 succeeds)

CREATE TRIGGER trg_revenue_settlement
    BEFORE INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_revenue_settlement();

CREATE TRIGGER trg_shipment_delivery_payout
    AFTER UPDATE OF status ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.handle_shipment_delivered_payout();


-- -------------------------------------------------------------------------
-- PHASE 3: Data & Accounting Correction Audit
-- -------------------------------------------------------------------------
-- (Run this ONLY after Phase 2 succeeds)

DO $$
DECLARE
    v_rec RECORD;
    v_correct_total NUMERIC;
    v_correct_fee NUMERIC;
BEGIN
    -- 1. Fix 'total_amount' for orders that missed delivery fees
    FOR v_rec IN (
        SELECT o.id, o.total_amount, 
               COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) as items_total,
               COALESCE(s.delivery_fee_amount, 0) + COALESCE(s.cross_zone_fee_amount, 0) as shipping_total
        FROM public.orders o
        JOIN public.order_items oi ON o.id = oi.order_id
        LEFT JOIN public.shipments s ON o.id = s.order_id
        GROUP BY o.id, o.total_amount, s.delivery_fee_amount, s.cross_zone_fee_amount
        HAVING o.total_amount < (COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) + 10)
    ) LOOP
        v_correct_total := v_rec.items_total + v_rec.shipping_total;
        UPDATE public.orders SET total_amount = v_correct_total WHERE id = v_rec.id;
        RAISE NOTICE 'Corrected order % total_amount from % to %', v_rec.id, v_rec.total_amount, v_correct_total;
    END LOOP;

    -- 2. Fix rider overpayments
    FOR v_rec IN (
        SELECT wt.id, wt.wallet_id, wt.amount, wt.metadata->>'order_id' as order_id, o.total_amount
        FROM public.wallet_transactions wt
        JOIN public.orders o ON (wt.metadata->>'order_id')::UUID = o.id
        WHERE wt.type = 'delivery_fee'
        AND wt.amount >= o.total_amount 
        AND o.total_amount > 0
        FOR UPDATE SKIP LOCKED
    ) LOOP
        SELECT (COALESCE(delivery_fee_amount, 0) + COALESCE(cross_zone_fee_amount, 0)) - 300
        INTO v_correct_fee FROM public.shipments WHERE order_id = v_rec.order_id::UUID LIMIT 1;
        IF v_correct_fee IS NULL OR v_correct_fee <= 0 THEN v_correct_fee := 1200; -- Fallback
        END IF;
        UPDATE public.wallet_transactions SET amount = v_correct_fee WHERE id = v_rec.id;
    END LOOP;
END $$;
