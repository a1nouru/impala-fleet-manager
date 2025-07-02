-- Enable RLS for all tables that will be modified by users.
ALTER TABLE public.bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS Policies for bank_deposits
-- =================================================================
CREATE POLICY "Allow authenticated users to view all bank deposits"
ON public.bank_deposits FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert bank deposits"
ON public.bank_deposits FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bank deposits"
ON public.bank_deposits FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- =================================================================
-- RLS Policies for daily_reports
-- =================================================================
CREATE POLICY "Allow authenticated users to view all daily reports"
ON public.daily_reports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert daily reports"
ON public.daily_reports FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update daily reports"
ON public.daily_reports FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- =================================================================
-- RLS Policies for daily_expenses
-- =================================================================
CREATE POLICY "Allow authenticated users to view all daily expenses"
ON public.daily_expenses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert new daily expenses"
ON public.daily_expenses FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update daily expenses"
ON public.daily_expenses FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete daily expenses"
ON public.daily_expenses FOR DELETE
TO authenticated
USING (true); 