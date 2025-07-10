-- Add missing DELETE policy for daily_reports table
-- This fixes the issue where daily reports cannot be deleted due to missing RLS policy
 
CREATE POLICY "Allow authenticated users to delete daily reports"
ON public.daily_reports FOR DELETE
TO authenticated
USING (true); 