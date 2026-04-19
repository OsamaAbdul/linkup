-- MIGRATION: 20260419_logistics_fee_integrity.sql
-- TARGET: Protect dynamic delivery fees and metadata from being overwritten or left NULL.

BEGIN;

-- 1. Create a function to ensure fee integrity
CREATE OR REPLACE FUNCTION public.ensure_shipment_fee_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_default_fee NUMERIC;
    v_cross_zone_surcharge NUMERIC := 0;
    v_seller_zone_id UUID;
    v_buyer_zone_id UUID;
    v_shipment_subtotal NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
    v_rider_fee NUMERIC := 0;
    v_config RECORD;
    v_parent_order RECORD;
BEGIN
    -- STEP A: Preservation Logic
    -- If this is an UPDATE and the NEW fee is 0 BUT the OLD fee was > 0, keep the OLD fee.
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.delivery_fee_amount <= 0 AND OLD.delivery_fee_amount > 0) THEN
            NEW.delivery_fee_amount := OLD.delivery_fee_amount;
        END IF;
        
        IF (NEW.cross_zone_fee_amount <= 0 AND OLD.cross_zone_fee_amount > 0) THEN
            NEW.cross_zone_fee_amount := OLD.cross_zone_fee_amount;
        END IF;
    END IF;

    -- STEP B: Zone & Metadata Integrity
    -- If broadcast_zone is missing, pull it from delivery_zones via zone_id
    IF NEW.broadcast_zone IS NULL AND NEW.zone_id IS NOT NULL THEN
        SELECT name INTO NEW.broadcast_zone FROM public.delivery_zones WHERE id = NEW.zone_id;
    END IF;
    
    -- Ensure bonus_amount is never NULL
    IF NEW.bonus_amount IS NULL THEN
        NEW.bonus_amount := 0;
    END IF;

    -- STEP C/D: Inheritance Logic (High-Fidelity)
    -- If we still have no fee, pull the actual portion from the parent order's total.
    IF (NEW.delivery_fee_amount IS NULL OR NEW.delivery_fee_amount = 0) THEN
        -- Get the order total and the sum of all its items
        SELECT total_amount INTO v_default_fee FROM public.orders WHERE id = NEW.order_id;
        
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal
        FROM public.order_items WHERE order_id = NEW.order_id;
        
        -- The logistics portion is the remainder of the total paid
        NEW.delivery_fee_amount := COALESCE(v_default_fee, 0) - COALESCE(v_shipment_subtotal, 0);
        NEW.cross_zone_fee_amount := 0; -- Combined into delivery_fee_amount for the Perfect Sum
    END IF;

    -- STEP E: Global Fee Breakdown Calculation (The "Perfect Sum" Model)
    IF (NEW.fee_breakdown IS NULL OR NEW.fee_breakdown = '{}'::JSONB OR (NEW.fee_breakdown->>'seller' ~ '[A-Za-z]')) THEN
        -- 1. Calculate the sub-total for THIS seller (in case of future multi-seller split)
        SELECT SUM(COALESCE(price_at_purchase, 0) * COALESCE(quantity, 1))
        INTO v_shipment_subtotal
        FROM public.order_items
        WHERE order_id = NEW.order_id AND seller_id = NEW.seller_id;

        -- 2. Fetch Order basics
        -- Some systems use total, some total_amount. We prioritize total_amount if available.
        SELECT * INTO v_parent_order FROM public.orders WHERE id = NEW.order_id;
        
        -- 3. Calculate Platform Commission (Seller's Responsibility)
        FOR v_config IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) LOOP
            IF v_config.fee_type = 'platform' THEN
                v_platform_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
            ELSIF v_config.fee_type = 'promoter' AND v_parent_order.promoter_id IS NOT NULL THEN
                v_promoter_fee := (COALESCE(v_shipment_subtotal, 0) * v_config.rate) + v_config.flat_fee;
            END IF;
        END LOOP;

        -- 4. Calculate Net Portions
        -- Seller pays Commission (v_platform_fee)
        -- Rider pays Logistical Cut (300)
        v_rider_fee := (COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0)) - 300;

        NEW.fee_breakdown := jsonb_build_object(
            'subtotal', ROUND(COALESCE(v_shipment_subtotal, 0), 2),
            'delivery_paid', ROUND(COALESCE(NEW.delivery_fee_amount, 0) + COALESCE(NEW.cross_zone_fee_amount, 0), 2),
            'platform', ROUND(COALESCE(v_platform_fee, 0) + 300, 2), -- Combined earnings
            'rider', ROUND(GREATEST(0, v_rider_fee), 2),
            'promoter', ROUND(COALESCE(v_promoter_fee, 0), 2),
            'seller', ROUND(COALESCE(v_shipment_subtotal, 0) - v_platform_fee - v_promoter_fee, 2)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger
DROP TRIGGER IF EXISTS trg_ensure_shipment_fee_integrity ON public.shipments;
CREATE TRIGGER trg_ensure_shipment_fee_integrity
BEFORE INSERT OR UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_shipment_fee_integrity();

COMMIT;
