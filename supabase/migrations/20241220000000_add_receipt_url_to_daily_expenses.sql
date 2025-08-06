-- Add receipt_url field to daily_expenses table for fuel receipt uploads
ALTER TABLE daily_expenses 
ADD COLUMN receipt_url TEXT;

-- Create storage bucket for fuel receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the fuel-receipts bucket
CREATE POLICY "Anyone can view fuel receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'fuel-receipts');

CREATE POLICY "Authenticated users can upload fuel receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fuel-receipts' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own fuel receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fuel-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'fuel-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own fuel receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fuel-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;