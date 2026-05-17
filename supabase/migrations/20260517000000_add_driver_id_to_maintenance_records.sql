-- Add driver_id to maintenance_records as optional FK to employees
ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.maintenance_records.driver_id IS 'The employee (driver) who was driving the vehicle during this maintenance event';
