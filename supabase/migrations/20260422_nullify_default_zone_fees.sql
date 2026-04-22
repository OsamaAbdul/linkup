-- MIGRATION: 20260422_nullify_default_zone_fees.sql
-- TARGET: Convert explicit 1500 fees to NULL so they inherit the Admin's "Rider Base Fee".

BEGIN;

-- Update all zones currently set to the old hardcoded default (1500) to NULL
-- This ensures they fallback to the dynamic value configured in fee_config
UPDATE public.delivery_zones
SET delivery_fee = NULL
WHERE delivery_fee = 1500 OR delivery_fee = 0;

COMMIT;
