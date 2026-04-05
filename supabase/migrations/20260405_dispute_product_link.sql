-- MIGRATION: 20260405_dispute_product_link.sql
-- Links disputes to specific products for multi-item order granularity.

-- 1. Add product_id to disputes table
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 2. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
