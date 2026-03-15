-- Logistics Dashboard Infrastructure Improvements

-- 1. Add vehicle_type to logistics_details
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- 2. Add total_earnings to logistics_details for quick access (updated via triggers or RPC)
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- 3. Add earnings to shipments table
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS earnings NUMERIC DEFAULT 2500;

-- 4. Enable access to verification status for redirection logic
-- Profiles might already have this info via join, but let's ensure logistics_verifications is readable.
-- Policies were already set in previous migration.

-- 5. Add notification settings to logistics_details
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "new_order": true,
  "order_delivered": true,
  "issue_reported": true,
  "promoter_earnings": true
}'::JSONB;
