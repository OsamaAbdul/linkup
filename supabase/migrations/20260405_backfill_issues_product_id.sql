-- MIGRATION: 20260405_backfill_issues_product_id.sql
-- Repairs the issues table by backfilling missing product_id values from the normalized order_items registry.

-- 1. Identify and fix NULL product_id values in the issues table
UPDATE public.issues i
SET product_id = (
    SELECT oi.product_id 
    FROM public.order_items oi 
    WHERE oi.order_id = i.order_id 
    LIMIT 1
)
WHERE i.product_id IS NULL;

-- 2. Optional: Standardize existing NULLs in disputes (if any were created during testing)
UPDATE public.disputes d
SET product_id = (
    SELECT oi.product_id 
    FROM public.order_items oi 
    WHERE oi.order_id = d.order_id 
    LIMIT 1
)
WHERE d.product_id IS NULL;

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';
