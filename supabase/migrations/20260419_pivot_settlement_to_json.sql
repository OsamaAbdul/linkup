-- MIGRATION: 20260419_pivot_settlement_to_json.sql
-- TARGET: Pivot the entire financial system to use shipments.fee_breakdown JSON.

BEGIN;

-- 1. Refactor calculate_precise_fees to be an aggregator
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_fees JSONB;
    v_total_platform NUMERIC := 0;
    v_total_rider NUMERIC := 0;
    v_total_promoter NUMERIC := 0;
    v_total_seller NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_shipment RECORD;
BEGIN
    -- Aggregate from all shipments associated with this order
    FOR v_shipment IN (SELECT fee_breakdown FROM public.shipments WHERE order_id = p_order_id) LOOP
        v_total_platform := v_total_platform + COALESCE((v_shipment.fee_breakdown->>'platform')::NUMERIC, 0);
        v_total_rider    := v_total_rider    + COALESCE((v_shipment.fee_breakdown->>'rider')::NUMERIC, 0);
        v_total_promoter := v_total_promoter + COALESCE((v_shipment.fee_breakdown->>'promoter')::NUMERIC, 0);
        v_total_seller   := v_total_seller   + COALESCE((v_shipment.fee_breakdown->>'seller')::NUMERIC, 0);
    END LOOP;

    -- Return the unified order-level breakdown
    RETURN jsonb_build_object(
        'platform', ROUND(v_total_platform, 2),
        'rider', ROUND(v_total_rider, 2),
        'promoter', ROUND(v_total_promoter, 2),
        'seller', ROUND(v_total_seller, 2),
        'is_aggregated', true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Update Shipment Payout Trigger to use the JSON source
CREATE OR REPLACE FUNCTION public.handle_shipment_delivered_payout()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_wallet_id UUID;
    v_rider_take_home NUMERIC;
    v_platform_earnings NUMERIC;
BEGIN
    -- Pull directly from the breakdown source of truth
    v_rider_take_home := (NEW.fee_breakdown->>'rider')::NUMERIC;
    v_platform_earnings := (NEW.fee_breakdown->>'platform')::NUMERIC;
    
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id;
        
        IF v_rider_wallet_id IS NOT NULL AND v_rider_take_home > 0 THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata) 
            VALUES (v_rider_wallet_id, v_rider_take_home, 'delivery_fee', 
                    'Delivery: Order #' || UPPER(RIGHT(NEW.order_id::TEXT, 6)), 'pending',
                    jsonb_build_object(
                      'order_id', NEW.order_id, 
                      'shipment_id', NEW.id, 
                      'is_instant_recognition', true,
                      'source', 'fee_breakdown_json'
                    ))
            ON CONFLICT (wallet_id, reference) DO NOTHING;

            -- Snapshot for audit (Full platform capture: Commission + Logistical Fee)
            INSERT INTO public.revenue_ledgers (order_id, total_order_amount, rider_fee, platform_fee, status) 
            VALUES (NEW.order_id, 0, v_rider_take_home, COALESCE(v_platform_earnings, 300), 'pending')
            ON CONFLICT (order_id) DO UPDATE SET
                rider_fee = public.revenue_ledgers.rider_fee + EXCLUDED.rider_fee,
                platform_fee = public.revenue_ledgers.platform_fee + EXCLUDED.platform_fee;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
