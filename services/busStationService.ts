import { createClient } from '@/lib/supabase/client';
import { expensesTotal, passengerRevenue } from '@/lib/bus-stations/revenue';
import type { BusStationId } from '@/lib/bus-stations/stations';

const supabase = createClient();

/** Slips live in the existing private bank-slips bucket, not a new one. */
const SLIP_BUCKET = 'bank-slips';

export interface BusStationRow {
  id: string;
  entry_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  passenger_count: number;
  passenger_revenue: number;
  cargo_amount: number;
  total_revenue: number;
  vehicles?: { plate: string } | null;
}

export interface BusStationSlip {
  id: string;
  entry_id: string;
  slip_url: string;
  file_name: string | null;
  file_size: number | null;
  amount: number | null;
  deposit_date: string | null;
}

export interface BusStationExpense {
  id: string;
  entry_id: string;
  name: string;
  reason: string | null;
  amount: number;
}

export interface BusStationEntry {
  id: string;
  station: BusStationId;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bus_station_revenue_rows: BusStationRow[];
  bus_station_revenue_slips: BusStationSlip[];
  bus_station_expenses: BusStationExpense[];
}

export interface BusStationOverview {
  /** Gross takings (passengers + cargo) before park expenses. */
  total: number;
  passenger: number;
  cargo: number;
  expenses: number;
  /** total − expenses: what the stations actually hand over. */
  net: number;
  /** Per-station NET revenue. */
  byStation: Record<string, number>;
}

/** One vehicle row as the form holds it, before it is persisted. */
export interface RowInput {
  vehicle_id: string;
  start_date: string;
  end_date: string;
  passenger_count: number;
  cargo_amount: number;
}

/** A slip the user attached: a new file, or an already-stored one being kept. */
export interface SlipInput {
  id?: string;
  file?: File;
  slip_url?: string;
  file_name?: string;
  file_size?: number;
  amount: number | null;
  deposit_date: string | null;
}

/** One park expense as the form holds it, before it is persisted. */
export interface ExpenseInput {
  name: string;
  reason: string | null;
  amount: number;
}

const SELECT = `
  *,
  bus_station_revenue_rows ( *, vehicles ( plate ) ),
  bus_station_revenue_slips ( * ),
  bus_station_expenses ( * )
`;

/**
 * Missing tables or missing RLS must degrade to an empty list, never a crashed
 * page — the same defensive posture as rentalService.
 */
function isRecoverable(error: any): boolean {
  const msg = error?.message || '';
  return (
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('permission denied') ||
    msg.includes('RLS') ||
    msg.includes('policy') ||
    error?.code === 'PGRST301'
  );
}

export const busStationService = {
  async getEntries(filters?: {
    from?: string;
    to?: string;
    station?: BusStationId | 'all';
  }): Promise<BusStationEntry[]> {
    try {
      let query = supabase
        .from('bus_station_revenues')
        .select(SELECT)
        .order('created_at', { ascending: false });

      if (filters?.station && filters.station !== 'all') {
        query = query.eq('station', filters.station);
      }

      const { data, error } = await query;
      if (error) throw error;

      let entries = (data || []) as unknown as BusStationEntry[];

      // Date filtering is on the ROWS (each carries its own range), so it is
      // applied here rather than in SQL: an entry is in range when any of its
      // rows starts in range.
      const { from, to } = filters || {};
      if (from || to) {
        entries = entries.filter((entry) =>
          (entry.bus_station_revenue_rows || []).some(
            (row) =>
              (!from || row.start_date >= from) && (!to || row.start_date <= to)
          )
        );
      }

      return entries;
    } catch (error: any) {
      if (isRecoverable(error)) {
        console.warn('Bus station tables unavailable, returning empty list:', error?.message);
        return [];
      }
      console.error('Error fetching bus station entries:', error);
      throw error;
    }
  },

  async uploadSlip(file: File, entryId: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `bus-station/${entryId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(SLIP_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    // Stored as the canonical public-shaped URL; lib/storage-url.ts re-signs it
    // at click time because the bucket is private.
    const { data } = supabase.storage.from(SLIP_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async removeSlipFile(slipUrl: string): Promise<void> {
    const marker = `/${SLIP_BUCKET}/`;
    const idx = slipUrl.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(slipUrl.slice(idx + marker.length).split('?')[0]);
    await supabase.storage.from(SLIP_BUCKET).remove([path]);
  },

  async replaceRows(entryId: string, rows: RowInput[]): Promise<void> {
    await supabase.from('bus_station_revenue_rows').delete().eq('entry_id', entryId);

    if (!rows.length) return;

    const payload = rows.map((row) => ({
      entry_id: entryId,
      vehicle_id: row.vehicle_id,
      start_date: row.start_date,
      end_date: row.end_date,
      passenger_count: row.passenger_count,
      passenger_revenue: passengerRevenue(row.passenger_count),
      cargo_amount: row.cargo_amount,
    }));

    const { error } = await supabase.from('bus_station_revenue_rows').insert(payload);
    if (error) throw error;
  },

  async replaceExpenses(entryId: string, expenses: ExpenseInput[]): Promise<void> {
    await supabase.from('bus_station_expenses').delete().eq('entry_id', entryId);

    if (!expenses.length) return;

    const payload = expenses.map((expense) => ({
      entry_id: entryId,
      name: expense.name,
      reason: expense.reason,
      amount: expense.amount,
    }));

    const { error } = await supabase.from('bus_station_expenses').insert(payload);
    if (error) throw error;
  },

  async attachSlips(entryId: string, slips: SlipInput[]): Promise<void> {
    for (const slip of slips) {
      if (slip.id) continue; // already stored, untouched

      let url = slip.slip_url;
      if (slip.file) url = await this.uploadSlip(slip.file, entryId);
      if (!url) continue;

      const { error } = await supabase.from('bus_station_revenue_slips').insert([
        {
          entry_id: entryId,
          slip_url: url,
          file_name: slip.file?.name ?? slip.file_name ?? null,
          file_size: slip.file?.size ?? slip.file_size ?? null,
          amount: slip.amount,
          deposit_date: slip.deposit_date,
        },
      ]);

      if (error) {
        // The DB row failed, so the just-uploaded object is an orphan.
        if (slip.file && url) await this.removeSlipFile(url);
        throw error;
      }
    }
  },

  async createEntryComplete(
    entry: { station: BusStationId; created_by?: string | null },
    rows: RowInput[],
    slips: SlipInput[],
    expenses: ExpenseInput[]
  ): Promise<string> {
    const { data: created, error } = await supabase
      .from('bus_station_revenues')
      .insert([
        {
          station: entry.station,
          created_by: entry.created_by ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    try {
      await this.replaceRows(created.id, rows);
      await this.replaceExpenses(created.id, expenses);
      await this.attachSlips(created.id, slips);
    } catch (err) {
      // Never leave a half-written entry behind.
      await supabase.from('bus_station_revenues').delete().eq('id', created.id);
      throw err;
    }

    return created.id as string;
  },

  async updateEntryComplete(
    entryId: string,
    entry: { station: BusStationId },
    rows: RowInput[],
    slips: SlipInput[],
    expenses: ExpenseInput[],
    removedSlipIds: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('bus_station_revenues')
      .update({
        station: entry.station,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) throw error;

    if (removedSlipIds.length) {
      const { data: removed } = await supabase
        .from('bus_station_revenue_slips')
        .select('slip_url')
        .in('id', removedSlipIds);

      await supabase.from('bus_station_revenue_slips').delete().in('id', removedSlipIds);
      for (const slip of removed || []) await this.removeSlipFile(slip.slip_url);
    }

    await this.replaceRows(entryId, rows);
    await this.replaceExpenses(entryId, expenses);
    await this.attachSlips(entryId, slips);
  },

  async deleteEntry(entryId: string): Promise<void> {
    const { data: slips } = await supabase
      .from('bus_station_revenue_slips')
      .select('slip_url')
      .eq('entry_id', entryId);

    const { error } = await supabase.from('bus_station_revenues').delete().eq('id', entryId);
    if (error) throw error;

    // Rows and slip records cascade; the stored files do not.
    for (const slip of slips || []) await this.removeSlipFile(slip.slip_url);
  },

  async getOverview(from: string, to: string): Promise<BusStationOverview> {
    const entries = await this.getEntries();
    const acc: BusStationOverview = {
      total: 0,
      passenger: 0,
      cargo: 0,
      expenses: 0,
      net: 0,
      byStation: { mbanza_congo: 0, nosso_centro: 0 },
    };

    for (const entry of entries) {
      // Expenses carry no date of their own; they count when their entry has
      // at least one vehicle row inside the selected period.
      let entryInRange = false;
      for (const row of entry.bus_station_revenue_rows || []) {
        if (row.start_date < from || row.start_date > to) continue;
        entryInRange = true;
        const total = Number(row.total_revenue) || 0;
        acc.passenger += Number(row.passenger_revenue) || 0;
        acc.cargo += Number(row.cargo_amount) || 0;
        acc.total += total;
        acc.byStation[entry.station] = (acc.byStation[entry.station] || 0) + total;
      }
      if (entryInRange) {
        const spent = expensesTotal(entry.bus_station_expenses || []);
        acc.expenses += spent;
        acc.byStation[entry.station] = (acc.byStation[entry.station] || 0) - spent;
      }
    }

    acc.net = acc.total - acc.expenses;
    return acc;
  },

  /** NET of park expenses — this is what feeds Financial Analytics. */
  async getBusStationRevenueTotal(from: string, to: string): Promise<number> {
    const overview = await this.getOverview(from, to);
    return overview.net;
  },
};
