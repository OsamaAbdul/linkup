-- Enable Stale Mission Recovery (1-Hour Inactivity Window)

-- 1. Update RLS Policy for visibility
-- Allows riders to see missions that were accepted but haven't been progressed for 1 hour
DROP POLICY IF EXISTS "Riders can view assigned shipments" ON public.shipments;
CREATE POLICY "Riders can view assigned shipments" 
ON public.shipments FOR SELECT 
TO authenticated 
USING (
    rider_id = auth.uid() 
    OR status = 'broadcast' 
    OR (status = 'accepted' AND updated_at < NOW() - INTERVAL '1 hour')
);

-- 2. Update claim_order_mission RPC to allow re-claiming stale missions
CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_shipment RECORD;
    v_old_rider_id UUID;
    v_order_id UUID;
BEGIN
    -- 1. Get current shipment state
    SELECT * INTO v_shipment 
    FROM public.shipments 
    WHERE id = p_shipment_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
    END IF;

    -- 2. Check if claimable (either 'broadcast' OR stale 'accepted')
    IF v_shipment.status != 'broadcast' AND 
       NOT (v_shipment.status = 'accepted' AND v_shipment.updated_at < NOW() - INTERVAL '1 hour') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is already taken and active');
    END IF;

    -- 3. Capture old rider if it's a takeover
    v_old_rider_id := v_shipment.rider_id;
    v_order_id := v_shipment.order_id;

    -- 4. Assign to new rider
    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_shipment_id;

    -- 5. Notify old rider if it was a takeover
    IF v_old_rider_id IS NOT NULL AND v_old_rider_id != p_rider_id THEN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            v_old_rider_id,
            'mission_reclaimed',
            'Your mission for Order #' || UPPER(RIGHT(v_order_id::TEXT, 6)) || ' was returned to the pool due to inactivity and claimed by another agent.'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Mission successfully claimed', 
        'order_id', v_order_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
