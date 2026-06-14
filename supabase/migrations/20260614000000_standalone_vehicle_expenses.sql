-- Allow standalone (report-free) vehicle expenses on the All Expenses page.
-- Previously every expense had to belong to a daily report (report_id NOT NULL).
-- A standalone expense belongs to no report but MUST carry its own vehicle and date
-- (enforced by the check constraint below) so it is never a true orphan.

ALTER TABLE daily_expenses
  ALTER COLUMN report_id DROP NOT NULL;

ALTER TABLE daily_expenses
  ADD COLUMN IF NOT EXISTS vehicle_id   UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expense_date DATE,
  ADD COLUMN IF NOT EXISTS route        TEXT;

-- Guard against orphans: an expense must belong to a report, OR be a standalone
-- expense with a vehicle and a date.
ALTER TABLE daily_expenses
  DROP CONSTRAINT IF EXISTS daily_expenses_report_or_vehicle_chk;
ALTER TABLE daily_expenses
  ADD CONSTRAINT daily_expenses_report_or_vehicle_chk
  CHECK (report_id IS NOT NULL OR (vehicle_id IS NOT NULL AND expense_date IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_daily_expenses_vehicle_id   ON daily_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_expense_date ON daily_expenses(expense_date);
