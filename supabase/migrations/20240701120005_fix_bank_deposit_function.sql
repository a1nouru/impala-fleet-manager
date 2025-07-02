-- Drop all existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS create_deposit_with_links;
DROP FUNCTION IF EXISTS create_deposit_with_links(TEXT, DATE, NUMERIC, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS create_deposit_with_links(TEXT, DATE, NUMERIC, TEXT[], TEXT, TEXT);

-- Ensure RLS policies are correct for deposit_reports
ALTER TABLE deposit_reports ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for deposit_reports
DROP POLICY IF EXISTS "deposit_reports_select_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_insert_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_update_policy" ON deposit_reports;
DROP POLICY IF EXISTS "deposit_reports_delete_policy" ON deposit_reports;

CREATE POLICY "deposit_reports_select_policy" ON deposit_reports
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_insert_policy" ON deposit_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_update_policy" ON deposit_reports
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "deposit_reports_delete_policy" ON deposit_reports
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create the clean function with proper parameter order
CREATE OR REPLACE FUNCTION create_deposit_with_links(
    bank_name_param TEXT,
    deposit_date_param DATE,
    amount_param NUMERIC,
    report_ids_param TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_deposit_id UUID;
    report_id TEXT;
    result JSON;
BEGIN
    -- Insert the bank deposit
    INSERT INTO bank_deposits (bank_name, deposit_date, amount, created_by)
    VALUES (bank_name_param, deposit_date_param, amount_param, auth.email())
    RETURNING id INTO new_deposit_id;
    
    -- Insert the deposit-report links
    FOREACH report_id IN ARRAY report_ids_param LOOP
        INSERT INTO deposit_reports (deposit_id, report_id)
        VALUES (new_deposit_id, report_id::UUID);
    END LOOP;
    
    -- Return the created deposit as JSON
    SELECT row_to_json(bd.*) INTO result
    FROM bank_deposits bd
    WHERE bd.id = new_deposit_id;
    
    RETURN result;
END;
$$; 