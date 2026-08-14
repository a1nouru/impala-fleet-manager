-- Loans module: company-issued loans, repayment slips, and server-side page password.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Server-side page passwords
-- ---------------------------------------------------------------------------
-- The hash lives in a table that no client role can read. Verification happens
-- inside a SECURITY DEFINER function, so the password is never sent to or
-- compared in the browser.
create table if not exists public.app_passwords (
  key text primary key,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_passwords enable row level security;
-- Intentionally no policies: anon/authenticated get zero rows.

revoke all on table public.app_passwords from anon, authenticated;

insert into public.app_passwords (key, password_hash)
values ('loans', extensions.crypt('Savanna@2024', extensions.gen_salt('bf')))
on conflict (key) do update
  set password_hash = excluded.password_hash,
      updated_at = now();

create or replace function public.verify_app_password(p_key text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_password is null or p_password = '' then
    return false;
  end if;

  select password_hash into v_hash
  from public.app_passwords
  where key = p_key;

  if v_hash is null then
    return false;
  end if;

  return v_hash = extensions.crypt(p_password, v_hash);
end;
$$;

revoke all on function public.verify_app_password(text, text) from public;
grant execute on function public.verify_app_password(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Loans
-- ---------------------------------------------------------------------------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  borrower_contact text,
  amount numeric(14, 2) not null check (amount >= 0),
  -- Which company account the money was issued from (e.g. Caixa Angola, Agaseke)
  issuing_account text not null default 'Caixa Angola',
  purpose text,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Repayment / closure details
  closed_at timestamptz,
  closed_by text,
  repaid_amount numeric(14, 2),
  repayment_date date,
  slip_url text,
  slip_name text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_status_idx on public.loans (status);
create index if not exists loans_issue_date_idx on public.loans (issue_date desc);

create or replace function public.set_loans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists loans_set_updated_at on public.loans;
create trigger loans_set_updated_at
  before update on public.loans
  for each row execute function public.set_loans_updated_at();

alter table public.loans enable row level security;

drop policy if exists "loans readable" on public.loans;
create policy "loans readable" on public.loans for select using (true);

drop policy if exists "loans insertable" on public.loans;
create policy "loans insertable" on public.loans for insert with check (true);

drop policy if exists "loans updatable" on public.loans;
create policy "loans updatable" on public.loans for update using (true) with check (true);

drop policy if exists "loans deletable" on public.loans;
create policy "loans deletable" on public.loans for delete using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for repayment slips
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('loan-slips', 'loan-slips', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view loan slips" on storage.objects;
create policy "Anyone can view loan slips" on storage.objects
  for select using (bucket_id = 'loan-slips');

drop policy if exists "Anyone can upload loan slips" on storage.objects;
create policy "Anyone can upload loan slips" on storage.objects
  for insert with check (bucket_id = 'loan-slips');

drop policy if exists "Anyone can update loan slips" on storage.objects;
create policy "Anyone can update loan slips" on storage.objects
  for update using (bucket_id = 'loan-slips') with check (bucket_id = 'loan-slips');

drop policy if exists "Anyone can delete loan slips" on storage.objects;
create policy "Anyone can delete loan slips" on storage.objects
  for delete using (bucket_id = 'loan-slips');
