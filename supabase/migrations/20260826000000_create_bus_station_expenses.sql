-- Park-side expenses (subsidies, casual labour, etc.) recorded on the same
-- paper sheet as the station takings. Each expense belongs to a revenue entry
-- and is deducted from that entry's revenue everywhere it is displayed.

CREATE TABLE IF NOT EXISTS public.bus_station_expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES public.bus_station_revenues(id) ON DELETE CASCADE,
  name       text NOT NULL,
  reason     text,
  amount     numeric(14,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_station_expenses_entry_idx ON public.bus_station_expenses(entry_id);

ALTER TABLE public.bus_station_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all ON public.bus_station_expenses;
CREATE POLICY authenticated_all ON public.bus_station_expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
