-- PHASE 3 HARDENING: PURE ORDERS & DECOUPLED LOGISTICS
-- TARGET: Finalize the separation of concerns

BEGIN;

-- 1. Financial Column Standardization
-- total_amount is currently a generated column, so we must drop it to make it a standalone record.
ALTER TABLE public.orders DROP COLUMN IF EXISTS total_amount;
ALTER TABLE public.orders ADD COLUMN total_amount NUMERIC DEFAULT 0;

-- Sync data from legacy total before dropping it
UPDATE public.orders SET total_amount = total;
ALTER TABLE public.orders DROP COLUMN IF EXISTS total;

-- 2. Update Revenue RPC for new column name
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT SUM(total_amount)
        FROM public.orders
        WHERE status IN ('delivered', 'completed')
    ), 0);
END;
$$;

-- 3. Enhance shipments Table (Logistics responsibility)
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS broadcast_zone TEXT;

-- 4. DATA MIGRATION: Sync remaining logistics from orders to shipments
UPDATE public.shipments s
SET 
    broadcast_zone = COALESCE(s.broadcast_zone, o.broadcast_zone),
    distance_km = COALESCE(s.distance_km, o.distance_km)
FROM public.orders o
WHERE s.order_id = o.id;

-- 5. FINAL CLEANUP: Remove logistics soup from transactional orders table
ALTER TABLE public.orders DROP COLUMN IF EXISTS city_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS zone_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS broadcast_zone;
ALTER TABLE public.orders DROP COLUMN IF EXISTS distance_km;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_address; -- Stale dead field

-- 6. INDEXING for PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON public.orders (total_amount);

COMMIT;
