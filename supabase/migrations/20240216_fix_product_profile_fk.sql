-- Fix Product-Profile Relationship
-- The frontend expects to join products with profiles using the foreign key 'products_seller_id_fkey'.
-- Currently, products.seller_id references auth.users. We need it to reference public.profiles for PostgREST to allow the join easily.

-- 1. Drop existing constraint (name might vary, but we try the standard name)
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

-- 2. Add new constraint referencing profiles
ALTER TABLE public.products
ADD CONSTRAINT products_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. Ensure RLS allows public to view products (Redundant but safe)
DROP POLICY IF EXISTS "Public products" ON public.products;
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
