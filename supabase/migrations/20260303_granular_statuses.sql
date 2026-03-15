-- MIGRATION: 20260303_granular_statuses.sql
-- Adds 'accepted' and 'picked_up' statuses to both order and shipment enums for granular feedback.

-- 1. Add 'accepted' and 'picked_up' to order_status if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.order_status ADD VALUE 'accepted' AFTER 'processing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'picked_up') THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'accepted';
    END IF;
END $$;

-- 2. Add 'accepted' to shipment_status if it doesn't exist
-- 'picked_up' already exists in the original schema for shipments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'accepted' AFTER 'assigned';
    END IF;
END $$;
