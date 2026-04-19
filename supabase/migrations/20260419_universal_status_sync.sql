-- UNIVERSAL STATUS SYNC & RECURSION BREAKER
-- This script fixes the "500 Internal Server Error" caused by infinite recursion between Orders and Shipments.

-- 1. Expand Shipment Status Enum to match UI capabilities
DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'accepted';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'broadcast';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'out_for_pickup';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_seller';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'out_for_delivery';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'arrived_at_destination';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'started';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE 'arrived';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Expand Order Status Enum
DO $$ BEGIN
    ALTER TYPE public.order_status ADD VALUE 'shipped';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Data Repair: Backfill Seller Ownership to existing shipments
-- This is CRITICAL for the flat RLS policy to work.
UPDATE public.shipments s
SET seller_id = o.seller_id
FROM public.orders o
WHERE s.order_id = o.id
AND (s.seller_id IS NULL OR s.seller_id != o.seller_id);

-- 4. MASTER RECURSION BREAKER (The Fix for the 500 Error)
-- We mark these as SECURITY DEFINER so they don't trigger RLS loops.

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

CREATE OR REPLACE FUNCTION public.check_is_rider_of_shipment(p_order_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shipments
    WHERE order_id = p_order_id
    AND rider_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_seller_of_order(p_order_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id
    AND seller_id = auth.uid()
  );
END;
$$;

-- 5. Flatten RLS Policies (No cross-table subqueries in USING clauses)

-- Orders: Simplify SELECT policy
DROP POLICY IF EXISTS "Sellers can view assigned orders" ON public.orders;
CREATE POLICY "Sellers can view assigned orders" ON public.orders
FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
CREATE POLICY "Riders can view assigned orders" ON public.orders
FOR SELECT USING (public.check_is_rider_of_shipment(id));

-- Shipments: Simplify SELECT policy (No subqueries!)
DROP POLICY IF EXISTS "Sellers and riders can view shipments" ON public.shipments;
DROP POLICY IF EXISTS "Seller view own shipments" ON public.shipments;
CREATE POLICY "Sellers and riders can view shipments" ON public.shipments
FOR SELECT USING (
    auth.uid() = rider_id OR 
    auth.uid() = seller_id OR
    public.check_is_admin()
);

-- 6. Unified Mission Claim RPC
CREATE OR REPLACE FUNCTION public.claim_order_mission(
    p_shipment_id UUID,
    p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_shipment RECORD;
    v_order_id UUID;
    v_seller_id UUID;
BEGIN
    SELECT s.*, o.seller_id INTO v_shipment 
    FROM public.shipments s
    JOIN public.orders o ON o.id = s.order_id
    WHERE s.id = p_shipment_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
    END IF;

    IF v_shipment.status::text NOT IN ('broadcast', 'pending') AND 
       NOT (v_shipment.status::text IN ('accepted', 'assigned') AND v_shipment.updated_at < NOW() - INTERVAL '1 hour') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission is already taken');
    END IF;

    v_order_id := v_shipment.order_id;
    v_seller_id := v_shipment.seller_id;

    UPDATE public.shipments
    SET 
        rider_id = p_rider_id,
        seller_id = v_seller_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_shipment_id;

    UPDATE public.orders
    SET 
        status = 'shipped',
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Mission successfully claimed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Automatic Order Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_order_status_from_shipment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status::TEXT IN ('accepted', 'out_for_pickup', 'arrived_at_seller', 'picked_up', 'out_for_delivery', 'arrived_at_destination') THEN
        UPDATE public.orders SET status = 'shipped', updated_at = NOW() WHERE id = NEW.order_id AND status != 'shipped';
    ELSIF NEW.status::TEXT = 'delivered' THEN
        UPDATE public.orders SET status = 'delivered', updated_at = NOW() WHERE id = NEW.order_id AND status != 'delivered';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_order_on_shipment_update ON public.shipments;
CREATE TRIGGER trg_sync_order_on_shipment_update
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_from_shipment();

DROP TRIGGER IF EXISTS trg_sync_order_on_shipment_insert ON public.shipments;
CREATE TRIGGER trg_sync_order_on_shipment_insert
AFTER INSERT ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_from_shipment();

NOTIFY pgrst, 'reload schema';
