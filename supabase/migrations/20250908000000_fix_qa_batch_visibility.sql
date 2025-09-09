-- Fix RLS policy for QA agencies to see unassigned batches
-- This allows QA agencies to view batches that haven't been assigned to any QA agency yet

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "QA agencies can view assigned batches" ON public.batches;

-- Create a new policy that allows QA agencies to see:
-- 1. Batches assigned to them (qa_agency_id = auth.uid())
-- 2. Unassigned batches (qa_agency_id IS NULL) that are available for pickup
CREATE POLICY "QA agencies can view available and assigned batches" ON public.batches
  FOR SELECT 
  USING (
    -- Check if user is a QA agency first
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'qa_agency'
    )
    AND (
      -- Allow viewing assigned batches
      auth.uid() = qa_agency_id 
      OR 
      -- Allow viewing unassigned batches that are submitted or under inspection
      (qa_agency_id IS NULL AND status IN ('submitted', 'under_inspection'))
    )
  );

-- Also allow QA agencies to update batches when they assign themselves
CREATE POLICY "QA agencies can assign themselves to unassigned batches" ON public.batches
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'qa_agency'
    )
    AND (
      -- Can update if already assigned to them
      auth.uid() = qa_agency_id
      OR
      -- Can update if currently unassigned (to assign themselves)
      qa_agency_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'qa_agency'
    )
  );
