-- ADD NOTIFICATION SETTINGS TO LOGISTICS DETAILS
-- This column will store user-specific toggle states for various alerts.

ALTER TABLE public.logistics_details
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "new_order": true,
    "order_delivered": true,
    "issue_reported": true,
    "promoter_earnings": true
}'::JSONB;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
