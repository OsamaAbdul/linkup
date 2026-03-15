-- MIGRATION: 20260303_fix_rpc_ambiguity.sql
-- Drops the old version of create_order_v3 to resolve overloading ambiguity.

-- 1. Drop the old 4-parameter version
DROP FUNCTION IF EXISTS public.create_order_v3(UUID, JSONB, JSONB, NUMERIC);

-- 2. Ensure the 5-parameter version (with DEFAULT) is the only one remaining
-- This was already created in 20260303_add_order_pickup_address.sql but we re-verify just in case.
CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB,
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_pickup_address JSONB DEFAULT NULL
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
BEGIN
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        pickup_address,
        items
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_pickup_address,
        p_items
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        INSERT INTO public.order_items_new (
            order_id, 
            product_id, 
            seller_id, 
            quantity, 
            price_at_purchase
        )
        VALUES (
            v_order_id, 
            v_item.product_id, 
            v_item.seller_id, 
            v_item.quantity, 
            v_item.price
        );

        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );
END;
$$;
