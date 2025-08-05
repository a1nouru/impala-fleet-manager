# Check and Fix Company Expenses Tables

## Step 1: Check what exists in your database

Run this SQL in your **Supabase SQL Editor** to see what's actually there:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('company_expenses', 'company_expense_receipts');

-- Check if storage bucket exists
SELECT * FROM storage.buckets WHERE name = 'company-expense-receipts';
```

## Step 2: Clean and Force Create Tables

If the check above shows missing tables, run this SQL:

```sql
-- Drop tables if they exist (to start fresh)
DROP TABLE IF EXISTS company_expense_receipts CASCADE;
DROP TABLE IF EXISTS company_expenses CASCADE;

-- Remove existing bucket if it exists
DELETE FROM storage.buckets WHERE name = 'company-expense-receipts';

-- Now create everything fresh
CREATE TABLE company_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    has_receipt BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_expense_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES company_expenses(id) ON DELETE CASCADE,
    receipt_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Create indexes
CREATE INDEX idx_company_expenses_date ON company_expenses(expense_date DESC);
CREATE INDEX idx_company_expenses_category ON company_expenses(category);
CREATE INDEX idx_company_expense_receipts_expense_id ON company_expense_receipts(expense_id);

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_company_expenses_updated_at 
    BEFORE UPDATE ON company_expenses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-expense-receipts', 'company-expense-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on tables
ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_expense_receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now)
CREATE POLICY "Enable read access for all users" ON company_expenses FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON company_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON company_expenses FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON company_expenses FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON company_expense_receipts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON company_expense_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON company_expense_receipts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON company_expense_receipts FOR DELETE USING (true);

-- Create storage policies
CREATE POLICY "Company expense receipts are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can upload company expense receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can update company expense receipts" ON storage.objects
FOR UPDATE USING (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can delete company expense receipts" ON storage.objects
FOR DELETE USING (bucket_id = 'company-expense-receipts');
```

## Step 3: Verify everything was created

Run this to verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('company_expenses', 'company_expense_receipts');

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('company_expenses', 'company_expense_receipts');

-- Check storage bucket
SELECT * FROM storage.buckets WHERE name = 'company-expense-receipts';

-- Test insert (should work)
INSERT INTO company_expenses (expense_date, category, amount) 
VALUES (CURRENT_DATE, 'Test', 10.00);

-- Check the test row
SELECT * FROM company_expenses;

-- Clean up test
DELETE FROM company_expenses WHERE category = 'Test';
```

## ✅ Expected Results:
- Step 1: Shows 2 tables if they exist
- Step 2: Creates everything fresh with no errors  
- Step 3: Shows tables, policies, and successful test insert

After running this, refresh your browser and try the Company Expenses page again!