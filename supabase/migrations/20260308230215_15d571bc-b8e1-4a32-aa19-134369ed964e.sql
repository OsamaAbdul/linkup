
-- 1. Add missing columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS zone_id uuid,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Add likes_count, city_id, zone_id to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS zone_id uuid;

-- 3. Add enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 4. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Sellers can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Create cities table
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);

-- 6. Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  delivery_fee numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);

-- 7. Create shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  rider_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  pickup_address text,
  delivery_address text,
  buyer_latitude double precision,
  buyer_longitude double precision,
  rider_latitude double precision,
  rider_longitude double precision,
  last_seen timestamptz,
  delivery_fee numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders can view assigned shipments" ON public.shipments FOR SELECT TO authenticated USING (rider_id = auth.uid() OR status = 'broadcast');
CREATE POLICY "Riders can update assigned shipments" ON public.shipments FOR UPDATE TO authenticated USING (rider_id = auth.uid());
CREATE POLICY "Authenticated can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (true);

-- 8. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

-- 9. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- 10. Create logistics_kyc table
CREATE TABLE IF NOT EXISTS public.logistics_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  home_address text NOT NULL,
  date_of_birth text,
  passport_photo_url text,
  city_id uuid REFERENCES public.cities(id),
  zone_id uuid REFERENCES public.delivery_zones(id),
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own kyc" ON public.logistics_kyc FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 11. Foreign keys for city/zone references
ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);
ALTER TABLE public.products ADD CONSTRAINT products_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);
ALTER TABLE public.products ADD CONSTRAINT products_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id);

-- 12. Create trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Insert default city
INSERT INTO public.cities (name, is_active) VALUES ('Abuja', true) ON CONFLICT (name) DO NOTHING;

-- 14. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;

-- 15. Allow user_roles insert for onboarding
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
