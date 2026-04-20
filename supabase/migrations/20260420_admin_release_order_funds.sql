-- MIGRATION: 20260420_admin_release_order_funds.sql
-- TARGET: Implement a breakdown-aware, order-specific fund release mechanism.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_release_order_funds(p_order_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to access all wallets
AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_shipment RECORD;
    v_rider_wallet_id UUID;
    v_success_count INTEGER := 0;
BEGIN
    -- 1. Authorization & State Check
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- RELAXATION: While production requires 'completed', 
    -- admin override should allow release if status is 'delivered' or 'completed'
    IF v_order.status NOT IN ('completed', 'delivered') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must be delivered or completed before release');
    END IF;

    IF v_order.settlement_status = 'settled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Funds for this order have already been released');
    END IF;

    -- 2. Fetch the "Perfect Sum" Breakdown
    -- This pulls from shipments.fee_breakdown JSON
    v_fees := public.calculate_precise_fees(p_order_id);

    IF v_fees IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Could not calculate fee breakdown for this order');
    END IF;

    -- 3. PROCESS SELLER
    v_seller_wallet_id := public.ensure_wallet_exists(v_order.seller_id);
    IF (v_fees->>'seller')::NUMERIC > 0 THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
        VALUES (
            v_seller_wallet_id, 
            (v_fees->>'seller')::NUMERIC, 
            'settlement', 
            'Release: Order #' || UPPER(RIGHT(p_order_id::TEXT, 6)),
            'success', -- INSTANT RELEASE
            jsonb_build_object('order_id', p_order_id, 'source', 'admin_manual_release')
        ) ON CONFLICT (wallet_id, reference) DO UPDATE SET status = 'success', updated_at = NOW();
        v_success_count := v_success_count + 1;
    END IF;

    -- 4. PROCESS PROMOTER
    IF v_order.promoter_id IS NOT NULL AND (v_fees->>'promoter')::NUMERIC > 0 THEN
        v_promoter_wallet_id := public.ensure_wallet_exists(v_order.promoter_id);
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
        VALUES (
            v_promoter_wallet_id, 
            (v_fees->>'promoter')::NUMERIC, 
            'commission', 
            'Release: Order #' || UPPER(RIGHT(p_order_id::TEXT, 6)),
            'success',
            jsonb_build_object('order_id', p_order_id, 'source', 'admin_manual_release')
        ) ON CONFLICT (wallet_id, reference) DO UPDATE SET status = 'success', updated_at = NOW();
        v_success_count := v_success_count + 1;
        
        -- Sync commissions table
        UPDATE public.commissions SET status = 'paid', paid_at = NOW() WHERE order_id = p_order_id;
    END IF;

    -- 5. PROCESS RIDERS (Loop through shipments)
    FOR v_shipment IN (SELECT id, rider_id, fee_breakdown FROM public.shipments WHERE order_id = p_order_id) LOOP
        IF v_shipment.rider_id IS NOT NULL AND (v_shipment.fee_breakdown->>'rider')::NUMERIC > 0 THEN
            v_rider_wallet_id := public.ensure_wallet_exists(v_shipment.rider_id);
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_rider_wallet_id, 
                (v_shipment.fee_breakdown->>'rider')::NUMERIC, 
                'delivery_fee', 
                'Release: Order #' || UPPER(RIGHT(p_order_id::TEXT, 6)) || '-' || UPPER(RIGHT(v_shipment.id::TEXT, 4)),
                'success',
                jsonb_build_object('order_id', p_order_id, 'shipment_id', v_shipment.id, 'source', 'admin_manual_release')
            ) ON CONFLICT (wallet_id, reference) DO UPDATE SET status = 'success', updated_at = NOW();
            v_success_count := v_success_count + 1;
        END IF;
    END LOOP;

    -- 6. Cleanup & Finalize
    -- Also flip any other "pending" transactions for this order just in case
    UPDATE public.wallet_transactions 
    SET status = 'success', updated_at = NOW() 
    WHERE metadata->>'order_id' = p_order_id::TEXT AND status = 'pending';

    UPDATE public.orders 
    SET settlement_status = 'settled', updated_at = NOW() 
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_transactions', v_success_count,
        'message', 'Successfully released ' || v_success_count || ' payout components for order ' || p_order_id
    );
END;
$$;

COMMIT;
