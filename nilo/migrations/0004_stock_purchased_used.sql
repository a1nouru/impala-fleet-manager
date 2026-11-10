-- Stock per part: what was bought (approved invoices), what is on the shelf, what is bought
-- but not yet on the shelf (labels to print or scan), and the rest = used.
drop view nilo_stock;

create view nilo_stock as
with line as (
  select l.id, l.item_id, l.unit_cost, coalesce(l.container_size, 1) size,
         l.quantity * coalesce(l.container_size, 1) bought,
         case when inv.origin = 'legacy' then 0
              else greatest(ceil(l.quantity) - l.labels_generated, 0) * coalesce(l.container_size, 1) end unlabelled
  from nilo_invoice_lines l join nilo_invoices inv on inv.id = l.invoice_id
  where inv.status = 'approved'
), unit as (
  select u.line_id,
         sum(u.remaining) filter (where u.status = 'in_stock') on_shelf,
         sum(u.remaining) filter (where u.status = 'labelled') labelled
  from nilo_units u group by 1
)
select i.id item_id, i.name, i.kind, i.measure_unit,
       coalesce(sum(line.bought), 0) purchased,
       coalesce(sum(unit.on_shelf), 0) available,
       coalesce(sum(unit.labelled), 0) + coalesce(sum(line.unlabelled), 0) awaiting_receipt,
       greatest(coalesce(sum(line.bought), 0) - coalesce(sum(unit.on_shelf), 0)
                - coalesce(sum(unit.labelled), 0) - coalesce(sum(line.unlabelled), 0), 0) used,
       round(sum(line.unit_cost / line.size * unit.on_shelf) / nullif(sum(unit.on_shelf), 0), 2) avg_cost,
       round(avg(line.unit_cost / line.size), 2) last_known_cost
from nilo_items i
left join line on line.item_id = i.id
left join unit on unit.line_id = line.id
group by i.id;

revoke all on nilo_stock from anon, authenticated;
