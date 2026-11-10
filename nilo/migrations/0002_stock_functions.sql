-- Stock operations. Each runs in one transaction and locks the units it touches, so Royal
-- Express and Impala consuming at the same moment can never take the same unit twice.
-- remaining = what is left in a unit: 1 for a single part, the measure left for a container.

update nilo_units u set remaining = coalesce(l.container_size, 1)
from nilo_invoice_lines l where l.id = u.line_id and u.remaining is null;
alter table nilo_units alter column remaining set not null;

alter table nilo_invoices add column if not exists source_ref text;

-- Live shared balance. avg_cost is per unit, or per measure for bulk.
create view nilo_stock as
select i.id item_id, i.name, i.kind, i.measure_unit,
       coalesce(sum(u.remaining) filter (where u.status = 'in_stock'), 0) available,
       coalesce(sum(u.remaining) filter (where u.status = 'labelled'), 0) awaiting_receipt,
       round(avg(l.unit_cost / coalesce(l.container_size, 1)) filter (where u.status = 'in_stock'), 2) avg_cost,
       round(avg(l.unit_cost / coalesce(l.container_size, 1)), 2) last_known_cost
from nilo_items i
left join nilo_invoice_lines l on l.item_id = i.id
left join nilo_units u on u.line_id = l.id
group by i.id;

revoke all on nilo_stock from anon, authenticated;

-- Creates the not-yet-labelled units of an approved line. Returns all its codes.
create function nilo_generate_labels(p_line uuid) returns setof text language plpgsql as $$
declare l nilo_invoice_lines; inv nilo_invoices;
begin
  select * into l from nilo_invoice_lines where id = p_line for update;
  if l.id is null then raise exception 'line not found'; end if;
  select * into inv from nilo_invoices where id = l.invoice_id;
  if inv.status <> 'approved' then raise exception 'invoice % is not approved', coalesce(inv.invoice_no, inv.id::text); end if;
  if l.item_id is null then raise exception 'name the item before printing labels'; end if;
  insert into nilo_units(line_id, remaining)
  select p_line, coalesce(l.container_size, 1)
  from generate_series(1, ceil(l.quantity)::int - l.labels_generated);
  update nilo_invoice_lines set labels_generated = ceil(quantity)::int where id = p_line;
  return query select code from nilo_units where line_id = p_line order by code;
end $$;

-- Scanning a printed label onto the shelf.
create function nilo_receive(p_code text, p_user text) returns nilo_units language plpgsql as $$
declare u nilo_units;
begin
  select * into u from nilo_units where code = upper(trim(p_code)) for update;
  if u.id is null then raise exception 'unknown code %', p_code; end if;
  if u.status <> 'labelled' then raise exception '% is already %', u.code, u.status; end if;
  update nilo_units set status = 'in_stock' where id = u.id returning * into u;
  insert into nilo_movements(unit_id, type, quantity, user_email) values (u.id, 'receive', u.remaining, p_user);
  return u;
end $$;

-- Makes a maintenance record's consumption equal to p_parts ([{item_id, quantity}]).
-- Idempotent: saving the same record twice changes nothing; editing it consumes or returns
-- only the difference; p_parts = '[]' (record deleted) returns everything.
-- Takes the oldest stock first. p_codes optionally pins specific scanned units.
create function nilo_set_record_parts(p_company text, p_record uuid, p_plate text, p_user text,
                                      p_parts jsonb, p_codes text[] default '{}')
returns void language plpgsql as $$
declare
  r record; need numeric; take numeric; u record;
begin
  for r in
    with want as (
      select (e->>'item_id')::uuid item_id, sum((e->>'quantity')::numeric) qty
      from jsonb_array_elements(p_parts) e group by 1
    ), have as (
      select l.item_id, sum(case m.type when 'consume' then m.quantity else -m.quantity end) qty
      from nilo_movements m join nilo_units un on un.id = m.unit_id join nilo_invoice_lines l on l.id = un.line_id
      where m.maintenance_record_id = p_record and m.company = p_company and m.type in ('consume', 'receive')
      group by 1
    )
    select coalesce(w.item_id, h.item_id) item_id, coalesce(w.qty, 0) - coalesce(h.qty, 0) delta
    from want w full join have h on h.item_id = w.item_id
  loop
    if r.delta > 0 then
      need := r.delta;
      for u in
        select un.id, un.remaining from nilo_units un join nilo_invoice_lines l on l.id = un.line_id
        where l.item_id = r.item_id and un.status = 'in_stock'
        order by (un.code = any(p_codes)) desc, un.created_at, un.code
        for update of un
      loop
        exit when need <= 0;
        take := least(need, u.remaining);
        update nilo_units set remaining = remaining - take,
          status = case when remaining - take = 0 then 'consumed' else 'in_stock' end where id = u.id;
        insert into nilo_movements(unit_id, type, quantity, company, vehicle_plate, maintenance_record_id, user_email)
        values (u.id, 'consume', take, p_company, p_plate, p_record, p_user);
        need := need - take;
      end loop;
      if need > 0 then
        raise exception 'not enough stock of %: % short', (select name from nilo_items where id = r.item_id), need;
      end if;
    elsif r.delta < 0 then
      need := -r.delta;
      for u in
        select un.id, sum(case m.type when 'consume' then m.quantity else -m.quantity end) net, max(m.id) last
        from nilo_movements m join nilo_units un on un.id = m.unit_id join nilo_invoice_lines l on l.id = un.line_id
        where m.maintenance_record_id = p_record and m.company = p_company and l.item_id = r.item_id
          and m.type in ('consume', 'receive')
        group by un.id having sum(case m.type when 'consume' then m.quantity else -m.quantity end) > 0
        order by last desc
      loop
        exit when need <= 0;
        take := least(need, u.net);
        update nilo_units set remaining = remaining + take, status = 'in_stock' where id = u.id;
        insert into nilo_movements(unit_id, type, quantity, company, vehicle_plate, maintenance_record_id, user_email)
        values (u.id, 'receive', take, p_company, p_plate, p_record, p_user);
        need := need - take;
      end loop;
    end if;
  end loop;
end $$;

revoke all on function nilo_generate_labels(uuid), nilo_receive(text, text),
  nilo_set_record_parts(text, uuid, text, text, jsonb, text[]) from public, anon, authenticated;
