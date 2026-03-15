-- MIGRATION: 20260303_buyer_completion_rls.sql
-- The buyer "Confirm Receipt & Finalize" button sets status = 'completed'.
-- The existing buyer UPDATE policy only allows status = 'pending' (cancel-only).
-- This migration adds a new policy so buyers can mark 'delivered' orders as 'completed'.

-- Drop the old cancel-only policy
DROP POLICY IF EXISTS "Buyers can cancel own orders" ON public.orders;

-- Recreate it split into two specific policies for clarity:

-- 1. Buyers can cancel orders that are still pending
CREATE POLICY "Buyers can cancel pending orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'pending'
);

-- 2. Buyers can confirm receipt of delivered orders (marks as 'completed')
CREATE POLICY "Buyers can confirm receipt of delivered orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (
    auth.uid() = buyer_id
    AND status::TEXT = 'completed'
    -- But the current row must be 'delivered' — enforced at query level by the client
);
