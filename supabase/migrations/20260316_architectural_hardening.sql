-- Migration: Architectural Hardening & Refinement
-- 1. Price Spoofing Protection in create_order
-- 2. Automated Escrow Release on Shipment Delivery
-- 3. Location Normalization (Removing legacy Enum usage)
-- 4. Shipment Data Integrity (Enforcing Enum)

-- ============================================================
-- 1. HARDEN create_order RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order(
    p_items JSONB,
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_city_id UUID DEFAULT NULL,
    p_zone_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_item RECORD;
    v_first_seller_id UUID;
    v_product_price NUMERIC;
    v_calculated_total NUMERIC := 0;
BEGIN
    -- Preliminary: Get the first seller for the order table (legacy column)
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- Initial insert with provided total (will be updated or validated)
    INSERT INTO public.orders (
        buyer_id, seller_id, status, payment_status, total, 
        shipping_address, items, city_id, zone_id
    )
    VALUES (
        auth.uid(), v_first_seller_id, 'pending', 'paid', p_total, 
        p_shipping_address, p_items, p_city_id, p_zone_id
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, seller_id UUID)
    LOOP
        -- SECURITY: Fetch AUTHENTIC price from products table
        SELECT price INTO v_product_price FROM public.products WHERE id = v_item.product_id;
        
        IF v_product_price IS NULL THEN
            RAISE EXCEPTION 'Product % not found', v_item.product_id;
        END IF;

        v_calculated_total := v_calculated_total + (v_product_price * v_item.quantity);

        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
        VALUES (v_order_id, v_item.product_id, v_item.seller_id, v_item.quantity, v_product_price);

        -- Inventory management
        UPDATE public.products SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id AND inventory >= v_item.quantity;

        IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory for product ID %', v_item.product_id; END IF;
    END LOOP;

    -- Update order total with calculated value if it differs (hardening against price spoofing)
    UPDATE public.orders SET total = v_calculated_total WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'final_total', v_calculated_total);
END;
$$;

-- ============================================================
-- 2. AUTOMATED ESCROW RELEASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_shipment_delivery_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_total NUMERIC;
    v_seller_id UUID;
    v_wallet_id UUID;
BEGIN
    -- release funds when shipment is 'delivered'
    IF NEW.status::TEXT = 'delivered' AND OLD.status::TEXT != 'delivered' THEN
        v_order_id := NEW.order_id;
        
        -- Get order details
        SELECT total, seller_id INTO v_total, v_seller_id 
        FROM public.orders WHERE id = v_order_id;

        -- Find seller's wallet
        SELECT id INTO v_wallet_id FROM public.wallets 
        WHERE user_id = v_seller_id OR seller_id = v_seller_id LIMIT 1;

        IF v_wallet_id IS NOT NULL THEN
            -- Move from escrow to balance
            UPDATE public.wallets 
            SET balance = balance + v_total,
                escrow_balance = GREATEST(0, escrow_balance - v_total),
                updated_at = NOW()
            WHERE id = v_wallet_id;

            -- Record Transaction
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_wallet_id, v_total, 'settlement', 'Escrow release for Order #' || v_order_id);
            
            -- Notify Seller
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_seller_id, 'payment', 'Payment of ₦' || v_total || ' released from escrow for order #' || LEFT(v_order_id::TEXT, 8));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. LOCATION NORMALIZATION (Drop legacy Enum columns)
-- ============================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS zone;
ALTER TABLE public.seller_verifications DROP COLUMN IF EXISTS zone;
ALTER TABLE public.orders DROP COLUMN IF EXISTS zone;

-- ============================================================
-- 4. SHIPMENT DATA INTEGRITY
-- ============================================================
-- IMPORTANT: Alter column type BEFORE creating the trigger to avoid dependency errors
ALTER TABLE public.shipments 
ALTER COLUMN status TYPE public.shipment_status USING status::public.shipment_status;

-- ============================================================
-- 2. AUTOMATED ESCROW RELEASE (Trigger Creation)
-- ============================================================
DROP TRIGGER IF EXISTS tr_release_escrow_on_delivery ON public.shipments;
CREATE TRIGGER tr_release_escrow_on_delivery
AFTER UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_shipment_delivery_settlement();

-- PostgREST Refresh
NOTIFY pgrst, 'reload schema';
