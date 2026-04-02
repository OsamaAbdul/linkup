-- MIGRATION: 20260402_stale_mission_rebroadcast.sql
-- Implements 1-hour timeout for claimed missions to be re-opened for other agents.

-- ============================================================
-- 1. UPDATE ATOMIC CLAIM RPC
-- ============================================================
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
    v_rider_zone TEXT;
    v_is_stale BOOLEAN;
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

    -- Check if mission is stale (claimed but no progress for > 1 hour)
    v_is_stale := (v_shipment.status::TEXT = 'accepted' AND v_shipment.updated_at < NOW() - INTERVAL '1 hour');

    -- Prevent double-claim UNLESS it is stale
    IF v_shipment.rider_id IS NOT NULL AND NOT v_is_stale THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission already claimed by another agent');
    END IF;

    -- Validate status is either 'broadcast' OR it's a stale 'accepted' mission
    IF v_shipment.status::TEXT != 'broadcast' AND NOT v_is_stale THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is no longer available');
    END IF;

    -- Verify the rider's KYC status is 'verified'
    IF NOT EXISTS (
        SELECT 1 FROM public.logistics_kyc
        WHERE user_id = p_rider_id AND status = 'verified'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your KYC must be verified by an admin before you can claim missions');
    END IF;

    -- Verify the rider is in the correct zone
    SELECT "zone"::TEXT INTO v_rider_zone
    FROM public.profiles
    WHERE id = p_rider_id;

    IF v_rider_zone IS DISTINCT FROM v_shipment.zone::TEXT THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not in the required zone for this mission');
    END IF;

    -- Atomically assign the rider and change status
    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        status = 'accepted',
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
        'reclaimed', v_is_stale
    );
END;
$$;

-- ============================================================
-- 2. UPDATE RLS: Agents can view stale missions as available
-- ============================================================
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;

CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
    -- Agent sees their own assigned shipments
    rider_id = auth.uid()
    OR
    -- Agent sees unassigned/broadcast orders in their zone
    (
        (rider_id IS NULL AND status::TEXT = 'broadcast')
        OR
        (status::TEXT = 'accepted' AND updated_at < NOW() - INTERVAL '1 hour')
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'logistics'
        AND p.zone::TEXT = shipments.zone::TEXT
        AND lk.status = 'verified'
    )
    OR
    -- Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Note: The UPDATE policy should also be updated or checked
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (
    rider_id = auth.uid()
    OR
    (
        (rider_id IS NULL AND status::TEXT = 'broadcast')
        OR
        (status::TEXT = 'accepted' AND updated_at < NOW() - INTERVAL '1 hour')
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'logistics'
        AND p.zone::TEXT = shipments.zone::TEXT
        AND lk.status = 'verified'
    )
);
