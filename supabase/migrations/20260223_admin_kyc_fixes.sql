-- 1. Fix Foreign Key Relationship for seller_verifications
-- Drop existing constraint
ALTER TABLE public.seller_verifications DROP CONSTRAINT IF EXISTS seller_verifications_user_id_fkey;

-- Re-add constraint pointing to profiles(id)
ALTER TABLE public.seller_verifications 
ADD CONSTRAINT seller_verifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add reviewed columns to seller_verifications
ALTER TABLE public.seller_verifications 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- 3. Create RPC for verifying seller KYC
CREATE OR REPLACE FUNCTION public.verify_seller_kyc(
    verification_id UUID,
    review_status public.verification_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Check if verification exists and is pending
    SELECT user_id INTO target_user_id
    FROM public.seller_verifications
    WHERE id = verification_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Verification not found';
    END IF;

    -- Update verification status
    UPDATE public.seller_verifications
    SET 
        status = review_status,
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
