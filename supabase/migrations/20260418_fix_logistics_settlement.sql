-- MIGRATION: 20260418_fix_logistics_settlement.sql
-- UNIFIED SETTLEMENT ENGINE: Fixes rider overpayment and ensures accurate seller/rider splits.
-- DEADLOCK SAFE VERSION: Uses lock timeouts and optimized operation order.

-- Set a timeout for locks to prevent hanging the database
SET lock_timeout = '5s';

-- 1. CLEANUP FIRST: Drop conflicting legacy triggers (Requires AccessExclusiveLock)
-- We do this first so that new logic isn't fighting old triggers.
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.orders;
DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.shipments;

-- 2. Redefine Unified Fee Engine
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

    SELECT 
        SUM(COALESCE(delivery_fee_amount, 0)) as total_delivery,
        SUM(COALESCE(cross_zone_fee_amount, 0)) as total_cross_zone,
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

    IF v_shipment_count > 0 THEN
        v_platform_fee := v_platform_fee + (300 * v_shipment_count);
        v_rider_fee := v_rider_fee - (300 * v_shipment_count);
    END IF;
    
    RETURN jsonb_build_object(
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'cross_zone', ROUND(v_cross_zone_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'rider_total', ROUND(GREATEST(0, v_rider_fee) + v_cross_zone_fee, 2),
        'seller', ROUND(v_order.total_amount - v_platform_fee - v_promoter_fee - GREATEST(0, v_rider_fee) - v_cross_zone_fee, 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Update Order Settlement Trigger
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
BEGIN
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent')) THEN
        v_fees := public.calculate_precise_fees(NEW.id);
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_seller_wallet_id, (v_fees->>'seller')::NUMERIC, 'settlement', 
                    'Pending: Order #' || UPPER(RIGHT(NEW.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment'))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;

        IF NEW.promoter_id IS NOT NULL THEN
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

-- 4. Update Shipment Payout Trigger
CREATE OR REPLACE FUNCTION public.handle_shipment_delivered_payout()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_shipment_fee NUMERIC;
BEGIN
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        v_shipment_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - 300;
        IF v_shipment_fee > 10000 THEN RAISE WARNING 'High fee: %', v_shipment_fee; END IF;
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

-- 5. AUDIT & CORRECTION: Fix existing overpaid transactions
-- This part is moved to a separate block to avoid holding locks during DDL
DO $$
DECLARE
    v_bad_tx RECORD;
    v_correct_fee NUMERIC;
BEGIN
    -- Only process items that are NOT currently locked by other processes
    FOR v_bad_tx IN (
        SELECT wt.id, wt.wallet_id, wt.amount, wt.metadata->>'order_id' as order_id, o.total_amount
        FROM public.wallet_transactions wt
        JOIN public.orders o ON (wt.metadata->>'order_id')::UUID = o.id
        WHERE wt.type = 'delivery_fee'
        AND wt.amount >= o.total_amount 
        AND o.total_amount > 0
        FOR UPDATE SKIP LOCKED -- Critical for skipping items that are already locked
    ) LOOP
        SELECT (COALESCE(delivery_fee_amount, 0) + COALESCE(cross_zone_fee_amount, 0)) - 300
        INTO v_correct_fee FROM public.shipments WHERE order_id = v_bad_tx.order_id::UUID LIMIT 1;

        IF v_correct_fee IS NULL OR v_correct_fee <= 0 THEN v_correct_fee := 1500 - 300; END IF;

        UPDATE public.wallet_transactions 
        SET amount = v_correct_fee,
            metadata = metadata || jsonb_build_object('corrected_from', v_bad_tx.amount, 'correction_date', NOW())
        WHERE id = v_bad_tx.id;
    END LOOP;
END $$;
