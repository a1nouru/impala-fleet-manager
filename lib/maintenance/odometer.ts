/**
 * Odometer (kilometers) rules for maintenance records. Dependency-free so `node --test` can run it.
 */

export const MAX_ODOMETER_KM = 2_000_000;
/** Buses here do <= ~1,200 km/day; anything above this per elapsed day is a typo. */
export const MAX_KM_PER_DAY = 1_500;

export interface OdometerRecordLike {
  id: string;
  vehicle_id?: string;
  date: string; // YYYY-MM-DD (may carry a time part)
  kilometers?: number | string | null;
}

export interface OdometerReading {
  km: number;
  date: string; // YYYY-MM-DD
}

export type OdometerError = 'invalid' | 'tooHigh' | 'belowPrevious' | 'aboveNext' | 'implausibleJump';

/**
 * Closest readings of the same vehicle around `date`, ignoring km <= 0 ("no reading")
 * and the record being edited. Same-day records count as previous.
 */
export function neighbourReadings(
  records: OdometerRecordLike[],
  vehicleId: string,
  date: string,
  excludeId?: string | null
): { previous?: OdometerReading; next?: OdometerReading } {
  let previous: OdometerReading | undefined;
  let next: OdometerReading | undefined;
  for (const r of records) {
    if (r.vehicle_id !== vehicleId || r.id === excludeId) continue;
    const km = Number(r.kilometers);
    if (!(km > 0)) continue;
    const d = r.date.slice(0, 10);
    if (d <= date) {
      if (!previous || d > previous.date || (d === previous.date && km > previous.km)) previous = { km, date: d };
    } else if (!next || d < next.date || (d === next.date && km < next.km)) {
      next = { km, date: d };
    }
  }
  return { previous, next };
}

/** Error key for an odometer reading taken on `date`, or null when it is acceptable. */
export function validateOdometer(
  reading: number,
  date: string,
  previous?: OdometerReading,
  next?: OdometerReading
): OdometerError | null {
  if (!Number.isInteger(reading) || reading <= 0) return 'invalid';
  if (reading > MAX_ODOMETER_KM) return 'tooHigh';
  if (previous) {
    if (reading < previous.km) return 'belowPrevious';
    const days = Math.max(1, Math.round((Date.parse(date) - Date.parse(previous.date)) / 86_400_000));
    if (reading - previous.km > MAX_KM_PER_DAY * days) return 'implausibleJump';
  }
  if (next && reading > next.km) return 'aboveNext';
  return null;
}
