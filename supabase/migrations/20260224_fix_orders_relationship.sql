-- Fix relationship between orders and profiles (buyer/seller)
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT orders_buyer_id_fkey ON public.orders IS 'PostgREST join reference for buyer profile';
COMMENT ON CONSTRAINT orders_seller_id_fkey ON public.orders IS 'PostgREST join reference for seller profile';
