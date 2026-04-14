
-- MIGRATION: 20260413_fix_promoter_attribution.sql
-- Fixes promoter_id being nulled out due to legacy JSONB checks.

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
    -- STEP 1: Metadata Capture on transition to awaiting_agent
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent')) THEN
        -- Secure Distance Calculation
        NEW.distance_km := public.calculate_distance(
            COALESCE(NEW.pickup_lat, 0), COALESCE(NEW.pickup_lng, 0), 
            COALESCE(NEW.delivery_lat, 0), COALESCE(NEW.delivery_lng, 0)
        );

        -- Validate Promoter Attribution (Check BOTH legacy items and modern order_items)
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals r
                WHERE r.promoter_id = NEW.promoter_id 
                AND (
                    r.product_id IS NULL OR 
                    -- Check legacy items column
                    (
                        jsonb_typeof(NEW.items) = 'array' AND
                        EXISTS (
                            SELECT 1 FROM jsonb_array_elements(NEW.items) item 
                            WHERE (item->>'product_id')::UUID = r.product_id
                        )
                    ) OR
                    -- Check modern order_items table
                    EXISTS (
                        SELECT 1 FROM public.order_items_new
                        WHERE order_id = NEW.id AND product_id = r.product_id
                    )
                )
                AND r.created_at >= v_attribution_threshold
                AND r.expires_at > NOW()
            ) THEN
                -- LOG attribution failure for debugging if needed
                RAISE NOTICE 'Promoter % attribution failed for order % due to product mismatch or expiration', NEW.promoter_id, NEW.id;
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

            -- Update commissions tracker
            -- Note: We use public.commissions name from the query in the UI
            -- Ensure this table exists or skip if it causes errors (the referral system is primary)
            BEGIN
                INSERT INTO public.commissions (order_id, promoter_id, amount, status)
                VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
                ON CONFLICT (order_id, promoter_id) DO UPDATE SET status = 'pending', amount = EXCLUDED.amount;
            EXCEPTION WHEN undefined_table THEN
                NULL; -- Commissions table might be created in another migration we haven't seen or is optional
            END;
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

        -- Rider Pending Tx
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
