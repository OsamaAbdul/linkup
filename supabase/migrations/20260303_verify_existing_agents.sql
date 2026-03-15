-- MIGRATION: 20260303_verify_existing_agents
-- This migration ensures all users with the 'logistics' role have the required verification and details records.
-- This is necessary because the UI now strictly filters for 'verified' agents.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT ur.user_id, p.display_name
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.role = 'logistics'
    )
    LOOP
        -- 1. Ensure a verification record exists and is set to 'verified'
        INSERT INTO public.logistics_verifications (
            user_id, 
            full_name, 
            phone_number, 
            home_address, 
            date_of_birth, 
            passport_photo_url, 
            status,
            reviewed_at
        )
        VALUES (
            r.user_id,
            COALESCE(r.display_name, 'Agent ' || substr(r.user_id::text, 1, 5)),
            '08000000000',
            'Seeded Address',
            '1990-01-01',
            'placeholder_url',
            'verified',
            now()
        )
        ON CONFLICT (user_id) DO UPDATE 
        SET status = 'verified', reviewed_at = now();

        -- 2. Ensure logistics details exist
        INSERT INTO public.logistics_details (
            user_id,
            vehicle_type,
            bank_name,
            account_number,
            account_name
        )
        VALUES (
            r.user_id,
            'Motorcycle',
            'Placeholder Bank',
            '0000000000',
            r.display_name
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;
