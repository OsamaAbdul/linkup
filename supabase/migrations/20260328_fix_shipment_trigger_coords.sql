-- MIGRATION: 20260328_fix_shipment_trigger_coords
-- Fixes the sync_order_to_shipment_status trigger to correctly copy coordinates and addresses with multi-tier fallbacks.
-- Updated: Uses shipping_info instead of non-existent pickup_address column in orders.

CREATE OR REPLACE FUNCTION public.sync_order_to_shipment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_shipment_id UUID;
    v_pickup_addr TEXT;
    v_seller_profile RECORD;
    v_seller_verif RECORD;
BEGIN
    -- A. AUTO-CREATION: When order is accepted (confirmed) or broadcast (awaiting_agent)
    IF NEW.status IN ('confirmed', 'awaiting_agent') AND OLD.status = 'pending' THEN
        -- Check if shipment already exists
        SELECT id INTO v_shipment_id FROM public.shipments WHERE order_id = NEW.id;
        
        IF v_shipment_id IS NULL THEN
            -- Fetch fallbacks
            SELECT address, latitude, longitude INTO v_seller_profile FROM public.profiles WHERE id = NEW.seller_id;
            SELECT business_address INTO v_seller_verif FROM public.seller_verifications WHERE user_id = NEW.seller_id;

            -- Derive pickup address from shipping_info (Json), profile, or verification
            v_pickup_addr := COALESCE(
                NULLIF(NEW.shipping_info->>'address', ''),
                NULLIF(NEW.shipping_info->>'pickup_address', ''),
                NULLIF(v_seller_profile.address, ''),
                NULLIF(v_seller_verif.business_address, ''),
                'Seller Shop'
            );

            INSERT INTO public.shipments (
                order_id,
                seller_id,
                status,
                tracking_code,
                delivery_address,
                pickup_address,
                zone_id,
                city_id,
                zone,
                broadcast_zone,
                pickup_latitude,
                pickup_longitude,
                buyer_latitude,
                buyer_longitude
            ) VALUES (
                NEW.id,
                NEW.seller_id,
                CASE WHEN NEW.status = 'awaiting_agent' THEN 'broadcast'::public.shipment_status ELSE 'assigned'::public.shipment_status END,
                'LK-' || UPPER(substring(md5(random()::text) from 1 for 8)),
                NEW.shipping_info::TEXT, -- Fallback if delivery_address not split
                v_pickup_addr,
                NEW.zone_id,
                NEW.city_id,
                NEW.broadcast_zone,
                NEW.broadcast_zone,
                COALESCE(NEW.pickup_lat, v_seller_profile.latitude),
                COALESCE(NEW.pickup_lng, v_seller_profile.longitude),
                NEW.delivery_lat,
                NEW.delivery_lng
            ) RETURNING id INTO v_shipment_id;
            
            -- Automatically link all order items to this shipment
            UPDATE public.order_items
            SET shipment_id = v_shipment_id
            WHERE order_id = NEW.id AND shipment_id IS NULL;
        END IF;
    END IF;

    -- B. SYNC: If order moves to awaiting_agent, ensure shipment is broadcast
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        UPDATE public.shipments
        SET status = 'broadcast', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'broadcast';
    END IF;

    -- C. FINALIZATION: If buyer completes order, mark shipment as delivered
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.shipments
        SET status = 'delivered', updated_at = NOW()
        WHERE order_id = NEW.id AND status::TEXT != 'delivered';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
