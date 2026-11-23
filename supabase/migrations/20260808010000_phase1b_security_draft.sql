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
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.status = 'active')
$$;
REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.is_active_user(_user_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = _role
     )
     AND (_role = 'developer'::public.app_role OR NOT EXISTS (
       SELECT 1 FROM public.user_roles dev
       WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role
     ));
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_user(_user_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'recruiter'::public.app_role,
                         'content_manager'::public.app_role)
     )
     AND NOT EXISTS (SELECT 1 FROM public.user_roles dev
                     WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_recruiting_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_user(_user_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'recruiter'::public.app_role)
     )
     AND NOT EXISTS (SELECT 1 FROM public.user_roles dev
                     WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_content_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_user(_user_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('administrator'::public.app_role,
                         'content_manager'::public.app_role)
     )
     AND NOT EXISTS (SELECT 1 FROM public.user_roles dev
                     WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_recruiting_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_content_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_recruiting_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_content_staff(uuid) TO authenticated, service_role;

-- Temporary developer grants are scoped to read-only public-content inspection; the
-- grant/revoke functions record an audit event and enforce a one-day maximum.
CREATE TABLE IF NOT EXISTS public.temporary_developer_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 1 AND 500),
  scope text NOT NULL CHECK (scope = 'public_content'),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
ALTER TABLE public.temporary_developer_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temporary_developer_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.temporary_developer_grants TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.is_active_user(_user_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = _role
     )
     AND _role <> 'developer'::public.app_role
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles dev
       WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role
     );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Add only token lifecycle and immutable submission metadata. These are
-- additive; no legacy user data is dropped. Trusted server code must generate
-- high-entropy raw tokens and store only SHA-256(token), never the raw token.
ALTER TABLE public.applications
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS preferred_contact_method text,
  ADD COLUMN IF NOT EXISTS is_18_or_older boolean,
  ADD COLUMN IF NOT EXISTS cdl_status text,
  ADD COLUMN IF NOT EXISTS commercial_experience_years numeric(4,1),
  ADD COLUMN IF NOT EXISTS tractor_trailer_experience boolean,
  ADD COLUMN IF NOT EXISTS linehaul_pd_experience boolean,
  ADD COLUMN IF NOT EXISTS schedule_availability text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_availability text,
  ADD COLUMN IF NOT EXISTS medical_card_status text,
  ADD COLUMN IF NOT EXISTS medical_card_expiration_month smallint,
  ADD COLUMN IF NOT EXISTS medical_card_expiration_year smallint,
  ADD COLUMN IF NOT EXISTS can_perform_duties_with_or_without_accommodation boolean,
  ADD COLUMN IF NOT EXISTS agrees_to_comply boolean,
  ADD COLUMN IF NOT EXISTS consent_electronic_records boolean,
  ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_gap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualification_gap_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resume_token_hash text,
  ADD COLUMN IF NOT EXISTS resume_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_response_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS recruiting_status text;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_contact_method_check
    CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email','phone','text')) NOT VALID,
  ADD CONSTRAINT applications_cdl_status_check
    CHECK (cdl_status IS NULL OR cdl_status IN ('valid_cdl','in_training','no_cdl')) NOT VALID,
  ADD CONSTRAINT applications_medical_card_status_check
    CHECK (medical_card_status IS NULL OR medical_card_status IN ('current','expired','none')) NOT VALID,
  ADD CONSTRAINT applications_medical_card_month_check
    CHECK (medical_card_expiration_month IS NULL OR medical_card_expiration_month BETWEEN 1 AND 12) NOT VALID,
  ADD CONSTRAINT applications_medical_card_year_check
    CHECK (medical_card_expiration_year IS NULL OR medical_card_expiration_year BETWEEN 2000 AND 2200) NOT VALID;

ALTER TABLE public.application_employers
  ADD COLUMN IF NOT EXISTS current_employer boolean,
  ADD COLUMN IF NOT EXISTS commercial_driving_relevant boolean,
  ADD COLUMN IF NOT EXISTS permission_to_contact boolean;

ALTER TABLE public.application_documents ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.application_documents
  ADD CONSTRAINT application_documents_approved_type_check
    CHECK (doc_type IN ('medical_card','resume')) NOT VALID,
  ADD CONSTRAINT application_documents_size_check
    CHECK (size_bytes IS NULL OR size_bytes BETWEEN 1 AND 10485760) NOT VALID;

UPDATE public.applications
SET recruiting_status = CASE status
  WHEN 'draft' THEN 'incomplete'
  WHEN 'submitted' THEN 'new'
  WHEN 'under_review' THEN 'ready_for_review'
  ELSE NULL
END
WHERE recruiting_status IS NULL;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_recruiting_status_check CHECK (
    recruiting_status IS NULL OR recruiting_status IN (
      'new','incomplete','ready_for_review','ready_to_invite_first_advantage',
      'first_advantage_invitation_sent','candidate_completing_first_advantage',
      'screening_complete_management_review','hired','rejected','archived'
    )
  ) NOT VALID;

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

CREATE TABLE IF NOT EXISTS public.application_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('medical_card','resume')),
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes BETWEEN 1 AND 10485760),
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
ALTER TABLE public.application_upload_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_upload_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.application_upload_intents TO service_role;

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

-- Remove inherited column-level grants from prior deployments before applying
-- the reviewed allowlists below; REVOKE table privileges alone does not do this.
DO $drop_column_grants$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY (ARRAY[
        'user_roles','profiles','applications','application_employers',
        'application_documents','application_notes','application_events',
        'screening_records','esign_records','drivers','notifications','audit_logs',
        'fadv_handoffs','security_audit_events','academy_modules','academy_progress',
        'handbook_sections','safety_resources','safety_acknowledgements','announcements',
        'announcement_acknowledgements','safety_meetings','safety_meeting_assignments',
        'handbook_versions','handbook_signatures','required_systems','media_assets',
        'lms_courses','lms_modules','lms_lessons','lms_quizzes',
        'lms_quiz_questions','lms_enrollments','lms_lesson_progress','lms_quiz_attempts'
      ])
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.%2$I FROM PUBLIC, anon, authenticated',
      c.column_name, c.table_name
    );
  END LOOP;
END;
$drop_column_grants$;

-- Applications have no direct applicant/anonymous table access. Recruiters can
-- read only the currently modeled application fields; legacy sensitive columns,
-- token material, and snapshots are deliberately excluded from column grants.
REVOKE ALL ON public.applications FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,user_id,job_id,position_title,reference_code,status,current_step,completed_steps,
  first_name,middle_name,last_name,preferred_name,email,phone,preferred_contact_method,
  city,state,postal_code,is_18_or_older,cdl_status,cdl_state,cdl_class,endorsements,
  commercial_experience_years,tractor_trailer_experience,linehaul_pd_experience,
  schedule_availability,start_availability,authorized_to_work,
  can_perform_duties_with_or_without_accommodation,medical_card_status,
  medical_card_expiration_month,medical_card_expiration_year,agrees_to_comply,
  consent_electronic_records,signature_name,signature_signed_at,certified,
  qualification_gap,qualification_gap_reasons,how_did_you_hear,
  submitted_at,created_at,updated_at,assigned_recruiter,priority,correction_notes,
  recruiting_status
) ON public.applications TO authenticated;
CREATE POLICY applications_recruiter_read ON public.applications
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_application_recruiting_status(
  _application_id uuid, _next_status text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE current_status text; application_state public.application_status;
BEGIN
  IF NOT public.is_recruiting_staff(auth.uid()) OR _next_status IS NULL OR _next_status NOT IN (
    'new','incomplete','ready_for_review','ready_to_invite_first_advantage',
    'first_advantage_invitation_sent','candidate_completing_first_advantage',
    'screening_complete_management_review','hired','rejected','archived'
  ) THEN
    RETURN false;
  END IF;
  SELECT recruiting_status,status INTO current_status,application_state
  FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND OR application_state <> 'submitted'::public.application_status THEN RETURN false; END IF;
  IF _next_status IN ('first_advantage_invitation_sent','candidate_completing_first_advantage')
     AND NOT EXISTS (
       SELECT 1 FROM public.fadv_handoffs h
       JOIN public.applications a ON a.id = h.application_id
       WHERE a.id = _application_id AND h.invitation_date IS NOT NULL
         AND h.recruiter_id IS NOT NULL
     ) THEN
    RETURN false;
  END IF;
  IF NOT (
    (current_status IS NULL AND _next_status IN ('new','incomplete','ready_for_review')) OR
    (current_status = 'new' AND _next_status IN ('incomplete','ready_for_review','archived')) OR
    (current_status = 'incomplete' AND _next_status IN ('ready_for_review','archived')) OR
    (current_status = 'ready_for_review' AND _next_status IN ('incomplete','ready_to_invite_first_advantage','archived')) OR
    (current_status = 'ready_to_invite_first_advantage' AND _next_status IN ('first_advantage_invitation_sent','incomplete','archived')) OR
    (current_status = 'first_advantage_invitation_sent' AND _next_status IN ('candidate_completing_first_advantage','screening_complete_management_review','archived')) OR
    (current_status = 'candidate_completing_first_advantage' AND _next_status IN ('screening_complete_management_review','archived')) OR
    (current_status = 'screening_complete_management_review' AND _next_status IN ('hired','rejected','archived'))
  ) THEN
    RETURN false;
  END IF;
  UPDATE public.applications SET recruiting_status = _next_status WHERE id = _application_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.update_application_recruiting_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_application_recruiting_status(uuid,text) TO authenticated;

-- All writes through ordinary application-related tables are server-only.
-- Human decisions stay explicit; no policy or trigger auto-hires/rejects.
REVOKE ALL ON public.application_employers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_employers TO authenticated;
CREATE POLICY employers_recruiter_read ON public.application_employers
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

REVOKE ALL ON public.application_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,application_id,doc_type,file_name,mime_type,size_bytes,created_at,
              verification_status,rejection_reason,verified_by,verified_at)
  ON public.application_documents TO authenticated;
CREATE POLICY documents_recruiter_read ON public.application_documents
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.verify_application_document(
  _document_id uuid, _status text, _rejection_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE application_id uuid;
BEGIN
  IF NOT public.is_recruiting_staff(auth.uid())
     OR _status NOT IN ('pending','approved','rejected')
     OR (_status <> 'rejected' AND _rejection_reason IS NOT NULL)
     OR length(_rejection_reason) > 500 THEN
    RETURN false;
  END IF;
  UPDATE public.application_documents d
    SET verification_status = _status,
        rejection_reason = CASE WHEN _status = 'rejected' THEN _rejection_reason END,
        verified_by = auth.uid(),
        verified_at = now()
    WHERE d.id = _document_id
    RETURNING d.application_id INTO application_id;
  IF application_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.application_events(application_id,actor_id,event_type,description,metadata)
    VALUES (application_id,auth.uid(),'document_' || _status,'Document verification updated',
            jsonb_build_object('document_id',_document_id));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_application_document(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_application_document(uuid,text,text) TO authenticated;

REVOKE ALL ON public.application_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_notes TO authenticated;
GRANT INSERT (application_id,body) ON public.application_notes TO authenticated;
CREATE POLICY notes_recruiter_read ON public.application_notes
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY notes_recruiter_insert ON public.application_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_recruiting_staff(auth.uid()) AND author_id = auth.uid());
CREATE OR REPLACE FUNCTION public.set_application_note_actor()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.author_id := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER application_notes_actor BEFORE INSERT ON public.application_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_application_note_actor();

REVOKE ALL ON public.application_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_events TO authenticated;
CREATE POLICY events_recruiter_read ON public.application_events
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

REVOKE ALL ON public.screening_records FROM PUBLIC, anon, authenticated;
-- Legacy screening rows/columns remain untouched and inaccessible to API roles.

REVOKE ALL ON public.esign_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.esign_records TO authenticated;
GRANT INSERT (application_id,document_name,status,envelope_reference,sent_at,completed_at,notes)
  ON public.esign_records TO authenticated;
GRANT UPDATE (document_name,status,envelope_reference,sent_at,completed_at,notes)
  ON public.esign_records TO authenticated;
CREATE POLICY esign_recruiter_read ON public.esign_records
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY esign_recruiter_insert ON public.esign_records
  FOR INSERT TO authenticated WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE POLICY esign_recruiter_update ON public.esign_records
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.set_esign_audit_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER esign_audit_fields BEFORE INSERT OR UPDATE ON public.esign_records
  FOR EACH ROW EXECUTE FUNCTION public.set_esign_audit_fields();

-- First Advantage handoff data is a separate minimal record; existing
-- screening_records remain preserved but unavailable to client roles.
REVOKE ALL ON public.fadv_handoffs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fadv_handoffs TO authenticated;
GRANT INSERT (application_id,invitation_date,external_reference,next_check_date)
  ON public.fadv_handoffs TO authenticated;
GRANT UPDATE (invitation_date,external_reference,next_check_date)
  ON public.fadv_handoffs TO authenticated;
CREATE POLICY fadv_recruiter_read ON public.fadv_handoffs
  FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY fadv_recruiter_insert ON public.fadv_handoffs
  FOR INSERT TO authenticated WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE POLICY fadv_recruiter_update ON public.fadv_handoffs
  FOR UPDATE TO authenticated USING (public.is_recruiting_staff(auth.uid()))
  WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- Role and profile data. A content manager gets no employee directory access;
-- users can only see/update a limited set of their own profile columns.
REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
CREATE OR REPLACE FUNCTION public.has_developer_role_marker(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles dev
    WHERE dev.user_id = auth.uid() AND dev.role = 'developer'::public.app_role
  )
$$;
REVOKE ALL ON FUNCTION public.has_developer_role_marker(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_developer_role_marker(uuid) TO authenticated, service_role;

CREATE POLICY roles_self_or_admin_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND role <> 'developer'::public.app_role
      AND NOT public.has_developer_role_marker(auth.uid()))
    OR public.has_role(auth.uid(),'administrator'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _user_id uuid, _role public.app_role, _grant boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'administrator'::public.app_role)
     OR _user_id = auth.uid() OR _role = 'developer'::public.app_role
     OR (_grant AND EXISTS (
       SELECT 1 FROM public.user_roles dev
       WHERE dev.user_id = _user_id AND dev.role = 'developer'::public.app_role
     )) THEN
    RETURN false;
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id,role,granted_by)
      VALUES (_user_id,_role,auth.uid()) ON CONFLICT (user_id,role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    VALUES (auth.uid(),CASE WHEN _grant THEN 'role_granted' ELSE 'role_revoked' END,
            'user',_user_id::text);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid,public.app_role,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid,public.app_role,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_temporary_developer_scope(_user_id uuid,_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.is_active_user(_user_id) AND _scope = 'public_content'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role <> 'developer'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.temporary_developer_grants g
                WHERE g.user_id = auth.uid() AND g.scope = _scope
                  AND g.revoked_at IS NULL AND now() < g.expires_at);
$$;
REVOKE ALL ON FUNCTION public.has_temporary_developer_scope(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_temporary_developer_scope(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_temporary_public_content_access(
  _user_id uuid,_purpose text,_duration interval
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'administrator'::public.app_role)
     OR _user_id = auth.uid() OR length(btrim(_purpose)) NOT BETWEEN 1 AND 500
     OR _duration <= interval '0' OR _duration > interval '24 hours'
     OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id
                AND ur.role <> 'developer'::public.app_role) THEN
    RETURN false;
  END IF;
  INSERT INTO public.temporary_developer_grants(user_id,granted_by,purpose,scope,expires_at)
    VALUES (_user_id,auth.uid(),_purpose,'public_content',now()+_duration);
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    VALUES (auth.uid(),'temporary_developer_access_granted','user',_user_id::text);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_temporary_public_content_access(uuid,text,interval) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_temporary_public_content_access(uuid,text,interval) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_temporary_developer_access(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'administrator'::public.app_role) THEN RETURN false; END IF;
  UPDATE public.temporary_developer_grants SET revoked_at = now()
    WHERE user_id = _user_id AND revoked_at IS NULL;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'developer'::public.app_role;
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    VALUES (auth.uid(),'temporary_developer_access_revoked','user',_user_id::text);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_temporary_developer_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_temporary_developer_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_expired_temporary_developer_access()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE removed_roles integer;
BEGIN
  WITH expired AS (
    UPDATE public.temporary_developer_grants
    SET revoked_at = expires_at
    WHERE revoked_at IS NULL AND expires_at <= now()
    RETURNING user_id
  )
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    SELECT NULL,'temporary_developer_access_expired','user',expired_users.user_id::text
    FROM (SELECT DISTINCT user_id FROM expired) expired_users;

  WITH removed AS (
    DELETE FROM public.user_roles ur
    WHERE ur.role = 'developer'::public.app_role
      AND NOT EXISTS (
        SELECT 1 FROM public.temporary_developer_grants g
        WHERE g.user_id = ur.user_id AND g.revoked_at IS NULL AND now() < g.expires_at
      )
    RETURNING ur.user_id
  )
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    SELECT NULL,'temporary_developer_role_marker_cleaned','user',removed.user_id::text
    FROM removed;
  GET DIAGNOSTICS removed_roles = ROW_COUNT;
  RETURN removed_roles;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_temporary_developer_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_temporary_developer_access() TO service_role;

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,email,full_name,preferred_name,phone,title,avatar_url,status,created_at,updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (full_name,preferred_name,phone,avatar_url)
  ON public.profiles TO authenticated;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'administrator'::public.app_role));
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_active_user(auth.uid()))
  WITH CHECK (id = auth.uid() AND public.is_active_user(auth.uid()));

-- Driver records are self-readable; only emergency contact is self-editable.
REVOKE ALL ON public.drivers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.drivers TO authenticated;
GRANT UPDATE (emergency_contact_name,emergency_contact_phone) ON public.drivers TO authenticated;
CREATE POLICY drivers_self_read ON public.drivers
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() AND status = 'active'
    AND public.has_role(auth.uid(),'driver'::public.app_role)
  );
CREATE POLICY drivers_admin_read ON public.drivers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'administrator'::public.app_role));
CREATE POLICY drivers_self_update ON public.drivers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'active'
    AND public.has_role(auth.uid(),'driver'::public.app_role))
  WITH CHECK (user_id = auth.uid() AND status = 'active'
    AND public.has_role(auth.uid(),'driver'::public.app_role));

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

CREATE OR REPLACE FUNCTION public.on_document_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status IN ('approved','rejected') THEN
    PERFORM public.notify_user(
      NEW.user_id,'document_' || NEW.verification_status,
      'Application document review updated',NULL,'/apply');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_application_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.user_id,'application_status','Your 52 Logistics application was updated',
      'Reference: ' || NEW.reference_code || '; status: ' || NEW.status::text,
      '/apply');
  END IF;
  RETURN NEW;
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
  USING (published AND status = 'open' AND archived_at IS NULL);
CREATE POLICY jobs_content_manage ON public.jobs FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY page_content_public_read ON public.page_content FOR SELECT TO anon, authenticated
  USING (published AND approval_status = 'approved');
CREATE POLICY page_content_content_manage ON public.page_content FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY page_content_temp_developer_read ON public.page_content FOR SELECT TO authenticated
  USING (published AND approval_status = 'approved'
    AND public.has_temporary_developer_scope(auth.uid(),'public_content'));
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
  public.announcements, public.safety_meetings, public.required_systems TO authenticated;
GRANT SELECT (id,version_label,title,description,effective_date,requires_signature,
              published,archived_at,created_at,updated_at)
  ON public.handbook_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academy_modules, public.handbook_sections,
  public.safety_resources, public.announcements, public.safety_meetings,
  public.handbook_versions, public.required_systems, public.media_assets TO authenticated;
GRANT SELECT ON public.announcement_acknowledgements, public.safety_acknowledgements,
  public.safety_meeting_assignments, public.handbook_signatures TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.safety_meeting_assignments TO authenticated;
GRANT SELECT ON public.media_assets TO authenticated;

CREATE POLICY academy_driver_read ON public.academy_modules FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY academy_content_manage ON public.academy_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY handbook_driver_read ON public.handbook_sections FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY handbook_content_manage ON public.handbook_sections FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY safety_driver_read ON public.safety_resources FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY safety_content_manage ON public.safety_resources FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY announcements_driver_read ON public.announcements FOR SELECT TO authenticated
  USING (published AND status = 'published'
    AND (publish_at IS NULL OR publish_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND audience IN ('driver','drivers','all_drivers')
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY announcements_content_manage ON public.announcements FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY meetings_driver_read ON public.safety_meetings FOR SELECT TO authenticated
  USING (status = 'published' AND audience IN ('driver','drivers','all_drivers')
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active')
    AND EXISTS (SELECT 1 FROM public.safety_meeting_assignments ma
                WHERE ma.meeting_id = safety_meetings.id AND ma.user_id = auth.uid()));
CREATE POLICY meetings_content_manage ON public.safety_meetings FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY handbook_versions_driver_read ON public.handbook_versions FOR SELECT TO authenticated
  USING (published AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY handbook_versions_content_manage ON public.handbook_versions FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY handbook_versions_path_content_only ON public.handbook_versions
  FOR SELECT TO authenticated USING (public.is_content_staff(auth.uid()));
CREATE POLICY required_systems_driver_read ON public.required_systems FOR SELECT TO authenticated
  USING (published AND audience = 'drivers'
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY required_systems_content_manage ON public.required_systems FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY media_content_read ON public.media_assets FOR SELECT TO authenticated
  USING (public.is_content_staff(auth.uid()));
CREATE POLICY media_content_manage ON public.media_assets FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- Acknowledgements and signatures are read-only to clients. Trusted, identity-bound
-- server RPCs are required to record actor, signed version, and evidence atomically.
-- Assignment and progress mutations remain server-only pending the Academy RPC phase.
CREATE POLICY announcement_ack_self_read ON public.announcement_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY safety_ack_self_read ON public.safety_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY handbook_signatures_self_read ON public.handbook_signatures
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY meeting_assignment_self_read ON public.safety_meeting_assignments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() AND public.has_role(auth.uid(),'driver'::public.app_role)
  );
CREATE POLICY meeting_assignment_content_manage ON public.safety_meeting_assignments
  FOR ALL TO authenticated USING (public.is_content_staff(auth.uid()))
  WITH CHECK (public.is_content_staff(auth.uid()));
-- Drivers have no UPDATE privilege on attended_at or assignment state; acknowledgements
-- remain separate append-only records.

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
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY lms_courses_content_manage ON public.lms_courses FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_modules_driver_read ON public.lms_modules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY lms_modules_content_only ON public.lms_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_lessons_driver_read ON public.lms_lessons FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
CREATE POLICY lms_lessons_content_only ON public.lms_lessons FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE POLICY lms_quizzes_driver_read ON public.lms_quizzes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.lms_courses c
      WHERE c.id = course_id AND c.published AND c.archived_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active'));
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
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active')
  );
CREATE POLICY lms_progress_self_read ON public.lms_lesson_progress
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active')
  );
CREATE POLICY lms_attempts_self_read ON public.lms_quiz_attempts
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND public.has_role(auth.uid(),'driver'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'active')
  );

-- Token-only applicant RPCs are service-role-only. The trusted server API must
-- enforce shared rate limits, generic token failures, and raw-token log redaction
-- before invoking them; no direct anonymous table or RPC access is granted.
-- See the Phase 1B server contract for endpoint payload mapping and rate-limit policy.
CREATE OR REPLACE FUNCTION public.start_public_application(_job_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions, pg_temp AS $$
DECLARE raw_token text; new_reference text; new_id uuid; position text; attempt integer;
BEGIN
  IF _job_id IS NULL THEN RETURN NULL; END IF;
  SELECT j.position INTO position FROM public.jobs j
  WHERE j.id = _job_id AND j.published AND j.archived_at IS NULL AND j.status = 'open';
  IF NOT FOUND THEN RETURN NULL; END IF;
  FOR attempt IN 1..100 LOOP
    raw_token := encode(extensions.gen_random_bytes(32),'hex');
    new_reference := '52L-' || upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    new_id := gen_random_uuid();
    BEGIN
      INSERT INTO public.applications
        (id,user_id,job_id,position_title,reference_code,status,recruiting_status,
         current_step,created_at,updated_at,resume_token_hash,resume_expires_at)
      VALUES (new_id,NULL,_job_id,position,new_reference,'draft','incomplete',1,now(),now(),
        encode(extensions.digest(convert_to(raw_token,'UTF8'),'sha256'),'hex'),now()+interval '7 days');
      RETURN jsonb_build_object('reference_code',new_reference,'resume_token',raw_token);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

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
    'reference_code',a.reference_code,'job_id',a.job_id,'position_title',a.position_title,
    'current_step',a.current_step,
    'first_name',a.first_name,'middle_name',a.middle_name,'last_name',a.last_name,
    'preferred_name',a.preferred_name,'email',a.email,'phone',a.phone,
    'preferred_contact_method',a.preferred_contact_method,
    'city',a.city,'state',a.state,'postal_code',a.postal_code,
    'is_18_or_older',a.is_18_or_older,'cdl_status',a.cdl_status,
    'cdl_state',a.cdl_state,'cdl_class',a.cdl_class,'endorsements',a.endorsements,
    'commercial_experience_years',a.commercial_experience_years,
    'tractor_trailer_experience',a.tractor_trailer_experience,
    'linehaul_pd_experience',a.linehaul_pd_experience,
    'schedule_availability',a.schedule_availability,'start_availability',a.start_availability,
    'authorized_to_work',a.authorized_to_work,
    'can_perform_duties_with_or_without_accommodation',a.can_perform_duties_with_or_without_accommodation,
    'medical_card_status',a.medical_card_status,
    'medical_card_expiration_month',a.medical_card_expiration_month,
    'medical_card_expiration_year',a.medical_card_expiration_year,
    'agrees_to_comply',a.agrees_to_comply,
    'consent_electronic_records',a.consent_electronic_records,
    'signature_name',a.signature_name,'signature_signed_at',a.signature_signed_at,
    'certified',a.certified,'qualification_gap',a.qualification_gap,
    'qualification_gap_reasons',a.qualification_gap_reasons,
    'how_did_you_hear',a.how_did_you_hear,
    'documents',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',d.id,'doc_type',d.doc_type,'file_name',d.file_name,
      'mime_type',d.mime_type,'size_bytes',d.size_bytes)
      ORDER BY d.created_at)
      FROM public.application_documents d WHERE d.application_id=a.id), '[]'::jsonb),
    'employers',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'employer_name',e.employer_name,'position_held',e.position_held,
      'city',e.city,'state',e.state,'phone',e.phone,'start_date',e.start_date,
      'end_date',e.end_date,'reason_for_leaving',e.reason_for_leaving,
      'was_dot_regulated',e.was_dot_regulated,'current_employer',e.current_employer,
      'commercial_driving_relevant',e.commercial_driving_relevant,
      'permission_to_contact',e.permission_to_contact,'equipment_operated',e.equipment_operated
    ) ORDER BY e.sort_order) FROM public.application_employers e
       WHERE e.application_id = a.id), '[]'::jsonb)
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
       'job_id','current_step','first_name','middle_name','last_name',
       'preferred_name','email','phone','preferred_contact_method','city','state','postal_code',
       'is_18_or_older','cdl_status','cdl_state','cdl_class','endorsements',
       'commercial_experience_years','tractor_trailer_experience','linehaul_pd_experience',
       'schedule_availability','start_availability','authorized_to_work',
       'can_perform_duties_with_or_without_accommodation','medical_card_status',
       'medical_card_expiration_month','medical_card_expiration_year','agrees_to_comply',
       'consent_electronic_records','how_did_you_hear'
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
  IF _patch ? 'job_id' AND NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = patched.job_id AND j.published AND j.archived_at IS NULL AND j.status = 'open'
  ) THEN RETURN false; END IF;
  IF (_patch ? 'current_step' AND patched.current_step NOT BETWEEN 1 AND 6)
     OR (_patch ? 'preferred_name' AND length(patched.preferred_name) > 80)
     OR (_patch ? 'preferred_contact_method' AND patched.preferred_contact_method NOT IN ('email','phone','text'))
     OR (_patch ? 'is_18_or_older' AND patched.is_18_or_older IS NULL)
     OR (_patch ? 'cdl_status' AND patched.cdl_status NOT IN ('valid_cdl','in_training','no_cdl'))
     OR (_patch ? 'medical_card_status' AND patched.medical_card_status NOT IN ('current','expired','none'))
     OR (_patch ? 'medical_card_expiration_month' AND patched.medical_card_expiration_month NOT BETWEEN 1 AND 12)
     OR (_patch ? 'medical_card_expiration_year' AND patched.medical_card_expiration_year NOT BETWEEN 2000 AND 2200)
     OR (_patch ? 'start_availability' AND length(patched.start_availability) > 160)
     OR (_patch ? 'commercial_experience_years' AND
         (patched.commercial_experience_years < 0 OR patched.commercial_experience_years > 60))
     OR (_patch ? 'schedule_availability' AND cardinality(patched.schedule_availability) > 20)
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
     OR EXISTS (SELECT 1 FROM unnest(patched.endorsements) AS endorsement WHERE length(endorsement) > 60)
     OR EXISTS (SELECT 1 FROM unnest(patched.schedule_availability) AS slot WHERE length(slot) > 160)
     THEN
    RETURN false;
  END IF;
  UPDATE public.applications a SET
    job_id = CASE WHEN _patch ? 'job_id' THEN patched.job_id ELSE a.job_id END,
    position_title = CASE WHEN _patch ? 'job_id' THEN (SELECT j.position FROM public.jobs j WHERE j.id = patched.job_id) ELSE a.position_title END,
    current_step = CASE WHEN _patch ? 'current_step' THEN patched.current_step ELSE a.current_step END,
    first_name = CASE WHEN _patch ? 'first_name' THEN patched.first_name ELSE a.first_name END,
    middle_name = CASE WHEN _patch ? 'middle_name' THEN patched.middle_name ELSE a.middle_name END,
    last_name = CASE WHEN _patch ? 'last_name' THEN patched.last_name ELSE a.last_name END,
    preferred_name = CASE WHEN _patch ? 'preferred_name' THEN patched.preferred_name ELSE a.preferred_name END,
    email = CASE WHEN _patch ? 'email' THEN patched.email ELSE a.email END,
    phone = CASE WHEN _patch ? 'phone' THEN patched.phone ELSE a.phone END,
    preferred_contact_method = CASE WHEN _patch ? 'preferred_contact_method' THEN patched.preferred_contact_method ELSE a.preferred_contact_method END,
    city = CASE WHEN _patch ? 'city' THEN patched.city ELSE a.city END,
    state = CASE WHEN _patch ? 'state' THEN patched.state ELSE a.state END,
    postal_code = CASE WHEN _patch ? 'postal_code' THEN patched.postal_code ELSE a.postal_code END,
    is_18_or_older = CASE WHEN _patch ? 'is_18_or_older' THEN patched.is_18_or_older ELSE a.is_18_or_older END,
    cdl_status = CASE WHEN _patch ? 'cdl_status' THEN patched.cdl_status ELSE a.cdl_status END,
    cdl_state = CASE WHEN _patch ? 'cdl_state' THEN patched.cdl_state ELSE a.cdl_state END,
    cdl_class = CASE WHEN _patch ? 'cdl_class' THEN patched.cdl_class ELSE a.cdl_class END,
    endorsements = CASE WHEN _patch ? 'endorsements' THEN patched.endorsements ELSE a.endorsements END,
    commercial_experience_years = CASE WHEN _patch ? 'commercial_experience_years' THEN patched.commercial_experience_years ELSE a.commercial_experience_years END,
    tractor_trailer_experience = CASE WHEN _patch ? 'tractor_trailer_experience' THEN patched.tractor_trailer_experience ELSE a.tractor_trailer_experience END,
    linehaul_pd_experience = CASE WHEN _patch ? 'linehaul_pd_experience' THEN patched.linehaul_pd_experience ELSE a.linehaul_pd_experience END,
    schedule_availability = CASE WHEN _patch ? 'schedule_availability' THEN patched.schedule_availability ELSE a.schedule_availability END,
    start_availability = CASE WHEN _patch ? 'start_availability' THEN patched.start_availability ELSE a.start_availability END,
    authorized_to_work = CASE WHEN _patch ? 'authorized_to_work' THEN patched.authorized_to_work ELSE a.authorized_to_work END,
    can_perform_duties_with_or_without_accommodation = CASE WHEN _patch ? 'can_perform_duties_with_or_without_accommodation' THEN patched.can_perform_duties_with_or_without_accommodation ELSE a.can_perform_duties_with_or_without_accommodation END,
    medical_card_status = CASE WHEN _patch ? 'medical_card_status' THEN patched.medical_card_status ELSE a.medical_card_status END,
    medical_card_expiration_month = CASE WHEN _patch ? 'medical_card_expiration_month' THEN patched.medical_card_expiration_month ELSE a.medical_card_expiration_month END,
    medical_card_expiration_year = CASE WHEN _patch ? 'medical_card_expiration_year' THEN patched.medical_card_expiration_year ELSE a.medical_card_expiration_year END,
    agrees_to_comply = CASE WHEN _patch ? 'agrees_to_comply' THEN patched.agrees_to_comply ELSE a.agrees_to_comply END,
    consent_electronic_records = CASE WHEN _patch ? 'consent_electronic_records' THEN patched.consent_electronic_records ELSE a.consent_electronic_records END,
    how_did_you_hear = CASE WHEN _patch ? 'how_did_you_hear' THEN patched.how_did_you_hear ELSE a.how_did_you_hear END,
    updated_at = now()
  WHERE a.id = app_id;
  RETURN FOUND;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS application_documents_storage_path_key
  ON public.application_documents(storage_path);

CREATE OR REPLACE FUNCTION public.save_application_employers(_token text,_employers jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE app_id uuid; item jsonb; employer public.application_employers; employer_order integer;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512
     OR _employers IS NULL OR jsonb_typeof(_employers) <> 'array'
     OR jsonb_array_length(_employers) > 10 THEN
    RETURN false;
  END IF;
  SELECT id INTO app_id FROM public.applications
  WHERE resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND resume_expires_at > now() AND resume_revoked_at IS NULL
    AND resume_consumed_at IS NULL AND status = 'draft'::public.application_status
  FOR UPDATE;
  IF app_id IS NULL THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(_employers) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR (item - ARRAY['employer_name','position_held','city','state','phone','start_date',
          'end_date','reason_for_leaving','was_dot_regulated','current_employer',
          'commercial_driving_relevant','permission_to_contact','equipment_operated']::text[]) <> '{}'::jsonb THEN
      RETURN false;
    END IF;
    employer := jsonb_populate_record(NULL::public.application_employers,item);
    IF employer.employer_name IS NULL OR length(btrim(employer.employer_name)) NOT BETWEEN 1 AND 160
       OR length(employer.position_held) > 120 OR length(employer.city) > 80
       OR length(employer.state) > 40 OR length(employer.phone) > 40
       OR length(employer.reason_for_leaving) > 400 OR length(employer.equipment_operated) > 200 THEN
      RETURN false;
    END IF;
  END LOOP;
  DELETE FROM public.application_employers WHERE application_id = app_id;
  FOR item, employer_order IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(_employers) WITH ORDINALITY AS entries(value,ordinality)
  LOOP
    employer := jsonb_populate_record(NULL::public.application_employers,item);
    INSERT INTO public.application_employers(
      application_id,employer_name,position_held,city,state,phone,start_date,end_date,
      reason_for_leaving,was_dot_regulated,current_employer,commercial_driving_relevant,
      permission_to_contact,equipment_operated,sort_order)
    VALUES(app_id,btrim(employer.employer_name),employer.position_held,employer.city,employer.state,
      employer.phone,employer.start_date,employer.end_date,employer.reason_for_leaving,
      coalesce(employer.was_dot_regulated,true),employer.current_employer,
      employer.commercial_driving_relevant,employer.permission_to_contact,
      employer.equipment_operated,employer_order);
  END LOOP;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_application_upload_target(
  _token text,_doc_type text,_file_name text,_mime_type text,_size_bytes bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp AS $$
DECLARE app public.applications; suffix text; object_path text; intent_id uuid; intent_expires_at timestamptz;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512
     OR _doc_type IS NULL OR _doc_type NOT IN ('medical_card','resume')
     OR _file_name IS NULL OR length(_file_name) > 255
     OR _mime_type NOT IN ('application/pdf','image/jpeg','image/png')
     OR _size_bytes NOT BETWEEN 1 AND 10485760 THEN RETURN NULL; END IF;
  suffix := lower(split_part(_file_name,'.',-1));
  IF NOT ((_mime_type = 'application/pdf' AND suffix = 'pdf') OR
          (_mime_type = 'image/jpeg' AND suffix IN ('jpg','jpeg')) OR
          (_mime_type = 'image/png' AND suffix = 'png')) THEN RETURN NULL; END IF;
  SELECT * INTO app FROM public.applications a
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now() AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL AND a.status = 'draft'::public.application_status
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  object_path := 'applicant/' || encode(extensions.gen_random_bytes(32),'hex') || '.' || suffix;
  intent_expires_at := now()+interval '10 minutes';
  INSERT INTO public.application_upload_intents(
    application_id,doc_type,file_name,mime_type,expected_size_bytes,storage_path,expires_at
  ) VALUES(app.id,_doc_type,_file_name,_mime_type,_size_bytes,object_path,intent_expires_at)
  RETURNING id INTO intent_id;
  RETURN jsonb_build_object('intent_id',intent_id,'storage_path',object_path,
                            'expires_at',intent_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_application_document(_token text,_intent_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions, pg_temp AS $$
DECLARE app public.applications; intent public.application_upload_intents; actual_size bigint;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN RETURN false; END IF;
  SELECT * INTO app FROM public.applications a
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now() AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL AND a.status = 'draft'::public.application_status
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO intent FROM public.application_upload_intents i
  WHERE i.id = _intent_id AND i.application_id = app.id AND i.consumed_at IS NULL
    AND i.expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT (o.metadata->>'size')::bigint INTO actual_size FROM storage.objects o
  WHERE o.bucket_id = 'applicant-documents' AND o.name = intent.storage_path
    AND o.metadata->>'mimetype' = intent.mime_type;
  IF actual_size IS DISTINCT FROM intent.expected_size_bytes THEN RETURN false; END IF;
  INSERT INTO public.application_documents(
    application_id,user_id,doc_type,storage_path,file_name,mime_type,size_bytes,verification_status
  ) VALUES(app.id,app.user_id,intent.doc_type,intent.storage_path,intent.file_name,
           intent.mime_type,actual_size,'pending');
  UPDATE public.application_upload_intents SET consumed_at = now() WHERE id = intent.id;
  RETURN true;
EXCEPTION WHEN unique_violation OR invalid_text_representation THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_application_document(_token text,_document_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions, pg_temp AS $$
DECLARE app_id uuid; object_path text;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN RETURN NULL; END IF;
  SELECT id INTO app_id FROM public.applications
  WHERE resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND resume_expires_at > now() AND resume_revoked_at IS NULL
    AND resume_consumed_at IS NULL AND status = 'draft'::public.application_status
  FOR UPDATE;
  IF app_id IS NULL THEN RETURN NULL; END IF;
  SELECT storage_path INTO object_path FROM public.application_documents
  WHERE id = _document_id AND application_id = app_id;
  RETURN object_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_application_document_deletion(
  _token text,_document_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions, pg_temp AS $$
DECLARE app_id uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN RETURN false; END IF;
  SELECT id INTO app_id FROM public.applications
  WHERE resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND resume_expires_at > now() AND resume_revoked_at IS NULL
    AND resume_consumed_at IS NULL AND status = 'draft'::public.application_status
  FOR UPDATE;
  IF app_id IS NULL THEN RETURN false; END IF;
  DELETE FROM public.application_documents WHERE id = _document_id AND application_id = app_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_application_resume_token(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions, pg_temp AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512 THEN RETURN false; END IF;
  UPDATE public.applications
  SET resume_revoked_at = now(), updated_at = now()
  WHERE resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND resume_expires_at > now() AND resume_revoked_at IS NULL
    AND resume_consumed_at IS NULL AND status = 'draft'::public.application_status;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_application_draft(_token text,_signature_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE app public.applications; gap_reasons text[] := '{}';
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 512
     OR _signature_name IS NULL OR length(btrim(_signature_name)) NOT BETWEEN 2 AND 120 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO app FROM public.applications a
  WHERE a.resume_token_hash = encode(extensions.digest(convert_to(_token,'UTF8'),'sha256'),'hex')
    AND a.resume_expires_at > now() AND a.resume_revoked_at IS NULL
    AND a.resume_consumed_at IS NULL AND a.status = 'draft'::public.application_status
  FOR UPDATE;
  IF NOT FOUND OR app.job_id IS NULL OR app.first_name IS NULL OR app.last_name IS NULL
     OR app.email IS NULL OR app.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
     OR app.phone IS NULL OR app.city IS NULL OR app.state IS NULL OR app.postal_code IS NULL
     OR app.is_18_or_older IS DISTINCT FROM true OR app.authorized_to_work IS NULL
     OR app.cdl_status IS NULL OR app.cdl_class IS NULL OR app.cdl_state IS NULL
     OR app.commercial_experience_years IS NULL OR app.tractor_trailer_experience IS NULL
     OR app.linehaul_pd_experience IS NULL OR cardinality(app.schedule_availability) = 0
     OR app.start_availability IS NULL
     OR app.can_perform_duties_with_or_without_accommodation IS NULL
     OR app.medical_card_status IS NULL
     OR (app.medical_card_status = 'current' AND
         (app.medical_card_expiration_month IS NULL
          OR app.medical_card_expiration_month NOT BETWEEN 1 AND 12
          OR app.medical_card_expiration_year IS NULL
          OR app.medical_card_expiration_year NOT BETWEEN 2000 AND 2200))
     OR app.agrees_to_comply IS DISTINCT FROM true
     OR app.preferred_contact_method IS NULL OR app.consent_electronic_records IS DISTINCT FROM true
     OR lower(btrim(_signature_name)) NOT IN (
       lower(btrim(concat_ws(' ',app.first_name,app.last_name))),
       lower(btrim(concat_ws(' ',app.first_name,app.middle_name,app.last_name)))
     )
     OR NOT EXISTS (SELECT 1 FROM public.application_employers e
       WHERE e.application_id=app.id AND e.employer_name IS NOT NULL
         AND e.position_held IS NOT NULL AND e.start_date IS NOT NULL
         AND e.current_employer IS NOT NULL AND e.commercial_driving_relevant IS NOT NULL
         AND e.permission_to_contact IS NOT NULL AND e.reason_for_leaving IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  IF app.is_18_or_older IS DISTINCT FROM true THEN
    gap_reasons := array_append(gap_reasons,'Applicant did not confirm they are at least 18 years old.');
  END IF;
  IF app.authorized_to_work IS DISTINCT FROM true THEN
    gap_reasons := array_append(gap_reasons,'Applicant did not confirm authorization to work in the United States.');
  END IF;
  IF app.cdl_status IS DISTINCT FROM 'valid_cdl' THEN
    gap_reasons := array_append(gap_reasons,'CDL status: ' || coalesce(app.cdl_status,'not provided') || '.');
  END IF;
  IF app.commercial_experience_years = 0 THEN
    gap_reasons := array_append(gap_reasons,'No commercial driving experience reported.');
  END IF;
  IF app.tractor_trailer_experience IS FALSE THEN
    gap_reasons := array_append(gap_reasons,'No tractor-trailer experience reported.');
  END IF;
  IF app.linehaul_pd_experience IS FALSE THEN
    gap_reasons := array_append(gap_reasons,'No linehaul or pickup-and-delivery experience reported.');
  END IF;
  IF app.can_perform_duties_with_or_without_accommodation IS DISTINCT FROM true THEN
    gap_reasons := array_append(gap_reasons,'Applicant indicated they may be unable to perform essential job functions with or without reasonable accommodation.');
  END IF;
  IF app.medical_card_status IS DISTINCT FROM 'current' THEN
    gap_reasons := array_append(gap_reasons,'DOT medical card status: ' || coalesce(app.medical_card_status,'not provided') || '.');
  ELSIF make_date(app.medical_card_expiration_year,app.medical_card_expiration_month,1)
        + interval '1 month' - interval '1 day' < current_date THEN
    gap_reasons := array_append(gap_reasons,'DOT medical card expiration date has passed.');
  END IF;

  UPDATE public.applications a
  SET signature_name = btrim(_signature_name), signature_signed_at = now(), certified = true,
      qualification_gap = cardinality(gap_reasons) > 0,
      qualification_gap_reasons = gap_reasons,
      current_step = 6, status = 'submitted'::public.application_status,
      recruiting_status = 'new', submitted_at = now(), resume_consumed_at = now(),
      submitted_response_snapshot = jsonb_build_object(
        'job_id',a.job_id,'position_title',a.position_title,'current_step',6,
        'first_name',a.first_name,'middle_name',a.middle_name,'last_name',a.last_name,
        'preferred_name',a.preferred_name,'email',a.email,'phone',a.phone,
        'preferred_contact_method',a.preferred_contact_method,'city',a.city,'state',a.state,
        'postal_code',a.postal_code,'is_18_or_older',a.is_18_or_older,'cdl_status',a.cdl_status,
        'cdl_state',a.cdl_state,'cdl_class',a.cdl_class,'endorsements',a.endorsements,
        'commercial_experience_years',a.commercial_experience_years,
        'tractor_trailer_experience',a.tractor_trailer_experience,
        'linehaul_pd_experience',a.linehaul_pd_experience,'schedule_availability',a.schedule_availability,
        'start_availability',a.start_availability,'authorized_to_work',a.authorized_to_work,
        'can_perform_duties_with_or_without_accommodation',a.can_perform_duties_with_or_without_accommodation,
        'medical_card_status',a.medical_card_status,'medical_card_expiration_month',a.medical_card_expiration_month,
        'medical_card_expiration_year',a.medical_card_expiration_year,'agrees_to_comply',a.agrees_to_comply,
        'consent_electronic_records',a.consent_electronic_records,'signature_name',btrim(_signature_name),
        'signature_signed_at',now(),'certified',true,'how_did_you_hear',a.how_did_you_hear,
        'qualification_gap',cardinality(gap_reasons) > 0,'qualification_gap_reasons',gap_reasons,
        'employers',coalesce((SELECT jsonb_agg(jsonb_build_object(
          'employer_name',e.employer_name,'position_held',e.position_held,'city',e.city,
          'state',e.state,'phone',e.phone,'start_date',e.start_date,'end_date',e.end_date,
          'reason_for_leaving',e.reason_for_leaving,'was_dot_regulated',e.was_dot_regulated,
          'current_employer',e.current_employer,'commercial_driving_relevant',e.commercial_driving_relevant,
          'permission_to_contact',e.permission_to_contact,'equipment_operated',e.equipment_operated
        ) ORDER BY e.sort_order) FROM public.application_employers e WHERE e.application_id=a.id),'[]'::jsonb)),
      updated_at = now()
  WHERE a.id = app.id;
  RETURN jsonb_build_object('reference_code',app.reference_code,'position_title',app.position_title,
                            'submitted_at',now(),'status','submitted');
END;
$$;

REVOKE ALL ON FUNCTION public.start_public_application(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resume_application(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_application_draft(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_application_employers(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_application_upload_target(text,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_application_document(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_application_document(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_application_document_deletion(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_application_resume_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_application_draft(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_application_resume_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_public_application(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resume_application(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_application_draft(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_application_employers(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_application_upload_target(text,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_application_document(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_application_document(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_application_document_deletion(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_application_draft(text,text) TO service_role;

-- Submitted response snapshot is immutable. Workflow-only fields remain
-- editable by recruiting staff; response corrections require a separately
-- reviewed, versioned API rather than rewriting the original submission.
CREATE OR REPLACE FUNCTION public.enforce_application_submission_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE current_response jsonb;
BEGIN
  IF OLD.submitted_response_snapshot IS NOT NULL THEN
    current_response := jsonb_build_object(
      'job_id',NEW.job_id,'position_title',NEW.position_title,'current_step',NEW.current_step,
      'first_name',NEW.first_name,'middle_name',NEW.middle_name,'last_name',NEW.last_name,
      'preferred_name',NEW.preferred_name,'email',NEW.email,'phone',NEW.phone,
      'preferred_contact_method',NEW.preferred_contact_method,'city',NEW.city,'state',NEW.state,
      'postal_code',NEW.postal_code,'is_18_or_older',NEW.is_18_or_older,'cdl_status',NEW.cdl_status,
      'cdl_state',NEW.cdl_state,'cdl_class',NEW.cdl_class,'endorsements',NEW.endorsements,
      'commercial_experience_years',NEW.commercial_experience_years,
      'tractor_trailer_experience',NEW.tractor_trailer_experience,'linehaul_pd_experience',NEW.linehaul_pd_experience,
      'schedule_availability',NEW.schedule_availability,'start_availability',NEW.start_availability,
      'authorized_to_work',NEW.authorized_to_work,
      'can_perform_duties_with_or_without_accommodation',NEW.can_perform_duties_with_or_without_accommodation,
      'medical_card_status',NEW.medical_card_status,'medical_card_expiration_month',NEW.medical_card_expiration_month,
      'medical_card_expiration_year',NEW.medical_card_expiration_year,'agrees_to_comply',NEW.agrees_to_comply,
      'consent_electronic_records',NEW.consent_electronic_records,'signature_name',NEW.signature_name,
      'certified',NEW.certified,'signature_signed_at',NEW.signature_signed_at,
      'how_did_you_hear',NEW.how_did_you_hear,'qualification_gap',NEW.qualification_gap,
      'qualification_gap_reasons',NEW.qualification_gap_reasons,
      'employers',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'employer_name',e.employer_name,'position_held',e.position_held,'city',e.city,
        'state',e.state,'phone',e.phone,'start_date',e.start_date,'end_date',e.end_date,
        'reason_for_leaving',e.reason_for_leaving,'was_dot_regulated',e.was_dot_regulated,
        'current_employer',e.current_employer,'commercial_driving_relevant',e.commercial_driving_relevant,
        'permission_to_contact',e.permission_to_contact,'equipment_operated',e.equipment_operated
      ) ORDER BY e.sort_order) FROM public.application_employers e WHERE e.application_id=NEW.id),'[]'::jsonb));
    IF current_response IS DISTINCT FROM OLD.submitted_response_snapshot
       OR NEW.submitted_response_snapshot IS DISTINCT FROM OLD.submitted_response_snapshot THEN
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

CREATE OR REPLACE FUNCTION public.record_recruiting_status_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.recruiting_status IS DISTINCT FROM OLD.recruiting_status THEN
    INSERT INTO public.application_events(application_id,actor_id,event_type,description,metadata)
      VALUES (NEW.id,auth.uid(),'recruiting_status_changed','Recruiting pipeline status changed',
              jsonb_build_object('from',OLD.recruiting_status,'to',NEW.recruiting_status));
    INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id,old_status,new_status)
      VALUES (auth.uid(),'recruiting_status_changed','application',NEW.id::text,
              OLD.recruiting_status,NEW.recruiting_status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER applications_recruiting_status_audit
  AFTER UPDATE OF recruiting_status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_recruiting_status_audit();

CREATE OR REPLACE FUNCTION public.guard_append_only_records()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'record is append-only';
END;
$$;
CREATE OR REPLACE FUNCTION public.guard_submitted_employer_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE application_id uuid;
BEGIN
  application_id := coalesce(NEW.application_id,OLD.application_id);
  IF EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id
             AND a.submitted_response_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'submitted employment history is immutable';
  END IF;
  RETURN coalesce(NEW,OLD);
END;
$$;
DROP TRIGGER IF EXISTS application_employers_immutable_after_submit ON public.application_employers;
CREATE TRIGGER application_employers_immutable_after_submit
  BEFORE INSERT OR UPDATE OR DELETE ON public.application_employers
  FOR EACH ROW EXECUTE FUNCTION public.guard_submitted_employer_history();

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
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.recruiter_id := auth.uid();
    NEW.created_at := now();
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fadv_handoffs_audit_fields ON public.fadv_handoffs;
CREATE TRIGGER fadv_handoffs_audit_fields
  BEFORE INSERT OR UPDATE ON public.fadv_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_fadv_audit_fields();

CREATE OR REPLACE FUNCTION public.record_fadv_handoff_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO public.security_audit_events(actor_id,action,target_type,target_id)
    VALUES (auth.uid(),CASE WHEN TG_OP = 'INSERT' THEN 'fadv_handoff_created' ELSE 'fadv_handoff_updated' END,
            'application',coalesce(NEW.application_id,OLD.application_id)::text);
  RETURN coalesce(NEW,OLD);
END;
$$;
CREATE TRIGGER fadv_handoffs_audit
  AFTER INSERT OR UPDATE ON public.fadv_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.record_fadv_handoff_audit();

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
      AND p.proname IN (
        'on_application_status_change','on_document_verification',
        'enforce_application_submission_immutability','record_application_status_audit','record_recruiting_status_audit',
        'guard_append_only_records','guard_submitted_employer_history',
        'set_fadv_audit_fields','record_fadv_handoff_audit',
        'set_acknowledgement_identity','set_handbook_signature_identity',
        'set_application_note_actor','set_esign_audit_fields'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.signature);
  END LOOP;
END;
$revoke_trigger_exec$;

-- Private storage bucket; no direct anon/authenticated object policies. Upload,
-- download, delete, and signed URL operations require a trusted server proxy.
-- The proxy must inspect actual file bytes, reject malware, avoid public caching,
-- and redact bearer tokens; object metadata alone is not file-content validation.
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
DO $drop_storage_policies$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ILIKE '%applicant-documents%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects',p.policyname);
  END LOOP;
END;
$drop_storage_policies$;

-- Restrictive bucket guards also override unrelated permissive client policies
-- that may allow general storage access without naming this bucket.
DROP POLICY IF EXISTS applicant_documents_client_select_block ON storage.objects;
CREATE POLICY applicant_documents_client_select_block ON storage.objects AS RESTRICTIVE
  FOR SELECT TO anon, authenticated USING (bucket_id <> 'applicant-documents');
DROP POLICY IF EXISTS applicant_documents_client_insert_block ON storage.objects;
CREATE POLICY applicant_documents_client_insert_block ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'applicant-documents');
DROP POLICY IF EXISTS applicant_documents_client_update_block ON storage.objects;
CREATE POLICY applicant_documents_client_update_block ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (bucket_id <> 'applicant-documents')
  WITH CHECK (bucket_id <> 'applicant-documents');
DROP POLICY IF EXISTS applicant_documents_client_delete_block ON storage.objects;
CREATE POLICY applicant_documents_client_delete_block ON storage.objects AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (bucket_id <> 'applicant-documents');

COMMIT;
