-- MIGRATION: 20260303_state_machine_overhaul.sql
-- Implements the robust order state machine statuses.
-- FIXED: Ensures 'accepted' exists in both enums before adding subsequent values.

-- 1. Extend order_status Enum
DO $$ 
BEGIN
    -- Add CONFIRMED after PENDING
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'confirmed') THEN
        ALTER TYPE public.order_status ADD VALUE 'confirmed' AFTER 'pending';
    END IF;

    -- Add AWAITING_AGENT after PROCESSING
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'awaiting_agent') THEN
        ALTER TYPE public.order_status ADD VALUE 'awaiting_agent' AFTER 'processing';
    END IF;

    -- Add ACCEPTED after AWAITING_AGENT
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.order_status ADD VALUE 'accepted' AFTER 'awaiting_agent';
    END IF;

    -- Add PICKED_UP after ACCEPTED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'picked_up') THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'accepted';
    END IF;

    -- Add OUT_FOR_DELIVERY after PICKED_UP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'out_for_delivery') THEN
        ALTER TYPE public.order_status ADD VALUE 'out_for_delivery' AFTER 'picked_up';
    END IF;

    -- Add COMPLETED after DELIVERED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'completed') THEN
        ALTER TYPE public.order_status ADD VALUE 'completed' AFTER 'delivered';
    END IF;

    -- Add REFUNDED after CANCELLED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'refunded') THEN
        ALTER TYPE public.order_status ADD VALUE 'refunded' AFTER 'cancelled';
    END IF;
END $$;

-- 2. Extend shipment_status Enum
DO $$ 
BEGIN
    -- Add ACCEPTED after ASSIGNED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'accepted') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'accepted' AFTER 'assigned';
    END IF;

    -- Add OUT_FOR_PICKUP after ACCEPTED
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'out_for_pickup') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'out_for_pickup' AFTER 'accepted';
    END IF;

    -- Add ARRIVED_AT_SELLER after OUT_FOR_PICKUP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'arrived_at_seller') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_seller' AFTER 'out_for_pickup';
    END IF;

    -- Add OUT_FOR_DELIVERY after PICKED_UP
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'out_for_delivery') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'out_for_delivery' AFTER 'picked_up';
    END IF;

    -- Add ARRIVED_AT_DESTINATION after OUT_FOR_DELIVERY
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'shipment_status' AND e.enumlabel = 'arrived_at_destination') THEN
        ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_destination' AFTER 'out_for_delivery';
    END IF;
END $$;
