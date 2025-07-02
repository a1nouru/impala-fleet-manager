-- Fix RLS policies for deposit_reports table
-- Enable RLS on deposit_reports if not already enabled
ALTER TABLE deposit_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "deposit_reports_select_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_insert_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_update_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_delete_policy" ON deposit_reports;

-- Create comprehensive policies for deposit_reports
CREATE POLICY "deposit_reports_select_policy" ON deposit_reports
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_insert_policy" ON deposit_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_update_policy" ON deposit_reports
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_delete_policy" ON deposit_reports
    FOR DELETE USING (auth.role() = 'authenticated');

-- Also ensure bank_deposits has proper RLS policies
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "bank_deposits_select_policy" ON bank_deposits;
DROP POLICY IF EXISTS "bank_deposits_insert_policy" ON bank_deposits;
DROP POLICY IF EXISTS "bank_deposits_update_policy" ON bank_deposits;
DROP POLICY IF EXISTS "bank_deposits_delete_policy" ON bank_deposits;

-- Create comprehensive policies for bank_deposits
CREATE POLICY "bank_deposits_select_policy" ON bank_deposits
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "bank_deposits_insert_policy" ON bank_deposits
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "bank_deposits_update_policy" ON bank_deposits
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "bank_deposits_delete_policy" ON bank_deposits
    FOR DELETE USING (auth.role() = 'authenticated');

-- Recreate the RPC function with proper security context and parameter order
CREATE OR REPLACE FUNCTION create_deposit_with_links(
    p_bank_name TEXT,
    p_deposit_date DATE,
    p_amount NUMERIC,
    p_report_ids TEXT[],
    p_deposit_slip_url TEXT DEFAULT NULL,
    p_created_by TEXT DEFAULT NULL
)
RETURNS bank_deposits
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    new_deposit bank_deposits;
    report_id TEXT;
BEGIN
    -- Insert the bank deposit
    INSERT INTO bank_deposits (bank_name, deposit_date, amount, deposit_slip_url, created_by)
    VALUES (p_bank_name, p_deposit_date, p_amount, p_deposit_slip_url, p_created_by)
    RETURNING * INTO new_deposit;
    
    -- Insert the deposit-report links
    FOREACH report_id IN ARRAY p_report_ids LOOP
        INSERT INTO deposit_reports (deposit_id, report_id)
        VALUES (new_deposit.id, report_id::UUID);
    END LOOP;
    
    RETURN new_deposit;
END;
$$; 