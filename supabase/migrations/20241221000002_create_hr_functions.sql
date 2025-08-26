-- Create functions for HR module operations

-- Function to calculate monthly deduction amount for an employee
CREATE OR REPLACE FUNCTION calculate_monthly_deduction(
    p_employee_id UUID,
    p_payroll_month INTEGER,
    p_payroll_year INTEGER
)
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_employee_salary DECIMAL(12,2);
    v_total_deduction DECIMAL(12,2) := 0;
    v_damage_record RECORD;
    v_calculated_deduction DECIMAL(12,2);
BEGIN
    -- Get employee's base salary
    SELECT valor INTO v_employee_salary
    FROM employees 
    WHERE id = p_employee_id AND is_active = true;
    
    IF v_employee_salary IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Loop through all unpaid damages for this employee
    FOR v_damage_record IN
        SELECT id, total_damage_cost, monthly_deduction_percentage, remaining_balance
        FROM vehicle_damages 
        WHERE employee_id = p_employee_id 
        AND is_fully_paid = false
        AND remaining_balance > 0
    LOOP
        -- Calculate deduction amount (percentage of salary, but not more than remaining balance)
        v_calculated_deduction := LEAST(
            (v_employee_salary * v_damage_record.monthly_deduction_percentage / 100.0),
            v_damage_record.remaining_balance
        );
        
        v_total_deduction := v_total_deduction + v_calculated_deduction;
    END LOOP;
    
    RETURN v_total_deduction;
END;
$$;

-- Function to process deductions and update damage balances
CREATE OR REPLACE FUNCTION process_payroll_deductions(
    p_payroll_run_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_employee_record RECORD;
    v_damage_record RECORD;
    v_gross_salary DECIMAL(12,2);
    v_total_deduction DECIMAL(12,2) := 0;
    v_net_salary DECIMAL(12,2);
    v_calculated_deduction DECIMAL(12,2);
    v_deduction_reason TEXT := '';
BEGIN
    -- Process deductions for each active employee
    FOR v_employee_record IN
        SELECT id, nome, valor as salary
        FROM employees 
        WHERE is_active = true
    LOOP
        v_gross_salary := v_employee_record.salary;
        v_total_deduction := 0;
        v_deduction_reason := '';
        
        -- Process each unpaid damage for this employee
        FOR v_damage_record IN
            SELECT id, vehicle_id, damage_description, total_damage_cost, 
                   monthly_deduction_percentage, remaining_balance
            FROM vehicle_damages 
            WHERE employee_id = v_employee_record.id 
            AND is_fully_paid = false
            AND remaining_balance > 0
        LOOP
            -- Calculate deduction amount
            v_calculated_deduction := LEAST(
                (v_gross_salary * v_damage_record.monthly_deduction_percentage / 100.0),
                v_damage_record.remaining_balance
            );
            
            v_total_deduction := v_total_deduction + v_calculated_deduction;
            
            -- Update remaining balance
            UPDATE vehicle_damages 
            SET remaining_balance = remaining_balance - v_calculated_deduction,
                is_fully_paid = (remaining_balance - v_calculated_deduction <= 0),
                updated_at = NOW()
            WHERE id = v_damage_record.id;
            
            -- Build deduction reason
            IF v_deduction_reason != '' THEN
                v_deduction_reason := v_deduction_reason || '; ';
            END IF;
            v_deduction_reason := v_deduction_reason || 
                format('Damage %s: %s AOA (%s%%)', 
                       v_damage_record.damage_description, 
                       v_calculated_deduction::TEXT, 
                       v_damage_record.monthly_deduction_percentage::TEXT);
        END LOOP;
        
        v_net_salary := v_gross_salary - v_total_deduction;
        
        -- Insert payroll deduction record
        INSERT INTO payroll_deductions (
            payroll_run_id,
            employee_id,
            gross_salary,
            deduction_amount,
            net_salary,
            deduction_reason
        ) VALUES (
            p_payroll_run_id,
            v_employee_record.id,
            v_gross_salary,
            v_total_deduction,
            v_net_salary,
            CASE WHEN v_deduction_reason = '' THEN 'No deductions' ELSE v_deduction_reason END
        );
    END LOOP;
    
    -- Update payroll run totals
    UPDATE payroll_runs 
    SET 
        total_gross_amount = (
            SELECT COALESCE(SUM(gross_salary), 0) 
            FROM payroll_deductions 
            WHERE payroll_run_id = p_payroll_run_id
        ),
        total_deductions = (
            SELECT COALESCE(SUM(deduction_amount), 0) 
            FROM payroll_deductions 
            WHERE payroll_run_id = p_payroll_run_id
        ),
        total_net_amount = (
            SELECT COALESCE(SUM(net_salary), 0) 
            FROM payroll_deductions 
            WHERE payroll_run_id = p_payroll_run_id
        ),
        employees_count = (
            SELECT COUNT(*) 
            FROM payroll_deductions 
            WHERE payroll_run_id = p_payroll_run_id
        ),
        updated_at = NOW()
    WHERE id = p_payroll_run_id;
END;
$$;

-- Function to get current month damage summary
CREATE OR REPLACE FUNCTION get_current_month_damage_summary()
RETURNS TABLE (
    total_damages_value DECIMAL(15,2),
    total_deductions_this_month DECIMAL(15,2),
    active_damages_count INTEGER,
    employees_with_damages_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(vd.total_damage_cost), 0)::DECIMAL(15,2) as total_damages_value,
        COALESCE(SUM(
            CASE 
                WHEN vd.is_fully_paid = false AND vd.remaining_balance > 0 
                THEN LEAST(
                    (e.valor * vd.monthly_deduction_percentage / 100.0),
                    vd.remaining_balance
                )
                ELSE 0
            END
        ), 0)::DECIMAL(15,2) as total_deductions_this_month,
        COUNT(CASE WHEN vd.is_fully_paid = false THEN 1 END)::INTEGER as active_damages_count,
        COUNT(DISTINCT vd.employee_id)::INTEGER as employees_with_damages_count
    FROM vehicle_damages vd
    INNER JOIN employees e ON vd.employee_id = e.id
    WHERE vd.damage_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
    AND vd.damage_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE;
END;
$$;
