-- ========================================================================
-- MIGRATION: Fix Automated Escrow Releases, Cron Scheduling & Force Release
-- ========================================================================

-- 1. Drop existing function to allow updating return type to JSONB
DROP FUNCTION IF EXISTS public.process_automated_escrow_releases();

-- 2. Redefine process_automated_escrow_releases with robust logic:
--    a) Correctly parses scalar jsonb 'escrow_release_days' from system_settings
--    b) Auto-completes 'delivered' orders where buyer hasn't manually finalized after release_days
--    c) Transitions 'order_settlements' from 'pending'/'processing' to 'settled'
--       (which fires trigger_settlement_release -> handle_settlement_release to credit wallets)
--    d) Synchronizes orders.settlement_status = 'settled'
CREATE OR REPLACE FUNCTION public.process_automated_escrow_releases()
RETURNS jsonb AS $$
DECLARE
    v_release_days INT;
    v_completed_count INT := 0;
    v_settled_count INT := 0;
BEGIN
    -- Extract configured release days from settings (properly handling scalar jsonb)
    SELECT COALESCE((value #>> '{}')::INT, 3) INTO v_release_days 
    FROM public.system_settings 
    WHERE key = 'escrow_release_days';
    
    IF v_release_days IS NULL OR v_release_days < 1 THEN
        v_release_days := 3;
    END IF;

    -- Step A: Auto-complete orders that have been 'delivered' longer than v_release_days
    -- (Resolves the deadlock where buyers received items but never clicked 'Mark Delivered & Finalize')
    WITH completed_orders AS (
        UPDATE public.orders
        SET status = 'completed',
            settlement_status = 'settled',
            updated_at = NOW()
        WHERE status = 'delivered'
        AND updated_at <= (NOW() - (v_release_days || ' days')::INTERVAL)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_completed_count FROM completed_orders;

    -- Step B: Transition settlements to 'settled' for completed orders that passed the hold window
    -- This fires trigger_settlement_release() -> handle_settlement_release() to credit wallets!
    WITH settled_records AS (
        UPDATE public.order_settlements os
        SET status = 'settled',
            updated_at = NOW()
        FROM public.orders o
        WHERE os.order_id = o.id
        AND os.status IN ('pending', 'processing')
        AND o.status = 'completed'
        AND (
            os.updated_at <= (NOW() - (v_release_days || ' days')::INTERVAL)
            OR o.updated_at <= (NOW() - (v_release_days || ' days')::INTERVAL)
        )
        RETURNING os.id
    )
    SELECT COUNT(*) INTO v_settled_count FROM settled_records;

    -- Step C: Ensure orders.settlement_status is updated for all settled orders
    UPDATE public.orders o
    SET settlement_status = 'settled',
        updated_at = NOW()
    FROM public.order_settlements os
    WHERE o.id = os.order_id
    AND os.status = 'settled'
    AND o.settlement_status != 'settled';

    RAISE LOG 'Automated escrow release finished: % orders auto-completed, % settlements released to wallets.', v_completed_count, v_settled_count;

    RETURN jsonb_build_object(
        'success', true,
        'release_days', v_release_days,
        'orders_completed', v_completed_count,
        'settlements_released', v_settled_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.process_automated_escrow_releases() TO postgres, service_role, authenticated;

-- 3. Fix force_release_all_funds() so the Admin "Pay All Sellers Now" button
--    actually updates order_settlements to 'settled' and credits wallets
CREATE OR REPLACE FUNCTION public.force_release_all_funds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Complete delivered orders
    UPDATE public.orders 
    SET status = 'completed',
        settlement_status = 'settled',
        updated_at = NOW()
    WHERE status = 'delivered';

    -- 2. Transition all pending/processing settlements for completed orders to 'settled'
    -- This triggers handle_settlement_release() which moves the funds to the wallet balances
    WITH settled_orders AS (
        UPDATE public.order_settlements os
        SET status = 'settled',
            updated_at = NOW()
        FROM public.orders o
        WHERE os.order_id = o.id
        AND os.status IN ('pending', 'processing')
        AND o.status = 'completed'
        RETURNING os.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM settled_orders;

    -- 3. Keep orders.settlement_status synced
    UPDATE public.orders o
    SET settlement_status = 'settled',
        updated_at = NOW()
    FROM public.order_settlements os
    WHERE o.id = os.order_id
    AND os.status = 'settled'
    AND o.settlement_status != 'settled';

    RETURN json_build_object(
        'success', true,
        'message', 'Successfully released funds for ' || v_updated_count || ' orders.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

-- Grant execution permissions on force_release_all_funds
GRANT EXECUTE ON FUNCTION public.force_release_all_funds() TO authenticated, service_role;

-- 4. Enable pg_cron and schedule the automated release job hourly
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- Unschedule previous job if exists to prevent duplicates
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_automated_escrow_releases') THEN
        PERFORM cron.unschedule('process_automated_escrow_releases');
    END IF;

    -- Schedule job to run every hour at minute 0
    PERFORM cron.schedule(
        'process_automated_escrow_releases',
        '0 * * * *',
        'SELECT public.process_automated_escrow_releases()'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron notice: %', SQLERRM;
END $$;
