
-- ============ ENUMS ============
CREATE TYPE public.application_status AS ENUM (
  'draft','submitted','under_review','screening','interview',
  'conditional_offer','background_check','onboarding','hired','rejected','withdrawn'
);
CREATE TYPE public.screening_status AS ENUM ('not_started','initiated','pending','clear','review_required','failed','cancelled');
CREATE TYPE public.esign_status AS ENUM ('not_sent','sent','viewed','completed','declined','voided');
CREATE TYPE public.driver_status AS ENUM ('onboarding','active','inactive','terminated');

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.is_recruiting_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('administrator','recruiter','developer'));
$$;

CREATE OR REPLACE FUNCTION public.is_content_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('administrator','content_manager'));
$$;

-- ============ APPLICATIONS ============
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  position_title text,
  reference_code text NOT NULL DEFAULT ('APP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  status public.application_status NOT NULL DEFAULT 'draft',
  current_step smallint NOT NULL DEFAULT 1,
  completed_steps smallint[] NOT NULL DEFAULT '{}',
  -- step 1 personal
  first_name text, middle_name text, last_name text,
  email text, phone text,
  address_line1 text, address_line2 text, city text, state text, postal_code text,
  date_of_birth date,
  -- step 2 CDL
  cdl_number text, cdl_state text, cdl_class text,
  cdl_issue_date date, cdl_expiration_date date,
  endorsements text[] NOT NULL DEFAULT '{}',
  years_experience numeric(4,1),
  medical_card_expiration date,
  twic_card boolean NOT NULL DEFAULT false,
  -- step 4 eligibility
  authorized_to_work boolean,
  age_21_or_older boolean,
  accidents_last_3_years text,
  violations_last_3_years text,
  license_ever_suspended boolean,
  suspension_details text,
  positive_drug_test boolean,
  drug_test_details text,
  can_perform_duties boolean,
  how_did_you_hear text,
  additional_notes text,
  -- step 6
  signature_name text,
  certified boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX applications_reference_code_key ON public.applications(reference_code);
CREATE INDEX applications_user_idx ON public.applications(user_id);
CREATE INDEX applications_status_idx ON public.applications(status);
CREATE INDEX applications_created_idx ON public.applications(created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own applications read" ON public.applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own applications insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own draft update" ON public.applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft') WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff read applications" ON public.applications FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY "staff update applications" ON public.applications FOR UPDATE TO authenticated
  USING (public.is_recruiting_staff(auth.uid())) WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE TRIGGER applications_touch BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EMPLOYMENT HISTORY ============
CREATE TABLE public.application_employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  employer_name text NOT NULL,
  position_held text,
  city text, state text, phone text,
  start_date date, end_date date,
  reason_for_leaving text,
  was_dot_regulated boolean NOT NULL DEFAULT true,
  equipment_operated text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_employers_app_idx ON public.application_employers(application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_employers TO authenticated;
GRANT ALL ON public.application_employers TO service_role;
ALTER TABLE public.application_employers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own employers manage" ON public.application_employers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid() AND a.status = 'draft'));
CREATE POLICY "staff read employers" ON public.application_employers FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

-- ============ DOCUMENTS ============
CREATE TABLE public.application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_documents_app_idx ON public.application_documents(application_id);
GRANT SELECT, INSERT, DELETE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs read" ON public.application_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own docs insert" ON public.application_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own docs delete" ON public.application_documents FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff read docs" ON public.application_documents FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

-- ============ NOTES ============
CREATE TABLE public.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_notes_app_idx ON public.application_notes(application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_notes TO authenticated;
GRANT ALL ON public.application_notes TO service_role;
ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage notes" ON public.application_notes FOR ALL TO authenticated
  USING (public.is_recruiting_staff(auth.uid())) WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- ============ TIMELINE ============
CREATE TABLE public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_events_app_idx ON public.application_events(application_id, created_at DESC);
GRANT SELECT, INSERT ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events read" ON public.application_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "staff read events" ON public.application_events FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE POLICY "staff insert events" ON public.application_events FOR INSERT TO authenticated WITH CHECK (public.is_recruiting_staff(auth.uid()));

-- ============ FIRST ADVANTAGE ============
CREATE TABLE public.screening_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status public.screening_status NOT NULL DEFAULT 'not_started',
  reference_number text,
  initiated_at timestamptz,
  status_updated_at timestamptz,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX screening_records_app_key ON public.screening_records(application_id);
GRANT SELECT, INSERT, UPDATE ON public.screening_records TO authenticated;
GRANT ALL ON public.screening_records TO service_role;
ALTER TABLE public.screening_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage screening" ON public.screening_records FOR ALL TO authenticated
  USING (public.is_recruiting_staff(auth.uid())) WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE TRIGGER screening_touch BEFORE UPDATE ON public.screening_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DOCUSIGN ============
CREATE TABLE public.esign_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  document_name text NOT NULL DEFAULT 'Onboarding packet',
  status public.esign_status NOT NULL DEFAULT 'not_sent',
  envelope_reference text,
  sent_at timestamptz,
  completed_at timestamptz,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX esign_records_app_idx ON public.esign_records(application_id);
GRANT SELECT, INSERT, UPDATE ON public.esign_records TO authenticated;
GRANT ALL ON public.esign_records TO service_role;
ALTER TABLE public.esign_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage esign" ON public.esign_records FOR ALL TO authenticated
  USING (public.is_recruiting_staff(auth.uid())) WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE TRIGGER esign_touch BEFORE UPDATE ON public.esign_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DRIVERS ============
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  driver_code text,
  status public.driver_status NOT NULL DEFAULT 'onboarding',
  hire_date date,
  terminal text NOT NULL DEFAULT 'Harrisburg, PA — Terminal 170',
  truck_number text,
  position_title text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own driver read" ON public.drivers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own driver update" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff manage drivers" ON public.drivers FOR ALL TO authenticated
  USING (public.is_recruiting_staff(auth.uid())) WITH CHECK (public.is_recruiting_staff(auth.uid()));
CREATE TRIGGER drivers_touch BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ACADEMY ============
CREATE TABLE public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  content text,
  duration_minutes integer,
  is_required boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_modules TO authenticated;
GRANT ALL ON public.academy_modules TO service_role;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads published modules" ON public.academy_modules FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "content manages modules" ON public.academy_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE TRIGGER academy_modules_touch BEFORE UPDATE ON public.academy_modules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  module_id uuid NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress manage" ON public.academy_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff read progress" ON public.academy_progress FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));
CREATE TRIGGER academy_progress_touch BEFORE UPDATE ON public.academy_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ HANDBOOK ============
CREATE TABLE public.handbook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  body text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handbook_sections TO authenticated;
GRANT ALL ON public.handbook_sections TO service_role;
ALTER TABLE public.handbook_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads handbook" ON public.handbook_sections FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "content manages handbook" ON public.handbook_sections FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE TRIGGER handbook_touch BEFORE UPDATE ON public.handbook_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SAFETY ============
CREATE TABLE public.safety_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  body text,
  category text NOT NULL DEFAULT 'Policy',
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_resources TO authenticated;
GRANT ALL ON public.safety_resources TO service_role;
ALTER TABLE public.safety_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads safety" ON public.safety_resources FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "content manages safety" ON public.safety_resources FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE TRIGGER safety_touch BEFORE UPDATE ON public.safety_resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.safety_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  resource_id uuid NOT NULL REFERENCES public.safety_resources(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);
GRANT SELECT, INSERT ON public.safety_acknowledgements TO authenticated;
GRANT ALL ON public.safety_acknowledgements TO service_role;
ALTER TABLE public.safety_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ack read" ON public.safety_acknowledgements FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own ack insert" ON public.safety_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff read ack" ON public.safety_acknowledgements FOR SELECT TO authenticated USING (public.is_recruiting_staff(auth.uid()));

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'driver',
  pinned boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads announcements" ON public.announcements FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "content manages announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));
CREATE TRIGGER announcements_touch BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED CONTENT (driver-facing content, not applicant data) ============
INSERT INTO public.academy_modules (slug, title, description, content, duration_minutes, is_required, sort_order) VALUES
 ('orientation','Company Orientation','Introduction to 52 Logistics, terminal operations and expectations.','Welcome to 52 Logistics, Inc. This module covers our history, terminal 170 operations, dispatch expectations and the chain of communication.',45,true,1),
 ('hours-of-service','Hours of Service','FMCSA hours-of-service rules and ELD usage.','Review of the 11-hour driving limit, 14-hour window, 30-minute break rule, 60/70-hour limits and correct ELD log management.',60,true,2),
 ('pre-trip-inspection','Pre-Trip Inspection','Complete pre-trip and post-trip inspection procedure.','Step-by-step walkthrough of the DOT pre-trip inspection, defect reporting and DVIR completion.',40,true,3),
 ('defensive-driving','Defensive Driving','Space management, speed control and hazard awareness.','Smith System fundamentals, following distance, work zones and adverse weather operation.',50,true,4),
 ('cargo-securement','Cargo Securement','Load securement standards and weight distribution.','FMCSA cargo securement rules, tie-down requirements, axle weight distribution and scaling.',35,false,5),
 ('accident-procedures','Accident & Incident Procedures','What to do at the scene and how to report.','Immediate scene steps, required notifications, documentation and post-accident testing requirements.',30,true,6);

INSERT INTO public.handbook_sections (slug, title, category, body, sort_order) VALUES
 ('welcome','Welcome to 52 Logistics','General','52 Logistics, Inc. operates out of Harrisburg, PA — Terminal 170. This handbook outlines the policies and expectations for every driver on our roster.',1),
 ('attendance','Attendance & Scheduling','Operations','Report for your scheduled shift on time and communicate absences to dispatch as early as possible. Schedule changes are coordinated through your dispatcher.',2),
 ('communication','Dispatch Communication','Operations','Keep your phone available during your duty window. Acknowledge dispatch messages promptly and report delays immediately.',3),
 ('equipment','Equipment & Maintenance','Equipment','Report defects through the DVIR at the end of every shift. Never operate equipment with an unrepaired safety defect.',4),
 ('drug-alcohol','Drug & Alcohol Policy','Compliance','52 Logistics maintains a DOT-compliant drug and alcohol testing program including pre-employment, random, post-accident and reasonable-suspicion testing.',5),
 ('pay-benefits','Pay & Benefits','Employment','Pay is issued on the published schedule. Contact the office for questions about deductions, benefits enrollment or direct deposit.',6),
 ('conduct','Professional Conduct','General','Represent 52 Logistics professionally with customers, at shipper and receiver facilities, and on the road.',7);

INSERT INTO public.safety_resources (title, summary, body, category, requires_acknowledgement, sort_order) VALUES
 ('Hours of Service Compliance','Stay legal on every log.','Drivers must maintain accurate ELD records. Falsification of logs is grounds for termination. Contact safety before exceeding any HOS limit.','Compliance',true,1),
 ('Pre-Trip Inspection Policy','Required before every dispatch.','A complete pre-trip inspection is required before every dispatch. Document defects on the DVIR and notify maintenance before departure.','Policy',true,2),
 ('Winter Driving Advisory','Reduce speed and increase following distance.','In snow or ice, reduce speed well below the posted limit, increase following distance to at least 8 seconds, and stop safely if conditions deteriorate.','Advisory',false,3),
 ('Accident Reporting Procedure','Call safety immediately.','Secure the scene, check for injuries, call 911 if needed, then notify the safety line before leaving the scene. Photograph the scene when it is safe to do so.','Policy',true,4),
 ('Distracted Driving Policy','No handheld device use.','Handheld mobile device use while operating a commercial motor vehicle is prohibited by FMCSA regulation and company policy.','Policy',true,5);

INSERT INTO public.announcements (title, body, pinned) VALUES
 ('Terminal 170 winter operations','Chains and winter kits are available at the terminal office. Check tire condition before every northbound run.',true),
 ('Quarterly safety meeting','The quarterly safety meeting is held at the Harrisburg terminal. Check with dispatch for the current schedule.',false);
