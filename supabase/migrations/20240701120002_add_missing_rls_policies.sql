-- Enable RLS for related tables that are read during queries.
ALTER TABLE public.deposit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS Policies for deposit_reports (Junction Table)
-- =================================================================
CREATE POLICY "Allow authenticated users to view deposit to report links"
ON public.deposit_reports FOR SELECT
TO authenticated
USING (true);


-- =================================================================
-- RLS Policies for vehicles
-- =================================================================
CREATE POLICY "Allow authenticated users to view all vehicles"
ON public.vehicles FOR SELECT
TO authenticated
USING (true);


-- =================================================================
-- RLS Policies for technicians
-- =================================================================
CREATE POLICY "Allow authenticated users to view all technicians"
ON public.technicians FOR SELECT
TO authenticated
USING (true); 