-- RLS Recursion Fix & Optimization
-- Breaks infinite recursion loops in user_roles, orders, and shipments.

-- 1. Ensure a safe admin check function exists (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Create safe order association checks
CREATE OR REPLACE FUNCTION public.check_is_seller_of_order(order_uuid UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_uuid
    AND seller_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_rider_of_shipment(order_uuid UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shipments
    WHERE order_id = order_uuid
    AND rider_id = auth.uid()
  );
END;
$$;

-- 3. Fix user_roles recursion
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (public.check_is_admin());

-- 4. Fix orders recursion
-- We need to replace policies that refer to shipments which refer back to orders.
DROP POLICY IF EXISTS "Logistics can update order status" ON public.orders;
CREATE POLICY "Logistics can update order status" ON public.orders
FOR UPDATE USING (public.check_is_rider_of_shipment(id));

DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders
FOR SELECT USING (auth.uid() = seller_id OR public.check_is_admin());

-- 5. Fix shipments recursion
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
  auth.uid() = rider_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);

-- 6. Ensure order_items_new is also safe
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items_new;
CREATE POLICY "Users can view own order items" ON public.order_items_new
FOR SELECT USING (
  auth.uid() = seller_id OR 
  public.check_is_seller_of_order(order_id) OR
  public.check_is_admin()
);
