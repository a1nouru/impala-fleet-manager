-- Driver who drove the vehicle on this report's day; required by the app for new
-- operational reports, nullable for history and the POS rollup.
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS daily_reports_driver_id_idx ON public.daily_reports (driver_id);
