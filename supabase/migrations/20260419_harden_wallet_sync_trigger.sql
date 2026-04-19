-- MIGRATION: 20260419_harden_wallet_sync_trigger.sql
-- TARGET: Ensure wallet balances update when transaction AMOUNTS are corrected.
-- This hardens the trigger logic to detect amount changes without status changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. LOGIC FOR INSERT
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'success') THEN
            UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
        ELSIF (NEW.status = 'pending') THEN
            UPDATE public.wallets SET escrow_balance = escrow_balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
        END IF;

    -- 2. LOGIC FOR UPDATE (Corrected for Amount Changes)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case A: Status Transition (Pending -> Success)
        IF (OLD.status = 'pending' AND NEW.status = 'success') THEN
            UPDATE public.wallets
            SET balance = balance + NEW.amount,
                escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        
        -- Case B: Status Transition (Pending -> Failed)
        ELSIF (OLD.status = 'pending' AND NEW.status = 'failed') THEN
            UPDATE public.wallets
            SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount),
                updated_at = NOW()
            WHERE id = NEW.wallet_id;

        -- Case C: AMOUNT CHANGE (Same Status: Pending)
        ELSIF (OLD.status = 'pending' AND NEW.status = 'pending' AND OLD.amount != NEW.amount) THEN
            UPDATE public.wallets
            SET escrow_balance = escrow_balance - OLD.amount + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;

        -- Case D: AMOUNT CHANGE (Same Status: Success)
        ELSIF (OLD.status = 'success' AND NEW.status = 'success' AND OLD.amount != NEW.amount) THEN
            UPDATE public.wallets
            SET balance = balance - OLD.amount + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        END IF;

    -- 3. LOGIC FOR DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'success') THEN
            UPDATE public.wallets SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.wallet_id;
        ELSIF (OLD.status = 'pending') THEN
            UPDATE public.wallets SET escrow_balance = GREATEST(0, escrow_balance - OLD.amount), updated_at = NOW() WHERE id = OLD.wallet_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
