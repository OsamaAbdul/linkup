-- MIGRATION: 20260405_expand_order_status.sql
-- Expands the order_status enum to accommodate judicial and final states.

-- 1. Add 'disputed' and 'completed' to the order_status enum
-- Since PostgreSQL doesn't allow dropping/re-creating enums easily if they are in use, 
-- we use ALTER TYPE ... ADD VALUE if it exists, or handle the enum creation robustly.

DO $$ 
BEGIN
    -- Add 'disputed' status
    BEGIN
        ALTER TYPE public.order_status ADD VALUE 'disputed';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Add 'completed' status
    BEGIN
        ALTER TYPE public.order_status ADD VALUE 'completed';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- 2. Reload PostgREST schema to reflect enum changes
NOTIFY pgrst, 'reload schema';
