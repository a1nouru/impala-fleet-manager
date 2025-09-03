-- Migration to update vehicle_damages table from percentage to fixed amounts
-- This ensures compatibility with the new Portuguese UI and fixed amount system

-- Step 1: Add the new column for monthly deduction amount
ALTER TABLE vehicle_damages 
ADD COLUMN IF NOT EXISTS monthly_deduction_amount DECIMAL(10,2) DEFAULT 0;

-- Step 2: Update existing records to convert percentage to fixed amount
-- This assumes a conversion where percentage is applied to total damage cost
UPDATE vehicle_damages 
SET monthly_deduction_amount = (total_damage_cost * monthly_deduction_percentage / 100)
WHERE monthly_deduction_amount = 0 AND monthly_deduction_percentage > 0;

-- Step 3: Add constraint to ensure deduction amount doesn't exceed total cost
ALTER TABLE vehicle_damages 
ADD CONSTRAINT check_deduction_amount_valid 
CHECK (monthly_deduction_amount > 0 AND monthly_deduction_amount <= total_damage_cost);

-- Step 4: Update the payroll deduction function to use fixed amounts
CREATE OR REPLACE FUNCTION process_payroll_deductions_with_balance_check(
    p_payroll_run_id UUID
) RETURNS VOID AS $$
DECLARE
    damage_record RECORD;
    actual_deduction DECIMAL(10,2);
    new_balance DECIMAL(10,2);
BEGIN
    -- Process each unpaid damage
    FOR damage_record IN 
        SELECT id, employee_id, monthly_deduction_amount, remaining_balance
        FROM vehicle_damages 
        WHERE is_fully_paid = FALSE AND remaining_balance > 0
    LOOP
        -- Calculate actual deduction (never exceed remaining balance)
        actual_deduction := LEAST(damage_record.monthly_deduction_amount, damage_record.remaining_balance);
        
        IF actual_deduction > 0 THEN
            -- Update remaining balance
            new_balance := damage_record.remaining_balance - actual_deduction;
            
            UPDATE vehicle_damages 
            SET 
                remaining_balance = new_balance,
                is_fully_paid = (new_balance <= 0),
                updated_at = NOW()
            WHERE id = damage_record.id;
            
            -- Insert payroll deduction record
            INSERT INTO payroll_deductions (
                payroll_run_id,
                employee_id,
                vehicle_damage_id,
                deduction_amount,
                deduction_reason,
                created_at
            ) VALUES (
                p_payroll_run_id,
                damage_record.employee_id,
                damage_record.id,
                actual_deduction,
                'Vehicle Damage Deduction',
                NOW()
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update the damage summary function to work with fixed amounts
CREATE OR REPLACE FUNCTION get_current_month_damage_summary()
RETURNS TABLE (
    total_damages_value DECIMAL(10,2),
    total_deductions_this_month DECIMAL(10,2),
    active_damages_count INTEGER,
    employees_with_damages_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH current_month_damages AS (
        SELECT 
            vd.total_damage_cost,
            vd.monthly_deduction_amount,
            vd.is_fully_paid,
            vd.employee_id
        FROM vehicle_damages vd
        WHERE EXTRACT(MONTH FROM vd.damage_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM vd.damage_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    )
    SELECT 
        COALESCE(SUM(cmd.total_damage_cost), 0) as total_damages_value,
        COALESCE(SUM(CASE WHEN NOT cmd.is_fully_paid THEN cmd.monthly_deduction_amount ELSE 0 END), 0) as total_deductions_this_month,
        COUNT(CASE WHEN NOT cmd.is_fully_paid THEN 1 END)::INTEGER as active_damages_count,
        COUNT(DISTINCT cmd.employee_id)::INTEGER as employees_with_damages_count
    FROM current_month_damages cmd;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add helpful comments
COMMENT ON COLUMN vehicle_damages.monthly_deduction_amount IS 'Fixed monthly deduction amount in AOA (replaced percentage-based system)';
COMMENT ON COLUMN vehicle_damages.monthly_deduction_percentage IS 'Legacy percentage field - kept for backward compatibility';

-- Step 7: Create index for better performance on deduction queries
CREATE INDEX IF NOT EXISTS idx_vehicle_damages_unpaid_balance 
ON vehicle_damages (is_fully_paid, remaining_balance) 
WHERE is_fully_paid = FALSE AND remaining_balance > 0;
