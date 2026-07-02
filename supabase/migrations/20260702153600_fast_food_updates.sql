-- Add new categories
INSERT INTO public.categories (name, slug, icon)
VALUES 
  ('Fast Food', 'fast-food', 'hamburger'),
  ('Restaurant', 'restaurant', 'utensils')
ON CONFLICT (slug) DO NOTHING;

-- Add is_active column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing products to be active
UPDATE public.products SET is_active = true WHERE is_active IS NULL;

-- Enable Realtime for notifications to ensure instant updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
