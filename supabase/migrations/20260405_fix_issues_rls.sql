-- MIGRATION: 20260405_fix_issues_rls.sql
-- Resolves the 403 Forbidden error when buyers or sellers attempt to report an issue.

-- 1. Add INSERT policy for users to create their own issues
DROP POLICY IF EXISTS "Users can insert own issues" ON public.issues;
CREATE POLICY "Users can insert own issues" ON public.issues 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Add UPDATE policy for users to manage their own issues (e.g. closing them)
DROP POLICY IF EXISTS "Users can update own issues" ON public.issues;
CREATE POLICY "Users can update own issues" ON public.issues 
FOR UPDATE USING (auth.uid() = user_id);

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';
