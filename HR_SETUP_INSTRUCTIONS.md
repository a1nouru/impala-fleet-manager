# HR System Setup Instructions

## 🚀 Quick Setup

The HR system requires 3 SQL migrations to be run in your Supabase SQL Editor. 

### Step 1: Check Current State (Optional)
Run this in Supabase SQL Editor to see what's already set up:
```sql
-- Check if HR tables exist
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename IN ('employees', 'vehicle_damages', 'payroll_runs', 'payroll_deductions')
ORDER BY tablename;
```

### Step 2: Run Migrations (In Order)

Copy and paste each file content into your Supabase SQL Editor and run them **in this exact order**:

#### 1. Create Tables
📁 `supabase/migrations/20241221000000_create_hr_tables.sql`
- Creates employees, vehicle_damages, payroll_runs, payroll_deductions tables
- Sets up RLS policies and indexes

#### 2. Insert Employee Data  
📁 `supabase/migrations/20241221000001_insert_employee_data.sql`
- Inserts all 40 employees from PAYROLL_DATA.md
- Handles conflicts with ON CONFLICT DO UPDATE

#### 3. Create Functions
📁 `supabase/migrations/20241221000002_create_hr_functions.sql`
- Creates calculate_monthly_deduction function
- Creates process_payroll_deductions function  
- Creates get_current_month_damage_summary function

### Step 3: Verify Setup
After running all migrations, refresh your HR page at `/dashboard/hr`. You should see:
- ✅ Employee data loaded (40 employees)
- ✅ Summary cards showing zeros (no damages yet)
- ✅ No setup warning message

## 🎯 Features Available After Setup

### Vehicle Damage Management
- Log damage entries with payment plans (1-30% monthly deduction)
- Track damage status (Paid/Pending)
- Real-time summary dashboard

### Employee Management  
- View all 40 pre-loaded employees
- Search and filter employees
- Manage employee status (Active/Inactive)

### Payroll Generation
- Generate monthly payroll with automatic damage deductions
- Respect 30% maximum deduction rule
- Detailed payroll reports with employee breakdowns
- Finalize payroll runs

## 🔧 Troubleshooting

### Error: "relation does not exist"
- The tables haven't been created yet
- Run migration #1: `20241221000000_create_hr_tables.sql`

### Error: "function does not exist"  
- The database functions haven't been created
- Run migration #3: `20241221000002_create_hr_functions.sql`

### No employees showing
- Employee data hasn't been inserted
- Run migration #2: `20241221000001_insert_employee_data.sql`

### Still having issues?
- Check Supabase logs for detailed error messages
- Ensure all 3 migrations ran successfully
- Verify your Supabase environment variables are correct

## 📊 Sample Data Included

The system comes pre-loaded with:
- **40 employees** from your payroll data
- **Salary information** (ranging from 5,000 to 12,812,000 AOA)
- **Bank details** (IBAN/NIB for each employee)
- **Employee codes** (OUR0040 - OUR0079)

Ready to start tracking vehicle damages and generating payrolls! 🎉
