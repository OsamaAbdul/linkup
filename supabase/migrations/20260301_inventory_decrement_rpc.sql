-- 20260301_inventory_decrement_rpc.sql
-- This migration provides the RPC function used by the create-order Edge Function.

CREATE OR REPLACE FUNCTION public.decrement_inventory(product_id_input uuid, quantity_input integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Double check inventory is sufficient before decrementing
  UPDATE public.products
  SET inventory = inventory - quantity_input
  WHERE id = product_id_input
  AND inventory >= quantity_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient inventory or product not found for ID: %', product_id_input;
  END IF;
END;
$$;

-- Ensure the function is owned by postgres as it's used by the admin client in Edge Functions
ALTER FUNCTION public.decrement_inventory(uuid, integer) OWNER TO postgres;

COMMENT ON FUNCTION public.decrement_inventory IS 'Atomic inventory decrement with stock validation - 20260301';