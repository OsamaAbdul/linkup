-- MIGRATION: 20260501_dispute_evidence_storage.sql
-- Create a new storage bucket for dispute evidence

INSERT INTO storage.buckets (id, name, public) 
VALUES ('dispute-evidence', 'dispute-evidence', true) 
ON CONFLICT DO NOTHING;

-- RLS POLICIES FOR dispute-evidence

-- 1. Public can view evidence (for Admins and Sellers to view via URL)
CREATE POLICY "Public can view evidence" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'dispute-evidence');

-- 2. Authenticated users can upload evidence
CREATE POLICY "Authenticated users can upload evidence" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'dispute-evidence' AND auth.uid() IS NOT NULL);

-- 3. Users can only delete their own evidence (optional, for hygiene)
CREATE POLICY "Users can delete own evidence" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
