-- Logistics Verification & Onboarding Schema

-- 1. Logistics Verifications Table (Mandatory for Admin review)
CREATE TABLE IF NOT EXISTS public.logistics_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    home_address TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    passport_photo_url TEXT NOT NULL,
    status public.verification_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- 2. Logistics Details Table (Skippable Onboarding)
CREATE TABLE IF NOT EXISTS public.logistics_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    username TEXT UNIQUE, -- Custom username requested
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    next_of_kin JSONB, -- { name, phone, relationship }
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. Enable RLS
ALTER TABLE public.logistics_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_details ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Logistics Verifications
CREATE POLICY "Users can view own logistics verification" ON public.logistics_verifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit logistics verification" ON public.logistics_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logistics verifications" ON public.logistics_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update logistics verifications" ON public.logistics_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Policies for Logistics Details
CREATE POLICY "Users can manage own logistics details" ON public.logistics_details
FOR ALL USING (auth.uid() = user_id);

-- 6. RPC for verifying logistics KYC
CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(
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
    SELECT user_id INTO target_user_id
    FROM public.logistics_verifications
    WHERE id = verification_id;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Verification not found';
    END IF;

    UPDATE public.logistics_verifications
    SET 
        status = review_status,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = verification_id;

    -- If approved, ensures role is granted (though they might already have it from onboarding)
    IF review_status = 'verified' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'logistics')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END;
$$;
