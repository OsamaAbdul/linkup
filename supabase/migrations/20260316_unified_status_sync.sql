-- Migration: Unified Status State Machine (REFINED)
-- 20260316_unified_status_sync.sql
-- Synchronizes orders and shipments tables to work "hand in hand".

-- 1. Helper to sync Shipment status back to Order
CREATE OR REPLACE FUNCTION public.sync_shipment_to_order_status()
RETURNS TRIGGER AS $$
DECLARE
    v_new_order_status public.order_status;
BEGIN
    -- Map shipment status to order status
    v_new_order_status := CASE 
        WHEN NEW.status::TEXT = 'broadcast' THEN 'awaiting_agent'::public.order_status
        WHEN NEW.status::TEXT = 'accepted' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'out_for_pickup' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'arrived_at_seller' THEN 'accepted'::public.order_status
        WHEN NEW.status::TEXT = 'picked_up' THEN 'picked_up'::public.order_status
        WHEN NEW.status::TEXT = 'out_for_delivery' THEN 'out_for_delivery'::public.order_status
        WHEN NEW.status::TEXT = 'arrived_at_destination' THEN 'out_for_delivery'::public.order_status
        WHEN NEW.status::TEXT = 'delivered' THEN 'delivered'::public.order_status
        WHEN NEW.status::TEXT = 'cancelled' THEN 'cancelled'::public.order_status
        WHEN NEW.status::TEXT = 'failed' THEN 'cancelled'::public.order_status
        ELSE NULL
    END;

    IF v_new_order_status IS NOT NULL THEN
        UPDATE public.orders
        SET status = v_new_order_status,
            updated_at = NOW()
        WHERE id = NEW.order_id
        AND status::TEXT != v_new_order_status::TEXT;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper to sync Order status to Shipment (and handle auto-creation)
CREATE OR REPLACE FUNCTION public.sync_order_to_shipment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_shipment_id UUID;
BEGIN
    -- A. AUTO-CREATION: When order is accepted (confirmed) or broadcast (awaiting_agent)
    IF NEW.status::TEXT IN ('confirmed', 'awaiting_agent') AND OLD.status::TEXT = 'pending' THEN
        -- Check if shipment already exists
        SELECT id INTO v_shipment_id FROM public.shipments WHERE order_id = NEW.id;
        
        IF v_shipment_id IS NULL THEN
            INSERT INTO public.shipments (
                order_id,
                seller_id,
                status,
                tracking_code,
                delivery_address,
                zone_id,
                city_id,
                pickup_address -- Placeholder or derived if available
            ) VALUES (
                NEW.id,
                NEW.seller_id,
                CASE WHEN NEW.status::TEXT = 'awaiting_agent' THEN 'broadcast'::public.shipment_status ELSE 'assigned'::public.shipment_status END,
                'LK-' || UPPER(substring(md5(random()::text) from 1 for 8)),
                NEW.shipping_address::TEXT,
                NEW.zone_id,
                NEW.city_id,
                'Seller Shop' -- Default placeholder
            ) RETURNING id INTO v_shipment_id;
            
            -- Automatically link all order items to this shipment
            UPDATE public.order_items
            SET shipment_id = v_shipment_id
            WHERE order_id = NEW.id AND shipment_id IS NULL;
        END IF;
    END IF;

    -- B. SYNC: If order moves to awaiting_agent, ensure shipment is broadcast
    IF NEW.status::TEXT = 'awaiting_agent' AND OLD.status::TEXT != 'awaiting_agent' THEN
        UPDATE public.shipments
        SET status = 'broadcast', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'broadcast';
    END IF;

    -- C. FINALIZATION: If buyer completes order, mark shipment as delivered
    IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT != 'completed' THEN
        UPDATE public.shipments
        SET status = 'delivered', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'delivered';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECREATE TRIGGERS
DROP TRIGGER IF EXISTS tr_sync_shipment_to_order ON public.shipments;
CREATE TRIGGER tr_sync_shipment_to_order
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipment_to_order_status();

DROP TRIGGER IF EXISTS tr_sync_order_to_shipment ON public.orders;
CREATE TRIGGER tr_sync_order_to_shipment
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_to_shipment_status();

-- 4. HOUSEKEEPING: Reload schema
NOTIFY pgrst, 'reload schema';
