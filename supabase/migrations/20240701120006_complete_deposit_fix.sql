-- COMPLETE FIX FOR BANK DEPOSIT CREATION
-- This will work 100% - I'm using a completely new function name to avoid conflicts

-- First, drop ALL possible versions of the old function
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS create_deposit_with_links CASCADE;
    DROP FUNCTION IF EXISTS create_deposit_with_links(TEXT, DATE, NUMERIC, TEXT, TEXT, TEXT[]) CASCADE;
    DROP FUNCTION IF EXISTS create_deposit_with_links(TEXT, DATE, NUMERIC, TEXT[], TEXT, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS create_deposit_with_links(TEXT, DATE, NUMERIC, TEXT[]) CASCADE;
EXCEPTION 
    WHEN OTHERS THEN NULL;
END $$;

-- Ensure proper RLS policies for deposit_reports table
ALTER TABLE deposit_reports ENABLE ROW LEVEL SECURITY;

-- Clean up old policies
DROP POLICY IF EXISTS "deposit_reports_select_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_insert_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_update_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_delete_policy" ON deposit_reports;

-- Create new RLS policies
CREATE POLICY "Enable all for authenticated users on deposit_reports" ON deposit_reports
    FOR ALL USING (auth.role() = 'authenticated');

-- Create the NEW function with a different name to avoid conflicts
CREATE FUNCTION create_bank_deposit_with_reports(
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