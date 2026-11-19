-- Loans: several supporting documents per loan, as [{ "url": ..., "name": ... }].
-- Replaces the single document_url/document_name pair, which stays in place
-- (unused) so already-deployed builds keep working during the rollout.
alter table public.loans
  add column if not exists documents jsonb not null default '[]'::jsonb;

update public.loans
set documents = jsonb_build_array(
  jsonb_build_object('url', document_url, 'name', coalesce(document_name, 'Document'))
)
where document_url is not null and documents = '[]'::jsonb;
