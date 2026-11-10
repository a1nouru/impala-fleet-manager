-- Nilo shared garage inventory. Runs on the dedicated "nilo" Supabase project.
-- Only the two fleet apps' servers touch it (service role); RLS is on with no policies.

create sequence nilo_unit_seq;

create table nilo_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'unit' check (kind in ('unit', 'bulk')),
  measure_unit text,
  created_at timestamptz not null default now(),
  check (kind = 'unit' or measure_unit is not null)
);

-- Every spelling ever used for a part, mapped once by a human and reused by later imports.
create table nilo_item_aliases (
  alias text primary key,
  item_id uuid not null references nilo_items(id)
);

create table nilo_invoices (
  id uuid primary key default gen_random_uuid(),
  origin text not null default 'upload' check (origin in ('upload', 'legacy', 'stocktake')),
  supplier text,
  supplier_nif text,
  invoice_no text,
  invoice_date date not null,
  total numeric(14, 2),
  file_path text,
  file_sha256 text unique,
  ocr_raw jsonb,
  checks jsonb not null default '[]',
  status text not null check (status in ('blocked', 'pending_approval', 'approved')),
  approved_by text,
  approved_at timestamptz,
  uploaded_by text not null,
  source_company text not null check (source_company in ('royal', 'impala')),
  created_at timestamptz not null default now(),
  unique (supplier_nif, invoice_no),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
  check (origin <> 'upload' or (file_path is not null and file_sha256 is not null))
);

create table nilo_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references nilo_invoices(id),
  ocr_description text not null default '',
  item_id uuid references nilo_items(id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  container_size numeric(12, 3) check (container_size > 0),
  labels_generated int not null default 0 check (labels_generated >= 0)
);

-- Which fleet-app inventory_items rows a line came from. The primary key makes the legacy
-- import re-runnable: a source row can only ever land once. Split orders have two sources.
create table nilo_line_sources (
  source_company text not null check (source_company in ('royal', 'impala')),
  source_id uuid not null,
  line_id uuid not null references nilo_invoice_lines(id),
  primary key (source_company, source_id)
);

create table nilo_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default 'NILO-' || lpad(nextval('nilo_unit_seq')::text, 6, '0'),
  line_id uuid not null references nilo_invoice_lines(id),
  status text not null default 'labelled' check (status in ('labelled', 'in_stock', 'consumed', 'void')),
  remaining numeric(12, 3) check (remaining >= 0),
  created_at timestamptz not null default now()
);

create table nilo_movements (
  id bigint generated always as identity primary key,
  unit_id uuid not null references nilo_units(id),
  type text not null check (type in ('receive', 'consume', 'adjust', 'void')),
  quantity numeric(12, 3) not null check (quantity > 0),
  company text check (company in ('royal', 'impala')),
  vehicle_plate text,
  maintenance_record_id uuid,
  user_email text not null,
  created_at timestamptz not null default now(),
  check (type <> 'consume' or (company is not null and vehicle_plate is not null))
);

create table nilo_statements (
  id uuid primary key default gen_random_uuid(),
  statement_no text not null unique,
  company text not null check (company in ('royal', 'impala')),
  period date not null check (period = date_trunc('month', period)::date),
  lines jsonb not null,
  total numeric(14, 2) not null,
  issued_by text not null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check (status in ('issued', 'paid')),
  paid_by text,
  paid_at timestamptz,
  payment_proof_path text,
  payment_proof_sha256 text,
  unique (company, period),
  check (status = 'issued' or (paid_by is not null and paid_at is not null
    and payment_proof_path is not null and payment_proof_sha256 is not null))
);

-- Movements are history: no edits, no deletes, for anyone (the service role included).
create function nilo_reject_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger nilo_movements_append_only before update or delete on nilo_movements
  for each row execute function nilo_reject_change();

-- An issued statement is frozen. The only allowed change is issued -> paid with its proof.
create function nilo_statement_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'statements cannot be deleted';
  end if;
  if old.status <> 'issued' or new.status <> 'paid'
     or (to_jsonb(new) - array['status', 'paid_by', 'paid_at', 'payment_proof_path', 'payment_proof_sha256'])
        is distinct from
        (to_jsonb(old) - array['status', 'paid_by', 'paid_at', 'payment_proof_path', 'payment_proof_sha256']) then
    raise exception 'an issued statement can only be marked paid';
  end if;
  return new;
end $$;

create trigger nilo_statements_frozen before update or delete on nilo_statements
  for each row execute function nilo_statement_guard();

do $$
declare t text;
begin
  foreach t in array array['nilo_items', 'nilo_item_aliases', 'nilo_invoices', 'nilo_invoice_lines',
                           'nilo_line_sources', 'nilo_units', 'nilo_movements', 'nilo_statements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public) values
  ('nilo-invoices', 'nilo-invoices', false),
  ('nilo-payments', 'nilo-payments', false);
