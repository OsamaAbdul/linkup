-- MIGRATION: 20260412_buyer_cross_zone_fee.sql
-- Implements Cross-Zone Fee for Buyers.

-- 1. Update fee_config type constraints and enrich shipments
ALTER TABLE public.fee_config DROP CONSTRAINT IF EXISTS fee_config_fee_type_check;
ALTER TABLE public.fee_config ADD CONSTRAINT fee_config_fee_type_check 
CHECK (fee_type IN ('platform', 'rider', 'promoter', 'rider_out_of_zone', 'rider_distance', 'buyer_cross_zone'));

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS cross_zone_fee_amount NUMERIC DEFAULT 0;

-- 2. Seed Default Cross-Zone Fee for Buyers
INSERT INTO public.fee_config (name, fee_type, rate, flat_fee, priority, is_active)
VALUES 
('Cross-Zone Surcharge', 'buyer_cross_zone', 0, 500, 15, true)
ON CONFLICT (name) DO UPDATE 
SET fee_type = EXCLUDED.fee_type,
    flat_fee = EXCLUDED.flat_fee,
    is_active = EXCLUDED.is_active;
