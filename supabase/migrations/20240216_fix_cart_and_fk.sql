-- Fix Product-Profile Relationship
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Ensure public visibility for products
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);

-- Fix Cart RLS (Enable access for authenticated users)
-- First, ensure RLS is enabled (it should be, but just in case)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;

-- Create Policies
CREATE POLICY "Users can view their own cart items" ON public.cart_items
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart items" ON public.cart_items
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart items" ON public.cart_items
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items" ON public.cart_items
FOR DELETE USING (auth.uid() = user_id);
