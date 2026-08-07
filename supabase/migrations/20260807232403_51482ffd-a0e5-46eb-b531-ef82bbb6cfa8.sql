
CREATE POLICY "own applicant docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applicant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own applicant docs insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applicant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own applicant docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'applicant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "staff read applicant docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applicant-documents' AND public.is_recruiting_staff(auth.uid()));
