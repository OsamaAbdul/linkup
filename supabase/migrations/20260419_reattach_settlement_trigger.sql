-- MIGRATION: 20260419_reattach_settlement_trigger.sql
-- TARGET: Ensure the revenue splitting engine is definitively active for both New and Finalized orders.

BEGIN;

-- 1. DROP EXISTING TO PREVENT CONFLICTS
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- 2. RE-ATTACH TRIGGER (INSERT OR UPDATE)
-- This fires whenever a new order is made or when its status changes.
CREATE TRIGGER trg_revenue_settlement
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- 3. RE-ATTACH SYNC TRIGGER (Ensure balances always match transactions)
-- We do this here as a safety measure to make sure the core sync is also wired.
DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

-- 4. VERIFICATION SEED (Optional diagnostic info)
-- This confirms the search path and function availability.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_revenue_settlement') THEN
        RAISE NOTICE 'Success: Revenue settlement trigger is now attached to orders table.';
    ELSE
        RAISE EXCEPTION 'Failure: Could not attach settlement trigger.';
    END IF;
END $$;

COMMIT;
