-- Enable RLS and Realtime for Orders
-- This ensures sellers can update status and UI updates in real-time

-- 1. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Orders
DO $$ 
BEGIN
    -- SELECT: Buyers can see their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view own orders') THEN
        CREATE POLICY "Buyers can view own orders" ON public.orders
        FOR SELECT USING (auth.uid() = buyer_id);
    END IF;

    -- SELECT: Sellers can see orders assigned to them
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can view assigned orders') THEN
        CREATE POLICY "Sellers can view assigned orders" ON public.orders
        FOR SELECT USING (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Sellers can update order status
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers can update order status') THEN
        CREATE POLICY "Sellers can update order status" ON public.orders
        FOR UPDATE USING (auth.uid() = seller_id)
        WITH CHECK (auth.uid() = seller_id);
    END IF;

    -- UPDATE: Logistics riders can update order status (synced from shipment)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Logistics can update order status') THEN
        CREATE POLICY "Logistics can update order status" ON public.orders
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.shipments 
                WHERE shipments.order_id = orders.id 
                AND shipments.rider_id = auth.uid()
            )
        );
    END IF;

    -- UPDATE: Buyers can cancel their own orders (if pending)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can cancel own orders') THEN
        CREATE POLICY "Buyers can cancel own orders" ON public.orders
        FOR UPDATE USING (auth.uid() = buyer_id)
        WITH CHECK (auth.uid() = buyer_id AND status = 'pending');
    END IF;
END $$;

-- 4. Enable RLS and Policies for Shipments
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- SELECT: Both sellers and riders can view the shipment
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sellers and riders can view shipments') THEN
        CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
        FOR SELECT USING (
            auth.uid() = rider_id OR 
            auth.uid() IN (SELECT seller_id FROM public.orders WHERE id = shipments.order_id)
        );
    END IF;

    -- UPDATE: Riders can update their assigned shipments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Riders can update own shipments') THEN
        CREATE POLICY "Riders can update own shipments" ON public.shipments
        FOR UPDATE USING (auth.uid() = rider_id)
        WITH CHECK (auth.uid() = rider_id);
    END IF;
END $$;

-- 5. Enable Realtime Replication
DO $$
BEGIN
    -- Enable for orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    -- Enable for shipments
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'shipments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
    END IF;
END $$;
