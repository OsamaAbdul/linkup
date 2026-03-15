-- Fix app_role Enum
-- This migration ensures the app_role enum contains all necessary values.
-- Postgres does not support "IF NOT EXISTS" for ALTER TYPE ADD VALUE easily in a single block without DO block.

DO $$
BEGIN
    -- Attempt to add 'promoter'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'promoter';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Attempt to add 'logistics'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'logistics';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;

    -- Attempt to add 'admin'
    BEGIN
        ALTER TYPE public.app_role ADD VALUE 'admin';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;
