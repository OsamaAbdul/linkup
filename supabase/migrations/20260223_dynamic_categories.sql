-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Sellers/Admins can add categories" ON public.categories FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('seller', 'admin')
    )
);

CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Seed existing categories
INSERT INTO public.categories (name, slug) VALUES 
('Electronics', 'electronics'),
('Fashion', 'fashion'),
('Home & Kitchen', 'home-kitchen'),
('Health & Beauty', 'health-beauty'),
('Sports', 'sports'),
('Toys', 'toys'),
('Automotive', 'automotive'),
('Grocery', 'grocery'),
('Services', 'services'),
('Other', 'other')
ON CONFLICT (name) DO NOTHING;
