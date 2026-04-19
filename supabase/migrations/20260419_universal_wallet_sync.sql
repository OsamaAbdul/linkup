-- MIGRATION: 20260419_universal_wallet_sync.sql
-- TARGET: Correct existing seller balances that were inflated by delivery fees.
-- REPAIR: Recalculates based on the new Subtotal-based fee engine.

DO $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_hold_reason TEXT := 'Repair: Correcting Seller-Delivery fee split';
BEGIN
    RAISE NOTICE 'Starting financial repair (Subtotal Fix)...';

    FOR v_order IN (
        SELECT id, seller_id, promoter_id, status, settlement_due_at, total_amount
        FROM public.orders
        WHERE status IN ('completed', 'delivered', 'processing')
        AND created_at >= NOW() - INTERVAL '7 days'
    ) LOOP
        -- NEW: Uses subtotal-based engine
        v_fees := public.calculate_precise_fees(v_order.id, v_order.total_amount, v_order.promoter_id);
        IF v_fees IS NULL THEN CONTINUE; END IF;

        -- B. Seller Wallet & Transaction (WILL OVERWRITE INFLATED BALANCES)
        v_seller_wallet_id := public.ensure_wallet_exists(v_order.seller_id);
        IF (v_fees->>'seller')::NUMERIC > 0 THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_seller_wallet_id, (v_fees->>'seller')::NUMERIC, 'settlement', 
                    'Pending: Order #' || UPPER(RIGHT(v_order.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', v_order.id, 'reason', v_hold_reason, 'hold_until', COALESCE(v_order.settlement_due_at, NOW() + INTERVAL '48 hours'), 'subtotal', v_fees->>'subtotal'))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET 
                amount = EXCLUDED.amount, -- This replaces the inflated ₦4175 with ~₦2046
                metadata = wallet_transactions.metadata || EXCLUDED.metadata;
        END IF;

        -- C. Promoter Wallet & Transaction
        IF v_order.promoter_id IS NOT NULL AND (v_fees->>'promoter')::NUMERIC > 0 THEN
            v_promoter_wallet_id := public.ensure_wallet_exists(v_order.promoter_id);
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_promoter_wallet_id, (v_fees->>'promoter')::NUMERIC, 'commission', 
                    'Commission: Order #' || UPPER(RIGHT(v_order.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', v_order.id, 'reason', v_hold_reason))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;

        -- D. Rider Wallet & Transaction
        SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = v_order.id LIMIT 1;
        IF v_rider_id IS NOT NULL AND (v_fees->>'rider_total')::NUMERIC > 0 THEN
            v_rider_wallet_id := public.ensure_wallet_exists(v_rider_id);
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_rider_wallet_id, (v_fees->>'rider_total')::NUMERIC, 'delivery_fee', 
                    'Delivery: Order #' || UPPER(RIGHT(v_order.id::TEXT, 6)), 'pending',
                    jsonb_build_object('order_id', v_order.id, 'reason', v_hold_reason))
            ON CONFLICT (wallet_id, reference) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;

    END LOOP;

    RAISE NOTICE 'Financial repair (Subtotal Fix) complete.';
END $$;
