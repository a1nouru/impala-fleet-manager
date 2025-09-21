-- Create storage bucket for inventory receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-receipts',
  'inventory-receipts',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the storage bucket
CREATE POLICY "Allow authenticated users to upload receipts" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'inventory-receipts' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view receipts" ON storage.objects
FOR SELECT USING (
  bucket_id = 'inventory-receipts' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update receipts" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'inventory-receipts' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete receipts" ON storage.objects
FOR DELETE USING (
  bucket_id = 'inventory-receipts' AND
  auth.role() = 'authenticated'
);

-- Add comment to document the bucket
COMMENT ON COLUMN storage.buckets.id IS 'inventory-receipts bucket stores receipt images for inventory purchases';