-- PERFORMANCE OPTIMIZATION: SERVER-SIDE AGGREGATION AND INDEXING

-- 1. Create RPC for efficient revenue calculation
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only count delivered and completed orders for revenue
    RETURN COALESCE((
        SELECT SUM(total)
        FROM public.orders
        WHERE status IN ('delivered', 'completed')
    ), 0);
END;
$$;

-- 2. Add performance indexes for common admin queries
-- Index on status for revenue and filter efficiency
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- Index on created_at for sorting large order lists
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);

-- Index on rider_id for shipment joins
CREATE INDEX IF NOT EXISTS idx_shipments_rider_id ON public.shipments (rider_id);

-- Index on order_id for shipment joins (already exists in some migrations, but safety first)
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments (order_id);

-- 3. Grant access to authenticated users (RLS will still apply if used, but RPC is SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue() TO service_role;
