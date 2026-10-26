// Revenue / expense comparison per route corridor for the Financial Overview
// "Routes" tab. Callers group with the fuel card's corridorOf (both directions
// pooled, Mbanza Kongo + Luvu together). Revenue and expenses match the
// Vehicles tab (get_vehicle_performance): ticket + baggage + cargo, minus
// expenses logged on the daily report.

export interface RouteReport {
  plate: string;
  corridor: string | null; // corridorOf(route).corridor, null when no route
  ticket: number;
  baggage: number;
  cargo: number;
  expenses: number;
}

export interface RouteRow {
  name: string;
  trips: number;
  ticket: number;
  baggage: number;
  cargo: number;
  revenue: number;
  expenses: number;
  net: number;
  revenuePerTrip: number;
}

export interface RouteStats {
  corridor: string;
  total: RouteRow;
  vehicles: RouteRow[]; // sorted by revenue, highest first
}

const emptyRow = (name: string): RouteRow => ({
  name, trips: 0, ticket: 0, baggage: 0, cargo: 0, revenue: 0, expenses: 0, net: 0, revenuePerTrip: 0,
});

function add(row: RouteRow, r: RouteReport) {
  row.trips += 1;
  row.ticket += r.ticket;
  row.baggage += r.baggage;
  row.cargo += r.cargo;
  row.revenue += r.ticket + r.baggage + r.cargo;
  row.expenses += r.expenses;
  row.net = row.revenue - row.expenses;
  row.revenuePerTrip = row.revenue / row.trips;
}

/** Reports without a route are skipped. Corridors sorted by trips, busiest first. */
export function routePerformance(reports: RouteReport[]): RouteStats[] {
  const byCorridor = new Map<string, { total: RouteRow; vehicles: Map<string, RouteRow> }>();
  for (const r of reports) {
    const corridor = r.corridor;
    if (!corridor) continue;
    if (!byCorridor.has(corridor)) byCorridor.set(corridor, { total: emptyRow(corridor), vehicles: new Map() });
    const c = byCorridor.get(corridor)!;
    if (!c.vehicles.has(r.plate)) c.vehicles.set(r.plate, emptyRow(r.plate));
    add(c.total, r);
    add(c.vehicles.get(r.plate)!, r);
  }
  return [...byCorridor.entries()]
    .map(([corridor, c]) => ({
      corridor,
      total: c.total,
      vehicles: [...c.vehicles.values()].sort((a, b) => b.revenue - a.revenue),
    }))
    .sort((a, b) => b.total.trips - a.total.trips);
}
