-- RPC Function to create an order atomically
CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID, -- using 'employer_id' name to match some potential legacy or just generic 'buyer_id'
    seller_id UUID,
    items JSONB, -- Array of {product_id, quantity, price}
    shipping_address JSONB,
    total_amount DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id UUID;
    item JSONB;
BEGIN
    -- 1. Insert into orders
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total_amount, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total_amount, shipping_address) -- Assuming payment is handled/simulated as 'paid' for now
    RETURNING id INTO new_order_id;

    -- 2. Insert items
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase, status)
        VALUES (
            new_order_id,
            (item->>'product_id')::UUID,
            seller_id,
            (item->>'quantity')::INTEGER,
            (item->>'price')::DECIMAL,
            'pending'
        );
    END LOOP;

    -- 3. Clear cart for this seller's products (Optional, but good UX)
    -- DELETE FROM public.cart_items WHERE user_id = auth.uid() AND product_id IN (SELECT (item->>'product_id')::UUID);

    RETURN new_order_id;
END;
$$;
