-- Deep-clean and insecticide treatments logged per vehicle. Both live in one
-- table, told apart by `type`, so the cleaning dashboard reads a single source.

CREATE TABLE IF NOT EXISTS public.vehicle_cleaning_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('deep_clean', 'insecticide')),
  cleaning_date date NOT NULL,
  location      text NOT NULL,
  performed_by  text,
  product       text,
  cost          numeric(14,2) CHECK (cost >= 0),
  notes         text,
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_cleaning_logs_vehicle_date_idx
  ON public.vehicle_cleaning_logs(vehicle_id, cleaning_date DESC);

ALTER TABLE public.vehicle_cleaning_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all ON public.vehicle_cleaning_logs;
CREATE POLICY authenticated_all ON public.vehicle_cleaning_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
