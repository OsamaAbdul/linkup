-- Migration: 20260317_role_management.sql
-- Description: Enforces Seller vs Promoter exclusivity and provides role management utilities.

-- 1. Trigger function to enforce exclusivity
CREATE OR REPLACE FUNCTION public.check_role_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
    -- If adding 'seller', check if 'promoter' already exists
    IF NEW.role = 'seller' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.user_id AND role = 'promoter'
        ) THEN
            RAISE EXCEPTION 'User cannot be both a seller and a promoter.';
        END IF;
    END IF;

    -- If adding 'promoter', check if 'seller' already exists
    IF NEW.role = 'promoter' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.user_id AND role = 'seller'
        ) THEN
            RAISE EXCEPTION 'User cannot be both a seller and a promoter.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_ensure_role_exclusivity ON public.user_roles;
CREATE TRIGGER trg_ensure_role_exclusivity
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.check_role_exclusivity();

-- 3. RPC for role management
-- This allows setting multiple roles at once securely.
CREATE OR REPLACE FUNCTION public.manage_user_roles(
    p_user_id UUID,
    p_roles TEXT[]
)
RETURNS VOID AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Delete existing roles
    DELETE FROM public.user_roles WHERE user_id = p_user_id;

    -- Insert new roles
    -- The trigger will automatically validate the Seller/Promoter exclusivity
    FOREACH v_role IN ARRAY p_roles
    LOOP
        INSERT INTO public.user_roles (user_id, role)
        VALUES (p_user_id, v_role::public.app_role);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
