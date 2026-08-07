-- 1. New application status
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'corrections_requested';

-- 2. Correction notes on applications
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS correction_notes text;

-- 3. Document verification fields
ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE POLICY "staff update docs" ON public.application_documents
  FOR UPDATE TO authenticated
  USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- 4. Applicant may insert own timeline events
CREATE POLICY "own events insert" ON public.application_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a
    WHERE a.id = application_id AND a.user_id = auth.uid()));

-- 5. Audit log inserts by signed-in actors
CREATE POLICY "authenticated insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 6. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 7. Notification helpers (security definer; inserts bypass RLS intentionally)
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _body text DEFAULT NULL, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_recruiting_staff(
  _type text, _title text, _body text DEFAULT NULL, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT ur.user_id, _type, _title, _body, _link
  FROM public.user_roles ur
  WHERE ur.role IN ('administrator','recruiter','developer');
END; $$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.notify_recruiting_staff(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_recruiting_staff(text, text, text, text) TO authenticated, service_role;

-- 8. Automatic notifications on application status change
CREATE OR REPLACE FUNCTION public.on_application_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' THEN
      PERFORM public.notify_recruiting_staff(
        'application_submitted',
        'New application received',
        coalesce(NEW.first_name || ' ' || NEW.last_name, 'An applicant') || ' submitted ' || NEW.reference_code,
        '/portal/recruiting/' || NEW.id::text);
    END IF;
    PERFORM public.notify_user(
      NEW.user_id,
      'application_status',
      'Application status updated',
      'Your application ' || NEW.reference_code || ' is now: ' || replace(NEW.status::text, '_', ' '),
      '/portal/application');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS applications_status_notify ON public.applications;
CREATE TRIGGER applications_status_notify
AFTER UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.on_application_status_change();

-- 9. Automatic notifications on document verification
CREATE OR REPLACE FUNCTION public.on_document_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status IN ('approved','rejected') THEN
    PERFORM public.notify_user(
      NEW.user_id,
      'document_' || NEW.verification_status,
      CASE WHEN NEW.verification_status = 'approved' THEN 'Document approved' ELSE 'Document needs re-upload' END,
      NEW.file_name || coalesce(' — ' || NEW.rejection_reason, ''),
      '/portal/application');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS documents_verification_notify ON public.application_documents;
CREATE TRIGGER documents_verification_notify
AFTER UPDATE ON public.application_documents
FOR EACH ROW EXECUTE FUNCTION public.on_document_verification();

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON public.applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_docs_application ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_verification ON public.application_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_app_events_application ON public.application_events(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
