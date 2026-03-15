-- Migration: Add inventory stock management
-- Ensures inventory cannot go below 0 and adds a constraint

-- Add default 0 to inventory if column exists, make it NOT NULL
ALTER TABLE products
  ALTER COLUMN inventory SET DEFAULT 0;

UPDATE products SET inventory = 0 WHERE inventory IS NULL;

ALTER TABLE products
  ALTER COLUMN inventory SET NOT NULL;

-- Add check constraint to prevent negative inventory
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_inventory_non_negative;

ALTER TABLE products
  ADD CONSTRAINT products_inventory_non_negative CHECK (inventory >= 0);

-- Expose inventory via RLS so buyers can read it
-- (products table is already readable, this just confirms inventory is accessible)
