-- Migration: 20260318_expand_logistics_kyc.sql
-- Description: Add NIN number and ID card photo columns to logistics_kyc

ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS nin_number TEXT,
ADD COLUMN IF NOT EXISTS id_card_photo_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.logistics_kyc.nin_number IS 'National Identification Number (NIN) of the rider';
COMMENT ON COLUMN public.logistics_kyc.id_card_photo_url IS 'Storage path for the uploaded ID card (NIN or Voter''s Card)';
