-- Loans: optional supporting document (agreement, request letter, etc.)
-- attached when the loan is recorded. Stored in the existing loan-slips bucket.
alter table public.loans
  add column if not exists document_url text,
  add column if not exists document_name text;
