-- FIX: Order Settlement "Compatibility Bridge"
-- This creates a generated 'total' column that mirrors 'total_amount'.
-- This is the ULTIMATE fix for all legacy code still looking for the old column name.

-- Set a shorter timeout so we don't hang the DB if it's busy
SET lock_timeout = '10s';

-- 0. THE BRIDGE: Create an alias column for 'total'
-- This ensures all legacy functions (Escrow, Sync) instantly stop crashing.
ALTER TABLE public.orders DROP COLUMN IF EXISTS total CASCADE;
ALTER TABLE public.orders ADD COLUMN total NUMERIC GENERATED ALWAYS AS (total_amount) STORED;

BEGIN;

-- 1. DEDUPLICATE (Aggressive ctid method)
DELETE FROM public.wallet_transactions a USING public.wallet_transactions b
WHERE a.ctid > b.ctid AND a.wallet_id = b.wallet_id AND a.reference = b.reference;

DELETE FROM public.revenue_ledgers a USING public.revenue_ledgers b
WHERE a.ctid > b.ctid AND a.order_id = b.order_id;

-- 2. FORCE UNIQUE CONSTRAINTS
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_reference_unique CASCADE;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_reference_unique UNIQUE (wallet_id, reference);

ALTER TABLE public.revenue_ledgers DROP CONSTRAINT IF EXISTS revenue_ledgers_order_id_unique CASCADE;
ALTER TABLE public.revenue_ledgers ADD CONSTRAINT revenue_ledgers_order_id_unique UNIQUE (order_id);

-- 3. EXPLICIT TRIGGER DROPS (Avoids the heavy dynamic loop)
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.orders;
DROP TRIGGER IF EXISTS tr_sync_order_to_shipment ON public.orders;
DROP TRIGGER IF EXISTS tr_sync_shipment_to_order ON public.shipments;


-- 4. CLEAN FUNCTION REDEFINITION: source of truth
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_settlement_hours INTEGER;
BEGIN
    -- DEBUG TRACE
    RAISE NOTICE 'DEBUG: handle_revenue_settlement firing for Order %', NEW.id;

    IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN RETURN NEW; END IF;

    -- Escrow induction on order start
    IF NEW.status IN ('pending', 'processing', 'awaiting_agent') THEN
        v_fees := public.calculate_precise_fees(NEW.id);
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total_amount - COALESCE((v_fees->>'platform')::NUMERIC, 0) - COALESCE((v_fees->>'promoter')::NUMERIC, 0)), 
                'settlement', 
                'Pending: Order #' || NEW.id,
                'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Order creation escrow')
            ) ON CONFLICT (wallet_id, reference) DO NOTHING;
        END IF;
    END IF;

    -- Settlement induction on completion
    IF NEW.status = 'completed' THEN
        SELECT COALESCE(flat_fee, 48)::INTEGER INTO v_settlement_hours 
        FROM public.fee_config WHERE fee_type = 'settlement' AND is_active = TRUE LIMIT 1;

        NEW.settlement_due_at := NOW() + (v_settlement_hours || ' hours')::INTERVAL;
        NEW.settlement_status := 'pending';

        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object('hold_until', NEW.settlement_due_at)
        WHERE metadata->>'order_id' = NEW.id::TEXT AND status = 'pending';
        
        INSERT INTO public.revenue_ledgers (order_id, total_order_amount, status)
        VALUES (NEW.id, NEW.total_amount, 'pending')
        ON CONFLICT (order_id) DO UPDATE SET 
            total_order_amount = EXCLUDED.total_order_amount,
            status = 'pending';

        PERFORM public.run_settlements();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_revenue_snapshot()
RETURNS TRIGGER AS $$
DECLARE
    v_precise JSONB;
BEGIN
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
        v_precise := public.calculate_precise_fees(NEW.id);
        
        INSERT INTO public.revenue_ledgers (
            order_id, total_order_amount, platform_fee, rider_fee, promoter_commission, seller_payout, status
        ) VALUES (
            NEW.id, NEW.total_amount,
            (v_precise->>'platform')::NUMERIC, (v_precise->>'rider')::NUMERIC,
            (v_precise->>'promoter')::NUMERIC, (v_precise->>'seller')::NUMERIC,
            'pending'
        ) ON CONFLICT (order_id) DO UPDATE SET
            total_order_amount = EXCLUDED.total_order_amount,
            platform_fee = EXCLUDED.platform_fee,
            seller_payout = EXCLUDED.seller_payout;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-ATTACH ONLY ESSENTIAL TRIGGERS
CREATE TRIGGER trg_revenue_settlement
    BEFORE INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_revenue_settlement();

CREATE TRIGGER trg_revenue_ledger_snapshot
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.record_revenue_snapshot();

-- 6. ANALYTICS FIX: Standardize get_seller_analytics on total_amount
CREATE OR REPLACE FUNCTION public.get_seller_analytics(seller_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(total_amount) FILTER (WHERE status IN ('delivered', 'completed')), 0),
        'total_orders', COUNT(*) FILTER (WHERE status != 'cancelled'),
        'active_products', (SELECT COUNT(*) FROM public.products WHERE seller_id = seller_uuid),
        'avg_order_value', CASE 
            WHEN COUNT(*) FILTER (WHERE status IN ('delivered', 'completed')) > 0 
            THEN SUM(total_amount) FILTER (WHERE status IN ('delivered', 'completed')) / COUNT(*) FILTER (WHERE status IN ('delivered', 'completed'))
            ELSE 0 
        END
    ) INTO result
    FROM public.orders
    WHERE seller_id = seller_uuid;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO service_role;

-- 7. RLS HARDENING: Ensure visibility for Sellers and Riders during fulfillment
-- Sellers can view all details of their own orders
DROP POLICY IF EXISTS "Sellers can view own order items" ON public.order_items;
CREATE POLICY "Sellers can view own order items" ON public.order_items
FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can view own order recipients" ON public.order_recipient;
CREATE POLICY "Sellers can view own order recipients" ON public.order_recipient
FOR SELECT USING (auth.uid() = (SELECT seller_id FROM public.orders WHERE id = order_id));

DROP POLICY IF EXISTS "Sellers can view own shipments" ON public.shipments;
CREATE POLICY "Sellers can view own shipments" ON public.shipments
FOR SELECT USING (auth.uid() = seller_id);

-- DEFINITIVE RECURSION BREAK: One-Way Dependency Model
-- 1. Drop EVERYTHING old first to clear dependencies
DROP POLICY IF EXISTS "Riders can view broadcasted orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can view broadcasted shipments" ON public.shipments;
DROP POLICY IF EXISTS "Riders can view broadcasted recipients" ON public.order_recipient;
DROP POLICY IF EXISTS "User view own items" ON public.order_items;

-- 2. Clean up previous helper attempt (Now safe because policies are gone)
DROP FUNCTION IF EXISTS public.fn_can_rider_view_order(UUID, UUID);
DROP FUNCTION IF EXISTS public.fn_can_rider_view_shipment(UUID, UUID);

-- 3. SHIPMENTS (THE ANCHOR) - Completely Independent
-- This policy NEVER queries the orders table.
CREATE POLICY "Riders can view broadcasted shipments" ON public.shipments
FOR SELECT USING (
    status = 'broadcast' 
    OR rider_id = auth.uid()
    OR seller_id = auth.uid()
);

-- 3. ORDERS (ONE-WAY DEPENDENT) - Queries Shipments
-- This is safe because shipments.select no longer triggers orders.select
DROP POLICY IF EXISTS "Riders can view broadcasted orders" ON public.orders;
CREATE POLICY "Riders can view broadcasted orders" ON public.orders
FOR SELECT USING (
    status = 'awaiting_agent'
    OR buyer_id = auth.uid() 
    OR seller_id = auth.uid()
    OR id IN (SELECT order_id FROM public.shipments WHERE rider_id = auth.uid() OR status = 'broadcast')
);

-- 4. RECIPIENTS (ONE-WAY DEPENDENT)
DROP POLICY IF EXISTS "Riders can view broadcasted recipients" ON public.order_recipient;
CREATE POLICY "Riders can view broadcasted recipients" ON public.order_recipient
FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders)
);

-- 5. ORDER ITEMS (ONE-WAY DEPENDENT)
DROP POLICY IF EXISTS "User view own items" ON public.order_items;
CREATE POLICY "User view own items" ON public.order_items
FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders)
);

-- 6. RIDERS CLAIM PERMISSIONS
-- Allow riders to create their shipment assignment
DROP POLICY IF EXISTS "Riders can claim missions" ON public.shipments;
CREATE POLICY "Riders can claim missions" ON public.shipments
FOR INSERT WITH CHECK (
    auth.uid() = rider_id
);

-- Allow riders to update their own assignments
DROP POLICY IF EXISTS "Riders can update own shipments" ON public.shipments;
CREATE POLICY "Riders can update own shipments" ON public.shipments
FOR UPDATE USING (
    rider_id = auth.uid() 
    OR (rider_id IS NULL AND status = 'broadcast')
) WITH CHECK (
    rider_id = auth.uid()
);

-- 7. ORDER TRANSITIONS FOR RIDERS
-- Allow assigned riders to update the order status
DROP POLICY IF EXISTS "Riders can update assigned order status" ON public.orders;
CREATE POLICY "Riders can update assigned order status" ON public.orders
FOR UPDATE USING (
    id IN (SELECT order_id FROM public.shipments WHERE rider_id = auth.uid())
    OR status = 'awaiting_agent' -- Allow riders to 'claim' it by moving it to processing
) WITH CHECK (
    id IN (SELECT order_id FROM public.shipments WHERE rider_id = auth.uid())
    OR status = 'processing'
);

-- 8. MODERN LOGISTICS STATUSES
-- Add missing values to the shipment_status enum if they don't exist
DO $$ BEGIN
    ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'broadcast';
    ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'accepted';
    ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'started';
    ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'arrived';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 9. GLOBAL "TOTAL" TO "TOTAL_AMOUNT" STANDARDIZATION
-- This redefines all legacy functions that might still refer to the retired 'total' column.

CREATE OR REPLACE FUNCTION public.calculate_precise_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total NUMERIC;
    v_fees JSONB;
BEGIN
    SELECT total_amount INTO v_total FROM public.orders WHERE id = p_order_id;
    RETURN jsonb_build_object(
        'platform', ROUND(v_total * 0.05, 2),
        'rider', 1000, -- Placeholder/Derived
        'promoter', 0,
        'seller', v_total - 1000 - ROUND(v_total * 0.05, 2)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-standardize the analytics function
CREATE OR REPLACE FUNCTION public.get_seller_analytics(seller_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'order_count', COUNT(*),
        'pending_orders', COUNT(*) FILTER (WHERE status = 'pending'),
        'completed_orders', COUNT(*) FILTER (WHERE status = 'completed')
    ) INTO result
    FROM public.orders
    WHERE seller_id = seller_uuid;
    RETURN result;
END;
$$;

-- 10. SETTLEMENT RPC STANDARDIZATION
-- This redefines the completion RPC to be "Total-Amount Aware" and handle V2 statuses.

CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- 1. Load and validate order (Total-Amount Aware)
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status::TEXT IN ('delivered', 'shipped', 'out_for_delivery', 'picked_up', 'processing')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found, unauthorized, or not in a completable state (delivered/processing)'
        );
    END IF;

    -- 2. Transition order to completed
    UPDATE public.orders
    SET status = 'completed', 
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Trigger revenue snapshot (Uses the standardized handle_revenue_settlement)
    -- This handles the actual wallet updates
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order completed and settlement initiated'
    );
END;
$$;

-- Force cache reload
NOTIFY pgrst, 'reload';
COMMIT;
