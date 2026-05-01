-- MIGRATION: 20260501_fix_buyer_dispute_rls.sql
-- Update orders RLS to allow buyers to mark orders as 'disputed'

DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;

CREATE POLICY "Buyers can update own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id 
    AND (
        (status = 'completed') OR 
        (status = 'disputed') OR
        (status = 'cancelled' AND (SELECT o.status FROM public.orders o WHERE o.id = id) = 'pending')
    )
);
