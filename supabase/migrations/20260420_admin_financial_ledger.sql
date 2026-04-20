-- MIGRATION: 20260420_admin_financial_ledger.sql
-- TARGET: Implement a comprehensive financial aggregation RPC for administrators.
-- This function pulls from the definitive fee_breakdown source of truth.

BEGIN;

-- Create the ledger function
CREATE OR REPLACE FUNCTION public.get_admin_financial_ledger()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- AUTHORIZATION CHECK
    -- Assuming is_admin() helper already exists in public schema from previous migrations
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can view the financial ledger.';
    END IF;

    -- Aggregate from the source of truth (shipments.fee_breakdown)
    -- We cast the JSON values to numeric for accurate summation
    SELECT jsonb_build_object(
        'total_received', COALESCE(SUM((s.fee_breakdown->>'total')::numeric), 0),
        'seller_total', COALESCE(SUM((s.fee_breakdown->>'seller_payout')::numeric), 0),
        'rider_total', COALESCE(SUM((s.fee_breakdown->>'rider_payout')::numeric), 0),
        'promoter_total', COALESCE(SUM((s.fee_breakdown->>'promoter_payout')::numeric), 0),
        'platform_total', COALESCE(SUM((s.fee_breakdown->>'platform_fee')::numeric), 0)
    ) INTO result
    FROM public.shipments s
    JOIN public.orders o ON s.order_id = o.id
    WHERE o.payment_status = 'paid';

    RETURN result;
END;
$$;

-- Grant execute permissions for the admin dashboard query
GRANT EXECUTE ON FUNCTION public.get_admin_financial_ledger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_financial_ledger() TO service_role;

COMMIT;
