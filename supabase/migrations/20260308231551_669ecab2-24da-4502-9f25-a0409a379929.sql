
CREATE TABLE IF NOT EXISTS public.seller_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  business_address text,
  bank_name text,
  account_number text,
  account_name text,
  national_id_url text,
  store_photo_url text,
  city_id uuid REFERENCES public.cities(id),
  zone_id uuid REFERENCES public.delivery_zones(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own verification" ON public.seller_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
