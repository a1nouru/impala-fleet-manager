// Nilo stock and billing, computed from the append-only movement log (nilo_movements).
// There is one pool: Royal Express and Impala read the same balances, so a part either
// company consumes is gone for both. Nothing is stored per company except who consumed.

export type Company = "royal" | "impala";

export type Unit = {
  id: string;
  code: string;
  itemName: string;
  // Invoice line price for one unit, or for one whole container when bulk.
  unitCost: number;
  // Bulk only: container size in its measure unit (e.g. 20 for a 20 L drum).
  containerSize: number | null;
};

export type Movement = {
  unitId: string;
  type: "receive" | "consume" | "adjust" | "void";
  quantity: number;
  company: Company | null;
  vehiclePlate: string | null;
  at: string;
  // The maintenance job a consume or return belongs to.
  recordId?: string | null;
};

// receive adds stock; everything else takes it away (adjust = stock-take shortfall).
const SIGN: Record<Movement["type"], 1 | -1> = { receive: 1, consume: -1, adjust: -1, void: -1 };

export function balances(movements: Movement[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of movements) out.set(m.unitId, (out.get(m.unitId) ?? 0) + SIGN[m.type] * m.quantity);
  return out;
}

export function availableByItem(units: Unit[], movements: Movement[]): Map<string, number> {
  const bal = balances(movements);
  const out = new Map<string, number>();
  for (const u of units) {
    const b = bal.get(u.id) ?? 0;
    if (b > 0) out.set(u.itemName, (out.get(u.itemName) ?? 0) + b);
  }
  return out;
}

// Validates a scan-to-consume before it is written. Returns the problem, or null when allowed.
export function consumeError(unit: Unit, movements: Movement[], quantity: number): string | null {
  const left = balances(movements.filter((m) => m.unitId === unit.id)).get(unit.id) ?? 0;
  if (quantity <= 0) return "quantity must be positive";
  if (unit.containerSize === null && quantity !== 1) return `${unit.code} is a single unit; consume exactly 1`;
  if (left <= 0) return `${unit.code} is not in stock`;
  if (quantity > left) return `${unit.code} has only ${left} left`;
  return null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export type StatementLine = {
  at: string;
  code: string;
  itemName: string;
  vehiclePlate: string;
  recordId: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type Statement = {
  company: Company;
  period: string;
  lines: StatementLine[];
  byVehicle: { vehiclePlate: string; parts: number; amount: number }[];
  total: number;
};

// period = "YYYY-MM". Bulk is billed per measure: container price / container size.
// Movements with a company are that company's consumption or returns; plain receives have none.
export function buildStatement(company: Company, period: string, units: Unit[], movements: Movement[]): Statement {
  const unitById = new Map(units.map((u) => [u.id, u]));
  // A company's receive is a part returned from one of its edited or deleted jobs: a credit.
  const lines = movements
    .filter((m) => (m.type === "consume" || m.type === "receive") && m.company === company && m.at.startsWith(period))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m): StatementLine => {
      const u = unitById.get(m.unitId);
      if (!u) throw new Error(`movement references unknown unit ${m.unitId}`);
      const unitPrice = u.containerSize === null ? u.unitCost : u.unitCost / u.containerSize;
      const quantity = m.type === "consume" ? m.quantity : -m.quantity;
      return {
        at: m.at,
        code: u.code,
        itemName: u.itemName,
        vehiclePlate: m.vehiclePlate ?? "",
        recordId: m.recordId ?? null,
        quantity,
        unitPrice: cents(unitPrice),
        amount: cents(unitPrice * quantity),
      };
    });

  const vehicles = new Map<string, { parts: number; amount: number }>();
  for (const l of lines) {
    const v = vehicles.get(l.vehiclePlate) ?? { parts: 0, amount: 0 };
    vehicles.set(l.vehiclePlate, { parts: v.parts + 1, amount: cents(v.amount + l.amount) });
  }

  return {
    company,
    period,
    lines,
    byVehicle: [...vehicles].map(([vehiclePlate, v]) => ({ vehiclePlate, ...v })).sort((a, b) => b.amount - a.amount),
    total: cents(lines.reduce((n, l) => n + l.amount, 0)),
  };
}
