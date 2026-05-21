-- Migration: 20260521_fix_claim_order_mission.sql
-- Fixes claim_order_mission to allow p_shipment_id to be either the shipment ID or the order ID.
-- This handles cases where RLS on shipments hides the shipment record, leading the client to fall back to the order ID.

CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_shipment RECORD;
    v_order_id UUID;
    v_seller_id UUID;
BEGIN
    -- Query shipments matching either by shipment ID or by order ID
    SELECT s.*, o.seller_id INTO v_shipment 
    FROM public.shipments s
    JOIN public.orders o ON o.id = s.order_id
    WHERE s.id = p_shipment_id OR s.order_id = p_shipment_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
    END IF;

    IF v_shipment.status::text NOT IN ('broadcast', 'pending') AND 
       NOT (v_shipment.status::text IN ('accepted', 'assigned') AND v_shipment.updated_at < NOW() - INTERVAL '1 hour') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is already taken');
    END IF;

    v_order_id := v_shipment.order_id;
    v_seller_id := v_shipment.seller_id;

    -- Update shipments table using the resolved shipment ID
    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        seller_id = v_seller_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE id = v_shipment.id;

    -- Update orders table using the resolved order ID
    UPDATE public.orders
    SET 
        status = 'shipped',
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Mission successfully claimed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
