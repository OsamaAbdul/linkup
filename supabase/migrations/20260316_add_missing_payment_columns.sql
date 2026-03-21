-- Migration: Add missing columns to orders table
-- This fix addresses the "Could not find the 'payment_method' column of 'orders' in the schema cache" error.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_ref TEXT,
ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS shipping_info JSONB;

-- Reload the PostgREST schema cache to ensure Edge Functions and API see the new columns immediately.
NOTIFY pgrst, 'reload schema';
