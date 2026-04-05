-- MIGRATION: 20260405_disputes_rls.sql
-- Enables Row-Level Security for the disputes table and adds policies for buyers and sellers.

-- 1. Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- 2. Buyers can view disputes they initiated
DROP POLICY IF EXISTS "Buyers can view own disputes" ON public.disputes;
CREATE POLICY "Buyers can view own disputes" ON public.disputes
FOR SELECT USING (auth.uid() = initiator_id);

-- 3. Sellers can view disputes related to their orders
DROP POLICY IF EXISTS "Sellers can view disputes against them" ON public.disputes;
CREATE POLICY "Sellers can view disputes against them" ON public.disputes
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = disputes.order_id
        AND orders.seller_id = auth.uid()
    )
);

-- 4. Admins can manage all disputes
DROP POLICY IF EXISTS "Admins can manage all disputes" ON public.disputes;
CREATE POLICY "Admins can manage all disputes" ON public.disputes
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 5. Buyers can insert their own disputes
DROP POLICY IF EXISTS "Buyers can insert own disputes" ON public.disputes;
CREATE POLICY "Buyers can insert own disputes" ON public.disputes
FOR INSERT WITH CHECK (auth.uid() = initiator_id);

-- 6. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
