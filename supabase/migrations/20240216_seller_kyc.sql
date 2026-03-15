-- Seller Verification Schema

-- 1. Create Zone Enum
DO $$ BEGIN
    CREATE TYPE public.abuja_zone AS ENUM (
        'Zone 1 (Gwarinpa & Life Camp)',
        'Zone 2 (Wuse & Utako)',
        'Zone 3 (Kubwa Central)',
        'Zone 4 (Lugbe & Apo)',
        'Zone 5 (Gwagwalada Districts)'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Verifications Table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_address TEXT NOT NULL,
    zone public.abuja_zone NOT NULL,
    national_id_url TEXT NOT NULL,
    store_photo_url TEXT NOT NULL,
    bank_details JSONB NOT NULL, -- { bank_name, account_number, account_name }
    status public.verification_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. Enable RLS
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Users can view their own verification status
CREATE POLICY "Users can view own verification" ON public.seller_verifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own verification
CREATE POLICY "Users can submit verification" ON public.seller_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own verification ONLY if it is pending or rejected
CREATE POLICY "Users can update own verification" ON public.seller_verifications
FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- Admin policies (assuming app_role 'admin' exists in user_roles)
-- For simplicity, we might allow full read for now or join with user_roles
CREATE POLICY "Admins can view all verifications" ON public.seller_verifications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update verifications" ON public.seller_verifications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Storage for KYC
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- Storage Policies
-- Only authenticated users can upload
CREATE POLICY "Authenticated upload kyc" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

-- Users can read their own files (This is tricky with storage RLS alone, usually we rely on signed URLs or folder structure: kyc-documents/user_id/file)
-- For now, simple RLS using the file path convention (user_id/filename)
CREATE POLICY "Users view own kyc path" ON storage.objects
FOR SELECT USING (bucket_id = 'kyc-documents' AND (name LIKE (auth.uid() || '/%')));

-- Admins view all
CREATE POLICY "Admins view all kyc" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
