
-- 1. Refactor sync_wallet_balance trigger to only affect balance on 'success'
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only affect balance if status is 'success'
    -- If INSERTED as success, add to balance
    IF (TG_OP = 'INSERT' AND NEW.status = 'success') THEN
        UPDATE public.wallets
        SET balance = balance + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    -- If UPDATED from pending to success, add to balance
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'success') THEN
        UPDATE public.wallets
        SET balance = balance + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    -- If UPDATED from success to failed (e.g. payout failure), subtract from balance
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'success' AND NEW.status = 'failed') THEN
        UPDATE public.wallets
        SET balance = balance - OLD.amount,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update handle_revenue_settlement to insert PENDING transactions immediately on Completion
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
    v_hold_reason TEXT := '48-hour security hold for dispute resolution';
BEGIN
    -- STEP 1: Capture Geometry & Initial Fees on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        v_fees := public.calculate_order_fees(NEW.id);
        
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

        -- Find seller wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id LIMIT 1;
        
        -- Initial escrow capture
        IF v_seller_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance + (NEW.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
            WHERE id = v_seller_wallet_id;
        END IF;
    END IF;

    -- STEP 2: Initiate PENDING Transactions on Completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        -- Calculations
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- 1. Seller Pending Tx
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC - (v_fees->>'promoter')::NUMERIC), 
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

        -- 2. Promoter Pending Tx & Commission Sync
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

            -- Always keep commissions table in sync for the dashboard
            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE SET status = 'pending', amount = EXCLUDED.amount;
        END IF;

        -- 3. Rider Pending Tx
        SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = NEW.id LIMIT 1;
        IF v_rider_id IS NOT NULL THEN
            SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
            IF v_rider_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_rider_wallet_id, 
                    (v_fees->>'rider')::NUMERIC, 
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

    -- STEP 3: Handle Disputes
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none';
        -- Optional: cancel pending transactions here
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update run_settlements to finalize pending transactions & commissions
CREATE OR REPLACE FUNCTION public.run_settlements()
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_seller_wallet_id UUID;
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
            
            -- Deduct from Seller Escrow
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
            IF v_seller_wallet_id IS NOT NULL THEN
                UPDATE public.wallets 
                SET escrow_balance = GREATEST(0, escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC))
                WHERE id = v_seller_wallet_id;
            END IF;

            -- Finalize Wallet Transactions
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

            -- Credit Platform
            UPDATE public.platform_wallets 
            SET balance = balance + (v_fees->>'platform')::NUMERIC 
            WHERE id = v_platform_wallet_id;

            -- Mark settled
            UPDATE public.orders SET settlement_status = 'settled' WHERE id = v_order.id;
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement finalization failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
