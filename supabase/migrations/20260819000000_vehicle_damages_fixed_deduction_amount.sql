-- Vehicle damages: switch from percentage-based to fixed monthly deduction amount.
-- The app (services/hrService.ts) has written `monthly_deduction_amount` for a long time,
-- but the 20241222 migration was never applied to the live projects, so every
-- "Log Vehicle Damage" insert failed with PGRST204 (column not in schema cache).

ALTER TABLE public.vehicle_damages
  ADD COLUMN IF NOT EXISTS monthly_deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.vehicle_damages
SET monthly_deduction_amount = ROUND(total_damage_cost * monthly_deduction_percentage / 100.0, 2)
WHERE monthly_deduction_amount = 0 AND COALESCE(monthly_deduction_percentage, 0) > 0;

-- Legacy percentage column is no longer written by the app
ALTER TABLE public.vehicle_damages ALTER COLUMN monthly_deduction_percentage DROP NOT NULL;
ALTER TABLE public.vehicle_damages ALTER COLUMN monthly_deduction_percentage SET DEFAULT 0;
ALTER TABLE public.vehicle_damages DROP CONSTRAINT IF EXISTS vehicle_damages_monthly_deduction_percentage_check;

ALTER TABLE public.vehicle_damages DROP CONSTRAINT IF EXISTS check_deduction_amount_valid;
ALTER TABLE public.vehicle_damages
  ADD CONSTRAINT check_deduction_amount_valid
  CHECK (monthly_deduction_amount >= 0 AND monthly_deduction_amount <= total_damage_cost);

COMMENT ON COLUMN public.vehicle_damages.monthly_deduction_amount IS 'Fixed monthly deduction amount in AOA (replaced percentage-based system)';
COMMENT ON COLUMN public.vehicle_damages.monthly_deduction_percentage IS 'Legacy percentage field - kept for backward compatibility';

CREATE INDEX IF NOT EXISTS idx_vehicle_damages_unpaid_balance
ON public.vehicle_damages (is_fully_paid, remaining_balance)
WHERE is_fully_paid = FALSE AND remaining_balance > 0;

-- Deduction functions: fixed amount per damage, capped at the remaining balance

CREATE OR REPLACE FUNCTION public.calculate_monthly_deduction(p_employee_id uuid, p_payroll_month integer, p_payroll_year integer)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_deduction DECIMAL(12,2) := 0;
    v_damage_record RECORD;
BEGIN
    FOR v_damage_record IN
        SELECT monthly_deduction_amount, remaining_balance
        FROM vehicle_damages
        WHERE employee_id = p_employee_id
          AND is_fully_paid = false
          AND remaining_balance > 0
    LOOP
        v_total_deduction := v_total_deduction
            + LEAST(v_damage_record.monthly_deduction_amount, v_damage_record.remaining_balance);
    END LOOP;

    RETURN v_total_deduction;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_payroll_deductions(p_payroll_run_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_employee_record RECORD;
    v_damage_record RECORD;
    v_gross_salary DECIMAL(12,2);
    v_total_deduction DECIMAL(12,2) := 0;
    v_net_salary DECIMAL(12,2);
    v_calculated_deduction DECIMAL(12,2);
    v_deduction_reason TEXT := '';
BEGIN
    FOR v_employee_record IN
        SELECT id, nome, valor as salary
        FROM employees
        WHERE is_active = true
    LOOP
        v_gross_salary := v_employee_record.salary;
        v_total_deduction := 0;
        v_deduction_reason := '';

        FOR v_damage_record IN
            SELECT id, damage_description, monthly_deduction_amount, remaining_balance
            FROM vehicle_damages
            WHERE employee_id = v_employee_record.id
              AND is_fully_paid = false
              AND remaining_balance > 0
        LOOP
            v_calculated_deduction := LEAST(v_damage_record.monthly_deduction_amount, v_damage_record.remaining_balance);

            IF v_calculated_deduction <= 0 THEN
                CONTINUE;
            END IF;

            v_total_deduction := v_total_deduction + v_calculated_deduction;

            UPDATE vehicle_damages
            SET remaining_balance = remaining_balance - v_calculated_deduction,
                is_fully_paid = (remaining_balance - v_calculated_deduction <= 0),
                updated_at = NOW()
            WHERE id = v_damage_record.id;

            IF v_deduction_reason != '' THEN
                v_deduction_reason := v_deduction_reason || '; ';
            END IF;
            v_deduction_reason := v_deduction_reason ||
                format('Damage %s: %s AOA', v_damage_record.damage_description, v_calculated_deduction::TEXT);
        END LOOP;

        v_net_salary := v_gross_salary - v_total_deduction;

        INSERT INTO payroll_deductions (
            payroll_run_id, employee_id, gross_salary, deduction_amount, net_salary, deduction_reason
        ) VALUES (
            p_payroll_run_id, v_employee_record.id, v_gross_salary, v_total_deduction, v_net_salary,
            CASE WHEN v_deduction_reason = '' THEN 'No deductions' ELSE v_deduction_reason END
        );
    END LOOP;

    UPDATE payroll_runs
    SET total_gross_amount = (SELECT COALESCE(SUM(gross_salary), 0) FROM payroll_deductions WHERE payroll_run_id = p_payroll_run_id),
        total_deductions  = (SELECT COALESCE(SUM(deduction_amount), 0) FROM payroll_deductions WHERE payroll_run_id = p_payroll_run_id),
        total_net_amount  = (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_deductions WHERE payroll_run_id = p_payroll_run_id),
        employees_count   = (SELECT COUNT(*) FROM payroll_deductions WHERE payroll_run_id = p_payroll_run_id),
        updated_at = NOW()
    WHERE id = p_payroll_run_id;
END;
$function$;

-- The app calls this first and falls back to the legacy name; it never existed until now
CREATE OR REPLACE FUNCTION public.process_payroll_deductions_with_balance_check(p_payroll_run_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM public.process_payroll_deductions(p_payroll_run_id);
END;
$function$;

DROP FUNCTION IF EXISTS public.get_current_month_damage_summary();
CREATE FUNCTION public.get_current_month_damage_summary()
RETURNS TABLE (
    total_damages_value NUMERIC,
    total_deductions_this_month NUMERIC,
    active_damages_count INTEGER,
    employees_with_damages_count INTEGER
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH current_month_damages AS (
        SELECT vd.total_damage_cost, vd.monthly_deduction_amount, vd.is_fully_paid, vd.employee_id
        FROM vehicle_damages vd
        WHERE EXTRACT(MONTH FROM vd.damage_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM vd.damage_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    )
    SELECT
        COALESCE(SUM(cmd.total_damage_cost), 0)::NUMERIC,
        COALESCE(SUM(CASE WHEN NOT cmd.is_fully_paid THEN cmd.monthly_deduction_amount ELSE 0 END), 0)::NUMERIC,
        COUNT(CASE WHEN NOT cmd.is_fully_paid THEN 1 END)::INTEGER,
        COUNT(DISTINCT cmd.employee_id)::INTEGER
    FROM current_month_damages cmd;
END;
$function$;
