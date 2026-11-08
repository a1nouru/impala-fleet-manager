-- Fatura Pró-Forma for vehicle rentals. Generating one also creates the rental, so it shows in the
-- Rental list; it reads as unpaid until rental_receipts cover the total.

create table if not exists invoice_series (
  series text primary key,
  next_number integer not null check (next_number > 0)
);

create table if not exists rental_invoices (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null unique references vehicle_rentals(id) on delete cascade,
  series text not null,
  number integer not null,
  issue_date date not null,
  due_date date not null,
  client_name text not null check (length(trim(client_name)) > 0),
  client_nif text,
  client_address text,
  notes text,
  iva_rate numeric(5,2) not null default 0 check (iva_rate >= 0),
  iva_exemption text,
  subtotal numeric(14,2) not null,
  iva_amount numeric(14,2) not null,
  total numeric(14,2) not null,
  public_token uuid not null unique default gen_random_uuid(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (series, number),
  check (due_date >= issue_date)
);

create table if not exists rental_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references rental_invoices(id) on delete cascade,
  position integer not null,
  code text,
  description text not null,
  unit text not null default 'Uni',
  qty numeric(12,2) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(qty * unit_price, 2)) stored
);
create index if not exists rental_invoice_lines_invoice on rental_invoice_lines (invoice_id, position);

alter table invoice_series enable row level security;
alter table rental_invoices enable row level security;
alter table rental_invoice_lines enable row level security;
drop policy if exists authenticated_all on rental_invoices;
drop policy if exists authenticated_all on rental_invoice_lines;
create policy authenticated_all on rental_invoices for all to authenticated using (true) with check (true);
create policy authenticated_all on rental_invoice_lines for all to authenticated using (true) with check (true);
-- invoice_series: no policies; only create_rental_invoice (security definer) touches it.

-- One call creates rental + invoice + lines atomically and assigns the next number in the series.
-- p = { series, issue_date, due_date, rental_start_date, rental_end_date, client_name, client_nif,
--       client_address, client_contact, notes, iva_rate, iva_exemption, lines: [{code, description, unit, qty, unit_price}] }
create or replace function create_rental_invoice(p jsonb) returns rental_invoices
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  r_id uuid;
  inv rental_invoices;
  sub numeric(14,2);
  rate numeric(5,2) := coalesce((p->>'iva_rate')::numeric, 0);
  label text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 then raise exception 'An invoice needs at least one line'; end if;

  select coalesce(sum(round((l->>'qty')::numeric * (l->>'unit_price')::numeric, 2)), 0) into sub
  from jsonb_array_elements(p->'lines') l;

  insert into invoice_series (series, next_number) values (p->>'series', 1) on conflict (series) do nothing;
  update invoice_series set next_number = next_number + 1 where series = p->>'series' returning next_number - 1 into n;
  label := (p->>'series') || '/' || n;

  insert into vehicle_rentals (rental_start_date, rental_end_date, rental_amount, client_name, client_contact, description, status, created_by)
  -- Whole days in Luanda time: vehicle_rentals requires start < end, and same-day hires are common.
  values (coalesce((p->>'rental_start_date')::date, (p->>'issue_date')::date)::timestamp at time zone 'Africa/Luanda',
          (coalesce((p->>'rental_end_date')::date, (p->>'due_date')::date) + interval '1 day' - interval '1 second') at time zone 'Africa/Luanda',
          round(sub * (1 + rate / 100), 2), p->>'client_name', nullif(trim(p->>'client_contact'), ''),
          'Fatura Pró-Forma ' || label || coalesce(' · ' || nullif(trim(p->>'notes'), ''), ''), 'active', auth.uid()::text)
  returning id into r_id;

  insert into rental_invoices (rental_id, series, number, issue_date, due_date, client_name, client_nif, client_address,
                               notes, iva_rate, iva_exemption, subtotal, iva_amount, total)
  values (r_id, p->>'series', n, (p->>'issue_date')::date, (p->>'due_date')::date, trim(p->>'client_name'),
          nullif(trim(p->>'client_nif'), ''), nullif(trim(p->>'client_address'), ''), nullif(trim(p->>'notes'), ''),
          rate, case when rate = 0 then coalesce(nullif(trim(p->>'iva_exemption'), ''), 'Transmissão de bens e serviço não sujeita') end,
          sub, round(sub * rate / 100, 2), round(sub * (1 + rate / 100), 2))
  returning * into inv;

  insert into rental_invoice_lines (invoice_id, position, code, description, unit, qty, unit_price)
  select inv.id, ord::int, nullif(trim(l->>'code'), ''), coalesce(nullif(trim(l->>'description'), ''), 'Prestação de serviço ALUGUER DE AUTOCARRO'),
         coalesce(nullif(trim(l->>'unit'), ''), 'Uni'), (l->>'qty')::numeric, (l->>'unit_price')::numeric
  from jsonb_array_elements(p->'lines') with ordinality as t(l, ord);

  return inv;
end $$;
revoke execute on function create_rental_invoice(jsonb) from public, anon;
grant execute on function create_rental_invoice(jsonb) to authenticated;

-- What the QR code opens: the invoice as printed, plus whether it has been paid. No login needed;
-- the token is unguessable and the payload holds nothing beyond the printed document.
create or replace function public_rental_invoice(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'series', i.series, 'number', i.number, 'issue_date', i.issue_date, 'due_date', i.due_date,
    'client_name', i.client_name, 'client_nif', i.client_nif, 'client_address', i.client_address, 'notes', i.notes,
    'iva_rate', i.iva_rate, 'iva_exemption', i.iva_exemption, 'subtotal', i.subtotal, 'iva_amount', i.iva_amount,
    'total', i.total, 'public_token', i.public_token,
    'paid_amount', coalesce((select sum(amount) from rental_receipts where rental_id = i.rental_id), 0),
    'cancelled', r.status = 'cancelled',
    'lines', coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'description', l.description, 'unit', l.unit,
                        'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total) order by l.position)
                       from rental_invoice_lines l where l.invoice_id = i.id), '[]'::jsonb))
  from rental_invoices i join vehicle_rentals r on r.id = i.rental_id
  where i.public_token = p_token
$$;
revoke execute on function public_rental_invoice(uuid) from public;
grant execute on function public_rental_invoice(uuid) to anon, authenticated;
