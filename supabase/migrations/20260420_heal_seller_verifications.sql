-- MIGRATION: 20260420_heal_seller_verifications.sql
-- TARGET: Backfill seller_verifications for users with the 'seller' role but missing KYC records.
-- This establishes a single point of truth for identity management.

BEGIN;

-- Insert missing verifications for established sellers
INSERT INTO public.seller_verifications (
    user_id, 
    status, 
    business_name, 
    phone_number, 
    business_address, 
    created_at,
    national_id_url,
    store_photo_url,
    bank_details
)
SELECT 
    ur.user_id,
    'verified'::verification_status as status,
    COALESCE(p.display_name, 'Unnamed Business') as business_name,
    COALESCE(p.phone, '0000000000') as phone_number,
    COALESCE(p.address, 'Manual Verification') as business_address,
    COALESCE(p.created_at, NOW()) as created_at,
    'LEGACY_VERIFICATION' as national_id_url,
    'LEGACY_VERIFICATION' as store_photo_url,
    jsonb_build_object(
        'bank_name', COALESCE(p.payout_bank_name, 'Legacy Bank'),
        'account_number', COALESCE(p.payout_account_number, '0000000000'),
        'account_name', COALESCE(p.payout_account_name, p.display_name)
    ) as bank_details
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.id
LEFT JOIN public.seller_verifications sv ON ur.user_id = sv.user_id
WHERE ur.role = 'seller'
AND sv.user_id IS NULL; -- Only catch sellers missing from the KYC table

-- Do the same for Logistics (Riders) if any are missing
INSERT INTO public.logistics_kyc (
    user_id,
    status,
    full_name,
    phone_number,
    home_address,
    zone,
    created_at,
    passport_photo_url,
    id_card_photo_url
)
SELECT 
    ur.user_id,
    'verified'::verification_status as status,
    COALESCE(p.display_name, 'Unnamed Rider') as full_name,
    COALESCE(p.phone, '0000000000') as phone_number,
    COALESCE(p.address, 'Manual Verification') as home_address,
    p.zone,
    COALESCE(p.created_at, NOW()) as created_at,
    'LEGACY_VERIFICATION' as passport_photo_url,
    'LEGACY_VERIFICATION' as id_card_photo_url
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.id
LEFT JOIN public.logistics_kyc lk ON ur.user_id = lk.user_id
WHERE ur.role = 'logistics'
AND lk.user_id IS NULL;

COMMIT;
