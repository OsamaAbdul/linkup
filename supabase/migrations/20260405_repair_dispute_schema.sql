-- MIGRATION: 20260405_repair_dispute_schema.sql
-- Resolves the issue where disputes were not correctly recorded due to missing columns and relationship definitions.

-- 1. Ensure 'details' column exists for descriptive intelligence
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS details TEXT;

-- 2. Establish formal relationship for initiator tracking (Buyer profile)
-- This is required for PostgREST joins used in the Admin dashboard.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'disputes_initiator_id_fkey') THEN
        ALTER TABLE public.disputes
        ADD CONSTRAINT disputes_initiator_id_fkey 
        FOREIGN KEY (initiator_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Update RLS policies to be definitive (Defensive check)
DROP POLICY IF EXISTS "Buyers can insert own disputes" ON public.disputes;
CREATE POLICY "Buyers can insert own disputes" ON public.disputes
FOR INSERT WITH CHECK (auth.uid() = initiator_id);

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
