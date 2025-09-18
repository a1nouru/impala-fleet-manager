-- Add document support to vehicle_damages table
ALTER TABLE vehicle_damages 
ADD COLUMN IF NOT EXISTS document_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS document_names TEXT[] DEFAULT '{}';

-- Add comment to explain the new columns
COMMENT ON COLUMN vehicle_damages.document_urls IS 'Array of URLs for uploaded documents related to the damage';
COMMENT ON COLUMN vehicle_damages.document_names IS 'Array of original file names corresponding to the document URLs';





