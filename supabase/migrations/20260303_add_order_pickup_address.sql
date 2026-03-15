-- MIGRATION: 20260303_add_order_pickup_address
-- Adds pickup_address to orders and updates creation RPC.

-- 1. Add pickup_address column to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_address JSONB;

-- 2. Update create_order_v3 to handle pickup_address
CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_pickup_address JSONB DEFAULT NULL -- New parameter
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
    -- 1. Extract first seller_id for the orders table legacy column
    v_first_seller_id := (p_items->0->>'seller_id')::UUID;

    -- 2. Create the Master Order record
    INSERT INTO public.orders (
        buyer_id, 
        seller_id, 
        status, 
        payment_status, 
        total, 
        shipping_address, 
        pickup_address, -- Store the new pickup address
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

    -- 3. Process each item: insert into items table and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC, seller_id UUID)
    LOOP
        -- a. Insert into order_items_new for detailed tracking
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

        -- b. Atomic Inventory Check and Decrement
        UPDATE public.products
        SET inventory = inventory - v_item.quantity
        WHERE id = v_item.product_id
        AND inventory >= v_item.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient inventory for product ID: %', v_item.product_id;
        END IF;
    END LOOP;

    -- 4. Return success result
    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'status', 'success',
        'message', 'Order created atomically'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Ownership ensure
ALTER FUNCTION public.create_order_v3(UUID, JSONB, JSONB, NUMERIC, JSONB) OWNER TO postgres;
