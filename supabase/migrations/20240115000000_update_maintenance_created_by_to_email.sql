-- Migration to update existing UUID values in created_by field to email addresses
-- This updates all maintenance_records that have a UUID in the created_by field

-- First, let's create a function to check if a string is a valid UUID
CREATE OR REPLACE FUNCTION is_valid_uuid(text_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN text_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
END;
$$ LANGUAGE plpgsql;

-- Update maintenance_records where created_by contains a UUID
-- Join with auth.users to get the email
UPDATE maintenance_records mr
SET created_by = au.email
FROM auth.users au
WHERE is_valid_uuid(mr.created_by)
  AND mr.created_by::uuid = au.id;

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % maintenance records from UUID to email format', updated_count;
END $$;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS is_valid_uuid(TEXT);

-- Add a comment to document this change
COMMENT ON COLUMN maintenance_records.created_by IS 'User email address who created the record. Previously stored UUIDs, migrated to emails on 2024-01-15';