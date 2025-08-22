-- Create vehicles table that is referenced throughout the system
-- This table should have been in the initial migration but was missing

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for vehicles table
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);

-- Enable Row Level Security
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these might already exist from other migrations, so use IF NOT EXISTS pattern)
DO $$
BEGIN
    -- Check if SELECT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'vehicles' 
        AND policyname = 'Allow authenticated users to view all vehicles'
    ) THEN
        CREATE POLICY "Allow authenticated users to view all vehicles"
        ON public.vehicles FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    -- Check if INSERT policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'vehicles' 
        AND policyname = 'Allow authenticated users to insert vehicles'
    ) THEN
        CREATE POLICY "Allow authenticated users to insert vehicles"
        ON public.vehicles FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;

    -- Check if UPDATE policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'vehicles' 
        AND policyname = 'Allow authenticated users to update vehicles'
    ) THEN
        CREATE POLICY "Allow authenticated users to update vehicles"
        ON public.vehicles FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;

    -- Check if DELETE policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'vehicles' 
        AND policyname = 'Allow authenticated users to delete vehicles'
    ) THEN
        CREATE POLICY "Allow authenticated users to delete vehicles"
        ON public.vehicles FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Insert some sample vehicles if the table is empty
INSERT INTO vehicles (plate, model) 
SELECT * FROM (VALUES 
    ('RAA-123-AB', 'Toyota Hiace'),
    ('RAA-124-AB', 'Toyota Hiace'),
    ('RAA-125-AB', 'Toyota Coaster'),
    ('RAA-126-AB', 'Toyota Hiace'),
    ('RAA-127-AB', 'Toyota Quantum')
) AS v(plate, model)
WHERE NOT EXISTS (SELECT 1 FROM vehicles LIMIT 1);

-- Add comment for documentation
COMMENT ON TABLE vehicles IS 'Fleet vehicles available for daily operations and rentals';
COMMENT ON COLUMN vehicles.plate IS 'Vehicle license plate number (unique identifier)';
COMMENT ON COLUMN vehicles.model IS 'Vehicle model/type';
