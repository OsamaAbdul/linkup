-- Allow Admins to view all orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all orders') THEN
        CREATE POLICY "Admins can view all orders" ON public.orders
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );
    END IF;
END $$;
