-- Fix relationship between profiles and user_roles for PostgREST
-- This allows automatic joining (embedding) in frontend queries

ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Also add a comment for clarification
COMMENT ON CONSTRAINT user_roles_user_id_fkey ON public.user_roles IS 'Direct reference to public.profiles for PostgREST embedding';
