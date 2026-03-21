-- STEP 2 OF 2: Run this AFTER 20260303_zone_broadcast_enum.sql has been committed.
-- MIGRATION: 20260303_zone_broadcast_claim.sql
-- Implements Zone-Based Order Broadcasting with First-Claim Atomic Locking.

-- ============================================================
-- 1. Ensure rider_id nullable on shipments (broadcast orders have no rider yet)
-- ============================================================
ALTER TABLE public.shipments 
    ALTER COLUMN rider_id DROP NOT NULL;

-- ============================================================
-- 2. ATOMIC CLAIM RPC - Race-safe first-claim via row lock
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

    -- NEW: Verify the rider's KYC status is 'verified'
    IF NOT EXISTS (
        SELECT 1 FROM public.logistics_kyc
        WHERE user_id = p_rider_id AND status = 'verified'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your KYC must be verified by an admin before you can claim missions');
    END IF;

    -- Verify the rider is in the correct zone
    SELECT zone::TEXT INTO v_rider_zone
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
        'order_id', v_shipment.order_id
    );
END;
$$;

COMMENT ON FUNCTION public.claim_order_mission IS 'Atomically claims a broadcast shipment for the first eligible rider — race-safe via row lock';

-- ============================================================
-- 3. RLS: Agents can see unassigned broadcast shipments in their zone
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
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
            AND lk.status = 'verified'
        )
    )
    OR
    -- Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Agents can update their own shipments OR claim broadcast ones
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (
    rider_id = auth.uid()
    OR
    (
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND p.zone::TEXT = shipments.zone::TEXT
            AND lk.status = 'verified'
        )
    )
);
