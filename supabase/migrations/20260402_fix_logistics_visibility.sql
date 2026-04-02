-- Fix: Logistics Visibility RLS Refinement
-- Ensures that parentheses are crystal clear and zone check is always applied to broadcast/stale missions.

DROP POLICY IF EXISTS "Logistics can view shipments in their zone" ON public.shipments;

CREATE POLICY "Logistics can view shipments in their zone"
ON public.shipments FOR SELECT
USING (
    -- 1. Agent sees their own assigned shipments (regardless of zone/kyc, though they should ideally match)
    rider_id = auth.uid()
    OR
    -- 2. Agent sees available missions (Broadcast OR Stale Accepted)
    (
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
    )
    OR
    -- 3. Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Ensure Update policy matches for claiming
DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.shipments;

CREATE POLICY "Riders can update their assigned shipments"
ON public.shipments FOR UPDATE
USING (
    rider_id = auth.uid()
    OR
    (
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
    )
);
