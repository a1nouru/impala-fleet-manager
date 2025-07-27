# Apply Database Migration to Supabase

Since we're using a hosted Supabase instance, you need to apply the migration manually through the Supabase Dashboard SQL Editor.

## Apply the Explanation Field Migration

1. Go to https://supabase.com/dashboard/project/hymravaveedguejtazsc/sql/new
2. Copy and paste this SQL:

```sql
-- Add explanation field to daily_reports table for flagged reports
-- This field stores explanations when reports have low net revenue or high expenses

ALTER TABLE daily_reports ADD COLUMN explanation TEXT;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN daily_reports.explanation IS 'Explanation required when net revenue is less than 50% of total revenue or expenses exceed 210,000 AOA';

-- Create index for performance on explanation queries
CREATE INDEX idx_daily_reports_explanation ON daily_reports(explanation) WHERE explanation IS NOT NULL;
```

3. Click "Run" to execute

## Verify Migration

Run this query to verify the migration was applied:

```sql
-- Check if explanation column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'daily_reports' AND column_name = 'explanation';
```

## Once Completed

After applying the migration, the application should work correctly:
- ✅ Daily reports can be created with the existing valid routes
- ✅ Flagged reports will show explanation functionality
- ✅ All validation and highlighting will work properly

The routes issue has been fixed by updating the form to use the correct route format that matches the database constraint. 