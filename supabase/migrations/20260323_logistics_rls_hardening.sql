-- RLS HARDENING FOR LOGISTICS METADATA
-- Target Tables: cities, delivery_zones, vehicle_types

-- 1. CITIES
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view cities" ON public.cities;
CREATE POLICY "Allow all users to view cities" 
ON public.cities FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to cities" ON public.cities;
CREATE POLICY "Admins have full access to cities" 
ON public.cities FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- 2. DELIVERY ZONES
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view delivery_zones" ON public.delivery_zones;
CREATE POLICY "Allow all users to view delivery_zones" 
ON public.delivery_zones FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to delivery_zones" ON public.delivery_zones;
CREATE POLICY "Admins have full access to delivery_zones" 
ON public.delivery_zones FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- 3. VEHICLE TYPES (Ensure robustness)
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to view vehicle_types" ON public.vehicle_types;
CREATE POLICY "Allow all users to view vehicle_types" 
ON public.vehicle_types FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins have full access to vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admins have full access to vehicle_types" 
ON public.vehicle_types FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- Reload schema
NOTIFY pgrst, 'reload schema';
