// Fuel consumption per route corridor. Vehicles are only ever compared with
// vehicles on the same corridor (both directions pooled), normalised by road
// distance so Mbanza Kongo and Luvu trips can share one comparison.

// Fixed pump price; fuel expenses are entered in liters and stored as amounts.
export const FUEL_PRICE_PER_LITER = 425; // Kz per liter

// Vehicles with fewer trips than this are shown but never flagged as worst.
export const MIN_TRIPS_TO_FLAG = 3;

// One-way road distances from Luanda (km), rounded from Google Maps / rome2rio.
const TOWNS: Record<string, { corridor: string; km: number }> = {
  HUAMBO: { corridor: "Luanda ⇄ Huambo", km: 600 },
  SOYO: { corridor: "Luanda ⇄ Soyo", km: 440 },
  MBANZA: { corridor: "Luanda ⇄ Mbanza Kongo / Luvu", km: 490 },
  LUVU: { corridor: "Luanda ⇄ Mbanza Kongo / Luvu", km: 530 },
  UIGE: { corridor: "Luanda ⇄ Uíge", km: 345 },
  "WAKU KUNGO": { corridor: "Luanda ⇄ Waku Kungo", km: 390 },
  BENGUELA: { corridor: "Luanda ⇄ Benguela", km: 550 },
};

export const isFuelCategory = (category: string | null | undefined) =>
  /^\s*(fuel|gas[oó]leo)/i.test(category ?? "");

/** Corridor + one-way km for a route like "HUAMBO - LUANDA". km is null for unknown routes. */
export function corridorOf(route: string): { corridor: string; km: number | null } {
  const towns = route.toUpperCase().split("-").map((s) => s.trim()).filter(Boolean);
  const town = towns.find((t) => t !== "LUANDA") ?? towns[0] ?? route;
  return TOWNS[town] ?? { corridor: route.trim().toUpperCase(), km: null };
}

export interface Trip { vehicleId: string; plate: string; date: string; route: string | null }
export interface FuelEntry {
  vehicleId: string;
  plate: string;
  date: string;
  route: string | null;
  liters: number;
  driver: string | null;
}

export interface Row {
  name: string;
  liters: number;
  trips: number;
  km: number;
  rate: number | null; // L/100km, or L/trip when the corridor distance is unknown
  driver?: string; // latest recorded driver (vehicle rows only)
}

export interface CorridorStats {
  corridor: string;
  unit: "L/100km" | "L/trip";
  total: Row;
  daily: Row[];
  weekly: Row[];
  vehicles: Row[];
  drivers: Row[];
  worst: Row | null;
}

const emptyRow = (name: string): Row => ({ name, liters: 0, trips: 0, km: 0, rate: null });

/** Monday of the ISO week containing `date` (yyyy-MM-dd). */
export function weekStart(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Latest value on or before `date` from a date-sorted list.
function latestOnOrBefore<T>(list: { date: string; value: T }[] | undefined, date: string): T | null {
  let found: T | null = null;
  for (const item of list ?? []) {
    if (item.date > date) break;
    found = item.value;
  }
  return found;
}

function timeline<T>(items: { vehicleId: string; date: string; value: T | null }[]) {
  const byVehicle = new Map<string, { date: string; value: T }[]>();
  for (const i of items) {
    if (i.value == null) continue;
    if (!byVehicle.has(i.vehicleId)) byVehicle.set(i.vehicleId, []);
    byVehicle.get(i.vehicleId)!.push({ date: i.date, value: i.value });
  }
  byVehicle.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
  return byVehicle;
}

/**
 * Trips are daily reports with a route. A fuel entry belongs to its report's
 * route, or (standalone fill-ups) the vehicle's latest route on/before that day.
 * A trip's driver is the latest driver recorded on that vehicle's fuel entries.
 */
export function analyzeFuel(trips: Trip[], fuel: FuelEntry[], from: string, to: string): CorridorStats[] {
  const routes = timeline(trips.map((t) => ({ vehicleId: t.vehicleId, date: t.date, value: t.route })));
  const drivers = timeline(fuel.map((f) => ({ vehicleId: f.vehicleId, date: f.date, value: f.driver?.trim() || null })));

  const stats = new Map<string, { s: CorridorStats; known: boolean; maps: Map<string, Row>[] }>();
  const bucket = (corridor: string, km: number | null) => {
    if (!stats.has(corridor)) {
      stats.set(corridor, {
        s: { corridor, unit: "L/100km", total: emptyRow(corridor), daily: [], weekly: [], vehicles: [], drivers: [], worst: null },
        known: true,
        maps: [new Map(), new Map(), new Map(), new Map()], // daily, weekly, vehicles, drivers
      });
    }
    const b = stats.get(corridor)!;
    if (km == null) b.known = false;
    return b;
  };
  const rowIn = (map: Map<string, Row>, name: string) => {
    if (!map.has(name)) map.set(name, emptyRow(name));
    return map.get(name)!;
  };
  const inRange = (date: string) => date >= from && date <= to;

  for (const t of trips) {
    if (!t.route || !inRange(t.date)) continue;
    const { corridor, km } = corridorOf(t.route);
    const b = bucket(corridor, km);
    const driver = latestOnOrBefore(drivers.get(t.vehicleId), t.date);
    const [daily, weekly, vehicles, drv] = b.maps;
    const rows = [b.s.total, rowIn(daily, t.date), rowIn(weekly, weekStart(t.date)), rowIn(vehicles, t.plate)];
    if (driver) rows.push(rowIn(drv, driver));
    for (const r of rows) { r.trips += 1; r.km += km ?? 0; }
  }

  for (const f of [...fuel].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!inRange(f.date)) continue;
    const route = f.route ?? latestOnOrBefore(routes.get(f.vehicleId), f.date);
    if (!route) continue;
    const { corridor, km } = corridorOf(route);
    const b = bucket(corridor, km);
    const driver = f.driver?.trim() || latestOnOrBefore(drivers.get(f.vehicleId), f.date);
    const [daily, weekly, vehicles, drv] = b.maps;
    const vehicle = rowIn(vehicles, f.plate);
    if (f.driver?.trim()) vehicle.driver = f.driver.trim(); // latest wins: fuel is iterated by date
    const rows = [b.s.total, rowIn(daily, f.date), rowIn(weekly, weekStart(f.date)), vehicle];
    if (driver) rows.push(rowIn(drv, driver));
    for (const r of rows) r.liters += f.liters;
  }

  return [...stats.values()]
    .map(({ s, known, maps }) => {
      s.unit = known ? "L/100km" : "L/trip";
      const rate = (r: Row) => {
        r.rate = known ? (r.km > 0 ? (r.liters / r.km) * 100 : null) : r.trips > 0 ? r.liters / r.trips : null;
        return r;
      };
      rate(s.total);
      const byName = (m: Map<string, Row>) => [...m.values()].map(rate).sort((a, b) => a.name.localeCompare(b.name));
      const byRate = (m: Map<string, Row>) => [...m.values()].map(rate).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
      s.daily = byName(maps[0]);
      s.weekly = byName(maps[1]);
      s.vehicles = byRate(maps[2]);
      s.drivers = byRate(maps[3]);
      s.worst = s.vehicles.find((v) => v.rate != null && v.trips >= MIN_TRIPS_TO_FLAG) ?? null;
      return s;
    })
    .sort((a, b) => b.total.trips - a.total.trips);
}
