-- MIGRATION: 20260412_settlement_audit_repair.sql
-- AUDIT & REPAIR: Fixes Rider escrow being stuck and Promoter visibility issues.

-- 1. UNIFIED PRECISION FEE ENGINE
-- Consolidates all fee calculation (Platform, Rider, Promoter, Cross-Zone)
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
BEGIN
    -- Get order basics
    SELECT total, promoter_id, items INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- Get shipment-specific fees from all shipments tied to this order
    SELECT 
        SUM(COALESCE(delivery_fee_amount, 0)) as total_delivery,
        SUM(COALESCE(cross_zone_fee_amount, 0)) as total_cross_zone
    INTO v_shipment_fees 
    FROM public.shipments 
    WHERE order_id = p_order_id;

    v_rider_fee := COALESCE(v_shipment_fees.total_delivery, 0);
    v_cross_zone_fee := COALESCE(v_shipment_fees.total_cross_zone, 0);

    -- Fetch Configured Rates for Platform and Promoter
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) 
    LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(v_rider_fee, 2),
        'cross_zone', ROUND(v_cross_zone_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'rider_total', ROUND(v_rider_fee + v_cross_zone_fee, 2),
        'seller', ROUND(v_order.total - v_platform_fee - v_promoter_fee, 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. REPAIR REVENUE SETTLEMENT TRIGGER
-- Relaxed promoter attribution and robust transaction creation
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_shipment RECORD;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
BEGIN
    -- STEP 1: Metadata Capture on transition to awaiting_agent (or earlier if needed)
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent')) THEN
        -- Secure Distance Calculation
        NEW.distance_km := public.calculate_distance(
            COALESCE(NEW.pickup_lat, 0), COALESCE(NEW.pickup_lng, 0), 
            COALESCE(NEW.delivery_lat, 0), COALESCE(NEW.delivery_lng, 0)
        );

        -- Validate Promoter Attribution (Check ANY product in order)
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals r
                WHERE r.promoter_id = NEW.promoter_id 
                AND (
                    r.product_id IS NULL OR 
                    EXISTS (
                        SELECT 1 FROM jsonb_array_elements(NEW.items) item 
                        WHERE (item->>'product_id')::UUID = r.product_id
                    )
                )
                AND r.created_at >= v_attribution_threshold
                AND r.expires_at > NOW()
            ) THEN
                NEW.promoter_id := NULL;
            END IF;
        END IF;

        -- Create Escrow transactions for Seller and Promoter immediately
        v_fees := public.calculate_precise_fees(NEW.id);
        
        -- Seller Escrow
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (v_fees->>'seller')::NUMERIC, 
                'settlement', 
                'Pending: Order #' || NEW.id,
                'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment')
            ) ON CONFLICT DO NOTHING;
        END IF;

        -- Promoter Escrow & Commission Sync
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
            IF v_promoter_wallet_id IS NULL THEN
                 INSERT INTO public.wallets (user_id, balance, escrow_balance)
                 VALUES (NEW.promoter_id, 0, 0) RETURNING id INTO v_promoter_wallet_id;
            END IF;

            IF v_promoter_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_promoter_wallet_id, 
                    (v_fees->>'promoter')::NUMERIC, 
                    'commission', 
                    'Commission: Order #' || NEW.id,
                    'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', 'Awaiting fulfillment')
                ) ON CONFLICT DO NOTHING;
            END IF;

            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE SET status = 'pending', amount = EXCLUDED.amount;
        END IF;
    END IF;

    -- STEP 2: Transition to completion (Rider payout & Hold period start)
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        v_fees := public.calculate_precise_fees(NEW.id);

        -- Finalize metadata for existing pending transactions
        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object(
            'reason', v_hold_reason,
            'hold_until', NEW.settlement_due_at
        )
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';

        -- Rider Pending Tx (Loop through shipments for this order)
        FOR v_shipment IN (SELECT rider_id, delivery_fee_amount, cross_zone_fee_amount FROM public.shipments WHERE order_id = NEW.id) LOOP
            IF v_shipment.rider_id IS NOT NULL THEN
                SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_shipment.rider_id;
                IF v_rider_wallet_id IS NOT NULL THEN
                    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                    VALUES (
                        v_rider_wallet_id, 
                        (COALESCE(v_shipment.delivery_fee_amount, 0) + COALESCE(v_shipment.cross_zone_fee_amount, 0)), 
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
        END LOOP;
        
        -- AUTOMATED RELEASE SIGNAL: Process any due settlements immediately
        -- This ensures that "active" usage of the app triggers the cleanup of "stale" escrows.
        PERFORM public.run_settlements();
    END IF;

    -- STEP 3: Handle Disputes
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none';
        UPDATE public.wallet_transactions 
        SET status = 'failed' 
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ENSURE RUN_SETTLEMENTS IS ACCESSIBLE AND ROBUST
CREATE OR REPLACE FUNCTION public.run_settlements(p_force BOOLEAN DEFAULT FALSE)
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND (settlement_due_at <= NOW() OR p_force = TRUE)
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            -- Finalize all Wallet Transactions tied to this order
            UPDATE public.wallet_transactions
            SET status = 'success',
                updated_at = NOW()
            WHERE (metadata->>'order_id' = v_order.id::TEXT)
            AND status = 'pending';

            -- Finalize Commissions
            UPDATE public.commissions 
            SET status = 'paid', 
                paid_at = NOW()
            WHERE order_id = v_order.id;

            -- Mark settled
            UPDATE public.orders 
            SET settlement_status = 'settled',
                updated_at = NOW() 
            WHERE id = v_order.id;
            
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Settlement finalization failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. AUTO-RELEASE TRIGGER
-- Triggers whenever any order is touched, cleaning up the queue.
CREATE OR REPLACE FUNCTION public.trg_auto_release_settlements_func()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.run_settlements();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_release_settlements ON public.orders;
CREATE TRIGGER trg_auto_release_settlements
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION public.trg_auto_release_settlements_func();
