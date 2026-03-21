-- Migration: 20260318_admin_kyc_access.sql
-- Goal: Enable Admin management for Logistics KYC

-- 1. Add review tracking columns to logistics_kyc
ALTER TABLE public.logistics_kyc 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- 1.1 Ensure explicit foreign key to profiles for PostgREST joins
ALTER TABLE public.logistics_kyc 
DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_profiles_fkey,
ADD CONSTRAINT logistics_kyc_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add RLS policies for Admins on logistics_kyc
-- Admin view policy
DO $$ BEGIN
    CREATE POLICY "Admins can view all logistics kyc" ON public.logistics_kyc
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Admin update policy
DO $$ BEGIN
    CREATE POLICY "Admins can update logistics kyc" ON public.logistics_kyc
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create RPC for verifying logistics KYC
CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(
    p_verification_id UUID,
    p_review_status TEXT -- 'verified' or 'rejected'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Validate admin status
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can verify KYC');
    END IF;

    -- Get user_id from verification
    SELECT user_id INTO v_user_id
    FROM public.logistics_kyc
    WHERE id = p_verification_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'KYC submission not found');
    END IF;

    -- Update KYC status and tracking
    UPDATE public.logistics_kyc
    SET 
        status = p_review_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_verification_id;

    -- If approved, ensure the user has the 'logistics' role
    IF p_review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'logistics')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'status', p_review_status
    );
END;
$$;

COMMENT ON FUNCTION public.verify_logistics_kyc IS 'Allows admins to approve or reject logistics rider KYC and atomically grant the logistics role.';
