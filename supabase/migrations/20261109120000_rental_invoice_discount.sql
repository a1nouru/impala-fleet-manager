-- Desconto on the Fatura Pró-Forma: total = (subtotal - discount) + IVA on that base.
alter table rental_invoices add column if not exists discount numeric(14,2) not null default 0 check (discount >= 0);

create or replace function create_rental_invoice(p jsonb) returns rental_invoices
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  r_id uuid;
  inv rental_invoices;
  sub numeric(14,2);
  rate numeric(5,2) := coalesce((p->>'iva_rate')::numeric, 0);
  label text;
  disc numeric(14,2) := coalesce((p->>'discount')::numeric, 0);
  base numeric(14,2);
  tot numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 then raise exception 'An invoice needs at least one line'; end if;

  select coalesce(sum(round((l->>'qty')::numeric * (l->>'unit_price')::numeric, 2)), 0) into sub
  from jsonb_array_elements(p->'lines') l;

  if disc < 0 or disc > sub then raise exception 'Discount must be between 0 and the subtotal'; end if;
  base := sub - disc;
  tot := round(base * (1 + rate / 100), 2);

  insert into invoice_series (series, next_number) values (p->>'series', 1) on conflict (series) do nothing;
  update invoice_series set next_number = next_number + 1 where series = p->>'series' returning next_number - 1 into n;
  label := (p->>'series') || '/' || n;

  insert into vehicle_rentals (rental_start_date, rental_end_date, rental_amount, client_name, client_contact, description, status, created_by)
  -- Whole days in Luanda time: vehicle_rentals requires start < end, and same-day hires are common.
  values (coalesce((p->>'rental_start_date')::date, (p->>'issue_date')::date)::timestamp at time zone 'Africa/Luanda',
          (coalesce((p->>'rental_end_date')::date, (p->>'due_date')::date) + interval '1 day' - interval '1 second') at time zone 'Africa/Luanda',
          tot, p->>'client_name', nullif(trim(p->>'client_contact'), ''),
          'Fatura Pró-Forma ' || label || coalesce(' · ' || nullif(trim(p->>'notes'), ''), ''), 'active', auth.uid()::text)
  returning id into r_id;

  insert into rental_invoices (rental_id, series, number, issue_date, due_date, client_name, client_nif, client_address,
                               notes, iva_rate, iva_exemption, subtotal, discount, iva_amount, total)
  values (r_id, p->>'series', n, (p->>'issue_date')::date, (p->>'due_date')::date, trim(p->>'client_name'),
          nullif(trim(p->>'client_nif'), ''), nullif(trim(p->>'client_address'), ''), nullif(trim(p->>'notes'), ''),
          rate, case when rate = 0 then coalesce(nullif(trim(p->>'iva_exemption'), ''), 'Transmissão de bens e serviço não sujeita') end,
          sub, disc, tot - base, tot)
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
    'iva_rate', i.iva_rate, 'iva_exemption', i.iva_exemption, 'subtotal', i.subtotal, 'discount', i.discount, 'iva_amount', i.iva_amount,
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
