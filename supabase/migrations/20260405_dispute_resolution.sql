-- MIGRATION: Dispute Resolution Engine
-- Standardizes the resolution flow for commercial disputes.

CREATE OR REPLACE FUNCTION public.resolve_dispute(
    p_dispute_id UUID,
    p_resolution TEXT, -- 'refund' or 'release'
    p_notes TEXT DEFAULT 'Resolved by Administration'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dispute RECORD;
    v_order RECORD;
    v_success BOOLEAN := FALSE;
    v_error TEXT;
BEGIN
    -- 1. Fetch Dispute & Order Context
    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id FOR UPDATE;
    IF v_dispute IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dispute node not found');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_dispute.order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Linked order registry missing');
    END IF;

    -- 2. Execute Resolution Logic
    IF p_resolution = 'refund' THEN
        -- Call existing refund logic
        PERFORM public.process_refund(v_order.id, p_notes);
        v_success := TRUE;
    
    ELSIF p_resolution = 'release' THEN
        -- Resume settlement flow
        UPDATE public.orders 
        SET 
            status = 'completed',
            settlement_status = 'pending',
            settlement_due_at = NOW() + INTERVAL '48 hours'
        WHERE id = v_order.id;
        v_success := TRUE;
    
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid resolution protocol: ' || p_resolution);
    END IF;

    -- 3. Finalize Dispute Metadata
    IF v_success THEN
        UPDATE public.disputes
        SET 
            status = 'resolved',
            resolution_meta = jsonb_build_object(
                'resolution', p_resolution,
                'notes', p_notes,
                'resolved_at', NOW(),
                'admin_id', auth.uid()
            ),
            updated_at = NOW()
        WHERE id = p_dispute_id;

        RETURN jsonb_build_object('success', true, 'order_id', v_order.id, 'resolution', p_resolution);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Unknown resolution failure');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated (admins will call this)
GRANT EXECUTE ON FUNCTION public.resolve_dispute TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute TO service_role;
