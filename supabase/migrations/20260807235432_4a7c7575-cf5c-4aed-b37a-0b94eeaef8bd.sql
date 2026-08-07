DROP POLICY IF EXISTS "own draft update" ON public.applications;
CREATE POLICY "own editable update" ON public.applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','corrections_requested'))
  WITH CHECK (user_id = auth.uid());