const fs = require('fs');
let file = 'supabase/migrations/20260101000000_initial_schema.sql';
let content = fs.readFileSync(file, 'utf8');

// The file should end EXACTLY at the end of the last function before the FIRST `-- Restore profiles table`.
// Which is around character 53821.
let firstRestore = content.indexOf('-- Restore profiles table');

// Let's find the last `$$ LANGUAGE plpgsql SECURITY DEFINER;` before firstRestore.
let goodEnd = content.lastIndexOf('$$ LANGUAGE plpgsql SECURITY DEFINER;', firstRestore);
if (goodEnd !== -1) {
    let finalGoodText = content.substring(0, goodEnd + '$$ LANGUAGE plpgsql SECURITY DEFINER;'.length) + '\n\n';
    
    // Now append the true proper block:
    let correctBlock = `-- Restore profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    zone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Restore seller_verifications table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    full_name TEXT,
    phone_number TEXT,
    business_address TEXT,
    zone TEXT,
    national_id_url TEXT,
    store_photo_url TEXT,
    bank_details JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verification" ON public.seller_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own verification" ON public.seller_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own verification" ON public.seller_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all seller verifications" ON public.seller_verifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update all seller verifications" ON public.seller_verifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Restore logistics_kyc table
CREATE TABLE IF NOT EXISTS public.logistics_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone_number TEXT,
    nin_number TEXT,
    home_address TEXT,
    zone TEXT,
    passport_photo_url TEXT,
    id_card_photo_url TEXT,
    bank_details JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logistics_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own logistics_kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own logistics_kyc" ON public.logistics_kyc FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own logistics_kyc" ON public.logistics_kyc FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all logistics_kyc" ON public.logistics_kyc FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update all logistics_kyc" ON public.logistics_kyc FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Restore verification RPCs
CREATE OR REPLACE FUNCTION public.verify_seller_kyc(verification_id UUID, review_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.seller_verifications
    SET status = review_status, updated_at = now()
    WHERE id = verification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_logistics_kyc(p_verification_id UUID, p_review_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.logistics_kyc
    SET status = p_review_status, updated_at = now()
    WHERE id = p_verification_id;
END;
$$;
`;

    fs.writeFileSync(file, finalGoodText + correctBlock);
    console.log("File completely fixed and finalized!");
} else {
    console.log("Could not find the end marker!");
}
