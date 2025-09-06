-- Add audit functionality at the date level
-- This allows auditors to mark entire dates as audited rather than individual reports

-- Create table to track date-level audits
CREATE TABLE date_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_date DATE NOT NULL UNIQUE, -- The date that was audited
    is_audited BOOLEAN DEFAULT TRUE, -- Always true when record exists
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When the date was audited
    audited_by TEXT NOT NULL, -- Who audited this date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment to document the table purpose
COMMENT ON TABLE date_audits IS 'Tracks which dates have been audited by auditors. One record per audited date.';
COMMENT ON COLUMN date_audits.audit_date IS 'The specific date that was audited (all reports for this date)';
COMMENT ON COLUMN date_audits.audited_by IS 'Identifier of the auditor who marked this date as audited';

-- Create index for performance on audit queries
CREATE INDEX idx_date_audits_date ON date_audits(audit_date);
CREATE INDEX idx_date_audits_auditor ON date_audits(audited_by);

-- Create trigger to automatically update the 'updated_at' timestamp
CREATE TRIGGER update_date_audits_updated_at
    BEFORE UPDATE ON date_audits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for date_audits table
ALTER TABLE date_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view all date audits"
ON date_audits FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert date audits"
ON date_audits FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update date audits"
ON date_audits FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete date audits"
ON date_audits FOR DELETE
TO authenticated
USING (true);
