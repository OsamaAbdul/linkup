-- MIGRATION: 20260419_idempotent_order_finalization.sql
-- IMPROVEMENT: Makes the order completion RPC idempotent and more robust.
-- This ensures that accidental double-clicks or UI desyncs don't result in scary error messages.

CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- 1. Load the order with a lock
    SELECT * INTO v_order 
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    -- 2. Authorization Check
    IF v_order IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found in our neural network.'
        );
    END IF;

    IF v_order.buyer_id != auth.uid() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: You are not the initiator of this transaction.'
        );
    END IF;

    -- 3. Idempotency Check: Already completed
    IF v_order.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Order was already finalized successfully.',
            'order_id', p_order_id
        );
    END IF;

    -- 4. Status Check: Must be in a completable state
    -- We allow completion from 'delivered', but also from transit states (in case buyer received early) 
    -- and 'processing' (standard state for non-logistics orders or V2 logistics).
    IF v_order.status::TEXT NOT IN ('delivered', 'shipped', 'out_for_delivery', 'picked_up', 'processing') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Finalization failed: Order is currently in ' || UPPER(v_order.status::TEXT) || ' state and cannot be finalized yet.'
        );
    END IF;

    -- 5. Transition to 'completed'
    -- This update TRIGGERS public.handle_revenue_settlement() automatically
    UPDATE public.orders
    SET status = 'completed', 
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 6. Return standard success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order completed. Funds are now on-hold for 48 hours for dispute resolution.',
        'order_id', p_order_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', 'System exception during finalization: ' || SQLERRM, 
        'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION public.complete_order_and_settle IS
'Idempotent version: allows redundant calls and provides descriptive authorization/state errors.';
