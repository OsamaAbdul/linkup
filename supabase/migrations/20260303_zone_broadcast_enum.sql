-- STEP 1 OF 2: Run this FIRST and wait for it to complete.
-- MIGRATION: 20260303_zone_broadcast_enum.sql
-- Adds 'broadcast' to the shipment_status enum.
-- PostgreSQL requires this to commit before the value can be used in functions/policies.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'broadcast' 
        AND enumtypid = 'public.shipment_status'::regtype
    ) THEN
        ALTER TYPE public.shipment_status ADD VALUE 'broadcast' BEFORE 'assigned';
    END IF;
END$$;

-- Also add broadcast_zone column to orders if not already there
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS broadcast_zone TEXT;

-- After running this, wait a moment then run 20260303_zone_broadcast_claim.sql
