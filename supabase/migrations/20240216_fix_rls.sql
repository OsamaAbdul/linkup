-- Fix RLS for user_roles
-- Users need to be able to SEE their own roles and INSERT their own roles (during onboarding).

-- Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can assign themselves a role (Insert)
-- You might want to restrict this to only if they don't have one, or allow it freely for now.
CREATE POLICY "Users can assign their own role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
