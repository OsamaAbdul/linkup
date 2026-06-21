const fs = require('fs');
const sql = `
-- Admin Policies for Order Settlements
DO $admin_pol_os$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all order_settlements" ON public.order_settlements;
    CREATE POLICY "Admins can view all order_settlements" ON public.order_settlements FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all order_settlements" ON public.order_settlements;
    CREATE POLICY "Admins can update all order_settlements" ON public.order_settlements FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $admin_pol_os$;
`;

fs.appendFileSync('supabase/migrations/20260101000000_initial_schema.sql', sql);
