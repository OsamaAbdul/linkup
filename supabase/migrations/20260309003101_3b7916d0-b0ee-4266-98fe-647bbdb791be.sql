-- Allow buyers to SELECT shipments for their own orders (retry - policy may already exist from partial success)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can view shipments for own orders' AND tablename = 'shipments'
  ) THEN
    CREATE POLICY "Buyers can view shipments for own orders"
    ON public.shipments FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipments.order_id AND orders.buyer_id = auth.uid()
    ));
  END IF;
END $$;