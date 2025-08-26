-- HR System Setup Check
-- Run this first to see what tables already exist

-- Check if HR tables exist
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN ('employees', 'vehicle_damages', 'payroll_runs', 'payroll_deductions')
ORDER BY tablename;

-- Check if vehicles table exists (required for foreign key)
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename = 'vehicles';

-- Check if HR functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name IN ('calculate_monthly_deduction', 'process_payroll_deductions', 'get_current_month_damage_summary')
ORDER BY routine_name;
