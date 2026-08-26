/**
 * Bus station passenger fare. Station clerks record a passenger COUNT; the
 * revenue is derived (20 passengers -> 20,000 Kz). Entries persist the computed
 * amount, so changing this never rewrites past records.
 *
 * This module is deliberately dependency-free so it runs under `node --test`
 * without a bundler, matching lib/inventory/usage.ts.
 */
export const PASSENGER_FARE_AOA = 1000;

export interface RevenueRowLike {
  passenger_count?: number | null;
  cargo_amount?: number | null;
}

export interface SlipLike {
  amount?: number | null;
}

export interface EntryTotals {
  passengerCount: number;
  passengerRevenue: number;
  cargoRevenue: number;
  total: number;
}

export interface VehicleLike {
  id: string;
  plate: string;
  /** Absent on older rows/queries; treated as active when undefined. */
  is_active?: boolean | null;
}

/** Coerce anything the form or the DB hands us into a safe non-negative number. */
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Passenger money is derived from a head count, never typed in Kwanza. */
export function passengerRevenue(count: number | null | undefined): number {
  return Math.floor(num(count)) * PASSENGER_FARE_AOA;
}

export function rowTotal(row: RevenueRowLike): number {
  return passengerRevenue(row.passenger_count) + num(row.cargo_amount);
}

export function entryTotals(rows: RevenueRowLike[]): EntryTotals {
  return (rows || []).reduce<EntryTotals>(
    (acc, row) => {
      const count = Math.floor(num(row.passenger_count));
      acc.passengerCount += count;
      acc.passengerRevenue += passengerRevenue(count);
      acc.cargoRevenue += num(row.cargo_amount);
      acc.total = acc.passengerRevenue + acc.cargoRevenue;
      return acc;
    },
    { passengerCount: 0, passengerRevenue: 0, cargoRevenue: 0, total: 0 }
  );
}

export function slipsTotal(slips: SlipLike[]): number {
  return (slips || []).reduce((sum, slip) => sum + num(slip.amount), 0);
}

export interface ExpenseLike {
  amount?: number | null;
}

/** Park-side spend (subsidies, casual labour) recorded alongside the takings. */
export function expensesTotal(expenses: ExpenseLike[]): number {
  return (expenses || []).reduce((sum, expense) => sum + num(expense.amount), 0);
}

/** What the station actually hands over: revenue minus park expenses. */
export function netRevenue(rows: RevenueRowLike[], expenses: ExpenseLike[]): number {
  return entryTotals(rows).total - expensesTotal(expenses);
}

/** Deposited minus earned. Negative means the station banked less than it took. */
export function depositVariance(rows: RevenueRowLike[], slips: SlipLike[]): number {
  return slipsTotal(slips) - entryTotals(rows).total;
}

/**
 * Operators worked around a unique constraint by re-registering buses under
 * near-identical plates ("LDA-29-14-AE.."). Those ghosts are quarantined with
 * `is_active = false` and must never reach a selection dropdown.
 */
export function selectableVehicles<T extends VehicleLike>(vehicles: T[]): T[] {
  return (vehicles || []).filter((v) => v?.is_active !== false);
}
