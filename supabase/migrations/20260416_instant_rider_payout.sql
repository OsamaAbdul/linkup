-- Instant Rider Payout Recognition (Shipment-Level Trigger)

-- 1. Create Trigger Function to handle shipment delivery payouts
CREATE OR REPLACE FUNCTION public.handle_shipment_delivered_payout()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_order RECORD;
    v_shipment_fee NUMERIC;
    v_hold_until TIMESTAMP;
BEGIN
    -- Only trigger when shipment is marked 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        
        -- Get order context
        SELECT id, seller_id FROM public.orders WHERE id = NEW.order_id INTO v_order;
        
        -- Calculate the exact payout (Fee + Cross-Zone - 300 Platform Fee)
        -- Note: We subtract 300 here to match the platform fee logic
        v_shipment_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - 300;
        
        -- Settlement hold duration (48 hours)
        v_hold_until := NOW() + INTERVAL '48 hours';

        -- 1. Find or create Rider Wallet
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id;
        
        IF v_rider_wallet_id IS NOT NULL AND v_shipment_fee > 0 THEN
            -- 2. Create PENDING Wallet Transaction for the Rider
            -- We tag it with shipment_id and order_id in metadata for audit and dispute tracking
            INSERT INTO public.wallet_transactions (
                wallet_id, 
                amount, 
                type, 
                reference, 
                status, 
                metadata
            ) VALUES (
                v_rider_wallet_id,
                v_shipment_fee,
                'delivery_fee',
                'Delivery: Order #' || UPPER(RIGHT(NEW.order_id::TEXT, 6)),
                'pending',
                jsonb_build_object(
                    'order_id', NEW.order_id,
                    'shipment_id', NEW.id,
                    'reason', 'Standard security hold for dispute resolution',
                    'hold_until', v_hold_until,
                    'is_instant_recognition', true
                )
            );

            -- 3. Ensure a Revenue Ledger entry exists so it shows in the Earnings UI
            -- If multiple shipments, this will aggregate them safely
            INSERT INTO public.revenue_ledgers (
                order_id,
                total_order_amount,
                rider_fee,
                platform_fee,
                status
            ) VALUES (
                NEW.order_id,
                0, -- Will be updated when Order is finalized
                v_shipment_fee,
                300, -- The platform fee share from this delivery
                'pending'
            )
            ON CONFLICT (order_id) DO UPDATE SET
                rider_fee = public.revenue_ledgers.rider_fee + EXCLUDED.rider_fee,
                platform_fee = public.revenue_ledgers.platform_fee + EXCLUDED.platform_fee;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger to shipments
DROP TRIGGER IF EXISTS trg_shipment_delivery_payout ON public.shipments;
CREATE TRIGGER trg_shipment_delivery_payout
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.handle_shipment_delivered_payout();


-- 3. REDEFINE handle_revenue_settlement to prevent duplicate rider payouts
-- This version removes the rider payout loop from the 'completed' block
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
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

        -- Validate Promoter Attribution
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals r
                WHERE r.promoter_id = NEW.promoter_id 
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

        -- Promoter Escrow
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
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
        END IF;
    END IF;

    -- STEP 2: Transition to completion (Finalize Hold Period)
    -- RIDER PAYOUTS REMOVED FROM HERE as they are now handled by shipments status trigger
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';

        -- Finalize metadata for existing pending transactions (Seller/Promoter/Rider)
        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object(
            'reason', v_hold_reason,
            'hold_until', NEW.settlement_due_at
        )
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
        
        -- Sync the Revenue Ledger final state
        v_fees := public.calculate_precise_fees(NEW.id);
        INSERT INTO public.revenue_ledgers (order_id, total_order_amount, status)
        VALUES (NEW.id, NEW.total, 'pending')
        ON CONFLICT (order_id) DO UPDATE SET 
            total_order_amount = EXCLUDED.total_order_amount,
            status = 'pending';

        PERFORM public.run_settlements();
    END IF;

    -- STEP 3: Handle Disputes (Freeze ALL pending transactions)
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none';
        UPDATE public.wallet_transactions 
        SET status = 'failed' 
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
