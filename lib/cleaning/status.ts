/**
 * Cleaning log rules. Dependency-free so `node --test` can run it.
 */

export type CleaningType = 'deep_clean' | 'insecticide';

export const CLEANING_TYPES: CleaningType[] = ['deep_clean', 'insecticide'];

/** Days a vehicle may go between treatments before it shows as overdue. */
export const CLEANING_INTERVAL_DAYS: Record<CleaningType, number> = {
  deep_clean: 30,
  insecticide: 30,
};

export interface CleaningLogLike {
  vehicle_id: string;
  type: CleaningType;
  cleaning_date: string; // YYYY-MM-DD
}

export type CleaningStatus = 'ok' | 'overdue' | 'never';

/** Whole days from `date` (YYYY-MM-DD) to `today` (YYYY-MM-DD). */
export function daysSince(date: string, today: string): number {
  return Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
}

/** Most recent cleaning_date per vehicle for one type. */
export function lastDateByVehicle(logs: CleaningLogLike[], type: CleaningType): Map<string, string> {
  const last = new Map<string, string>();
  for (const log of logs) {
    if (log.type !== type) continue;
    const prev = last.get(log.vehicle_id);
    if (!prev || log.cleaning_date > prev) last.set(log.vehicle_id, log.cleaning_date);
  }
  return last;
}

export function cleaningStatus(lastDate: string | undefined, type: CleaningType, today: string): CleaningStatus {
  if (!lastDate) return 'never';
  return daysSince(lastDate, today) > CLEANING_INTERVAL_DAYS[type] ? 'overdue' : 'ok';
}
