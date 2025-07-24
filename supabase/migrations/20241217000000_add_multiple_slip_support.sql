-- Add support for multiple bank slips per deposit
-- Create a new table to store multiple slip URLs for each deposit

CREATE TABLE bank_deposit_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID NOT NULL REFERENCES bank_deposits(id) ON DELETE CASCADE,
    slip_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

-- Create index for better performance
CREATE INDEX idx_bank_deposit_slips_deposit_id ON bank_deposit_slips(deposit_id);

-- Enable RLS for the new table
ALTER TABLE bank_deposit_slips ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bank_deposit_slips
CREATE POLICY "Allow authenticated users to view bank deposit slips"
ON bank_deposit_slips FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert bank deposit slips"
ON bank_deposit_slips FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bank deposit slips"
ON bank_deposit_slips FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete bank deposit slips"
ON bank_deposit_slips FOR DELETE
TO authenticated
USING (true);

-- Migrate existing single slip URLs to the new table
-- This preserves existing data while adding support for multiple slips
INSERT INTO bank_deposit_slips (deposit_id, slip_url, file_name, created_by)
SELECT 
    id as deposit_id,
    deposit_slip_url as slip_url,
    CASE 
        WHEN deposit_slip_url IS NOT NULL 
        THEN 'migrated-slip-' || id || '.pdf'
        ELSE NULL
    END as file_name,
    created_by
FROM bank_deposits 
WHERE deposit_slip_url IS NOT NULL;

-- Clear the legacy deposit_slip_url field to avoid duplication
UPDATE bank_deposits 
SET deposit_slip_url = NULL 
WHERE deposit_slip_url IS NOT NULL;

-- Create updated function to handle multiple slips
CREATE OR REPLACE FUNCTION create_bank_deposit_with_multiple_reports(
    p_bank_name TEXT,
    p_deposit_date DATE,
    p_amount NUMERIC,
    p_report_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deposit_id UUID;
    report_id UUID;
BEGIN
    -- Insert bank deposit
    INSERT INTO bank_deposits (bank_name, deposit_date, amount, created_by)
    VALUES (p_bank_name, p_deposit_date, p_amount, auth.email())
    RETURNING id INTO deposit_id;
    
    -- Link reports to deposit
    FOREACH report_id IN ARRAY p_report_ids
    LOOP
        INSERT INTO deposit_reports (deposit_id, report_id)
        VALUES (deposit_id, report_id);
    END LOOP;
    
    RETURN deposit_id;
END;
$$;

-- Create function to add slip to existing deposit
CREATE OR REPLACE FUNCTION add_slip_to_deposit(
    p_deposit_id UUID,
    p_slip_url TEXT,
    p_file_name TEXT,
    p_file_size INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    slip_id UUID;
BEGIN
    INSERT INTO bank_deposit_slips (deposit_id, slip_url, file_name, file_size, created_by)
    VALUES (p_deposit_id, p_slip_url, p_file_name, p_file_size, auth.email())
    RETURNING id INTO slip_id;
    
    RETURN slip_id;
END;
$$;

-- Create function to get deposit with all slips
CREATE OR REPLACE FUNCTION get_deposit_with_slips(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'deposit', row_to_json(bd.*),
        'slips', COALESCE(
            json_agg(
                json_build_object(
                    'id', bds.id,
                    'slip_url', bds.slip_url,
                    'file_name', bds.file_name,
                    'file_size', bds.file_size,
                    'upload_date', bds.upload_date
                )
            ) FILTER (WHERE bds.id IS NOT NULL), 
            '[]'::json
        ),
        'reports', COALESCE(
            json_agg(
                DISTINCT json_build_object(
                    'report_id', dr.report_id
                )
            ) FILTER (WHERE dr.report_id IS NOT NULL),
            '[]'::json
        )
    ) INTO result
    FROM bank_deposits bd
    LEFT JOIN bank_deposit_slips bds ON bd.id = bds.deposit_id
    LEFT JOIN deposit_reports dr ON bd.id = dr.deposit_id
    WHERE bd.id = p_deposit_id
    GROUP BY bd.id, bd.bank_name, bd.deposit_date, bd.amount, bd.deposit_slip_url, bd.created_by, bd.created_at, bd.updated_at;
    
    RETURN result;
END;
$$; 