-- Migration: 20260609_fix_claim_order_mission_no_shipment.sql
-- Root cause: claim_order_mission returns "Mission not found" when the seller
-- broadcasts an order without a pre-existing shipments row. The RPC only
-- queries shipments by id or order_id but never creates the row.
-- Fix: When no shipment row is found but the order IS in 'awaiting_agent' status,
-- auto-create the shipment record inline and then claim it atomically.

CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_shipment   RECORD;
    v_order      RECORD;
    v_order_id   UUID;
    v_seller_id  UUID;
    v_new_id     UUID;
BEGIN
    -- ── Step 1: Try to find the shipment by shipment.id OR shipment.order_id ──
    SELECT s.*, o.seller_id INTO v_shipment
    FROM public.shipments s
    JOIN public.orders o ON o.id = s.order_id
    WHERE (s.id = p_shipment_id OR s.order_id = p_shipment_id)
      AND s.status IN ('broadcast', 'pending')
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- ── Step 2: If found and claimable, claim it immediately ──────────────────
    IF FOUND THEN
        UPDATE public.shipments
        SET
            rider_id   = p_rider_id,
            status     = 'accepted',
            updated_at = NOW()
        WHERE id = v_shipment.id;

        UPDATE public.orders
        SET
            status     = 'shipped',
            updated_at = NOW()
        WHERE id = v_shipment.order_id;

        RETURN jsonb_build_object('success', true, 'message', 'Mission successfully claimed');
    END IF;

    -- ── Step 3: No shipment row found — check if p_shipment_id is an order ID ─
    -- This handles the case where the seller broadcast the order but no
    -- shipments row was created (ShipmentFeedV2 falls back to o.id for the card).
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_shipment_id
      AND status = 'awaiting_agent'
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        -- Maybe p_shipment_id is a real shipment id but the order is reachable
        -- via the shipment's order_id
        SELECT o.* INTO v_order
        FROM public.orders o
        JOIN public.shipments s ON s.order_id = o.id
        WHERE s.id = p_shipment_id
          AND o.status = 'awaiting_agent'
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Mission not found or already taken');
        END IF;
    END IF;

    v_order_id  := v_order.id;
    v_seller_id := v_order.seller_id;

    -- ── Step 4: Auto-create the missing shipment row and claim it atomically ──
    -- Avoid reading optional columns (zone_id, city_id) from v_order — they may
    -- not exist on the live orders table yet. The shipment is created with NULLs
    -- for those geography fields; they can be filled in later.
    INSERT INTO public.shipments (
        order_id,
        seller_id,
        rider_id,
        status,
        pickup_address,
        delivery_address,
        pickup_address_text,
        delivery_address_text,
        created_at,
        updated_at
    )
    VALUES (
        v_order_id,
        v_seller_id,
        p_rider_id,
        'accepted',
        '{}'::JSONB,   -- placeholder; NOT NULL constraint requires a value
        '{}'::JSONB,   -- placeholder; real address stored in _text columns
        NULL,
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (order_id) DO UPDATE
        SET rider_id   = EXCLUDED.rider_id,
            status     = 'accepted',
            updated_at = NOW()
    RETURNING id INTO v_new_id;

    -- ── Step 5: Advance the order status ──────────────────────────────────────
    UPDATE public.orders
    SET
        status     = 'shipped',
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'shipment_id', v_new_id, 'message', 'Mission successfully claimed');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_order_mission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_mission(UUID, UUID) TO service_role;
