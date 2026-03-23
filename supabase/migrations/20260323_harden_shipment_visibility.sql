-- MIGRATION: 20260323_harden_shipment_visibility.sql
-- Hardens mission visibility by making RLS policies more resilient to string mismatches.

-- 1. Ensure the RLS policy for shipments handles both zone_id (robust) and zone (legacy/fallback).
DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;

CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
    -- Case A: Agent sees their own assigned shipments
    rider_id = auth.uid()
    OR
    -- Case B: Agent sees unassigned/broadcast orders in their zone
    (
        rider_id IS NULL
        AND status::TEXT = 'broadcast'
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.profiles p ON ur.user_id = p.id
            JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'logistics'
            AND lk.status = 'verified'
            AND (
                -- Robust Match: Zone IDs match
                (p.zone_id IS NOT NULL AND shipments.zone_id IS NOT NULL AND p.zone_id = shipments.zone_id)
                OR
                -- Fallback Match: Zone Names match (case-insensitive and trimmed)
                (TRIM(LOWER(p.zone)) = TRIM(LOWER(shipments.zone)))
            )
        )
    )
    OR
    -- Case C: Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. Update the UPDATE policy to match the SELECT policy logic for claiming
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
            AND lk.status = 'verified'
            AND (
                (p.zone_id IS NOT NULL AND shipments.zone_id IS NOT NULL AND p.zone_id = shipments.zone_id)
                OR
                (TRIM(LOWER(p.zone)) = TRIM(LOWER(shipments.zone)))
            )
        )
    )
);

-- 3. Add performance indexes for zone-based lookups
CREATE INDEX IF NOT EXISTS idx_shipments_zone_id ON public.shipments(zone_id);
CREATE INDEX IF NOT EXISTS idx_profiles_zone_id ON public.profiles(zone_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
