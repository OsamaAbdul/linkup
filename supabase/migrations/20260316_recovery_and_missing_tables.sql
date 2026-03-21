-- 20260316_recovery_and_missing_tables.sql
-- 1. Create missing Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create PROMOTER_CODES table
CREATE TABLE IF NOT EXISTS public.promoter_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. Create ISSUES table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority public.issue_priority DEFAULT 'medium',
    status public.issue_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.promoter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Promoter Codes
DROP POLICY IF EXISTS "Anyone can view codes" ON public.promoter_codes;
CREATE POLICY "Anyone can view codes" ON public.promoter_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own codes" ON public.promoter_codes;
CREATE POLICY "Users can manage own codes" ON public.promoter_codes FOR ALL USING (auth.uid() = user_id);

-- Issues
DROP POLICY IF EXISTS "Users can view own reported issues" ON public.issues;
CREATE POLICY "Users can view own reported issues" ON public.issues FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Sellers can view issues against them" ON public.issues;
CREATE POLICY "Sellers can view issues against them" ON public.issues FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Admins can manage all issues" ON public.issues;
CREATE POLICY "Admins can manage all issues" ON public.issues FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
