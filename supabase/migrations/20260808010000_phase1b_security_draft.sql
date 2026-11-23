-- DRAFT / UNAPPLIED — Phase 1B SRS v4.1 database security proposal.
-- No data is deleted. Legacy application and screening columns/rows are retained,
-- but legacy sensitive columns are intentionally not granted to API roles.
-- Rollback: do not reverse this wholesale in production. Re-granting prior broad
-- privileges would reopen the findings. Revert only after reviewed replacement
-- policies and server/API workflows are deployed.

BEGIN;

-- pgcrypto must already be installed in the Supabase extensions schema. Fail
-- closed rather than falling back to a weaker or differently encoded token hash.
DO $crypto_preflight$
BEGIN
  IF to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'Phase 1B requires extensions.digest(bytea,text) from pgcrypto';
  END IF;
END;
$crypto_preflight$;

-- Role helpers must never answer questions about an arbitrary user's role to a
-- caller. Security-definer routines use a fixed search path and derive identity
-- from the request JWT. Temporary developers are not recruiting staff.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = _role
     );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'recruiter'::public.app_role,
                         'content_manager'::public.app_role)
     );
$$;

CREATE OR REPLACE FUNCTION public.is_recruiting_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'recruiter'::public.app_role)
     );
$$;

CREATE OR REPLACE FUNCTION public.is_content_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'content_manager'::public.app_role)
     );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_recruiting_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_content_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_recruiting_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_content_staff(uuid) TO authenticated, service_role;

-- Temporary developer grants fail closed; no policy below consumes this table.
-- A separate reviewed workflow must grant/revoke access with an audit record.
CREATE TABLE IF NOT EXISTS public.temporary_developer_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 1 AND 500),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
ALTER TABLE public.temporary_developer_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temporary_developer_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.temporary_developer_grants TO service_role;

-- Add only token lifecycle and immutable submission metadata. These are
-- additive; no legacy user data is dropped. Trusted server code must generate
-- high-entropy raw tokens and store only SHA-256(token), never the raw token.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS resume_token_hash text,
  ADD COLUMN IF NOT EXISTS resume_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_response_snapshot jsonb;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_hash_format
    CHECK (resume_token_hash IS NULL OR resume_token_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT applications_resume_expiry_required
    CHECK (resume_token_hash IS NULL OR resume_expires_at IS NOT NULL) NOT VALID;

CREATE TABLE IF NOT EXISTS public.fadv_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE RESTRICT,
  invitation_date date,
  recruiter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_reference text,
  next_check_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS fadv_handoffs_recruiter_idx
  ON public.fadv_handoffs(recruiter_id);
CREATE UNIQUE INDEX IF NOT EXISTS applications_resume_token_hash_key
  ON public.applications(resume_token_hash) WHERE resume_token_hash IS NOT NULL;
ALTER TABLE public.fadv_handoffs ENABLE ROW LEVEL SECURITY;

-- A small append-only audit stream. It records identifiers and decision
-- metadata only, never application payloads, screening notes, or document data.
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  old_status text,
  new_status text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_audit_events TO authenticated;
GRANT ALL ON public.security_audit_events TO service_role;

-- Remove every existing policy on the tables whose security model is replaced.
-- This avoids permissive-policy OR behavior and makes repeated review predictable.
DO $drop_policies$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'user_roles','profiles','applications','application_employers',
        'application_documents','application_notes','application_events',
        'screening_records','esign_records','drivers','notifications','audit_logs',
        'fadv_handoffs','security_audit_events',
        'page_content','faqs','jobs','site_settings','social_links',
        'academy_modules','academy_progress','handbook_sections','safety_resources',
        'safety_acknowledgements','announcements','announcement_acknowledgements',
        'safety_meetings','safety_meeting_assignments','handbook_versions',
        'handbook_signatures','email_templates','required_systems','media_assets',
        'lms_courses','lms_modules','lms_lessons','lms_quizzes',
        'lms_quiz_questions','lms_enrollments','lms_lesson_progress','lms_quiz_attempts'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$drop_policies$;

-- Applications have no direct applicant/anonymous table access. Recruiters can
-- read only the currently modeled application fields; legacy sensitive columns,
-- token material, and snapshots are deliberately excluded from column grants.
REVOKE ALL ON public.applications FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,user_id,job_id,position_title,reference_code,status,current_step,completed_steps,
  first_name,middle_name,last_name,email,phone,city,state,postal_code,cdl_state,
  cdl_class,endorsements,years_experience,authorized_to_work,how_did_you_hear,
  additional_notes,signature_name,certified,submitted_at,created_at,updated_at,
  assigned_recruiter,priority,correction_notes
) ON public.applications TO authenticated;
GRANT UPDATE (status,assigned_recruiter,priority,correction_notes)
  ON public.applications TO authenticated;
CREATE POLICY applications_recruiter_read ON public.applications
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY applications_recruiter_update ON public.applications
  FOR UPDATE TO authenticated
  USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- All writes through ordinary application-related tables are server-only.
-- Human decisions stay explicit; no policy or trigger auto-hires/rejects.
REVOKE ALL ON public.application_employers FROM PUBLIC, anon, authenticated;
CREATE POLICY employers_recruiter_read ON public.application_employers
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
GRANT SELECT ON public.application_employers TO authenticated;

REVOKE ALL ON public.application_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_documents TO authenticated;
GRANT UPDATE (verification_status,rejection_reason,verified_by,verified_at)
  ON public.application_documents TO authenticated;
CREATE POLICY documents_recruiter_read ON public.application_documents
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY documents_recruiter_verify ON public.application_documents
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

REVOKE ALL ON public.application_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.application_notes TO authenticated;
CREATE POLICY notes_recruiter_read ON public.application_notes
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY notes_recruiter_insert ON public.application_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_recruiting_staff(auth.uid()) AND author_id = auth.uid());

REVOKE ALL ON public.application_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_events TO authenticated;
CREATE POLICY events_recruiter_read ON public.application_events
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

REVOKE ALL ON public.screening_records FROM PUBLIC, anon, authenticated;
-- Legacy screening rows/columns remain untouched and inaccessible to API roles.

REVOKE ALL ON public.esign_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.esign_records TO authenticated;
CREATE POLICY esign_recruiter_read ON public.esign_records
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY esign_recruiter_insert ON public.esign_records
  FOR INSERT TO authenticated WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE POLICY esign_recruiter_update ON public.esign_records
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- First Advantage handoff data is a separate minimal record; existing
-- screening_records remain preserved but unavailable to client roles.
REVOKE ALL ON public.fadv_handoffs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fadv_handoffs TO authenticated;
CREATE POLICY fadv_recruiter_read ON public.fadv_handoffs
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY fadv_recruiter_insert ON public.fadv_handoffs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_recruiting_staff(auth.uid()) AND updated_by = auth.uid());
CREATE POLICY fadv_recruiter_update ON public.fadv_handoffs
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()) AND updated_by = auth.uid());

-- Role and profile data. A content manager gets no employee directory access;
-- users can only see/update a limited set of their own profile columns.
REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
CREATE POLICY roles_self_or_admin_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator'::public.app_role));
-- Role changes are server-only until audited administrative role-management APIs exist.

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,email,full_name,preferred_name,phone,title,avatar_url,status,created_at,updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (full_name,preferred_name,phone,avatar_url)
  ON public.profiles TO authenticated;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Driver records are self-readable; only emergency contact is self-editable.
REVOKE ALL ON public.drivers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.drivers TO authenticated;
GRANT UPDATE (emergency_contact_name,emergency_contact_phone) ON public.drivers TO authenticated;
CREATE POLICY drivers_self_read ON public.drivers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY drivers_recruiter_read ON public.drivers
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY drivers_self_update ON public.drivers
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY drivers_recruiter_update ON public.drivers
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- Notifications are own-read and own read-state only. No caller-supplied
-- recipient function, direct insert/delete, or arbitrary body update.
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY notifications_self_read ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_self_mark_read ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _body text DEFAULT NULL, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,type,title,body,link)
  VALUES (_user_id,_type,_title,_body,_link);
END;
$$;
CREATE OR REPLACE FUNCTION public.notify_recruiting_staff(
  _type text, _title text, _body text DEFAULT NULL, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.notifications(user_id,type,title,body,link)
  SELECT DISTINCT ur.user_id,_type,_title,_body,_link
  FROM public.user_roles ur
  WHERE ur.role IN ('administrator'::public.app_role,'recruiter'::public.app_role);
END;
$$;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_recruiting_staff(text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Existing free-form client audit inserts are removed. Admin-only read access;
-- SECURITY DEFINER triggers below append minimal audit events.
REVOKE ALL ON public.audit_logs, public.email_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
CREATE POLICY email_templates_admin_read ON public.email_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role));
CREATE POLICY email_templates_admin_manage ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'administrator'::public.app_role));
GRANT SELECT ON public.audit_logs TO authenticated;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role));
CREATE POLICY security_audit_admin_read ON public.security_audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role));

-- Public and portal content is separated from restricted drafts/configuration.
-- Content managers/admins may manage approved content but receive no recruiting
-- or applicant access. Anon retains only published public-facing jobs/copy/FAQs.
REVOKE ALL ON public.jobs, public.page_content, public.faqs, public.site_settings,
  public.social_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jobs, public.page_content, public.faqs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jobs, public.page_content, public.faqs TO authenticated;
CREATE POLICY jobs_public_read ON public.jobs FOR SELECT TO anon, authenticated
  USING (published AND archived_at IS NULL);
CREATE POLICY jobs_content_manage ON public.jobs FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY page_content_public_read ON public.page_content FOR SELECT TO anon, authenticated
  USING (published AND approval_status = 'approved');
CREATE POLICY page_content_content_manage ON public.page_content FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY faqs_public_read ON public.faqs FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY faqs_content_manage ON public.faqs FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

REVOKE ALL ON public.site_settings, public.social_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_settings, public.social_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings, public.social_links TO authenticated;
CREATE POLICY settings_public_read ON public.site_settings FOR SELECT TO anon, authenticated
  USING (is_public);
CREATE POLICY settings_admin_manage ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'administrator'::public.app_role));
CREATE POLICY social_public_read ON public.social_links FOR SELECT TO anon, authenticated
  USING (is_active AND url IS NOT NULL);
CREATE POLICY social_admin_manage ON public.social_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'administrator'::public.app_role));

-- Portal content is limited to authenticated drivers with a driver record,
-- plus content staff for authoring. Applicant/recruiter/developer roles do not
-- receive broad portal access. Publication/audience filtering is fail-closed.
REVOKE ALL ON public.academy_modules, public.academy_progress,
  public.handbook_sections, public.safety_resources,
  public.announcements, public.announcement_acknowledgements, public.safety_meetings,
  public.safety_meeting_assignments, public.handbook_versions, public.handbook_signatures,
  public.required_systems, public.media_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.academy_modules, public.handbook_sections, public.safety_resources,
  public.announcements, public.safety_meetings, public.handbook_versions,
  public.required_systems TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academy_modules, public.handbook_sections,
  public.safety_resources, public.announcements, public.safety_meetings,
  public.handbook_versions, public.required_systems, public.media_assets TO authenticated;
GRANT SELECT ON public.announcement_acknowledgements, public.safety_acknowledgements,
  public.safety_meeting_assignments, public.handbook_signatures TO authenticated;
GRANT INSERT ON public.announcement_acknowledgements, public.safety_acknowledgements,
  public.handbook_signatures TO authenticated;
GRANT SELECT ON public.media_assets TO authenticated;

CREATE POLICY academy_driver_read ON public.academy_modules FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY academy_content_manage ON public.academy_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY handbook_driver_read ON public.handbook_sections FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY handbook_content_manage ON public.handbook_sections FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY safety_driver_read ON public.safety_resources FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY safety_content_manage ON public.safety_resources FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY announcements_driver_read ON public.announcements FOR SELECT TO authenticated
  USING (published AND status = 'published'
    AND (publish_at IS NULL OR publish_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND audience IN ('driver','drivers','all_drivers')
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY announcements_content_manage ON public.announcements FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY meetings_driver_read ON public.safety_meetings FOR SELECT TO authenticated
  USING (status = 'published' AND audience IN ('driver','drivers','all_drivers')
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY meetings_content_manage ON public.safety_meetings FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY handbook_versions_driver_read ON public.handbook_versions FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY handbook_versions_content_manage ON public.handbook_versions FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY required_systems_driver_read ON public.required_systems FOR SELECT TO authenticated
  USING (published AND audience = 'drivers'
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY required_systems_content_manage ON public.required_systems FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY media_content_read ON public.media_assets FOR SELECT TO authenticated
  USING (public.is_content_staff(auth.uid()));
CREATE POLICY media_content_manage ON public.media_assets FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- Acknowledgements are append-only. Triggers overwrite caller-provided actor and
-- timestamps. Assignment/scoring mutation is intentionally server-only pending
-- scoped task-completion RPCs.
CREATE POLICY announcement_ack_self_read ON public.announcement_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY announcement_ack_self_insert ON public.announcement_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.published AND a.status = 'published'
        AND (a.publish_at IS NULL OR a.publish_at <= now())
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND a.audience IN ('driver','drivers','all_drivers'))
  );
CREATE POLICY safety_ack_self_read ON public.safety_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY safety_ack_self_insert ON public.safety_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.safety_resources r
      WHERE r.id = resource_id AND r.published)
  );
CREATE POLICY handbook_signatures_self_read ON public.handbook_signatures
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY handbook_signatures_self_insert ON public.handbook_signatures
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.handbook_versions h
      WHERE h.id = version_id AND h.published AND h.requires_signature)
  );
REVOKE ALL ON public.safety_meeting_assignments FROM PUBLIC, anon, authenticated;
-- assignments are server-authored; no client read/update of attendance status

-- LMS: public course metadata is not exposed to non-drivers. Content authoring
-- remains content-staff-only. Correct answers and all self-reported scoring are
-- withheld pending a trusted scoring API.
REVOKE ALL ON public.lms_courses, public.lms_modules, public.lms_lessons,
  public.lms_quizzes, public.lms_quiz_questions, public.lms_enrollments,
  public.lms_lesson_progress, public.lms_quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_courses, public.lms_modules,
  public.lms_lessons, public.lms_quizzes, public.lms_quiz_questions TO authenticated;
GRANT SELECT ON public.lms_enrollments, public.lms_lesson_progress,
  public.lms_quiz_attempts TO authenticated;
CREATE POLICY lms_courses_driver_read ON public.lms_courses FOR SELECT TO authenticated
  USING (published AND archived_at IS NULL
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY lms_courses_content_manage ON public.lms_courses FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_modules_driver_read ON public.lms_modules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY lms_modules_content_only ON public.lms_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_lessons_driver_read ON public.lms_lessons FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY lms_lessons_content_only ON public.lms_lessons FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_quizzes_driver_read ON public.lms_quizzes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid()));
CREATE POLICY lms_quizzes_content_only ON public.lms_quizzes FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_questions_content_only ON public.lms_quiz_questions FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- Quiz questions remain server/content-write-only. The existing options payload
-- has not been proven to exclude answer keys, so no applicant/driver view is
-- granted until a reviewed quiz delivery/scoring API is implemented.

CREATE POLICY lms_enrollments_self_read ON public.lms_enrollments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
  );
CREATE POLICY lms_progress_self_read ON public.lms_lesson_progress
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
  );
CREATE POLICY lms_attempts_self_read ON public.lms_quiz_attempts
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
  );

-- Token-only applicant APIs. Tokens are high-entropy bearer secrets created by
-- trusted server code; SHA-256 via pgcrypto is stored only.
-- Current SQL does not model all SRS v4.1 response fields or child/document
-- workflows. Rate limiting, token issuance/revocation, new-application creation,
-- corrections_requested versioning, confirmation delivery, and generated-type
-- updates require server/API follow-up before production use. This database draft
-- does not rate-limit bearer-token attempts and does not upload documents.
CREATE OR REPLACE FUNCTION public.resume_application(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id',a.id,'job_id',a.job_id,'position_title',a.position_title,
    'status',a.status,'current_step',a.current_step,
    'first_name',a.first_name,'middle_name',a.middle_name,'last_name',a.last_name,
    'email',a.email,'phone',a.phone,'city',a.city,'state',a.state,
    'postal_code',a.postal_code,'cdl_state',a.cdl_state,'cdl_class',a.cdl_class,
    'endorsements',a.endorsements,'years_experience',a.years_experience,
    'authorized_to_work',a.authorized_to_work,'how_did_you_hear',a.how_did_you_hear,
    'additional_notes',a.additional_notes,'signature_name',a.signature_name,
    'certified',a.certified,'submitted_at',a.submitted_at
  ) INTO result
  FROM public.applications a
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now()
    AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL
    AND a.status = 'draft'::public.application_status;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_application_draft(_token text, _patch jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE app_id uuid; patched public.applications;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512
     OR _patch IS NULL OR jsonb_typeof(_patch) <> 'object'
     OR octet_length(_patch::text) > 20000
     OR (_patch - ARRAY[
       'job_id','position_title','current_step','first_name','middle_name','last_name',
       'email','phone','city','state','postal_code','cdl_state','cdl_class',
       'endorsements','years_experience','authorized_to_work','how_did_you_hear',
       'additional_notes','signature_name','certified'
     ]::text[]) <> '{}'::jsonb THEN
    RETURN false;
  END IF;
  SELECT a.id INTO app_id
  FROM public.applications a
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now() AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL AND a.status = 'draft'::public.application_status
  FOR UPDATE;
  IF app_id IS NULL THEN RETURN false; END IF;
  SELECT jsonb_populate_record(NULL::public.applications, _patch) INTO patched;
  IF (_patch ? 'current_step' AND patched.current_step NOT BETWEEN 1 AND 6)
     OR (_patch ? 'position_title' AND length(patched.position_title) > 160)
     OR (_patch ? 'first_name' AND length(patched.first_name) > 80)
     OR (_patch ? 'middle_name' AND length(patched.middle_name) > 80)
     OR (_patch ? 'last_name' AND length(patched.last_name) > 80)
     OR (_patch ? 'email' AND length(patched.email) > 255)
     OR (_patch ? 'phone' AND length(patched.phone) > 40)
     OR (_patch ? 'city' AND length(patched.city) > 80)
     OR (_patch ? 'state' AND length(patched.state) > 40)
     OR (_patch ? 'postal_code' AND length(patched.postal_code) > 20)
     OR (_patch ? 'cdl_state' AND length(patched.cdl_state) > 40)
     OR (_patch ? 'cdl_class' AND length(patched.cdl_class) > 10)
     OR (_patch ? 'endorsements' AND cardinality(patched.endorsements) > 12)
     OR (_patch ? 'years_experience' AND
         (patched.years_experience < 0 OR patched.years_experience > 60))
     OR (_patch ? 'how_did_you_hear' AND length(patched.how_did_you_hear) > 160)
     OR (_patch ? 'additional_notes' AND length(patched.additional_notes) > 2000)
     OR (_patch ? 'signature_name' AND length(patched.signature_name) > 120)
     OR EXISTS (
       SELECT 1 FROM unnest(patched.endorsements) AS endorsement
       WHERE length(endorsement) > 60
     ) THEN
    RETURN false;
  END IF;
  UPDATE public.applications a SET
    job_id = CASE WHEN _patch ? 'job_id' THEN patched.job_id ELSE a.job_id END,
    position_title = CASE WHEN _patch ? 'position_title' THEN patched.position_title ELSE a.position_title END,
    current_step = CASE WHEN _patch ? 'current_step' THEN patched.current_step ELSE a.current_step END,
    first_name = CASE WHEN _patch ? 'first_name' THEN patched.first_name ELSE a.first_name END,
    middle_name = CASE WHEN _patch ? 'middle_name' THEN patched.middle_name ELSE a.middle_name END,
    last_name = CASE WHEN _patch ? 'last_name' THEN patched.last_name ELSE a.last_name END,
    email = CASE WHEN _patch ? 'email' THEN patched.email ELSE a.email END,
    phone = CASE WHEN _patch ? 'phone' THEN patched.phone ELSE a.phone END,
    city = CASE WHEN _patch ? 'city' THEN patched.city ELSE a.city END,
    state = CASE WHEN _patch ? 'state' THEN patched.state ELSE a.state END,
    postal_code = CASE WHEN _patch ? 'postal_code' THEN patched.postal_code ELSE a.postal_code END,
    cdl_state = CASE WHEN _patch ? 'cdl_state' THEN patched.cdl_state ELSE a.cdl_state END,
    cdl_class = CASE WHEN _patch ? 'cdl_class' THEN patched.cdl_class ELSE a.cdl_class END,
    endorsements = CASE WHEN _patch ? 'endorsements' THEN patched.endorsements ELSE a.endorsements END,
    years_experience = CASE WHEN _patch ? 'years_experience' THEN patched.years_experience ELSE a.years_experience END,
    authorized_to_work = CASE WHEN _patch ? 'authorized_to_work' THEN patched.authorized_to_work ELSE a.authorized_to_work END,
    how_did_you_hear = CASE WHEN _patch ? 'how_did_you_hear' THEN patched.how_did_you_hear ELSE a.how_did_you_hear END,
    additional_notes = CASE WHEN _patch ? 'additional_notes' THEN patched.additional_notes ELSE a.additional_notes END,
    signature_name = CASE WHEN _patch ? 'signature_name' THEN patched.signature_name ELSE a.signature_name END,
    certified = CASE WHEN _patch ? 'certified' THEN patched.certified ELSE a.certified END,
    updated_at = now()
  WHERE a.id = app_id;
  RETURN FOUND;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_application_draft(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE app_id uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN
    RETURN false;
  END IF;
  UPDATE public.applications a
  SET status = 'submitted'::public.application_status,
      submitted_at = now(),
      resume_consumed_at = now(),
      submitted_response_snapshot = jsonb_build_object(
        'job_id',a.job_id,'position_title',a.position_title,'current_step',a.current_step,
        'first_name',a.first_name,'middle_name',a.middle_name,'last_name',a.last_name,
        'email',a.email,'phone',a.phone,'city',a.city,'state',a.state,
        'postal_code',a.postal_code,'cdl_state',a.cdl_state,'cdl_class',a.cdl_class,
        'endorsements',a.endorsements,'years_experience',a.years_experience,
        'authorized_to_work',a.authorized_to_work,'how_did_you_hear',a.how_did_you_hear,
        'additional_notes',a.additional_notes,'signature_name',a.signature_name,
        'certified',a.certified),
      updated_at = now()
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now() AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL AND a.status = 'draft'::public.application_status
  RETURNING a.id INTO app_id;
  RETURN app_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_application(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_application_draft(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_application_draft(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_application(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_application_draft(text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_application_draft(text) TO anon, authenticated;

-- Submitted response snapshot is immutable. Workflow-only fields remain
-- editable by recruiting staff; response corrections require a separately
-- reviewed, versioned API rather than rewriting the original submission.
CREATE OR REPLACE FUNCTION public.enforce_application_submission_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE current_response jsonb;
BEGIN
  IF OLD.submitted_response_snapshot IS NOT NULL THEN
    current_response := jsonb_build_object(
      'job_id',NEW.job_id,'position_title',NEW.position_title,'current_step',NEW.current_step,
      'first_name',NEW.first_name,'middle_name',NEW.middle_name,'last_name',NEW.last_name,
      'email',NEW.email,'phone',NEW.phone,'city',NEW.city,'state',NEW.state,
      'postal_code',NEW.postal_code,'cdl_state',NEW.cdl_state,'cdl_class',NEW.cdl_class,
      'endorsements',NEW.endorsements,'years_experience',NEW.years_experience,
      'authorized_to_work',NEW.authorized_to_work,'how_did_you_hear',NEW.how_did_you_hear,
      'additional_notes',NEW.additional_notes,'signature_name',NEW.signature_name,
      'certified',NEW.certified);
    IF current_response IS DISTINCT FROM OLD.submitted_response_snapshot THEN
      RAISE EXCEPTION 'submitted application responses are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER applications_submission_immutable
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_submission_immutability();

CREATE OR REPLACE FUNCTION public.record_application_status_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_events (application_id,actor_id,event_type,description,metadata)
    VALUES (
      NEW.id,coalesce(auth.uid(),NEW.user_id),
      CASE WHEN NEW.status = 'submitted'::public.application_status
           THEN 'application_submitted' ELSE 'status_changed' END,
      CASE WHEN NEW.status = 'submitted'::public.application_status
           THEN 'Applicant submitted application' ELSE 'Recruiting status decision' END,
      jsonb_build_object('from',OLD.status::text,'to',NEW.status::text)
    );
    INSERT INTO public.security_audit_events
      (actor_id,action,target_type,target_id,old_status,new_status)
    VALUES (
      coalesce(auth.uid(),NEW.user_id),
      CASE WHEN NEW.status = 'submitted'::public.application_status
           THEN 'application_submitted' ELSE 'application_status_changed' END,
      'application',NEW.id::text,OLD.status::text,NEW.status::text
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER applications_status_audit
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_status_audit();

CREATE OR REPLACE FUNCTION public.guard_append_only_records()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'record is append-only';
END;
$$;
DROP TRIGGER IF EXISTS application_events_append_only ON public.application_events;
CREATE TRIGGER application_events_append_only
  BEFORE UPDATE OR DELETE ON public.application_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_records();
DROP TRIGGER IF EXISTS security_audit_append_only ON public.security_audit_events;
CREATE TRIGGER security_audit_append_only
  BEFORE UPDATE OR DELETE ON public.security_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_records();

CREATE OR REPLACE FUNCTION public.set_fadv_audit_fields()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fadv_handoffs_audit_fields ON public.fadv_handoffs;
CREATE TRIGGER fadv_handoffs_audit_fields
  BEFORE INSERT OR UPDATE ON public.fadv_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_fadv_audit_fields();

CREATE OR REPLACE FUNCTION public.set_acknowledgement_identity()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.acknowledged_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS announcement_ack_identity ON public.announcement_acknowledgements;
CREATE TRIGGER announcement_ack_identity BEFORE INSERT ON public.announcement_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.set_acknowledgement_identity();
DROP TRIGGER IF EXISTS safety_ack_identity ON public.safety_acknowledgements;
CREATE TRIGGER safety_ack_identity BEFORE INSERT ON public.safety_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.set_acknowledgement_identity();

CREATE OR REPLACE FUNCTION public.set_handbook_signature_identity()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.signed_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS handbook_signature_identity ON public.handbook_signatures;
CREATE TRIGGER handbook_signature_identity BEFORE INSERT ON public.handbook_signatures
  FOR EACH ROW EXECUTE FUNCTION public.set_handbook_signature_identity();

-- Notifications remain trigger-generated only. Existing trigger functions call
-- notify_user/notify_recruiting_staff as their privileged owner; arbitrary API
-- callers cannot execute those helpers. Revoke all other callable trigger funcs.
DO $revoke_trigger_exec$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('on_application_status_change','on_document_verification')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.signature);
  END LOOP;
END;
$revoke_trigger_exec$;

-- Private storage bucket; no direct anon/authenticated object policies. Upload,
-- download, delete, and signed URL operations require trusted server mediation.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('applicant-documents','applicant-documents',false,10485760,
        ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "own applicant docs read" ON storage.objects;
DROP POLICY IF EXISTS "own applicant docs insert" ON storage.objects;
DROP POLICY IF EXISTS "own applicant docs delete" ON storage.objects;
DROP POLICY IF EXISTS "staff read applicant docs" ON storage.objects;

-- The prior storage policy names have been dropped. No replacement client policy
-- is created; this is intentionally deny-by-default until the trusted uploader.

COMMIT;
