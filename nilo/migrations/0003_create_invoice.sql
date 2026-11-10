-- Stores a checked supplier invoice and its lines in one transaction. Each line names its
-- part; the part is found through its alias key (lib/nilo/ingest.ts itemKey) or created.
-- p: {supplier, supplier_nif, invoice_no, invoice_date, total, file_path, file_sha256,
--     ocr_raw, checks, status, uploaded_by, source_company,
--     lines: [{ocr_description, item_name, alias, kind, measure_unit, container_size, quantity, unit_cost}]}
create function nilo_create_invoice(p jsonb) returns uuid language plpgsql as $$
declare inv uuid; l jsonb; item uuid;
begin
  insert into nilo_invoices(supplier, supplier_nif, invoice_no, invoice_date, total, file_path, file_sha256,
                            ocr_raw, checks, status, uploaded_by, source_company,
                            approved_by, approved_at)
  values (p->>'supplier', p->>'supplier_nif', p->>'invoice_no', (p->>'invoice_date')::date, (p->>'total')::numeric,
          p->>'file_path', p->>'file_sha256', p->'ocr_raw', coalesce(p->'checks', '[]'), p->>'status',
          p->>'uploaded_by', p->>'source_company',
          case when p->>'status' = 'approved' then 'auto: passed all checks' end,
          case when p->>'status' = 'approved' then now() end)
  returning id into inv;

  for l in select * from jsonb_array_elements(p->'lines') loop
    select item_id into item from nilo_item_aliases where alias = l->>'alias';
    if item is null then
      insert into nilo_items(name, kind, measure_unit)
      values (l->>'item_name', coalesce(l->>'kind', 'unit'), l->>'measure_unit')
      on conflict (name) do update set name = excluded.name
      returning id into item;
      insert into nilo_item_aliases(alias, item_id) values (l->>'alias', item) on conflict do nothing;
    end if;
    insert into nilo_invoice_lines(invoice_id, ocr_description, item_id, quantity, unit_cost, container_size)
    values (inv, coalesce(l->>'ocr_description', ''), item, (l->>'quantity')::numeric, (l->>'unit_cost')::numeric,
            nullif(l->>'container_size', '')::numeric);
  end loop;
  return inv;
end $$;

revoke all on function nilo_create_invoice(jsonb) from public, anon, authenticated;

-- cutover_at: maintenance records created before it were settled by the legacy import and
-- never touch Nilo stock.
create table nilo_settings (key text primary key, value text not null);
alter table nilo_settings enable row level security;
revoke all on nilo_settings from anon, authenticated;
