-- Create storage bucket for inventory receipts (following bank-slips pattern)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-receipts', 'inventory-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the inventory-receipts bucket (same pattern as bank-slips)
CREATE POLICY "Anyone can view inventory receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-receipts');

CREATE POLICY "Authenticated users can upload inventory receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inventory-receipts' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own inventory receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'inventory-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'inventory-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own inventory receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inventory-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure the bucket is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-receipts', 'inventory-receipts', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Grant necessary permissions (same as bank-slips)
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;