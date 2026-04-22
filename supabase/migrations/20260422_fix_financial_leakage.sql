-- MIGRATION: 20260422_fix_financial_leakage.sql
-- TARGET: Fix Cross-Zone Fee dropping and ensure "Perfect Sum" integrity.

BEGIN;

-- 1. Fix Shipment Fee Integrity Logic
CREATE OR REPLACE FUNCTION public.ensure_shipment_fee_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_default_fee NUMERIC;
    v_shipment_subtotal NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_rider_fee NUMERIC := 0;
    v_logistical_cut NUMERIC := 0;
    v_config RECORD;
    v_parent_order RECORD;
BEGIN
    -- STEP A: Preservation Logic
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.delivery_fee_amount <= 0 AND OLD.delivery_fee_amount > 0) THEN
            NEW.delivery_fee_amount := OLD.delivery_fee_amount;
        END IF;
        
        IF (NEW.cross_zone_fee_amount <= 0 AND OLD.cross_zone_fee_amount > 0) THEN
            NEW.cross_zone_fee_amount := OLD.cross_zone_fee_amount;
        END IF;
    END IF;

    -- STEP B: Zone & Metadata Integrity
    IF NEW.broadcast_zone IS NULL AND NEW.zone_id IS NOT NULL THEN
        SELECT name INTO NEW.broadcast_zone FROM public.delivery_zones WHERE id = NEW.zone_id;
    END IF;
    
    IF NEW.bonus_amount IS NULL THEN
        NEW.bonus_amount := 0;
    END IF;

    -- STEP C/D: Inheritance Logic (High-Fidelity)
    -- If delivery_fee is missing, we pull the "Logistics Pool" from the parent order
    IF (NEW.delivery_fee_amount IS NULL OR NEW.delivery_fee_amount = 0) THEN
        SELECT total_amount INTO v_default_fee FROM public.orders WHERE id = NEW.order_id;
        
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal
        FROM public.order_items WHERE order_id = NEW.order_id;
        
        -- The logistics portion is the remainder of the total paid (Delivery + Cross Zone)
        NEW.delivery_fee_amount := COALESCE(v_default_fee, 0) - COALESCE(v_shipment_subtotal, 0);
        
        -- IMPORTANT: If we pull the remainder, it already includes any Cross-Zone surcharge paid.
        -- We do NOT zero out cross_zone_fee_amount here if it was already set.
    END IF;

    -- STEP E: Global Fee Breakdown Calculation (Source of Truth)
    -- We RE-CALCULATE this for every insert/update to ensure it never drifts.
    SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
    INTO v_shipment_subtotal
    FROM public.order_items
    WHERE order_id = NEW.order_id AND seller_id = NEW.seller_id;

    SELECT * INTO v_parent_order FROM public.orders WHERE id = NEW.order_id;
    
    -- Fetch Configs
    FOR v_config IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_config.fee_type = 'platform' THEN
            v_platform_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
        ELSIF v_config.fee_type = 'promoter' AND v_parent_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
        ELSIF v_config.fee_type = 'rider_logistical_cut' THEN
            v_logistical_cut := v_config.flat_fee;
        END IF;
    END LOOP;

    IF v_logistical_cut = 0 THEN v_logistical_cut := 300; END IF;

    -- Calculate Net Portions using BOTH delivery and cross-zone fees
    v_rider_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - v_logistical_cut;

    NEW.fee_breakdown := jsonb_build_object(
        'subtotal', ROUND(COALESCE(v_shipment_subtotal, 0), 2),
        'delivery_paid', ROUND(COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0), 2),
        'platform', ROUND(COALESCE(v_platform_fee, 0) + v_logistical_cut, 2), -- Combined earnings (Commission + 300 cut)
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'promoter', ROUND(COALESCE(v_promoter_fee, 0), 2),
        'seller', ROUND(COALESCE(v_shipment_subtotal, 0) - v_platform_fee - v_promoter_fee, 2)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
