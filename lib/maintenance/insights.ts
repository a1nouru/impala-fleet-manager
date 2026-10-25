// Maintenance parts insights for the Reports page "Detailed Analysis" tab.
//
// maintenance_records.parts holds strings like "PNEU GORDEN CROWN (Qty: 2)" (or
// "Category: free text" for custom parts). Inventory rows carry the unit price
// (amount_unit); the two are joined by normalized item name, same as stock math.

// Same as normalizeItemName in lib/inventory/usage.ts (kept import-free so
// node --test can load this file directly).
function normalizeItemName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const PART_QTY_RE = /^(.+?)\s*\(Qty:\s*(\d+)\)$/;

// ponytail: name-based tire detection ("PNEU …", "Tire - 315/80R22.5"); fitting/repair
// services are excluded. Swap for an inventory category column if one is added.
const TIRE_RE = /pneu|tire|tyre/i;
const TIRE_SERVICE_RE = /montag|repar|remend|vulcan|calibr/i;

export function isTire(name: string): boolean {
  return TIRE_RE.test(name) && !TIRE_SERVICE_RE.test(name);
}

// Fluids are logged in litres ("ÓLEO SINOPEC 15W40 (Qty: 23)"), so one oil change
// would outrank a set of tires. They count as one replacement per line (cost still
// uses the real quantity). Anchored at the start so "FILTRO DE ÓLEO" stays a part.
const FLUID_RE = /^\s*(óleo|oleo|oil|valvu|água|agua|l[ií]quido|massa|grease|coolant|anticongelante)/i;

export function isFluid(name: string): boolean {
  return FLUID_RE.test(name);
}

export type ParsedPart = { name: string; qty: number };

export function parsePart(part: string): ParsedPart | null {
  if (typeof part !== "string" || !part.trim()) return null;
  const match = part.match(PART_QTY_RE);
  if (match) return { name: match[1].trim(), qty: parseInt(match[2], 10) || 0 };
  return { name: part.trim(), qty: 1 }; // custom / legacy part: one unit
}

type Inventory = { item_name?: string | null; amount_unit?: number | string | null };

// Average unit price per normalized item name (Kz). Unpriced names are absent.
export function unitPriceByName(items: Inventory[]): Record<string, number> {
  const sum: Record<string, { total: number; n: number }> = {};
  for (const item of items ?? []) {
    const price = Number(item?.amount_unit);
    const key = normalizeItemName(item?.item_name);
    if (!key || !(price > 0)) continue;
    sum[key] ??= { total: 0, n: 0 };
    sum[key].total += price;
    sum[key].n += 1;
  }
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v.total / v.n]));
}

export type InsightRecord = {
  id: string;
  date: string;
  plate: string;
  kilometers?: number | string | null;
  parts?: string[] | null;
};

// Readings of 0 (the historical default) are treated as "no reading".
// Deltas above this are typos, not real driving between two services.
const MAX_KM_BETWEEN_SERVICES = 30000;

// km driven since the vehicle's previous recorded odometer reading, per record id.
// `all` must be every record (not just the filtered range) so the first record in
// the range still finds its predecessor.
export function kmSincePrevious(all: InsightRecord[]): Record<string, number> {
  const byPlate: Record<string, InsightRecord[]> = {};
  for (const r of all) {
    if (Number(r.kilometers) > 0) (byPlate[r.plate] ??= []).push(r);
  }
  const out: Record<string, number> = {};
  for (const list of Object.values(byPlate)) {
    list.sort((a, b) => a.date.localeCompare(b.date) || Number(a.kilometers) - Number(b.kilometers));
    for (let i = 1; i < list.length; i++) {
      const delta = Number(list[i].kilometers) - Number(list[i - 1].kilometers);
      if (delta > 0 && delta <= MAX_KM_BETWEEN_SERVICES) out[list[i].id] = delta;
    }
  }
  return out;
}

export type VehicleInsight = {
  plate: string;
  records: number;
  partUnits: number; // replacements; a fluid line counts once
  tireUnits: number;
  tireCost: number;
  partsCost: number;
  km: number; // km covered by records that have a valid odometer delta
  kmPartUnits: number; // part units on those same records
  partsPer1000Km: number | null;
};

export type PartInsight = {
  name: string;
  units: number;
  unitPrice: number | null;
  totalCost: number;
  vehicles: number;
  isTire: boolean;
};

export function buildInsights(
  inRange: InsightRecord[],
  kmById: Record<string, number>,
  prices: Record<string, number>
) {
  const vehicles: Record<string, VehicleInsight> = {};
  const parts: Record<string, PartInsight & { plates: Set<string> }> = {};

  for (const r of inRange) {
    const v = (vehicles[r.plate] ??= {
      plate: r.plate, records: 0, partUnits: 0, tireUnits: 0, tireCost: 0,
      partsCost: 0, km: 0, kmPartUnits: 0, partsPer1000Km: null,
    });
    v.records += 1;
    let recordUnits = 0;

    for (const raw of r.parts ?? []) {
      const p = parsePart(raw);
      if (!p || p.qty <= 0) continue;
      const key = normalizeItemName(p.name);
      const price = prices[key];
      const cost = price ? price * p.qty : 0;
      const tire = isTire(p.name);
      const units = isFluid(p.name) ? 1 : p.qty;

      recordUnits += units;
      v.partUnits += units;
      v.partsCost += cost;
      if (tire) {
        v.tireUnits += p.qty;
        v.tireCost += cost;
      }

      const part = (parts[key] ??= {
        name: p.name, units: 0, unitPrice: price ?? null, totalCost: 0,
        vehicles: 0, isTire: tire, plates: new Set(),
      });
      part.units += p.qty;
      part.totalCost += cost;
      part.plates.add(r.plate);
    }

    const km = kmById[r.id];
    if (km) {
      v.km += km;
      v.kmPartUnits += recordUnits;
    }
  }

  const vehicleList = Object.values(vehicles).map((v) => ({
    ...v,
    partsPer1000Km: v.km > 0 ? (v.kmPartUnits / v.km) * 1000 : null,
  }));
  const partList = Object.values(parts).map(({ plates, ...p }) => ({ ...p, vehicles: plates.size }));

  const n = vehicleList.length || 1;
  const fleetAvg = {
    partUnits: vehicleList.reduce((s, v) => s + v.partUnits, 0) / n,
    tireUnits: vehicleList.reduce((s, v) => s + v.tireUnits, 0) / n,
    partsCost: vehicleList.reduce((s, v) => s + v.partsCost, 0) / n,
  };

  return { vehicles: vehicleList, parts: partList, fleetAvg };
}

// The Sunday-to-Sunday week before `today`'s week: if today is Sunday, that is
// last Sunday → today; otherwise the two most recent past Sundays.
export function lastSundayToSunday(today: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 7);
  return { from, to };
}
