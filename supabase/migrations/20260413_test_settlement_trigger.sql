-- ADMIN TEST RPC: MOVE ALL ESCROW TO BALANCE
-- Usage: SELECT public.test_move_all_escrow_to_balance();
-- NOT FOR PRODUCTION USE

CREATE OR REPLACE FUNCTION public.test_move_all_escrow_to_balance()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Update all pending wallet transactions to success
    -- This triggers trg_sync_wallet_balance which handles the actual balance movements
    UPDATE public.wallet_transactions 
    SET status = 'success',
        updated_at = NOW()
    WHERE status = 'pending';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Also update any pending commissions
    UPDATE public.commissions
    SET status = 'paid',
        paid_at = NOW()
    WHERE status = 'pending';

    -- Update order settlement statuses for consistency
    UPDATE public.orders
    SET settlement_status = 'settled',
        updated_at = NOW()
    WHERE settlement_status = 'pending';

    RETURN jsonb_build_object(
        'success', true,
        'transactions_processed', v_count,
        'message', 'All escrowed funds moved to main balances for ' || v_count || ' transactions.'
    );
END;
$$;
