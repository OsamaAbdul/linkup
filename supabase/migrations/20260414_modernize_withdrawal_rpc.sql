
-- MIGRATION: 20260414_modernize_withdrawal_rpc.sql
-- Overhauls the withdrawal RPC to be secure, automated, and compatible with the Payout Request system.

CREATE OR REPLACE FUNCTION public.request_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_new_payout_id UUID;
    v_daily_limit NUMERIC := 100000; -- High limit for promoters
    v_today_total NUMERIC;
    v_withdrawal_fee NUMERIC := 0; -- Default if not found
BEGIN
    -- 1. SECURITY: Identity Guard
    IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized identity mismatch');
    END IF;

    -- 2. FLOODING SHIELD: Block multiple concurrent pending payouts
    IF EXISTS (
        SELECT 1 FROM public.payout_requests 
        WHERE user_id = p_user_id AND status IN ('pending', 'processing')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have a payout request being processed.');
    END IF;

    -- 3. WALLET RESOLUTION & ATOMIC LOCK
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Please earn some commission first.');
    END IF;

    -- 4. BALANCE CHECK
    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- 5. DAILY LIMIT CHECK
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total
    FROM public.payout_requests 
    WHERE user_id = p_user_id AND created_at >= CURRENT_DATE AND status != 'rejected';

    IF (v_today_total + p_amount) > v_daily_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Daily withdrawal limit reached (₦' || v_daily_limit || ')');
    END IF;

    -- 6. GET WITHDRAWAL FEE (Optional config check)
    SELECT (value->>'amount')::NUMERIC INTO v_withdrawal_fee 
    FROM public.system_settings WHERE key = 'withdrawal_fee';

    -- 7. SUBMIT PAYOUT REQUEST
    INSERT INTO public.payout_requests (
        user_id, 
        wallet_id, 
        amount, 
        fee_amount,
        bank_name, 
        account_number, 
        account_name, 
        status
    ) VALUES (
        p_user_id, 
        v_wallet.id, 
        p_amount, 
        COALESCE(v_withdrawal_fee, 0),
        p_bank_name, 
        p_account_number, 
        p_account_name, 
        'pending'
    ) RETURNING id INTO v_new_payout_id;

    -- NOTE: In your system, the Trigger 'tr_handle_payout_request' automatically:
    -- 1. Deducts the balance
    -- 2. Creates the wallet_transaction
    -- So we don't need to do it manually here to avoid double deduction.

    RETURN jsonb_build_object(
        'success', true, 
        'id', v_new_payout_id, 
        'message', 'Withdrawal of ₦' || p_amount::TEXT || ' submitted for admin approval.'
    );
END;
$$;

COMMENT ON FUNCTION public.request_withdrawal IS 'Submits a payout request to admins and automatically handles wallet synchronization.';
