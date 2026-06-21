const fs = require('fs');
const sql = `
-- Admin Policies for Orders and Shipments
DO $admin_pol$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
    CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
    CREATE POLICY "Admins can update all orders" ON public.orders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all order_items" ON public.order_items;
    CREATE POLICY "Admins can view all order_items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all order_recipients" ON public.order_recipient;
    CREATE POLICY "Admins can view all order_recipients" ON public.order_recipient FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can view all shipments" ON public.shipments;
    CREATE POLICY "Admins can view all shipments" ON public.shipments FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update all shipments" ON public.shipments;
    CREATE POLICY "Admins can update all shipments" ON public.shipments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $admin_pol$;
`;

fs.appendFileSync('supabase/migrations/20260101000000_initial_schema.sql', sql);
