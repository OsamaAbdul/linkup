
-- Create seller verification storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-verifications', 'seller-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own files
CREATE POLICY "Users can view own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'seller-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
