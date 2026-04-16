-- Financial Correction: Restoring Escrow Accuracy & Order-Based Hold

-- 1. Redefine the Wallet Sync Trigger for absolute robustness
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT: Add to escrow if pending, or balance if success
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'pending' THEN
            UPDATE public.wallets SET escrow_balance = escrow_balance + NEW.amount WHERE id = NEW.wallet_id;
        ELSIF NEW.status = 'success' THEN
            UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
        END IF;
    
    -- On UPDATE: Handle transitions
    ELSIF (TG_OP = 'UPDATE') THEN
        -- ONLY act if status actually changed
        IF OLD.status != NEW.status THEN
            -- Pending -> Success: Move from Escrow to Available Balance
            IF OLD.status = 'pending' AND NEW.status = 'success' THEN
                UPDATE public.wallets 
                SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                    balance = balance + NEW.amount 
                WHERE id = NEW.wallet_id;
            
            -- Pending -> Failed/Rejected: Release from Escrow
            ELSIF OLD.status = 'pending' AND NEW.status IN ('failed', 'rejected') THEN
                UPDATE public.wallets SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount) WHERE id = NEW.wallet_id;
            
            -- Success -> Failed (Refund): Remove from Balance
            ELSIF OLD.status = 'success' AND NEW.status IN ('failed', 'rejected') THEN
                UPDATE public.wallets SET balance = GREATEST(0, balance - OLD.amount) WHERE id = NEW.wallet_id;
            
            -- Success -> Pending (Correction): Move back to Escrow
            ELSIF OLD.status = 'success' AND NEW.status = 'pending' THEN
                UPDATE public.wallets 
                SET balance = GREATEST(0, balance - OLD.amount),
                    escrow_balance = escrow_balance + NEW.amount 
                WHERE id = NEW.wallet_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Utility to Fix All Wallet Balances from Scratch (The source of truth)
CREATE OR REPLACE FUNCTION public.rebuild_all_wallets()
RETURNS VOID AS $$
DECLARE
    v_wallet RECORD;
    v_success_total NUMERIC;
    v_pending_total NUMERIC;
    v_withdrawal_total NUMERIC;
BEGIN
    FOR v_wallet IN (SELECT id, user_id FROM public.wallets) LOOP
        -- Sum active earnings
        SELECT COALESCE(SUM(amount), 0) INTO v_success_total 
        FROM public.wallet_transactions WHERE wallet_id = v_wallet.id AND status = 'success';
        
        -- Sum pending earnings
        SELECT COALESCE(SUM(amount), 0) INTO v_pending_total 
        FROM public.wallet_transactions WHERE wallet_id = v_wallet.id AND status = 'pending';
        
        -- Sum processed withdrawals (deduct from Available)
        SELECT COALESCE(SUM(amount + COALESCE(fee_amount, 0)), 0) INTO v_withdrawal_total 
        FROM public.payout_requests WHERE user_id = v_wallet.user_id AND status NOT IN ('rejected');

        -- Final update
        UPDATE public.wallets 
        SET balance = GREATEST(0, v_success_total - v_withdrawal_total),
            escrow_balance = v_pending_total,
            updated_at = NOW()
        WHERE id = v_wallet.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. PERFORM CORRECTION: 
-- A) Recalculate hold period based on Order Completion Time
-- B) Revert 'success' transactions to 'pending' if still in hold period
DO $$
DECLARE
    v_settlement_hours INTEGER;
BEGIN
    -- Get current global duration
    SELECT COALESCE(flat_fee, 48)::INTEGER INTO v_settlement_hours 
    FROM public.fee_config WHERE fee_type = 'settlement' AND is_active = TRUE LIMIT 1;

    -- Update metadata and status based on real order completion
    UPDATE public.wallet_transactions wt
    SET 
        status = 'pending',
        metadata = wt.metadata || jsonb_build_object(
            'hold_until', o.updated_at + (v_settlement_hours || ' hours')::INTERVAL,
            'correction_reason', 'Re-syncing with order completion time'
        )
    FROM public.orders o
    WHERE (wt.metadata->>'order_id' = o.id::TEXT)
    AND o.status = 'completed'
    AND (o.updated_at + (v_settlement_hours || ' hours')::INTERVAL) > NOW();

    -- B) Run the global rebuild to fix UI numbers immediately
    PERFORM public.rebuild_all_wallets();
END $$;
