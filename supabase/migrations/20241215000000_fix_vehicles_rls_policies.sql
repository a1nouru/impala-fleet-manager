-- Fix RLS policies for vehicles table
-- Add missing INSERT, UPDATE, and DELETE policies for authenticated users

-- Add INSERT policy for vehicles
CREATE POLICY "Allow authenticated users to insert vehicles"
ON public.vehicles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for vehicles  
CREATE POLICY "Allow authenticated users to update vehicles"
ON public.vehicles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy for vehicles
CREATE POLICY "Allow authenticated users to delete vehicles"
ON public.vehicles FOR DELETE
TO authenticated
USING (true);

-- Also check if maintenance_records and technicians tables need similar policies
-- Add missing policies for maintenance_records if they don't exist
CREATE POLICY "Allow authenticated users to insert maintenance records"
ON public.maintenance_records FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update maintenance records"
ON public.maintenance_records FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete maintenance records"
ON public.maintenance_records FOR DELETE
TO authenticated
USING (true);

-- Add missing policies for technicians if they don't exist  
CREATE POLICY "Allow authenticated users to insert technicians"
ON public.technicians FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update technicians"
ON public.technicians FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete technicians"
ON public.technicians FOR DELETE
TO authenticated
USING (true); 