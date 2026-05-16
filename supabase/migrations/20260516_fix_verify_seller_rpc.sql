-- Fix the RPC signature for verify_seller_kyc so that PostgREST can resolve the string argument correctly

-- Ensure the required columns exist before updating the RPC
ALTER TABLE public.seller_verifications 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

DROP FUNCTION IF EXISTS public.verify_seller_kyc(UUID, public.verification_status);

CREATE OR REPLACE FUNCTION public.verify_seller_kyc(
    verification_id UUID,
    review_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Check if verification exists
    SELECT user_id INTO target_user_id
    FROM public.seller_verifications
    WHERE id = verification_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Verification not found';
    END IF;

    -- Update verification status
    UPDATE public.seller_verifications
    SET 
        status = review_status::public.verification_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = verification_id;

    -- If approved, grant seller role
    IF review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'seller')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END;
$$;

-- Notify PostgREST to reload the schema cache so the new signature is immediately available
NOTIFY pgrst, 'reload schema';
