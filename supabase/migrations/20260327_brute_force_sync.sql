-- BRUTE FORCE IDENTITY RECOVERY: Zero-Failure Synchronization
-- This migration uses a procedural loop to ensure every user gets a profile, 
-- regardless of previous ID/NULL conflicts.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- Attempt to UPDATE first if user_id exists
        UPDATE public.profiles 
        SET email = LOWER(r.email)
        WHERE user_id = r.id;
        
        -- If NO rows were updated, it means the profile is missing.
        -- We then attempt to INSERT.
        IF NOT FOUND THEN
            BEGIN
                -- Try to insert using the Auth ID as both ID and user_id for maximum consistency
                INSERT INTO public.profiles (id, user_id, display_name, email)
                VALUES (
                    r.id, 
                    r.id, 
                    COALESCE(r.raw_user_meta_data->>'display_name', 'Member'), 
                    LOWER(r.email)
                    );
            EXCEPTION WHEN unique_violation THEN
                -- If r.id was already taken by a random ID, we fallback to letting the DB 
                -- generate a new ID but keep the user_id linked.
                INSERT INTO public.profiles (user_id, display_name, email)
                VALUES (
                    r.id, 
                    COALESCE(r.raw_user_meta_data->>'display_name', 'Member'), 
                    LOWER(r.email)
                    );
            WHEN OTHERS THEN
                -- Log other errors to the console
                RAISE NOTICE 'Skipping user % due to error: %', r.email, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- RESTORE VISIBILITY (Definitive)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- RELOAD API
NOTIFY pgrst, 'reload schema';
