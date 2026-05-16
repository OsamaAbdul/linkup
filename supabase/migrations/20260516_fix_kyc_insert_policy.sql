-- Explicitly drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can submit verification" ON public.seller_verifications;
DROP POLICY IF EXISTS "Users can insert own verification" ON public.seller_verifications;

-- Re-create the INSERT policy explicitly to ensure authenticated users can submit KYC
CREATE POLICY "Users can insert own verification" 
ON public.seller_verifications 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Ensure they can also update their own pending/rejected verifications if they ever need to resubmit
DROP POLICY IF EXISTS "Users can update own verification" ON public.seller_verifications;
CREATE POLICY "Users can update own verification" 
ON public.seller_verifications 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());
