-- MIGRATION: 20260303_seed_agent_zones
-- This migration updates existing logistics agents with operational zones if they don't have one.

DO $$
DECLARE
    r RECORD;
    zones text[] := ARRAY[
        'Zone 1 (Gwarinpa & Life Camp)',
        'Zone 2 (Wuse & Utako)',
        'Zone 3 (Kubwa Central)',
        'Zone 4 (Lugbe & Apo)',
        'Zone 5 (Gwagwalada Districts)'
    ];
    counter int := 1;
BEGIN
    FOR r IN (
        SELECT ur.user_id 
        FROM public.user_roles ur
        JOIN public.profiles p ON ur.user_id = p.id
        WHERE ur.role = 'logistics' AND p.zone IS NULL
    )
    LOOP
        UPDATE public.profiles 
        SET zone = zones[((counter - 1) % 5) + 1]::public.abuja_zone
        WHERE id = r.user_id;
        
        counter := counter + 1;
    END LOOP;
END $$;
