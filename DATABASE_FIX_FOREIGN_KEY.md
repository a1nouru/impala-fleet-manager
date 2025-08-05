# Fix Foreign Key Relationship

The tables exist but the foreign key relationship is missing between them.

## Run this SQL in your Supabase SQL Editor:

```sql
-- First, check if the foreign key constraint exists
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='company_expense_receipts';

-- If no results above, add the foreign key constraint
ALTER TABLE company_expense_receipts 
ADD CONSTRAINT fk_company_expense_receipts_expense_id 
FOREIGN KEY (expense_id) REFERENCES company_expenses(id) ON DELETE CASCADE;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
```

This will establish the proper relationship between the tables.