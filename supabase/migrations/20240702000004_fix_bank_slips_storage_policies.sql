-- Fix RLS policies for bank-slips storage bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Bank slips are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload bank slips" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own bank slips" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own bank slips" ON storage.objects;

-- Create proper RLS policies for bank-slips bucket
CREATE POLICY "Anyone can view bank slips"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-slips');

CREATE POLICY "Authenticated users can upload bank slips"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-slips' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own bank slips"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-slips' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'bank-slips' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own bank slips"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-slips' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-slips', 'bank-slips', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated; 