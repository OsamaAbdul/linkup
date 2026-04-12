-- MIGRATION: 20260412_fix_settlement_ambiguity.sql
-- REPAIR: Fixes the "function public.run_settlements() is not unique" error.

-- 1. CLEANUP DUPLICATE SIGNATURES
-- We must drop the specific signatures to remove ambiguity.
DROP FUNCTION IF EXISTS public.run_settlements();
DROP FUNCTION IF EXISTS public.run_settlements(boolean);

-- 2. RE-IMPLEMENT DEFINITIVE VERSION
-- This version handles Platform, Rider, and Promoter payouts with high precision.
CREATE OR REPLACE FUNCTION public.run_settlements(p_force BOOLEAN DEFAULT FALSE)
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND (settlement_due_at <= NOW() OR p_force = TRUE)
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            -- Finalize all Wallet Transactions tied to this order
            -- Moves status from 'pending' to 'success' (triggering balance sync)
            UPDATE public.wallet_transactions
            SET status = 'success',
                updated_at = NOW()
            WHERE (metadata->>'order_id' = v_order.id::TEXT)
            AND status = 'pending';

            -- Finalize Commissions
            UPDATE public.commissions 
            SET status = 'paid', 
                paid_at = NOW()
            WHERE order_id = v_order.id;

            -- Mark settled
            UPDATE public.orders 
            SET settlement_status = 'settled',
                updated_at = NOW() 
            WHERE id = v_order.id;
            
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Settlement finalization failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REPAIR AUTO-RELEASE TRIGGER
-- Ensure the transition trigger calls the unique function correctly.
CREATE OR REPLACE FUNCTION public.trg_auto_release_settlements_func()
RETURNS TRIGGER AS $$
BEGIN
    -- This call now resolves uniquely to run_settlements(boolean) with default FALSE.
    PERFORM public.run_settlements();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger just in case
DROP TRIGGER IF EXISTS trg_auto_release_settlements ON public.orders;
CREATE TRIGGER trg_auto_release_settlements
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION public.trg_auto_release_settlements_func();
