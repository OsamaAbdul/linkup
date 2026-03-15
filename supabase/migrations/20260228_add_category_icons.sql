-- Migration: 20260228_add_category_icons
-- Adds icon column to categories table for UI display.

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS icon TEXT;

-- Seed some default icons for existing categories
UPDATE public.categories SET icon = 'Smartphone' WHERE slug = 'electronics';
UPDATE public.categories SET icon = 'Shirt' WHERE slug = 'fashion';
UPDATE public.categories SET icon = 'HomeIcon' WHERE slug = 'home-kitchen';
UPDATE public.categories SET icon = 'Activity' WHERE slug = 'health-beauty';
UPDATE public.categories SET icon = 'Footprints' WHERE slug = 'sports';
UPDATE public.categories SET icon = 'Gamepad' WHERE slug = 'toys';
UPDATE public.categories SET icon = 'Car' WHERE slug = 'automotive';
UPDATE public.categories SET icon = 'ShoppingBag' WHERE slug = 'grocery';
UPDATE public.categories SET icon = 'Settings' WHERE slug = 'services';
UPDATE public.categories SET icon = 'Grid' WHERE slug = 'other';
