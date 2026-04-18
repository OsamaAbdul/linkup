-- 1. Clean up any existing duplicate order_id records (Keeping the most recent)
DELETE FROM public.shipments a USING (
      SELECT MIN(ctid) as ctid, order_id 
      FROM public.shipments 
      GROUP BY order_id 
      HAVING COUNT(*) > 1
) b
WHERE a.order_id = b.order_id 
AND a.ctid <> b.ctid;

-- 2. Add unique constraint to order_id to support UPSERT logic
ALTER TABLE public.shipments 
DROP CONSTRAINT IF EXISTS shipments_order_id_key;

ALTER TABLE public.shipments 
ADD CONSTRAINT shipments_order_id_key UNIQUE (order_id);

-- Force cache reload
NOTIFY pgrst, 'reload';
