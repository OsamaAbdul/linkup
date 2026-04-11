-- MIGRATION: 20260405_logistics_incentives.sql
-- Implements professional Rider Incentives: Out-of-Zone Bonus and Distance Surcharge.

-- 1. Enrich Shipments Schema for tracking
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_breakdown JSONB DEFAULT '{}'::JSONB;

-- 2. Relax fee_config constraints to accommodate new professional incentive types
ALTER TABLE public.fee_config DROP CONSTRAINT IF EXISTS fee_config_fee_type_check;
ALTER TABLE public.fee_config ADD CONSTRAINT fee_config_fee_type_check 
CHECK (fee_type IN ('platform', 'rider', 'promoter', 'rider_out_of_zone', 'rider_distance'));

-- Ensure name is unique for conflict resolution
ALTER TABLE public.fee_config DROP CONSTRAINT IF EXISTS fee_config_name_key;
ALTER TABLE public.fee_config ADD CONSTRAINT fee_config_name_key UNIQUE (name);

-- 3. Seed/Ensure Fee Configuration for Incentives
INSERT INTO public.fee_config (name, fee_type, rate, flat_fee, priority, is_active)
VALUES 
('Out-of-Zone Bonus', 'rider_out_of_zone', 0, 500, 10, true),
('Long Distance Surcharge', 'rider_distance', 0, 100, 10, true)
ON CONFLICT (name) DO UPDATE 
SET is_active = EXCLUDED.is_active,
    flat_fee = EXCLUDED.flat_fee;

-- 3. Update claim_order_mission RPC to calculate incentives
CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shipment RECORD;
    v_rider RECORD;
    v_base_fee NUMERIC;
    v_zone_bonus NUMERIC := 0;
    v_dist_surcharge NUMERIC := 0;
    v_distance NUMERIC := 0;
    v_total_fee NUMERIC := 0;
    v_config RECORD;
    v_breakdown JSONB;
BEGIN
    -- Lock the row to prevent concurrent claims
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id
    FOR UPDATE;

    -- Validate shipment exists
    IF v_shipment IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
    END IF;

    -- Prevent double-claim
    IF v_shipment.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission already claimed by another agent');
    END IF;

    -- Validate status is still broadcast
    IF v_shipment.status::TEXT != 'broadcast' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is no longer available');
    END IF;

    -- Verify the rider's KYC status is 'verified'
    IF NOT EXISTS (
        SELECT 1 FROM public.logistics_kyc
        WHERE user_id = p_rider_id AND status = 'verified'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your KYC must be verified by an admin before you can claim missions');
    END IF;

    -- Get Rider Profile (Zone & Location)
    SELECT * INTO v_rider FROM public.profiles WHERE id = p_rider_id;

    -- --- INCENTIVE CALCULATION ---
    v_base_fee := COALESCE(v_shipment.delivery_fee_amount, 0);
    
    -- 1. Calculate Distance
    IF v_shipment.pickup_latitude IS NOT NULL AND v_shipment.buyer_latitude IS NOT NULL THEN
        v_distance := public.calculate_distance(
            v_shipment.pickup_latitude::NUMERIC, v_shipment.pickup_longitude::NUMERIC,
            v_shipment.buyer_latitude::NUMERIC, v_shipment.buyer_longitude::NUMERIC
        );
    END IF;

    -- 2. Fetch Configs
    FOR v_config IN (SELECT fee_type, flat_fee FROM public.fee_config WHERE is_active = true) LOOP
        IF v_config.fee_type = 'rider_out_of_zone' THEN
            -- Apply bonus if rider's zone != shipment broadcast zone
            IF v_rider.zone::TEXT IS DISTINCT FROM v_shipment.broadcast_zone::TEXT THEN
                v_zone_bonus := v_config.flat_fee;
            END IF;
        ELSIF v_config.fee_type = 'rider_distance' THEN
            -- Apply surcharge for distance > 5km
            IF v_distance > 5 THEN
                v_dist_surcharge := (v_distance - 5) * v_config.flat_fee;
            END IF;
        END IF;
    END LOOP;

    v_total_fee := v_base_fee + v_zone_bonus + v_dist_surcharge;
    v_breakdown := jsonb_build_object(
        'base_fee', v_base_fee,
        'zone_bonus', v_zone_bonus,
        'distance_surcharge', ROUND(v_dist_surcharge, 2),
        'distance_km', ROUND(v_distance, 2)
    );

    -- Atomically assign the rider and update fee
    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        status = 'accepted',
        delivery_fee_amount = v_total_fee,
        bonus_amount = (v_zone_bonus + v_dist_surcharge),
        fee_breakdown = v_breakdown,
        updated_at = NOW()
    WHERE id = p_shipment_id;

    -- Sync order status to accepted
    UPDATE public.orders
    SET 
        status = 'accepted',
        updated_at = NOW()
    WHERE id = v_shipment.order_id;

    RETURN jsonb_build_object(
        'success', true,
        'shipment_id', p_shipment_id,
        'order_id', v_shipment.order_id,
        'total_fee', v_total_fee,
        'breakdown', v_breakdown
    );
END;
$$;
