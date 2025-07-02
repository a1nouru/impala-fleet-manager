-- Create storage bucket for bank slip attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-slips', 'bank-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bank-slips bucket
CREATE POLICY "Public Access for bank-slips bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'bank-slips');

CREATE POLICY "Authenticated users can upload bank-slips" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'bank-slips' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own bank-slips" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'bank-slips' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own bank-slips" ON storage.objects
FOR DELETE USING (
    bucket_id = 'bank-slips' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
); 