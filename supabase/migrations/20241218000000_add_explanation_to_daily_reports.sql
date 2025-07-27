-- Add explanation field to daily_reports table for flagged reports
-- This field stores explanations when reports have low net revenue or high expenses

ALTER TABLE daily_reports ADD COLUMN explanation TEXT;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN daily_reports.explanation IS 'Explanation required when net revenue is less than 50% of total revenue or expenses exceed 210,000 AOA';

-- Create index for performance on explanation queries
CREATE INDEX idx_daily_reports_explanation ON daily_reports(explanation) WHERE explanation IS NOT NULL; 