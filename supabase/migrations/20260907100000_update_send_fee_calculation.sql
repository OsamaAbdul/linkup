-- ========================================================================
-- INDUSTRY-STANDARD BOUNDED ROAD DISTANCE VERIFICATION FOR SEND DELIVERY
-- ========================================================================

-- Drop previous overloaded signatures to avoid any parameter ambiguity
DROP FUNCTION IF EXISTS public.calculate_send_delivery_fee(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS public.calculate_send_delivery_fee(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC);

CREATE OR REPLACE FUNCTION public.calculate_send_delivery_fee(
    p_pickup_lat NUMERIC,
    p_pickup_lng NUMERIC,
    p_dropoff_lat NUMERIC,
    p_dropoff_lng NUMERIC,
    p_weight_kg NUMERIC DEFAULT 1.0,
    p_is_fragile BOOLEAN DEFAULT false,
    p_distance_km NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_fee NUMERIC := 500;
    v_per_km_rate NUMERIC := 100;
    v_pkg_surcharge NUMERIC := 0;
    v_service_fee NUMERIC := 200;
    v_fragile_fee NUMERIC := 0;
    v_haversine_km NUMERIC := 0;
    v_distance_km NUMERIC := 0;
    v_distance_fee NUMERIC := 0;
    v_total_fee NUMERIC := 0;
    v_rider_rate NUMERIC := 0.80;
    v_rider_min NUMERIC := 1000;
    v_rider_earnings NUMERIC := 0;
    v_min_allowed NUMERIC;
    v_max_allowed NUMERIC;
    v_is_verified_road BOOLEAN := false;

    v_rec RECORD;
    v_dlat NUMERIC;
    v_dlon NUMERIC;
    v_lat1 NUMERIC;
    v_lat2 NUMERIC;
    v_a NUMERIC;
    v_c NUMERIC;
BEGIN
    -- 1. Calculate Haversine Straight-Line Distance as Mathematical Baseline
    IF p_pickup_lat IS NOT NULL AND p_pickup_lng IS NOT NULL AND p_dropoff_lat IS NOT NULL AND p_dropoff_lng IS NOT NULL THEN
        IF p_pickup_lat = p_dropoff_lat AND p_pickup_lng = p_dropoff_lng THEN
            v_haversine_km := 1.0;
        ELSE
            v_lat1 := radians(p_pickup_lat);
            v_lat2 := radians(p_dropoff_lat);
            v_dlat := radians(p_dropoff_lat - p_pickup_lat);
            v_dlon := radians(p_dropoff_lng - p_pickup_lng);
            v_a := sin(v_dlat / 2)^2 + cos(v_lat1) * cos(v_lat2) * sin(v_dlon / 2)^2;
            v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
            v_haversine_km := round((6371 * v_c)::numeric, 1);
            IF v_haversine_km < 1.0 THEN
                v_haversine_km := 1.0;
            END IF;
        END IF;
    ELSE
        v_haversine_km := 5.0;
    END IF;

    -- 2. Validate Road Distance against Plausible Physical Bounds (Tortuosity Guard)
    -- Road distance can never be physically less than straight line distance (minus 5% margin for GPS drift)
    -- and rarely exceeds 2.5x the straight line distance.
    IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
        v_min_allowed := round(v_haversine_km * 0.95, 1);
        v_max_allowed := GREATEST(10.0, round(v_haversine_km * 2.5, 1));

        IF p_distance_km >= v_min_allowed AND p_distance_km <= v_max_allowed THEN
            v_distance_km := round(p_distance_km::numeric, 1);
            v_is_verified_road := true;
        ELSE
            -- Client value failed plausibility checks (possible tampering or bad GPS), fall back to safe tortuosity estimate
            v_distance_km := GREATEST(1.0, round((v_haversine_km * 1.35)::numeric, 1));
            v_is_verified_road := false;
        END IF;
    ELSE
        -- No client road distance provided; use standard road factor
        v_distance_km := GREATEST(1.0, round((v_haversine_km * 1.35)::numeric, 1));
        v_is_verified_road := false;
    END IF;

    -- 3. Fetch live fee configurations from public.fee_config (fallback to defaults if inactive)
    FOR v_rec IN 
        SELECT fee_type, flat_fee, is_active 
        FROM public.fee_config 
        WHERE fee_type IN (
            'send_base_fee', 
            'send_per_km_rate', 
            'send_pkg_small_surcharge', 
            'send_pkg_medium_surcharge', 
            'send_pkg_large_surcharge', 
            'send_pkg_xlarge_surcharge', 
            'send_service_fee', 
            'send_fragile_surcharge'
        ) AND is_active = true
    LOOP
        CASE v_rec.fee_type
            WHEN 'send_base_fee' THEN
                v_base_fee := COALESCE(v_rec.flat_fee, 500);
            WHEN 'send_per_km_rate' THEN
                v_per_km_rate := COALESCE(v_rec.flat_fee, 100);
            WHEN 'send_service_fee' THEN
                v_service_fee := COALESCE(v_rec.flat_fee, 200);
            WHEN 'send_fragile_surcharge' THEN
                IF p_is_fragile THEN
                    v_fragile_fee := COALESCE(v_rec.flat_fee, 300);
                END IF;
            ELSE
                -- handled below by weight bracket
        END CASE;
    END LOOP;

    -- 4. Determine Package Surcharge based on weight bracket
    IF p_weight_kg <= 2.0 THEN
        SELECT COALESCE(flat_fee, 0) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_small_surcharge' AND is_active = true;
    ELSIF p_weight_kg <= 5.0 THEN
        SELECT COALESCE(flat_fee, 200) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_medium_surcharge' AND is_active = true;
    ELSIF p_weight_kg <= 10.0 THEN
        SELECT COALESCE(flat_fee, 500) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_large_surcharge' AND is_active = true;
    ELSE
        SELECT COALESCE(flat_fee, 1000) INTO v_pkg_surcharge 
        FROM public.fee_config 
        WHERE fee_type = 'send_pkg_xlarge_surcharge' AND is_active = true;
    END IF;

    IF v_pkg_surcharge IS NULL THEN
        IF p_weight_kg <= 2.0 THEN v_pkg_surcharge := 0;
        ELSIF p_weight_kg <= 5.0 THEN v_pkg_surcharge := 200;
        ELSIF p_weight_kg <= 10.0 THEN v_pkg_surcharge := 500;
        ELSE v_pkg_surcharge := 1000;
        END IF;
    END IF;

    -- 5. Calculate Distance Fee
    v_distance_fee := round(v_distance_km * v_per_km_rate);

    -- 6. Total Delivery Fee = Base fee + Distance fee + Package surcharge + Service fee + Fragile fee
    v_total_fee := v_base_fee + v_distance_fee + v_pkg_surcharge + v_service_fee + v_fragile_fee;

    -- 7. Calculate Rider Earnings & Platform Commission
    SELECT COALESCE(rate, 0.80) INTO v_rider_rate 
    FROM public.fee_config 
    WHERE fee_type = 'send_rider_payout_rate' AND is_active = true;
    IF v_rider_rate IS NULL OR v_rider_rate <= 0 THEN v_rider_rate := 0.80; END IF;

    SELECT COALESCE(flat_fee, 1000) INTO v_rider_min 
    FROM public.fee_config 
    WHERE fee_type = 'send_rider_min_payout' AND is_active = true;
    IF v_rider_min IS NULL THEN v_rider_min := 1000; END IF;

    v_rider_earnings := GREATEST(v_rider_min, round(v_total_fee * v_rider_rate));

    RETURN jsonb_build_object(
        'base_fee', v_base_fee,
        'per_km_rate', v_per_km_rate,
        'distance_km', v_distance_km,
        'haversine_km', v_haversine_km,
        'is_verified_road', v_is_verified_road,
        'distance_fee', v_distance_fee,
        'package_surcharge', v_pkg_surcharge,
        'service_fee', v_service_fee,
        'fragile_surcharge', v_fragile_fee,
        'total_fee', v_total_fee,
        'rider_earnings', v_rider_earnings,
        'platform_fee', GREATEST(0, v_total_fee - v_rider_earnings),
        'currency', 'NGN'
    );
END;
$$;
