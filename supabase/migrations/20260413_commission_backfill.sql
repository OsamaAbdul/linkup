
-- MIGRATION: 20260413_commission_backfill.sql
-- Backfills missing commissions for orders that were previously missing attribution/sync.

DO $$
DECLARE
    v_order_id UUID;
BEGIN
    -- Identify orders that have a promoter but no commission entry
    FOR v_order_id IN (
        SELECT id FROM public.orders 
        WHERE promoter_id IS NOT NULL 
        AND id NOT IN (SELECT order_id FROM public.commissions)
    ) LOOP
        -- Triggering an update will now fire the new 'handle_revenue_settlement' 
        -- logic (if applied) and generate the missing records.
        UPDATE public.orders 
        SET updated_at = NOW() 
        WHERE id = v_order_id;
        
        RAISE NOTICE 'Backfilled commission for order %', v_order_id;
    END LOOP;
END;
$$;
