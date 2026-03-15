-- MIGRATION: 20260227_rider_online_status
-- Adds is_online column to profiles to track logistics agent availability.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Ensure riders can update their own status
-- (Profiles table already has update policy for auth.uid() = id)
