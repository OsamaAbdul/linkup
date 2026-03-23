-- FIX RELATIONSHIP BETWEEN PROFILES AND USER_ROLES
-- This migration ensures PostgREST can perform joins (embeddings) between these tables.

-- 1. Ensure the foreign key exists and points to profiles(id)
-- We use profiles(id) because profiles.id is typically synchronized with auth.users.id
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Add an index for performance if not exists
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
