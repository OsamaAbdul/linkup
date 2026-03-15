-- MIGRATION: 20260303_scalable_zones_v2.sql
-- Introduction of dedicated tables for cities and zones to support future growth and multi-city operations.

-- 1. Create Cities table
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Delivery Zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    delivery_fee NUMERIC DEFAULT 1500,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(city_id, name)
);

-- 3. Seed initial Abuja data
INSERT INTO public.cities (name) VALUES ('Abuja') ON CONFLICT (name) DO NOTHING;

-- Use a DO block to seed zones based on the newly created city entry
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id FROM public.cities WHERE name = 'Abuja';
    
    INSERT INTO public.delivery_zones (city_id, name) VALUES
    (v_city_id, 'Zone 1 (Gwarinpa & Life Camp)'),
    (v_city_id, 'Zone 2 (Wuse & Utako)'),
    (v_city_id, 'Zone 3 (Kubwa Central)'),
    (v_city_id, 'Zone 4 (Lugbe & Apo)'),
    (v_city_id, 'Zone 5 (Gwagwalada Districts)')
    ON CONFLICT (city_id, name) DO NOTHING;
END $$;

-- 4. Extend orders, shipments, profiles, and verifications with scalable references
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

ALTER TABLE public.logistics_verifications ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);
ALTER TABLE public.logistics_verifications ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id);

-- 5. Update create_order_v3 RPC to support scalable references
-- We maintain the signature but add logic to handle city/zone IDs
CREATE OR REPLACE FUNCTION public.create_order_v3(
    p_buyer_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, price, seller_id}
    p_shipping_address JSONB,
    p_total NUMERIC,
    p_zone public.abuja_zone DEFAULT NULL,
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
        items,
        zone, -- keep for backward compatibility with existing enum logic
        city_id,
        zone_id
    )
    VALUES (
        p_buyer_id, 
        v_first_seller_id, 
        'pending', 
        'paid', 
        p_total, 
        p_shipping_address, 
        p_items,
        p_zone,
        p_city_id,
        p_zone_id
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

-- 6. RLS Policies for Locations
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);

