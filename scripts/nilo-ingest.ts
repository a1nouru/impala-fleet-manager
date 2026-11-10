// The Nilo merge. Reads inventory_items and maintenance usage from both fleet DBs (read-only)
// and writes a review report. --commit loads the result into Nilo, once. --resync replaces an
// earlier import (to catch up the gap before the apps switched over), but only while nobody has
// used Nilo yet.
//   SUPABASE_ACCESS_TOKEN=sbp_... node --experimental-strip-types scripts/nilo-ingest.ts report.md [--commit|--resync]
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { allocateRecent, itemKey, openingUnits, planIngest, type Company, type RecentUse, type SourceRow } from "../lib/nilo/ingest.ts";
import { usedQuantitiesByNormalizedName } from "../lib/inventory/usage.ts";

const PROJECTS: Record<Company, string> = { royal: "hymravaveedguejtazsc", impala: "depesjavqihzrxswkcso" };
const NILO = "xuggdtzfsptidaqjpqxg";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const out = process.argv[2];
const resync = process.argv[3] === "--resync";
const commit = resync || process.argv[3] === "--commit";
if (!token || !out) throw new Error("usage: SUPABASE_ACCESS_TOKEN=... scripts/nilo-ingest.ts <report.md> [--commit]");

async function sql<T>(ref: string, query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${ref}: ${res.status} ${await res.text()}`);
  return res.json();
}

const SQL = `
select i.id, i.code, i.date::text, coalesce(nullif(trim(i.item_name), ''), i.description, '') item_name,
       coalesce(i.description, '') description, i.quantity::float8 quantity, i.amount_unit::float8 unit_cost,
       i.receipt_url, i.created_by,
       case when o.id is null then null else (o.metadata->>'eTag') || ':' || (o.metadata->>'size') end file_key
from inventory_items i
left join storage.objects o on o.bucket_id = 'inventory-receipts'
  and o.name = substring(i.receipt_url from '/inventory-receipts/([^?]+)')`;

const extra = new Map<string, { receiptUrl: string | null; createdBy: string | null }>();

async function load(company: Company): Promise<SourceRow[]> {
  type Row = {
    id: string;
    code: string | null;
    date: string;
    item_name: string;
    description: string;
    quantity: number | null;
    unit_cost: number | null;
    receipt_url: string | null;
    created_by: string | null;
    file_key: string | null;
  };
  const rows = await sql<Row>(PROJECTS[company], SQL);
  for (const r of rows) extra.set(`${company}:${r.id}`, { receiptUrl: r.receipt_url, createdBy: r.created_by });
  return rows.map((r) => ({
    company,
    id: r.id,
    code: r.code ?? "",
    date: r.date,
    itemName: r.item_name,
    description: r.description,
    quantity: r.quantity ?? 0,
    unitCost: r.unit_cost ?? 0,
    fileKey: r.file_key,
  }));
}

// Parts used per catalog key across both apps, from the "Name (Qty: n)" strings on jobs.
async function usedByKey(): Promise<Map<string, number>> {
  const used = new Map<string, number>();
  for (const c of ["royal", "impala"] as const) {
    const records = await sql<{ parts: unknown }>(PROJECTS[c], "select parts from maintenance_records");
    for (const [name, n] of Object.entries(usedQuantitiesByNormalizedName(records))) {
      const k = itemKey(name);
      used.set(k, (used.get(k) ?? 0) + n);
    }
  }
  return used;
}

const rows = [...(await load("royal")), ...(await load("impala"))];
const plan = planIngest(rows);
const units = openingUnits(plan.lots, await usedByKey());
const openingTotal = units.reduce((a, b) => a + b, 0);

// Jobs entered since the start of this month become real Nilo consumption, so this month's
// running statement is complete and later edits of those jobs adjust stock correctly.
const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
type UseMeta = { company: Company; recordId: string; plate: string; date: string };
const recentUses: RecentUse<UseMeta>[] = [];
for (const company of ["royal", "impala"] as const) {
  const recs = await sql<{ id: string; date: string; plate: string | null; parts: string[] | null }>(
    PROJECTS[company],
    `select m.id, m.date::text date, v.plate, m.parts from maintenance_records m
     left join vehicles v on v.id = m.vehicle_id where m.created_at >= '${monthStart}' order by m.date, m.created_at`,
  );
  for (const r of recs)
    for (const p of r.parts ?? []) {
      const m = p.match(/^(.+?)\s*\(Qty:\s*(\d+)\)$/);
      if (m) recentUses.push({ key: itemKey(m[1]), quantity: Number(m[2]), meta: { company, recordId: r.id, plate: r.plate ?? "", date: r.date } });
    }
}
const recent = allocateRecent(plan.lots, units, recentUses);
const recentTotal = recent.placed.reduce((n, p) => n + p.quantity, 0);

const kz = (n: number) => n.toLocaleString("pt-AO", { maximumFractionDigits: 2 });
const who = (r: SourceRow) => `${r.company === "royal" ? "RE" : "IM"} #${r.code}`;
const line = (r: SourceRow) => `| ${who(r)} | ${r.date} | ${r.itemName.trim()} | ${r.quantity} | ${kz(r.unitCost)} |`;
const table = (groups: SourceRow[][]) =>
  groups.map((g, i) => [`**${i + 1}.**`, "", "| Row | Date | Item | Qty | Unit Kz |", "|---|---|---|---|---|", ...g.map(line), ""].join("\n"));

const byCompany = (c: Company) => rows.filter((r) => r.company === c).length;
const report = [
  `# Nilo merge ${commit ? "import" : "dry run"} (${new Date().toISOString().slice(0, 10)})`,
  "",
  `Read ${byCompany("royal")} Royal Express + ${byCompany("impala")} Impala rows.`,
  "",
  `- Nilo purchase lots: **${plan.lots.length}**`,
  `- Split orders joined into one lot: **${plan.splitPairs.length}**`,
  `- Likely duplicates, same receipt + item + qty + price (imported as-is; review): **${plan.likelyDuplicates.length}** groups`,
  `- Look-alikes (imported as-is; review): **${plan.lookalikes.length}** groups`,
  `- Junk rows skipped: **${plan.junk.length}**`,
  `- Catalog parts: **${plan.catalog.length}** (from ${new Set(rows.map((r) => r.itemName.trim().toLowerCase())).size} raw names)`,
  `- Opening stock (bought − used, both apps): **${openingTotal}** units`,
  `- Used since ${monthStart.slice(0, 10)} (brought in as consumption for the running statement): **${recentTotal}** units` +
    (recent.skipped.length ? `; ${recent.skipped.reduce((n, u) => n + u.quantity, 0)} more logged than were ever bought (not imported)` : ""),
  "",
  "## Split orders joined",
  "| Item | Date | RE | Impala | Nilo lot | Unit Kz |",
  "|---|---|---|---|---|---|",
  ...plan.splitPairs.map((l) => `| ${l.rows[0].itemName} | ${l.date} | ${l.rows[0].quantity} | ${l.rows[1].quantity} | **${l.quantity}** | ${kz(l.unitCost)} |`),
  "",
  "## Opening stock by part",
  "| Part | Units |",
  "|---|---|",
  ...plan.catalog
    .map((c) => ({ c, n: plan.lots.reduce((s, l, i) => s + (l.itemKey === c.key ? units[i] : 0), 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => `| ${x.c.names[0]} | ${x.n} |`),
  "",
  "## Likely duplicates: same receipt file, item, qty and price",
  ...table(plan.likelyDuplicates),
  "## Look-alikes: same day, item and qty, different receipts",
  ...table(plan.lookalikes),
  "## Junk rows skipped",
  "| Row | Date | Item | Qty | Unit Kz |",
  "|---|---|---|---|---|",
  ...plan.junk.map(line),
  "",
  "## Catalog (parts with more than one spelling)",
  "| Catalog key | Total qty | Purchases | Spellings merged |",
  "|---|---|---|---|",
  ...plan.catalog.filter((c) => c.names.length > 1).map((c) => `| ${c.key} | ${c.quantity} | ${c.rows} | ${c.names.join(" · ")} |`),
  "",
].join("\n");

writeFileSync(out, report);
console.log(report.split("\n").slice(0, 13).join("\n"));

if (commit) {
  if (resync) {
    const [used] = await sql<{ n: number }>(
      NILO,
      `select (select count(*) from nilo_movements where user_email <> 'legacy import')
            + (select count(*) from nilo_invoices where origin <> 'legacy')
            + (select count(*) from nilo_statements) n`,
    );
    if (used.n > 0) throw new Error(`Nilo is in use (${used.n} non-import records); a resync would erase them.`);
    await sql(
      NILO,
      `truncate nilo_movements, nilo_units, nilo_line_sources, nilo_invoice_lines, nilo_invoices,
         nilo_item_aliases, nilo_items, nilo_settings;
       alter sequence nilo_unit_seq restart`,
    );
  }
  const done = await sql<{ n: number }>(NILO, "select count(*)::int n from nilo_settings where key = 'cutover_at'");
  if (done[0].n > 0) throw new Error("Nilo already has a cutover; the legacy import runs once (use --resync before first use).");

  const itemId = new Map(plan.catalog.map((c) => [c.key, randomUUID()]));
  const taken = new Set<string>();
  const items = plan.catalog.map((c) => {
    let name = c.names[0];
    while (taken.has(name.toLowerCase())) name = `${name} *`;
    taken.add(name.toLowerCase());
    return { id: itemId.get(c.key), name, alias: c.key };
  });
  const lots = plan.lots.map((l, i) => {
    const first = l.rows[0];
    const x = extra.get(`${first.company}:${first.id}`);
    return {
      invoice_id: randomUUID(),
      line_id: randomUUID(),
      item_id: itemId.get(l.itemKey),
      date: l.date,
      quantity: l.quantity,
      unit_cost: l.unitCost,
      description: l.rows.map((r) => r.description || r.itemName).join(" / "),
      file_path: x?.receiptUrl ?? null,
      uploaded_by: x?.createdBy || "legacy import",
      source_company: first.company,
      source_ref: l.rows.map(who).join(" + "),
      units: units[i],
      consumed: recent.placed.filter((p) => p.lot === i).map((p) => ({ quantity: p.quantity, ...p.meta })),
      sources: l.rows.map((r) => ({ company: r.company, id: r.id })),
    };
  });
  const payload = JSON.stringify({ items, lots, cutover: monthStart });
  if (payload.includes("$payload$")) throw new Error("payload contains the SQL quote tag");
  const script = readFileSync(new URL("../nilo/legacy-import.sql", import.meta.url), "utf8").replace("__PAYLOAD__", payload);
  await sql(NILO, script);

  const [check] = await sql(
    NILO,
    `select (select count(*) from nilo_items) items, (select count(*) from nilo_invoice_lines) lines,
       (select count(*) from nilo_line_sources) sources, (select count(*) from nilo_units) units,
       (select sum(available) from nilo_stock) available, (select value from nilo_settings where key = 'cutover_at') cutover`,
  );
  console.log("Committed:", JSON.stringify(check));
}
