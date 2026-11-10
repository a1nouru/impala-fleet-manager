-- One-time load of both apps' legacy inventory into Nilo. scripts/nilo-ingest.ts --commit
-- replaces the placeholder below with the planned JSON and runs this as one transaction.
begin;

create temp table p on commit drop as select $payload$__PAYLOAD__$payload$::jsonb j;

insert into nilo_items(id, name)
select (x->>'id')::uuid, x->>'name' from p, jsonb_array_elements(j->'items') x;

insert into nilo_item_aliases(alias, item_id)
select x->>'alias', (x->>'id')::uuid from p, jsonb_array_elements(j->'items') x;

insert into nilo_invoices(id, origin, invoice_date, total, file_path, status, approved_by, approved_at,
                          uploaded_by, source_company, source_ref)
select (x->>'invoice_id')::uuid, 'legacy', (x->>'date')::date,
       round((x->>'quantity')::numeric * (x->>'unit_cost')::numeric, 2),
       x->>'file_path', 'approved', 'legacy import', now(), x->>'uploaded_by', x->>'source_company', x->>'source_ref'
from p, jsonb_array_elements(j->'lots') x;

insert into nilo_invoice_lines(id, invoice_id, ocr_description, item_id, quantity, unit_cost, labels_generated)
select (x->>'line_id')::uuid, (x->>'invoice_id')::uuid, x->>'description', (x->>'item_id')::uuid,
       (x->>'quantity')::numeric, (x->>'unit_cost')::numeric,
       (x->>'units')::int + coalesce((select sum((c->>'quantity')::int) from jsonb_array_elements(x->'consumed') c), 0)
from p, jsonb_array_elements(j->'lots') x;

insert into nilo_line_sources(source_company, source_id, line_id)
select s->>'company', (s->>'id')::uuid, (x->>'line_id')::uuid
from p, jsonb_array_elements(j->'lots') x, jsonb_array_elements(x->'sources') s;

with u as (
  insert into nilo_units(line_id, status, remaining)
  select (x->>'line_id')::uuid, 'in_stock', 1
  from p, jsonb_array_elements(j->'lots') x, generate_series(1, (x->>'units')::int)
  returning id
)
insert into nilo_movements(unit_id, type, quantity, user_email)
select id, 'receive', 1, 'legacy import' from u;

-- This month's jobs: one consumed unit per part used, dated on the job's day.
with c as (
  select (x->>'line_id')::uuid line_id, c->>'company' company, c->>'plate' plate,
         (c->>'recordId')::uuid record_id, ((c->>'date') || 'T12:00:00Z')::timestamptz at
  from p, jsonb_array_elements(j->'lots') x, jsonb_array_elements(x->'consumed') c,
       generate_series(1, (c->>'quantity')::int)
), u as (
  insert into nilo_units(line_id, status, remaining, created_at)
  select line_id, 'consumed', 0, at from c
  returning id, line_id, created_at
), paired as (
  select u.id, c.* from
    (select u.*, row_number() over (partition by line_id, created_at order by id) n from u) u
    join (select c.*, row_number() over (partition by line_id, at order by record_id, company) n from c) c
      on c.line_id = u.line_id and c.at = u.created_at and c.n = u.n
)
insert into nilo_movements(unit_id, type, quantity, company, vehicle_plate, maintenance_record_id, user_email, created_at)
select id, 'consume', 1, company, plate, record_id, 'legacy import', at from paired;

-- Jobs created from this date on are Nilo jobs (their stock is in Nilo); older jobs are history.
insert into nilo_settings(key, value) select 'cutover_at', j->>'cutover' from p;

commit;
