// Driver scorecard: attributes revenue, tire/clutch-disc/spare-part use, maintenance cost and
// damages to drivers, then ranks them against each other for the same period.

export const MIN_DAYS_DRIVEN = 20;
export const ESTIMATE_WINDOW_DAYS = 7;
export const TIERS = { raise: 80, good: 60 } as const;

export type PartKind = "tire" | "clutch" | "routine" | "wear";
export type Tier = "raise" | "good" | "watch" | "insufficient";

export interface MaintenanceInput {
  vehicle_id: string;
  date: string;
  driver_id: string | null;
  cost: number | null;
  parts: string[] | null;
}

export interface ReportInput {
  vehicle_id: string;
  report_date: string;
  status: string;
  driver_id: string | null;
  ticket_revenue: number | null;
  baggage_revenue: number | null;
  cargo_revenue: number | null;
}

export interface DamageInput {
  employee_id: string;
  damage_date: string;
  total_damage_cost: number | null;
}

export interface DriverInput {
  id: string;
  nome: string;
}

export interface MonthStats {
  month: string;
  days: number;
  revenue: number;
  tires: number;
  clutches: number;
  wearParts: number;
}

export interface DriverScore {
  driverId: string;
  name: string;
  daysDriven: number;
  estimatedDays: number;
  revenue: number;
  revenuePerDay: number;
  tires: number;
  clutches: number;
  wearParts: number;
  maintenanceCost: number;
  maintenanceEvents: number;
  damageCount: number;
  damageCost: number;
  per30: { tires: number; clutches: number; wearParts: number; cost: number };
  points: Record<ComponentKey, number> | null;
  score: number | null;
  tier: Tier;
  months: MonthStats[];
}

type Stats = Omit<DriverScore, "points" | "score" | "tier">;

export const COMPONENTS = [
  { key: "revenue", label: "Revenue / day", weight: 40, higherIsBetter: true, value: (d: Stats) => d.revenuePerDay },
  { key: "tires", label: "Tires", weight: 15, higherIsBetter: false, value: (d: Stats) => d.per30.tires },
  { key: "clutch", label: "Clutch discs", weight: 15, higherIsBetter: false, value: (d: Stats) => d.per30.clutches },
  { key: "parts", label: "Spare parts", weight: 10, higherIsBetter: false, value: (d: Stats) => d.per30.wearParts },
  { key: "cost", label: "Maintenance cost", weight: 10, higherIsBetter: false, value: (d: Stats) => d.per30.cost },
  { key: "damages", label: "Damages", weight: 10, higherIsBetter: false, value: (d: Stats) => d.damageCost },
] as const;

export type ComponentKey = (typeof COMPONENTS)[number]["key"];

const TIRE = /(pneu|tire|tyre|\d{2}r\s?22)/;
// "disco de embreagem/embraiagem/embreiagem" — clutch wear is the clearest sign of rough driving.
// Pumps ("bomba … de embraiagem") are hydraulics, not wear, so they stay spare parts.
const CLUTCH = /^(?!.*bomba).*(embr[ae]i?agem|clutch)/;
const ROUTINE = /(oleo|oil|filtro|filro|filter|sinopec|valvo|valvu|vavol|lubrif|massa|\d{2}w\d{2,3}|\blf\s?\d|^9009$|silicone|silcone|cilcone)/;

export function parsePart(raw: string): { name: string; qty: number; kind: PartKind } | null {
  const m = raw.match(/^(.*?)\s*\(qty:\s*([\d.]+)\)\s*$/i);
  const name = (m ? m[1] : raw).trim();
  if (!name) return null;
  const qty = m ? Number(m[2]) || 1 : 1;
  const key = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const kind: PartKind = TIRE.test(key) ? "tire" : CLUTCH.test(key) ? "clutch" : ROUTINE.test(key) ? "routine" : "wear";
  return { name, qty, kind };
}

const dayNumber = (iso: string) => Math.round(Date.parse(iso.slice(0, 10)) / 86_400_000);

/** Driver of the closest maintenance record on the same vehicle within the window, if any. */
export function makeDriverEstimator(maintenance: MaintenanceInput[]) {
  const byVehicle = new Map<string, { day: number; driver: string }[]>();
  for (const m of maintenance) {
    if (!m.driver_id) continue;
    const list = byVehicle.get(m.vehicle_id) ?? [];
    list.push({ day: dayNumber(m.date), driver: m.driver_id });
    byVehicle.set(m.vehicle_id, list);
  }
  return (vehicleId: string, date: string): string | null => {
    const day = dayNumber(date);
    let best: { gap: number; driver: string } | null = null;
    for (const e of byVehicle.get(vehicleId) ?? []) {
      const gap = Math.abs(e.day - day);
      if (gap <= ESTIMATE_WINDOW_DAYS && (!best || gap < best.gap)) best = { gap, driver: e.driver };
    }
    return best?.driver ?? null;
  };
}

/**
 * Share of the other drivers this one beats, 0..1. Ties count in the driver's
 * favour, so a fleet where nobody had a damage gives everyone full points.
 */
function rankFraction(value: number, all: number[], higherIsBetter: boolean): number {
  if (all.length < 2) return 1;
  const notBetter = all.filter((v) => (higherIsBetter ? v <= value : v >= value)).length - 1;
  return notBetter / (all.length - 1);
}

export function scoreDrivers(input: {
  from: string;
  to: string;
  drivers: DriverInput[];
  reports: ReportInput[];
  maintenance: MaintenanceInput[];
  damages: DamageInput[];
}): DriverScore[] {
  const { from, to } = input;
  const inRange = (d: string) => d >= from && d <= to;
  const estimate = makeDriverEstimator(input.maintenance);
  const names = new Map(input.drivers.map((d) => [d.id, d.nome]));
  const stats = new Map<string, Stats>();
  const months = new Map<string, Map<string, MonthStats>>();

  const statsFor = (id: string): Stats | null => {
    const existing = stats.get(id);
    if (existing) return existing;
    const name = names.get(id);
    if (name === undefined) return null;
    const fresh: Stats = {
      driverId: id, name, daysDriven: 0, estimatedDays: 0, revenue: 0, revenuePerDay: 0,
      tires: 0, clutches: 0, wearParts: 0, maintenanceCost: 0, maintenanceEvents: 0, damageCount: 0, damageCost: 0,
      per30: { tires: 0, clutches: 0, wearParts: 0, cost: 0 }, months: [],
    };
    stats.set(id, fresh);
    months.set(id, new Map());
    return fresh;
  };
  const monthFor = (id: string, date: string): MonthStats => {
    const byMonth = months.get(id)!;
    const month = date.slice(0, 7);
    const existing = byMonth.get(month);
    if (existing) return existing;
    const fresh = { month, days: 0, revenue: 0, tires: 0, clutches: 0, wearParts: 0 };
    byMonth.set(month, fresh);
    return fresh;
  };

  for (const r of input.reports) {
    if (r.status !== "Operational" || !inRange(r.report_date)) continue;
    const driverId = r.driver_id ?? estimate(r.vehicle_id, r.report_date);
    const s = driverId ? statsFor(driverId) : null;
    if (!s) continue;
    const revenue = Number(r.ticket_revenue ?? 0) + Number(r.baggage_revenue ?? 0) + Number(r.cargo_revenue ?? 0);
    s.daysDriven += 1;
    if (!r.driver_id) s.estimatedDays += 1;
    s.revenue += revenue;
    const m = monthFor(s.driverId, r.report_date);
    m.days += 1;
    m.revenue += revenue;
  }

  for (const rec of input.maintenance) {
    if (!rec.driver_id || !inRange(rec.date)) continue;
    const s = statsFor(rec.driver_id);
    if (!s) continue;
    s.maintenanceEvents += 1;
    s.maintenanceCost += Number(rec.cost ?? 0);
    const m = monthFor(s.driverId, rec.date);
    for (const raw of rec.parts ?? []) {
      const part = parsePart(raw);
      if (part?.kind === "tire") { s.tires += part.qty; m.tires += part.qty; }
      if (part?.kind === "clutch") { s.clutches += part.qty; m.clutches += part.qty; }
      if (part?.kind === "wear") { s.wearParts += part.qty; m.wearParts += part.qty; }
    }
  }

  for (const d of input.damages) {
    if (!inRange(d.damage_date)) continue;
    const s = statsFor(d.employee_id);
    if (!s) continue;
    s.damageCount += 1;
    s.damageCost += Number(d.total_damage_cost ?? 0);
  }

  for (const s of stats.values()) {
    const per30 = (n: number) => (s.daysDriven ? (n / s.daysDriven) * 30 : 0);
    s.revenuePerDay = s.daysDriven ? s.revenue / s.daysDriven : 0;
    s.per30 = { tires: per30(s.tires), clutches: per30(s.clutches), wearParts: per30(s.wearParts), cost: per30(s.maintenanceCost) };
    s.months = [...months.get(s.driverId)!.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  const ranked = [...stats.values()].filter((s) => s.daysDriven >= MIN_DAYS_DRIVEN);
  const columns = COMPONENTS.map((c) => ranked.map(c.value));

  return [...stats.values()]
    .map((s): DriverScore => {
      if (s.daysDriven < MIN_DAYS_DRIVEN) return { ...s, points: null, score: null, tier: "insufficient" };
      const points = Object.fromEntries(
        COMPONENTS.map((c, i) => {
          let fraction = rankFraction(c.value(s), columns[i], c.higherIsBetter);
          if (c.key === "damages" && s.damageCount > 0) fraction = Math.min(fraction, 0.5);
          return [c.key, Math.round(fraction * c.weight * 10) / 10];
        }),
      ) as Record<ComponentKey, number>;
      const score = Math.round(Object.values(points).reduce((a, b) => a + b, 0));
      const tier: Tier = score >= TIERS.raise ? "raise" : score >= TIERS.good ? "good" : "watch";
      return { ...s, points, score, tier };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.daysDriven - a.daysDriven);
}
