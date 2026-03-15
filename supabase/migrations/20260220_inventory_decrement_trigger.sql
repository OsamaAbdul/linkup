-- Create an atomic RPC function for safe inventory decrement
-- This is called by both the edge function and can be used independently
CREATE OR REPLACE FUNCTION decrement_inventory(p_product_id UUID, p_quantity INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET inventory = GREATEST(0, inventory - p_quantity)
  WHERE id = p_product_id;
END;
$$;

-- Also create/replace the trigger function
CREATE OR REPLACE FUNCTION decrement_inventory_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM decrement_inventory(NEW.product_id, NEW.quantity);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_decrement_inventory ON order_items_new;

-- Attach trigger to fire after each row is inserted into order_items_new
CREATE TRIGGER trigger_decrement_inventory
  AFTER INSERT ON order_items_new
  FOR EACH ROW
  EXECUTE FUNCTION decrement_inventory_on_order();
