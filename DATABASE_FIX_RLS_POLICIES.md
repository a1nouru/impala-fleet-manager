# Fix Company Expenses RLS Policies

The tables exist but we need to add Row Level Security (RLS) policies for proper access.

## Run this SQL in your Supabase SQL Editor:

```sql
-- Enable RLS on company_expenses table
ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on company_expense_receipts table  
ALTER TABLE company_expense_receipts ENABLE ROW LEVEL SECURITY;

-- Create policies for company_expenses table
CREATE POLICY "Users can view all company expenses" ON company_expenses
FOR SELECT USING (true);

CREATE POLICY "Users can insert company expenses" ON company_expenses
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update company expenses" ON company_expenses
FOR UPDATE USING (true);

CREATE POLICY "Users can delete company expenses" ON company_expenses
FOR DELETE USING (true);

-- Create policies for company_expense_receipts table
CREATE POLICY "Users can view all company expense receipts" ON company_expense_receipts
FOR SELECT USING (true);

CREATE POLICY "Users can insert company expense receipts" ON company_expense_receipts
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update company expense receipts" ON company_expense_receipts
FOR UPDATE USING (true);

CREATE POLICY "Users can delete company expense receipts" ON company_expense_receipts
FOR DELETE USING (true);
```

After running this SQL, the Company Expenses feature should work properly!