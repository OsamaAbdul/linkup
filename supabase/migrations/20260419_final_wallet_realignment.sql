-- MIGRATION: 20260419_final_wallet_realignment.sql
-- TARGET: Force-sync all wallet balances with the transaction history.
-- This is a "Ground-Truth" audit that manually corrects any drift in the wallets table.

DO $$
DECLARE
    v_wallet RECORD;
    v_actual_balance NUMERIC;
    v_actual_escrow NUMERIC;
BEGIN
    RAISE NOTICE 'Starting definitive wallet realignment audit...';

    FOR v_wallet IN (SELECT id, user_id FROM public.wallets) LOOP
        -- 1. Calculate Ground Truth Balance (Success)
        SELECT COALESCE(SUM(amount), 0) INTO v_actual_balance 
        FROM public.wallet_transactions 
        WHERE wallet_id = v_wallet.id AND status = 'success';

        -- 2. Calculate Ground Truth Escrow (Pending)
        SELECT COALESCE(SUM(amount), 0) INTO v_actual_escrow 
        FROM public.wallet_transactions 
        WHERE wallet_id = v_wallet.id AND status = 'pending';

        -- 3. Force Realignment
        UPDATE public.wallets
        SET balance = v_actual_balance,
            escrow_balance = v_actual_escrow,
            updated_at = NOW()
        WHERE id = v_wallet.id;

        RAISE NOTICE 'Wallet % (User %) realigned: Balance=%, Escrow=%', 
            v_wallet.id, v_wallet.user_id, v_actual_balance, v_actual_escrow;
    END LOOP;

    RAISE NOTICE 'Definitive realignment complete.';
END $$;
