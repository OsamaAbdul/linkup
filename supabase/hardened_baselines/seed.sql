-- linkup-marketplace/supabase/seed.sql
-- Hydrates a fresh Supabase environment with essential production data.
-- Run with: supabase db reset (or manually in SQL Editor)

-- 1. SEED CITIES & ZONES (NIGERIA/ABUJA)
INSERT INTO public.cities (name, is_active) VALUES ('Abuja', true);

-- Abuja zones with varying delivery fees
INSERT INTO public.delivery_zones (city_id, name, delivery_fee, is_active)
SELECT 
    (SELECT id FROM public.cities WHERE name='Abuja'),
    name,
    fee,
    true
FROM (VALUES 
    ('Gwarinpa', 1500),
    ('Wuse II', 1200),
    ('Maitama', 1800),
    ('Asokoro', 1800),
    ('Utako', 1200),
    ('Kubwa', 2500)
) AS t(name, fee);

-- 2. SEED FEE CONFIGURATION (Phase 11 Logic)
INSERT INTO public.fee_config (name, fee_type, rate, flat_fee, priority, is_active)
VALUES
    ('Platform Fee (Standard)', 'platform', 0.05, 0, 10, true),
    ('Rider Base Fee', 'rider', 0, 1500, 10, true),
    ('Promoter Commission (Variable)', 'promoter', 0.10, 0, 1, true),
    ('Out-of-Zone Bonus', 'rider_out_of_zone', 0, 500, 10, true)
ON CONFLICT (name) DO NOTHING;

-- 3. SEED PLATFORM WALLET (SYSTEM)
-- This is the recipient of all platform fees.
INSERT INTO public.profiles (id, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Linkup Revenue')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (id, user_id, balance)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 0)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED ADMIN USER (Optional placeholder)
-- Note: Replace with real UID after signup
-- INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR-USER-ID', 'admin');
