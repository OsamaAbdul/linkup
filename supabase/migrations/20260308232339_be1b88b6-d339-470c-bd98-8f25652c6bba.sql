
-- Allow admin to view all seller verifications
CREATE POLICY "Admins can view all verifications"
ON public.seller_verifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to update all seller verifications (approve/reject)
CREATE POLICY "Admins can update all verifications"
ON public.seller_verifications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
