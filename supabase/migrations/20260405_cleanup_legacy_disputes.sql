-- MIGRATION: 20260405_cleanup_legacy_disputes.sql
-- Finalizes the consolidation by removing the deprecated standalone disputes table.

-- 1. Drop the legacy disputes table
-- We've already migrated the data in the previous unify migration.
DROP TABLE IF EXISTS public.disputes CASCADE;

-- 2. Reload schema
NOTIFY pgrst, 'reload schema';
