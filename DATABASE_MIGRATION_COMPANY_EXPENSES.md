# Company Expenses Database Migration

## ⚠️ Important: Run this SQL in your Supabase SQL Editor

To enable the Company Expenses feature, you need to create the necessary database tables and storage setup.

### Step 1: Copy and run this SQL in Supabase SQL Editor

```sql
-- Create company_expenses table
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

-- Create company_expense_receipts table
CREATE TABLE company_expense_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES company_expenses(id) ON DELETE CASCADE,
    receipt_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_company_expenses_date ON company_expenses(expense_date DESC);
CREATE INDEX idx_company_expenses_category ON company_expenses(category);
CREATE INDEX idx_company_expense_receipts_expense_id ON company_expense_receipts(expense_id);

-- Create updated_at trigger for company_expenses
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_expenses_updated_at 
    BEFORE UPDATE ON company_expenses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for company expense receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-expense-receipts', 'company-expense-receipts', true);

-- Create storage policies for company expense receipts
CREATE POLICY "Company expense receipts are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can upload company expense receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can update company expense receipts" ON storage.objects
FOR UPDATE USING (bucket_id = 'company-expense-receipts');

CREATE POLICY "Users can delete company expense receipts" ON storage.objects
FOR DELETE USING (bucket_id = 'company-expense-receipts');
```

### Step 2: Verify the setup

After running the SQL, go to your Supabase dashboard and verify:

1. **Tables created**: `company_expenses` and `company_expense_receipts` should appear in your Tables tab
2. **Storage bucket created**: `company-expense-receipts` should appear in your Storage tab
3. **Policies created**: Check the policies are applied to the storage bucket

### Step 3: Test the feature

1. Go to `/dashboard/financials` in your app
2. Click on the "Company Expenses" tab
3. Try adding a new expense with the "Add Expense" button

## 🎉 That's it!

Your Company Expenses feature should now be fully functional with:
- ✅ Add new company expenses
- ✅ Upload receipt files (PDF, JPG, PNG)
- ✅ Mark expenses as having no receipt
- ✅ Search and reuse previous expense categories
- ✅ Edit and delete expenses
- ✅ Date filtering and grouping
- ✅ Black footer totals matching your existing UI

---

If you encounter any issues, check the browser console for specific error messages.