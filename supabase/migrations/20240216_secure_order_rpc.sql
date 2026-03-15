-- Secure Order Creation with Stock Checks
-- This function replaces the basic create_order to add:
-- 1. Validation that products exist.
-- 2. Validation that sufficient inventory exists.
-- 3. Atomic deduction of inventory upon order creation.

CREATE OR REPLACE FUNCTION public.create_order(
    employer_id UUID, -- Argument name kept for compatibility, represents buyer
    seller_id UUID,
    items JSONB, -- Array of objects: {product_id, quantity, price}
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
    product_record RECORD;
    item_qty INTEGER;
    item_id UUID;
BEGIN
    -- 1. Validate Stock for ALL items before making any changes
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;

        -- Lock the product row for update to prevent race conditions
        SELECT * INTO product_record FROM public.products WHERE id = item_id FOR UPDATE;

        IF product_record IS NULL THEN
             RAISE EXCEPTION 'Product % not found', item_id;
        END IF;

        IF product_record.inventory < item_qty THEN
             RAISE EXCEPTION 'Insufficient stock for product: % (Available: %, Requested: %)', product_record.title, product_record.inventory, item_qty;
        END IF;
    END LOOP;

    -- 2. Create the Order
    INSERT INTO public.orders (buyer_id, seller_id, status, payment_status, total_amount, shipping_address)
    VALUES (auth.uid(), seller_id, 'pending', 'paid', total_amount, shipping_address)
    RETURNING id INTO new_order_id;

    -- 3. Deduct Stock and Create Order Items
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_id := (item->>'product_id')::UUID;
        item_qty := (item->>'quantity')::INTEGER;

        -- Deduct inventory
        UPDATE public.products
        SET inventory = inventory - item_qty
        WHERE id = item_id;

        -- Insert order item
        INSERT INTO public.order_items (order_id, product_id, seller_id, quantity, price_at_purchase, status)
        VALUES (
            new_order_id,
            item_id,
            seller_id,
            item_qty,
            (item->>'price')::DECIMAL,
            'pending'
        );
    END LOOP;

    RETURN new_order_id;
END;
$$;
