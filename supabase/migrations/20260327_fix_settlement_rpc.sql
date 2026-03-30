-- RPC: COMPLETE_ORDER_AND_SETTLE (REFACTORED)
-- This version strips the 'eager' settlement logic and relies on system triggers
-- to handle 48-hour holds (pending status) for seller, rider, and promoter.

CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- 1. Load and validate the order
    -- Must be 'delivered' and belong to the calling buyer
    SELECT * INTO v_order 
    FROM public.orders
    WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status::TEXT = 'delivered'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found, not yours, or not in delivered state'
        );
    END IF;

    -- 2. Update order status to 'completed'
    -- This update TRIGGERS public.handle_revenue_settlement()
    -- handle_revenue_settlement will:
    --   - Set settlement_status = 'pending'
    --   - Set settlement_due_at = NOW() + 48 hours
    --   - Insert 'pending' transactions for seller, rider, promoter
    UPDATE public.orders
    SET status = 'completed', 
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Return success
    -- The actual settlement (balance transfer) will happen 48h later via run_settlements()
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order completed. Funds are now on-hold for 48 hours for dispute resolution.',
        'order_id', p_order_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM, 
        'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION public.complete_order_and_settle IS
'Refactored version: strips immediate credit and relies on system triggers for 48h hold.';
