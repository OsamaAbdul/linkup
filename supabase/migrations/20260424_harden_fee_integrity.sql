-- MIGRATION: 20260424_harden_fee_integrity.sql
-- TARGET: 
-- 1. Harden shipment fee integrity (Perfect Sum).
-- 2. Fix the Seller-Logistics bug (Seller should not pay platform's logistics cut).
-- 3. Deduplicate wallet transactions (Ghost transaction cleanup).

BEGIN;

-- ==========================================
-- 1. FIX: calculate_precise_fees
-- ==========================================
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(
    p_order_id UUID,
    p_total_amount NUMERIC DEFAULT NULL,
    p_promoter_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_total NUMERIC;
    v_order_promoter_id UUID;
    v_subtotal NUMERIC := 0;
    v_shipment_fees RECORD;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_rider_fee NUMERIC := 0;
    v_platform_commission NUMERIC := 0;
    v_platform_total NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_cross_zone_fee NUMERIC := 0;
    v_shipment_count INTEGER := 0;
    v_logistical_cut NUMERIC := 300;
BEGIN
    IF p_total_amount IS NOT NULL THEN
        v_order_total := p_total_amount;
        v_order_promoter_id := p_promoter_id;
    ELSE
        SELECT total_amount, promoter_id INTO v_order_total, v_order_promoter_id 
        FROM public.orders WHERE id = p_order_id;
    END IF;

    IF v_order_total IS NULL THEN RETURN NULL; END IF;

    SELECT SUM(price_at_purchase * quantity) INTO v_subtotal 
    FROM public.order_items WHERE order_id = p_order_id;
    
    IF v_subtotal IS NULL OR v_subtotal = 0 THEN
        v_subtotal := v_order_total; 
    END IF;

    SELECT 
        SUM(COALESCE(delivery_fee_amount, 0)) as total_delivery,
        SUM(COALESCE(cross_zone_fee_amount, 0)) as total_cross_zone,
        COUNT(*) as shipment_count
    INTO v_shipment_fees FROM public.shipments WHERE order_id = p_order_id;

    v_rider_fee := COALESCE(v_shipment_fees.total_delivery, 0);
    v_cross_zone_fee := COALESCE(v_shipment_fees.total_cross_zone, 0);
    v_shipment_count := COALESCE(v_shipment_fees.shipment_count, 0);

    -- Apply Fee Configs
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_commission := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order_promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_subtotal * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'rider_logistical_cut' THEN
            v_logistical_cut := v_rec.flat_fee;
        END IF;
    END LOOP;

    v_platform_total := v_platform_commission + (v_logistical_cut * GREATEST(1, v_shipment_count));
    v_rider_fee := v_rider_fee - (v_logistical_cut * GREATEST(1, v_shipment_count));
    
    RETURN jsonb_build_object(
        'subtotal', ROUND(v_subtotal, 2),
        'delivery_pool', ROUND(v_order_total - v_subtotal, 2),
        'platform', ROUND(v_platform_total, 2),
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'cross_zone', ROUND(v_cross_zone_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'rider_total', ROUND(GREATEST(0, v_rider_fee) + v_cross_zone_fee, 2),
        'seller', ROUND(v_subtotal - v_platform_commission - v_promoter_fee, 2) -- FIX: Do NOT subtract logistics cut from seller
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==========================================
-- 2. FIX: ensure_shipment_fee_integrity
-- ==========================================
CREATE OR REPLACE FUNCTION public.ensure_shipment_fee_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_default_fee NUMERIC;
    v_shipment_subtotal NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_rider_fee NUMERIC := 0;
    v_logistical_cut NUMERIC := 300;
    v_config RECORD;
    v_parent_order RECORD;
BEGIN
    -- STEP A: Preservation Logic
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.delivery_fee_amount <= 0 AND OLD.delivery_fee_amount > 0) THEN
            NEW.delivery_fee_amount := OLD.delivery_fee_amount;
        END IF;
        IF (NEW.delivery_fee_amount = 1500 AND OLD.delivery_fee_amount > 1500) THEN
            NEW.delivery_fee_amount := OLD.delivery_fee_amount;
        END IF;
    END IF;

    -- STEP B: Zone Integrity
    IF NEW.broadcast_zone IS NULL AND NEW.zone_id IS NOT NULL THEN
        SELECT name INTO NEW.broadcast_zone FROM public.delivery_zones WHERE id = NEW.zone_id;
    END IF;

    -- STEP C: Perfect Sum Logic
    IF (NEW.delivery_fee_amount IS NULL OR NEW.delivery_fee_amount = 0) THEN
        SELECT total_amount INTO v_default_fee FROM public.orders WHERE id = NEW.order_id;
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal FROM public.order_items WHERE order_id = NEW.order_id;
        
        IF (v_default_fee > v_shipment_subtotal) THEN
            NEW.delivery_fee_amount := v_default_fee - v_shipment_subtotal;
        END IF;
    END IF;

    -- STEP D: Breakdown
    SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
    INTO v_shipment_subtotal FROM public.order_items
    WHERE order_id = NEW.order_id AND seller_id = NEW.seller_id;

    SELECT * INTO v_parent_order FROM public.orders WHERE id = NEW.order_id;
    
    FOR v_config IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
        IF v_config.fee_type = 'platform' THEN
            v_platform_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
        ELSIF v_config.fee_type = 'promoter' AND v_parent_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
        ELSIF v_config.fee_type = 'rider_logistical_cut' THEN
            v_logistical_cut := v_config.flat_fee;
        END IF;
    END LOOP;

    v_rider_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - v_logistical_cut;

    NEW.fee_breakdown := jsonb_build_object(
        'subtotal', ROUND(COALESCE(v_shipment_subtotal, 0), 2),
        'delivery_paid', ROUND(COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0), 2),
        'platform', ROUND(v_platform_fee + v_logistical_cut, 2),
        'rider', ROUND(GREATEST(0, v_rider_fee), 2),
        'promoter', ROUND(COALESCE(v_promoter_fee, 0), 2),
        'seller', ROUND(COALESCE(v_shipment_subtotal, 0) - v_platform_fee - v_promoter_fee, 2)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. DEDUPLICATE WALLET TRANSACTIONS
-- ==========================================
DO $$
BEGIN
    -- Merge amounts and metadata from legacy references (Full UUID) into modern ones (Short Code)
    UPDATE public.wallet_transactions target
    SET amount = source.amount,
        metadata = target.metadata || source.metadata
    FROM public.wallet_transactions source
    WHERE target.wallet_id = source.wallet_id
    AND LENGTH(target.reference) < 30 
    AND LENGTH(source.reference) > 30 
    AND RIGHT(source.reference, 6) = RIGHT(target.reference, 6);

    -- Delete the legacy ones that were merged
    DELETE FROM public.wallet_transactions
    WHERE LENGTH(reference) > 30
    AND EXISTS (
        SELECT 1 FROM public.wallet_transactions target
        WHERE target.wallet_id = public.wallet_transactions.wallet_id
        AND LENGTH(target.reference) < 30
        AND RIGHT(public.wallet_transactions.reference, 6) = RIGHT(target.reference, 6)
    );
    
    -- 4. Ensure Promoter Fee is Percentage-Based (As requested)
    INSERT INTO public.fee_config (fee_type, name, rate, flat_fee, is_active, priority)
    VALUES ('promoter', 'Promoter Commission', 0.10, 0.00, TRUE, 50)
    ON CONFLICT (fee_type) DO UPDATE SET 
        rate = EXCLUDED.rate,
        flat_fee = 0.00;
    
    RAISE NOTICE 'Wallet and Transactions have been successfully repaired.';
END $$;

COMMIT;
