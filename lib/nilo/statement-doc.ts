// The statement Nilo sends each company: account summary, then every vehicle, every job on it
// and every part on each job. It runs continuously: each statement covers everything since the
// previous one up to the moment it is produced. Pure: the API gathers inputs, the UI renders it.
import type { Company, Range, Statement, StatementLine } from "./ledger";

// Same rule as the ledger uses for lines; kept local so this module stays type-only on ledger.
const inRange = (range: Range, at: string) => (range.from === null || at >= range.from) && at < range.to;

export type Job = { date: string; description: string };

// An earlier issued statement of the same company.
export type PriorStatement = {
  statementNo: string;
  to: string;
  total: number;
  status: "issued" | "paid";
  paidAt: string | null;
};

// One part on one job: every unit of the same item at the same price, with their label codes.
export type DocLine = { itemName: string; codes: string[]; quantity: number; unitPrice: number; amount: number };

export type JobSection = { recordId: string | null; date: string; description: string; lines: DocLine[]; subtotal: number };

function groupLines(lines: StatementLine[]): DocLine[] {
  const out = new Map<string, DocLine>();
  for (const l of lines) {
    const key = [l.itemName, l.unitPrice, Math.sign(l.quantity)].join("|");
    const g = out.get(key) ?? { itemName: l.itemName, codes: [], quantity: 0, unitPrice: l.unitPrice, amount: 0 };
    if (!g.codes.includes(l.code)) g.codes.push(l.code);
    g.quantity += l.quantity;
    g.amount = cents(g.amount + l.amount);
    out.set(key, g);
  }
  return [...out.values()].map((g) => ({ ...g, codes: g.codes.sort() }));
}

export type VehicleSection = {
  plate: string;
  jobs: JobSection[];
  units: number;
  charges: number;
  credits: number;
  subtotal: number;
};

export type StatementDoc = {
  company: Company;
  // Covered range [from, to). from = null on a company's first statement: everything before.
  from: string | null;
  to: string;
  // null while provisional (the running statement, not yet issued).
  statementNo: string | null;
  provisional: boolean;
  issuedAt: string | null;
  dueDate: string;
  account: {
    previousBalance: number;
    unpaid: { statementNo: string; to: string; total: number }[];
    paymentsReceived: { statementNo: string; paidAt: string; total: number }[];
    charges: number;
    credits: number;
    amountDue: number;
  };
  vehicles: VehicleSection[];
  parts: { itemName: string; quantity: number; amount: number }[];
  counts: { vehicles: number; jobs: number; units: number };
};

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));

// NILO-RE-20261110-1: company, statement date, and the how-many-th statement of that day.
export const statementNo = (company: Company, at: string, nthThatDay: number) =>
  `NILO-${company === "royal" ? "RE" : "IM"}-${at.slice(0, 10).replaceAll("-", "")}-${nthThatDay}`;

// Payment is due 15 days after the statement date.
export const PAYMENT_DAYS = 15;
export const dueDate = (at: string) =>
  new Date(Date.parse(at.slice(0, 10)) + PAYMENT_DAYS * 86_400_000).toISOString().slice(0, 10);

export function buildStatementDoc(
  st: Statement,
  jobs: Map<string, Job>,
  prior: PriorStatement[],
  issue: { issuedAt: string; statementNo: string } | null,
): StatementDoc {
  const byVehicle = new Map<string, Map<string, StatementLine[]>>();
  for (const l of st.lines) {
    const v = byVehicle.get(l.vehiclePlate) ?? new Map<string, StatementLine[]>();
    const key = l.recordId ?? "";
    v.set(key, [...(v.get(key) ?? []), l]);
    byVehicle.set(l.vehiclePlate, v);
  }

  const vehicles: VehicleSection[] = [...byVehicle].map(([plate, byJob]) => {
    const sections = [...byJob]
      .map(([recordId, lines]): JobSection => {
        const job = recordId ? jobs.get(recordId) : undefined;
        return {
          recordId: recordId || null,
          date: job?.date ?? lines[0].at.slice(0, 10),
          description: job?.description ?? "",
          lines: groupLines(lines),
          subtotal: sum(lines.map((l) => l.amount)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const lines = sections.flatMap((j) => j.lines);
    return {
      plate,
      jobs: sections,
      units: lines.reduce((n, l) => n + l.quantity, 0),
      charges: sum(lines.filter((l) => l.amount > 0).map((l) => l.amount)),
      credits: sum(lines.filter((l) => l.amount < 0).map((l) => -l.amount)),
      subtotal: sum(lines.map((l) => l.amount)),
    };
  });
  vehicles.sort((a, b) => b.subtotal - a.subtotal);

  const parts = new Map<string, { quantity: number; amount: number }>();
  for (const l of st.lines) {
    const p = parts.get(l.itemName) ?? { quantity: 0, amount: 0 };
    parts.set(l.itemName, { quantity: p.quantity + l.quantity, amount: cents(p.amount + l.amount) });
  }

  const unpaid = prior.filter((p) => p.status === "issued");
  const charges = sum(st.lines.filter((l) => l.amount > 0).map((l) => l.amount));
  const credits = sum(st.lines.filter((l) => l.amount < 0).map((l) => -l.amount));
  const previousBalance = sum(unpaid.map((p) => p.total));

  return {
    company: st.company,
    from: st.from,
    to: st.to,
    statementNo: issue?.statementNo ?? null,
    provisional: issue === null,
    issuedAt: issue?.issuedAt ?? null,
    dueDate: dueDate(issue?.issuedAt ?? st.to),
    account: {
      previousBalance,
      unpaid: unpaid.map(({ statementNo, to, total }) => ({ statementNo, to, total })),
      paymentsReceived: prior
        .filter((p) => p.status === "paid" && p.paidAt !== null && inRange(st, p.paidAt))
        .map((p) => ({ statementNo: p.statementNo, paidAt: p.paidAt as string, total: p.total })),
      charges,
      credits,
      amountDue: cents(previousBalance + charges - credits),
    },
    vehicles,
    parts: [...parts].map(([itemName, p]) => ({ itemName, ...p })).sort((a, b) => b.amount - a.amount),
    counts: {
      vehicles: vehicles.length,
      jobs: vehicles.reduce((n, v) => n + v.jobs.length, 0),
      units: st.lines.reduce((n, l) => n + l.quantity, 0),
    },
  };
}
