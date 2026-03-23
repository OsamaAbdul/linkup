-- Migration: 20260323_fix_kyc_tracking.sql
-- Description: Fix logistics_kyc foreign key and add missing RLS update policies

-- 1. Temporarily drop the NOT NULL constraint to allow data fixing
-- This handles cases where data might already be inconsistent or become temporarily null during mapping.
ALTER TABLE public.logistics_kyc ALTER COLUMN user_id DROP NOT NULL;

-- 2. Unify user_id in logistics_kyc to use auth ID (auth.uid())
-- Map any profile-ID-based user_ids back to their associated auth UUID.
UPDATE public.logistics_kyc l
SET user_id = p.user_id
FROM public.profiles p
WHERE l.user_id = p.id;

-- 3. Delete any orphaned or invalid records
-- This ensures that when we re-enable NOT NULL and the Foreign Key, the data is valid.
DELETE FROM public.logistics_kyc 
WHERE user_id IS NULL 
   OR user_id NOT IN (SELECT id FROM auth.users);

-- 4. Re-enable NOT NULL constraint
ALTER TABLE public.logistics_kyc ALTER COLUMN user_id SET NOT NULL;

-- 5. Correct the Foreign Key to reference auth.users(id)
-- We use separate DO blocks to ensure each drop is handled gracefully.
DO $$ BEGIN
    ALTER TABLE public.logistics_kyc DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_profiles_fkey;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.logistics_kyc DROP CONSTRAINT IF EXISTS logistics_kyc_user_id_auth_fkey;
EXCEPTION
    WHEN others THEN null;
END $$;

ALTER TABLE public.logistics_kyc 
ADD CONSTRAINT logistics_kyc_user_id_auth_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. RLS Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can update own kyc" ON public.logistics_kyc
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can view own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can view own kyc" ON public.logistics_kyc
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can insert own kyc" ON public.logistics_kyc;
    CREATE POLICY "Users can insert own kyc" ON public.logistics_kyc
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Profiles unique constraint and update policy
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND contype = 'u' 
        AND conkey @> array[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'user_id')]
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
    END IF;
    
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON CONSTRAINT logistics_kyc_user_id_auth_fkey ON public.logistics_kyc IS 'Ensure logistics KYC records correctly reference the auth users table.';
