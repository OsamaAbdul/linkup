-- NOTE: Run this command OUTSIDE of any transaction block in the Supabase SQL Editor.
-- PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction block or DO block.

-- 1. Check if 'broadcast' exists first (manually or via metadata check)
-- 2. Run this command:
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'broadcast' BEFORE 'assigned';
