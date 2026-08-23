-- Deposits are scoped to a vehicle group (Regular vs Agaseke) because the two
-- groups bank into different accounts: Regular → Caixa Angola, Agaseke →
-- Standard Bank. Legacy mixed deposits keep deposit_group NULL.
ALTER TABLE bank_deposits
  ADD COLUMN IF NOT EXISTS deposit_group text
  CHECK (deposit_group IN ('regular', 'agaseke'));

-- Widen the bank_name check to allow Standard Bank (Agaseke deposits).
ALTER TABLE bank_deposits DROP CONSTRAINT IF EXISTS bank_deposits_bank_name_check;
ALTER TABLE bank_deposits
  ADD CONSTRAINT bank_deposits_bank_name_check
  CHECK (bank_name IN ('Caixa Angola', 'BAI', 'Standard Bank'));
