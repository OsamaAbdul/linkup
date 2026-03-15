-- Create Enums for Order Status and Payment Status
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Drop existing orders table if it conflicts (or alter it, but for this task we might be starting fresh or migrating)
-- NOTE: In a real prod env, we would migrate data. Here we might just alter.
-- Let's alter the existing 'orders' table to be robust.

-- 1. Modify 'orders' table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status order_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- 2. Create 'order_items' table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id), 
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending' 
);

-- 3. RLS Policies for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order items" 
ON public.order_items FOR SELECT 
USING (auth.uid() IN (
    SELECT buyer_id FROM public.orders WHERE id = order_items.order_id
));

CREATE POLICY "Sellers can view items in their orders" 
ON public.order_items FOR SELECT 
USING (seller_id = auth.uid());

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);
