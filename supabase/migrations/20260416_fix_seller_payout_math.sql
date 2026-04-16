-- FIX: Correct Seller Payout Calculation in Revenue Engine
-- Ensures Rider Fees and Cross-Zone Fees are deducted from the seller's total.

-- 1. Redefine calculate_precise_fees with the corrected subtraction logic
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
    -- Get order basics
    SELECT total, promoter_id, items INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- Get shipment-specific fees and count from all shipments tied to this order
    SELECT 
        SUM(COALESCE(delivery_fee_amount, 0)) as total_delivery,
        SUM(COALESCE(cross_zone_fee_amount, 0)) as total_cross_zone,
        COUNT(*) as shipment_count
    INTO v_shipment_fees 
    FROM public.shipments 
    WHERE order_id = p_order_id;

    v_rider_fee := COALESCE(v_shipment_fees.total_delivery, 0);
    v_cross_zone_fee := COALESCE(v_shipment_fees.total_cross_zone, 0);
    v_shipment_count := COALESCE(v_shipment_fees.shipment_count, 0);

    -- Fetch Configured Rates for Platform and Promoter
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) 
    LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        END IF;
    END LOOP;

    -- Apply 300 NGN Platform Fee Deduction per Shipment (from Rider back to Platform)
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
        -- FIXED: Subtract rider fees from the seller payout
        'seller', ROUND(v_order.total - v_platform_fee - v_promoter_fee - GREATEST(0, v_rider_fee) - v_cross_zone_fee, 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. REPAIR: Recalculate any PENDING ledger entries that were affected by the bug
-- This ensures the audit trail is accurate before the 48h settlement occurs.
DO $$
DECLARE
    v_entry RECORD;
    v_precise JSONB;
BEGIN
    FOR v_entry IN (SELECT id, order_id FROM public.revenue_ledgers WHERE status = 'pending') LOOP
        v_precise := public.calculate_precise_fees(v_entry.order_id);
        
        UPDATE public.revenue_ledgers 
        SET 
            platform_fee = (v_precise->>'platform')::NUMERIC,
            rider_fee = (v_precise->>'rider')::NUMERIC,
            promoter_commission = (v_precise->>'promoter')::NUMERIC,
            seller_payout = (v_precise->>'seller')::NUMERIC
        WHERE id = v_entry.id;
    END LOOP;
END;
$$;
