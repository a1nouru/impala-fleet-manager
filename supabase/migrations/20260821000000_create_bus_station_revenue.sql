-- Bus Station Revenue: station clerks record a batch of per-vehicle takings
-- (date range, passenger count, cargo) plus the bank slips proving deposit.

CREATE TABLE IF NOT EXISTS public.bus_station_revenues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station     text NOT NULL CHECK (station IN ('mbanza_congo', 'nosso_centro')),
  notes       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_station_revenue_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          uuid NOT NULL REFERENCES public.bus_station_revenues(id) ON DELETE CASCADE,
  vehicle_id        uuid NOT NULL REFERENCES public.vehicles(id),
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  passenger_count   integer NOT NULL DEFAULT 0 CHECK (passenger_count >= 0),
  -- Persisted, not derived from the fare constant: a future fare change must
  -- not rewrite what was actually recorded.
  passenger_revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (passenger_revenue >= 0),
  cargo_amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (cargo_amount >= 0),
  total_revenue     numeric(14,2) GENERATED ALWAYS AS (passenger_revenue + cargo_amount) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_station_rows_date_order CHECK (end_date >= start_date),
  CONSTRAINT bus_station_rows_one_per_vehicle UNIQUE (entry_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS public.bus_station_revenue_slips (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid NOT NULL REFERENCES public.bus_station_revenues(id) ON DELETE CASCADE,
  slip_url     text NOT NULL,
  file_name    text,
  file_size    bigint,
  amount       numeric(14,2),
  deposit_date date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_station_rows_entry_idx   ON public.bus_station_revenue_rows(entry_id);
CREATE INDEX IF NOT EXISTS bus_station_rows_vehicle_idx ON public.bus_station_revenue_rows(vehicle_id);
CREATE INDEX IF NOT EXISTS bus_station_rows_start_idx   ON public.bus_station_revenue_rows(start_date);
CREATE INDEX IF NOT EXISTS bus_station_slips_entry_idx  ON public.bus_station_revenue_slips(entry_id);
CREATE INDEX IF NOT EXISTS bus_station_revenues_station_idx ON public.bus_station_revenues(station);

ALTER TABLE public.bus_station_revenues      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_station_revenue_rows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_station_revenue_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all ON public.bus_station_revenues;
CREATE POLICY authenticated_all ON public.bus_station_revenues
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all ON public.bus_station_revenue_rows;
CREATE POLICY authenticated_all ON public.bus_station_revenue_rows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all ON public.bus_station_revenue_slips;
CREATE POLICY authenticated_all ON public.bus_station_revenue_slips
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
