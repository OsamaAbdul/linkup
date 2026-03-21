-- Migration: 20260318_add_missing_kyc_columns.sql
-- Description: Add missing 'zone' and 'updated_at' columns to logistics_kyc table to fix submission error.

ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS zone TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update existing rows to have an updated_at value equal to created_at
UPDATE public.logistics_kyc 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.logistics_kyc;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.logistics_kyc
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
