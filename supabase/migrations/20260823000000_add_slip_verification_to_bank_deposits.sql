-- Read-only OCR verdict captured when a deposit is logged: extracted slip
-- amounts vs the selected reports' per-vehicle net balances. Written once by
-- the app at deposit creation; never edited by users.
ALTER TABLE bank_deposits
  ADD COLUMN IF NOT EXISTS slip_verification jsonb;

COMMENT ON COLUMN bank_deposits.slip_verification IS
  'Slip OCR verification verdict (lib/bank-slip/verify.ts SlipVerification): per-report matches, slips total vs selected total. Null for deposits logged before the feature existed.';
