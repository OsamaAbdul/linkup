-- Create vehicle_types table
CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read labels
CREATE POLICY "Allow all authenticated users to read vehicle_types"
ON public.vehicle_types
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage
-- (Assuming there is a way to check for admin role, similar to existing policies)
CREATE POLICY "Allow admins to manage vehicle_types"
ON public.vehicle_types
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Seed defaults
INSERT INTO public.vehicle_types (name)
VALUES 
    ('Bicycle'),
    ('Motorcycle'),
    ('Car/Sedan'),
    ('Van/Mini-bus'),
    ('Truck/Delivery Van')
ON CONFLICT (name) DO NOTHING;
