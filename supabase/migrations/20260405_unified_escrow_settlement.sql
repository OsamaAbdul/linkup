
-- 1. UNIFIED WALLET SYNCHRONIZATION
-- This function ensures that any 'pending' transaction immediately reflects in the user's escrow_balance,
-- and moves to the available 'balance' once finalized as 'success'.
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- LOGIC FOR INSERT
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'success') THEN
            UPDATE public.wallets
            SET balance = balance + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        ELSIF (NEW.status = 'pending') THEN
            UPDATE public.wallets
            SET escrow_balance = escrow_balance + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        END IF;

    -- LOGIC FOR UPDATE (Transitioning from pending to success)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status = 'pending' AND NEW.status = 'success') THEN
            UPDATE public.wallets
            SET balance = balance + NEW.amount,
                escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        ELSIF (OLD.status = 'pending' AND NEW.status = 'failed') THEN
            UPDATE public.wallets
            SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        ELSIF (OLD.status = 'success' AND NEW.status = 'failed') THEN
             UPDATE public.wallets
            SET balance = balance - OLD.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        END IF;

    -- LOGIC FOR DELETE (Cleanup)
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'success') THEN
            UPDATE public.wallets
            SET balance = balance - OLD.amount,
                updated_at = NOW()
            WHERE id = OLD.wallet_id;
        ELSIF (OLD.status = 'pending') THEN
            UPDATE public.wallets
            SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                updated_at = NOW()
            WHERE id = OLD.wallet_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Re-apply trigger to wallet_transactions
DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

-- 2. REFACTOR REVENUE SETTLEMENT (Removal of manual escrow increments)
-- Now escrow balance is handled automatically by the sync_wallet_balance trigger
-- whenever a 'pending' transaction is inserted.
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_rider_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
    v_hold_reason TEXT := 'Standard security hold for dispute resolution';
BEGIN
    -- STEP 1: Metadata Capture & Initial Escrow on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- Validate Promoter Attribution (Last-Click Wins within window)
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

        -- NOTE: Escrow transactions are now initiated here so they reflect in user's pending balance immediately.
        
        -- 1. Seller Escrow Tx
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NULL THEN
            -- Create wallet if missing (first-time seller)
            INSERT INTO public.wallets (user_id, seller_id, balance, escrow_balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total - COALESCE((v_fees->>'rider')::NUMERIC, 0) - COALESCE((v_fees->>'platform')::NUMERIC, 0) - COALESCE((v_fees->>'promoter')::NUMERIC, 0)), 
                'settlement', 
                'Pending Settlement: Order #' || NEW.id,
                'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Order confirmed - awaiting fulfillment')
            );
        END IF;

        -- 2. Promoter Escrow Tx & Commission Sync
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
            IF v_promoter_wallet_id IS NULL THEN
                -- Create wallet if missing (first-time promoter)
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.promoter_id, 0, 0)
                RETURNING id INTO v_promoter_wallet_id;
            END IF;

            IF v_promoter_wallet_id IS NOT NULL THEN
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
                VALUES (
                    v_promoter_wallet_id, 
                    (v_fees->>'promoter')::NUMERIC, 
                    'commission', 
                    'Pending Commission: Order #' || NEW.id,
                    'pending',
                    jsonb_build_object('order_id', NEW.id, 'reason', 'Order confirmed - awaiting fulfillment')
                );
            END IF;

            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE SET status = 'pending', amount = EXCLUDED.amount;
        END IF;
    END IF;

    -- STEP 2: Transition PENDING Transactions to Hold Period on Completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        -- Update existing pending transactions with the settlement hold details
        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object(
            'reason', v_hold_reason,
            'hold_until', NEW.settlement_due_at
        )
        WHERE metadata->>'order_id' = NEW.id::TEXT 
        AND status = 'pending';

        -- 3. Rider Pending Tx (Still created on completion as rider is assigned later)
        v_fees := public.calculate_order_fees(NEW.id);
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
        -- Cancel pending transactions
        UPDATE public.wallet_transactions 
        SET status = 'failed' 
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFACTOR SETTLEMENT RUNNER & ADMIN OVERRIDE
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
            -- The sync_wallet_balance trigger will automatically handle escrow->balance movement
            UPDATE public.wallet_transactions
            SET status = 'success',
                updated_at = NOW()
            WHERE (metadata->>'order_id' = v_order.id::TEXT)
            AND status = 'pending';

            -- Finalize Commissions table
            UPDATE public.commissions 
            SET status = 'paid', 
                paid_at = NOW()
            WHERE order_id = v_order.id;

            -- Credit Platform
            v_fees := public.calculate_order_fees(v_order.id);
            UPDATE public.platform_wallets 
            SET balance = balance + (v_fees->>'platform')::NUMERIC 
            WHERE id = v_platform_wallet_id;

            -- Mark settled
            UPDATE public.orders 
            SET settlement_status = 'settled',
                updated_at = NOW() 
            WHERE id = v_order.id;
            
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement finalization failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ADMIN RPC: FORCE RELEASE ALL FUNDS
CREATE OR REPLACE FUNCTION public.force_release_all_funds()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Trigger the force settlement
    SELECT processed_count INTO v_count FROM public.run_settlements(TRUE);
    
    RETURN jsonb_build_object(
        'success', true,
        'orders_processed', v_count,
        'message', 'Funds released successfully for ' || v_count || ' orders.'
    );
END;
$$;
