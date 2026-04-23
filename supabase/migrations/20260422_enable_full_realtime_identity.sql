-- MIGRATION: 20260422_enable_full_realtime_identity.sql
-- TARGET: Enable REPLICA IDENTITY FULL to allow Realtime filters on non-PK columns.

BEGIN;

-- This ensures that when an UPDATE happens, the broadcast includes ALL column values (like seller_id).
-- Without this, Supabase Realtime filters like 'seller_id=eq.XYZ' will often fail to trigger.

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.shipments REPLICA IDENTITY FULL;

COMMIT;
