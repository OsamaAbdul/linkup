-- Rider Visibility Fix
-- Allows logistics agents (riders) to see the orders and items they are assigned to.

-- 1. Update orders SELECT policy to include riders
DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
CREATE POLICY "Riders can view assigned orders" ON public.orders
FOR SELECT USING (public.check_is_rider_of_shipment(id));

-- 2. Ensure buyers and sellers policies are also present and clean (from previous master fix)
-- Buyer view policy (ensure it's not lost)
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders" ON public.orders
FOR SELECT USING (auth.uid() = buyer_id);

-- Seller view policy (redundant but safe to re-apply)
DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders
FOR SELECT USING (auth.uid() = seller_id OR public.check_is_admin());


-- 3. Update order_items SELECT policy to include riders
DROP POLICY IF EXISTS "Riders can view assigned order items" ON public.order_items;
CREATE POLICY "Riders can view assigned order items" ON public.order_items
FOR SELECT USING (public.check_is_rider_of_shipment(order_id));

-- Also ensure public.order_items_new is covered if it's being used
DROP POLICY IF EXISTS "Logistics can view order items" ON public.order_items_new;
CREATE POLICY "Logistics can view order items" ON public.order_items_new
FOR SELECT USING (public.check_is_rider_of_shipment(order_id));


-- 4. Final check on shipments policy to ensure it's not blocked
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
  auth.uid() = rider_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);
