-- FINAL FIX FOR LOGISTICS DETAILS SCHEMA
-- This ensures the table and all required columns exist for the settings page.

-- 1. Create table if missing
CREATE TABLE IF NOT EXISTS public.logistics_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Add missing columns
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "new_order": true,
  "order_delivered": true,
  "issue_reported": true,
  "promoter_earnings": true
}'::JSONB;
ALTER TABLE public.logistics_details ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- 3. Enable RLS
ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Users can manage own logistics details" ON public.logistics_details;
CREATE POLICY "Users can manage own logistics details" ON public.logistics_details
FOR ALL USING (auth.uid() = user_id);

-- 5. RELOAD SCHEMA CACHE (Crucial for PostgREST to see new columns)
NOTIFY pgrst, 'reload schema';
