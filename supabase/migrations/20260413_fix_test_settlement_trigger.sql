-- ADMIN TEST FIX: Robust Escrow Settle Trigger
-- Redefines the RPC to avoid triggering notifications for null-user wallets (like platform/rider)

CREATE OR REPLACE FUNCTION public.test_move_all_escrow_to_balance()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Update only pending wallet transactions where the wallet has a valid user_id
    -- This prevents triggers from failing on notifications for null-user wallets
    UPDATE public.wallet_transactions wt
    SET status = 'success',
        updated_at = NOW()
    FROM public.wallets w
    WHERE wt.wallet_id = w.id
    AND wt.status = 'pending'
    AND w.user_id IS NOT NULL; -- CRITICAL: Only notify real users

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Also update any pending commissions (usually tied to a promoter profile)
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
        'message', 'All escrowed funds for valid users moved to main balances. Count: ' || v_count
    );
END;
$$;
