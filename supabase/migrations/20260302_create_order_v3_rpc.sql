-- 20260302_create_order_v3_rpc.sql
-- Atomic Order Creation with Inventory Protection

CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC
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
        items
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
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
        -- This will automatically fail the transaction if quantity is insufficient or item doesn't exist
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
    -- In PostgreSQL, any error RAISEd within a function automatically rolls back the entire transaction wrap.
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Ownership ensure
ALTER FUNCTION public.create_order_v3(UUID, JSONB, JSONB, NUMERIC) OWNER TO postgres;

COMMENT ON FUNCTION public.create_order_v3 IS 'Robust atomic order creation with transactional inventory decrement - 20260302';
