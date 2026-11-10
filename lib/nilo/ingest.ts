// Plans the one-time merge of both apps' inventory_items into Nilo without double counting.
// Pure: rows in, plan out. scripts/nilo-ingest.ts feeds it real data.

import type { Company } from "./ledger.ts";

export type { Company };

export type SourceRow = {
  company: Company;
  id: string;
  code: string;
  date: string;
  itemName: string;
  description: string;
  quantity: number;
  unitCost: number;
  // Storage eTag + size of the receipt; identical content gives an identical key.
  fileKey: string | null;
};

export type Lot = { rows: SourceRow[]; itemKey: string; date: string; quantity: number; unitCost: number };

export type IngestPlan = {
  lots: Lot[];
  splitPairs: Lot[];
  likelyDuplicates: SourceRow[][];
  lookalikes: SourceRow[][];
  junk: SourceRow[];
  catalog: { key: string; names: string[]; rows: number; quantity: number }[];
};

const SYNONYMS: [RegExp, string][] = [
  [/\btires?\b/g, "pneu"],
  [/\bgord[ae]n\b|\bgolden\b/g, "golden"],
  [/\bcr[iy]wn\b|\bgrown\b/g, "crown"],
  [/\bbrake disc pads\b/g, "calco"],
];

// Parts that are one physical product however they were typed. Every Golden Crown tyre the
// fleets buy is the 315/80R22.5; the extra words ("000", "liso", "2") are typing noise.
const CANONICAL: [RegExp, string][] = [[/^pneu golden\b/, "pneu golden crown 315/80r22.5"]];

export function itemKey(name: string): string {
  let s = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  const key = s
    .replace(/[^a-z0-9/.*]+/g, " ")
    .replace(/^\s*\d+\s*t?\s+/, "")
    .replace(/\bjogos? de\b|\bde\b|\bdo\b|\bda\b/g, " ")
    .replace(/\b([a-z]{4,})s\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return CANONICAL.find(([re]) => re.test(key))?.[1] ?? key;
}

const SPLIT_ORDER = /dividid[oa]|contentor dividido|metade da encomenda/i;

const lotOf = (rows: SourceRow[]): Lot => ({
  rows,
  itemKey: itemKey(rows[0].itemName),
  date: rows[0].date,
  quantity: rows.reduce((n, r) => n + r.quantity, 0),
  unitCost: rows[0].unitCost,
});

function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) {
    const k = key(t);
    if (k === null) continue;
    out.set(k, [...(out.get(k) ?? []), t]);
  }
  return out;
}

function byFrequency(values: string[]): string[] {
  const n = new Map<string, number>();
  for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

// What is still on the shelf when Nilo starts: per part, everything bought by both apps minus
// everything both apps' maintenance jobs used, in whole units. The units are attached to the
// newest purchases (oldest stock is assumed used first). Returns units per lot, same order.
export function openingUnits(lots: Lot[], usedByKey: Map<string, number>): number[] {
  const out = lots.map(() => 0);
  const byKey = groupBy(
    lots.map((l, i) => ({ l, i })),
    (x) => x.l.itemKey,
  );
  for (const [key, group] of byKey) {
    const bought = group.reduce((n, x) => n + x.l.quantity, 0);
    let left = Math.floor(Math.max(0, bought - (usedByKey.get(key) ?? 0)));
    for (const { l, i } of group.sort((a, b) => b.l.date.localeCompare(a.l.date))) {
      out[i] = Math.min(Math.floor(l.quantity), left);
      left -= out[i];
    }
  }
  return out;
}

export type RecentUse<M> = { key: string; quantity: number; meta: M };

// Jobs from this month are brought into Nilo as real consumption so the running statement is
// complete. Each used unit is placed on the newest purchase that still has room after the
// opening stock. Uses with no room left (more logged than ever bought) come back in skipped.
export function allocateRecent<M>(lots: Lot[], opening: number[], uses: RecentUse<M>[]) {
  const room = lots.map((l, i) => Math.floor(l.quantity) - opening[i]);
  const newestFirst = lots.map((l, i) => i).sort((a, b) => lots[b].date.localeCompare(lots[a].date));
  const placed: { lot: number; quantity: number; meta: M }[] = [];
  const skipped: RecentUse<M>[] = [];
  for (const use of uses) {
    let need = Math.floor(use.quantity);
    for (const i of newestFirst) {
      if (need === 0) break;
      if (lots[i].itemKey !== use.key || room[i] === 0) continue;
      const take = Math.min(need, room[i]);
      room[i] -= take;
      need -= take;
      placed.push({ lot: i, quantity: take, meta: use.meta });
    }
    if (need > 0) skipped.push({ ...use, quantity: need });
  }
  return { placed, skipped };
}

export function planIngest(all: SourceRow[]): IngestPlan {
  const isJunk = (r: SourceRow) => r.quantity <= 0 || r.unitCost <= 1 || /^\s*test\b/i.test(r.itemName);
  const junk = all.filter(isJunk);
  let rest = all.filter((r) => !isJunk(r));

  // One order halved between the two apps: same item, day, qty and unit cost on each side.
  const splitPairs: Lot[] = [];
  const splitKey = (r: SourceRow) =>
    SPLIT_ORDER.test(r.description) ? [itemKey(r.itemName), r.date, r.quantity, r.unitCost].join("|") : null;
  for (const group of groupBy(rest, splitKey).values()) {
    const royal = group.filter((r) => r.company === "royal");
    const impala = group.filter((r) => r.company === "impala");
    for (let i = 0; i < Math.min(royal.length, impala.length); i++) splitPairs.push(lotOf([royal[i], impala[i]]));
  }
  const paired = new Set(splitPairs.flatMap((l) => l.rows));
  rest = rest.filter((r) => !paired.has(r));

  // Nothing else is merged automatically: identical lines can legitimately repeat on one invoice,
  // so each candidate needs a human yes before rows are collapsed.
  // Same receipt file, item, quantity and price (any day).
  const fileItem = (r: SourceRow) => (r.fileKey ? [r.fileKey, itemKey(r.itemName), r.quantity, r.unitCost].join("|") : null);
  const likelyDuplicates = [...groupBy(rest, fileItem).values()].filter((g) => g.length > 1);
  // Same day, item and quantity on different receipts.
  const lookalikes = [...groupBy(rest, (r) => [r.date, itemKey(r.itemName), r.quantity].join("|")).values()].filter(
    (g) => g.length > 1 && new Set(g.map((r) => r.fileKey)).size > 1,
  );

  const lots = [...splitPairs, ...rest.map((r) => lotOf([r]))].sort((a, b) => a.date.localeCompare(b.date));

  const catalog = [...groupBy(lots, (l) => l.itemKey).entries()]
    .map(([key, ls]) => ({
      key,
      // Most used spelling first: it becomes the part's display name.
      names: byFrequency(ls.flatMap((l) => l.rows.map((r) => r.itemName.trim()))),
      rows: ls.length,
      quantity: ls.reduce((n, l) => n + l.quantity, 0),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  return { lots, splitPairs, likelyDuplicates, lookalikes, junk, catalog };
}
