-- ============ JOBS ============
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'Full-time',
  ADD COLUMN IF NOT EXISTS work_category text NOT NULL DEFAULT 'Linehaul',
  ADD COLUMN IF NOT EXISTS responsibilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_notes text,
  ADD COLUMN IF NOT EXISTS application_deadline date;

UPDATE public.jobs SET work_category =
  CASE WHEN position ILIKE 'linehaul%' THEN 'Linehaul'
       WHEN position ILIKE 'p&d%' THEN 'P&D'
       WHEN position ILIKE 'hybrid%' THEN 'Hybrid'
       WHEN position ILIKE 'spare%' THEN 'Spare'
       ELSE 'Linehaul' END;

UPDATE public.jobs SET employment_type = ''
WHERE slug IN (
  'linehaul-urr-sun-thu',
  'linehaul-urr-tue-sat',
  'pd-urr-mon-fri',
  'hybrid-urr-mon-fri-day',
  'hybrid-urr-mon-fri-evening',
  'spare-urr-fri-mon'
);

-- ============ APPLICATIONS ============
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS assigned_recruiter uuid,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- ============ ANNOUNCEMENTS ============
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS requires_acknowledgement boolean NOT NULL DEFAULT false;

UPDATE public.announcements SET status = CASE WHEN published THEN 'published' ELSE 'draft' END;

CREATE TABLE IF NOT EXISTS public.announcement_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT ON public.announcement_acknowledgements TO authenticated;
GRANT ALL ON public.announcement_acknowledgements TO service_role;
ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ack read" ON public.announcement_acknowledgements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "own ack insert" ON public.announcement_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ SAFETY MEETINGS ============
CREATE TABLE public.safety_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  meeting_date timestamptz,
  mode text NOT NULL DEFAULT 'in_person',
  audience text NOT NULL DEFAULT 'all_drivers',
  instructions text,
  materials_url text,
  acknowledgement_deadline timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_meetings TO authenticated;
GRANT ALL ON public.safety_meetings TO service_role;
ALTER TABLE public.safety_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read published meetings" ON public.safety_meetings FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_staff(auth.uid()));
CREATE POLICY "staff manage meetings" ON public.safety_meetings FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

CREATE TABLE public.safety_meeting_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.safety_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz,
  attended_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_meeting_assignments TO authenticated;
GRANT ALL ON public.safety_meeting_assignments TO service_role;
ALTER TABLE public.safety_meeting_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meeting assignment read" ON public.safety_meeting_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "own meeting assignment update" ON public.safety_meeting_assignments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff manage meeting assignments" ON public.safety_meeting_assignments FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ HANDBOOK VERSIONS ============
CREATE TABLE public.handbook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label text NOT NULL,
  title text NOT NULL,
  description text,
  document_url text,
  storage_path text,
  effective_date date,
  requires_signature boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handbook_versions TO authenticated;
GRANT ALL ON public.handbook_versions TO service_role;
ALTER TABLE public.handbook_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read published handbook versions" ON public.handbook_versions FOR SELECT TO authenticated
  USING (published = true OR public.is_staff(auth.uid()));
CREATE POLICY "content staff manage handbook versions" ON public.handbook_versions FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

CREATE TABLE public.handbook_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.handbook_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signature_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, user_id)
);
GRANT SELECT, INSERT ON public.handbook_signatures TO authenticated;
GRANT ALL ON public.handbook_signatures TO service_role;
ALTER TABLE public.handbook_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signature read" ON public.handbook_signatures FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "own signature insert" ON public.handbook_signatures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ EMAIL TEMPLATES ============
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  description text,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read email templates" ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage email templates" ON public.email_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

INSERT INTO public.email_templates (template_key, name, subject, body, description, variables) VALUES
('application_received','Application received','We received your 52 Logistics application','Hello {{applicant_name}},

We received your application for {{position}}. Your reference number is {{reference_code}}.

A recruiter reviews every application. Submitting an application does not guarantee employment, an interview, a screening invitation, or a position.

— 52 Logistics Recruiting','Sent to the applicant after a successful submission.','{applicant_name,position,reference_code}'),
('application_incomplete','Incomplete application','Complete your 52 Logistics application','Hello {{applicant_name}},

Your application {{reference_code}} is saved but not submitted. You can continue where you left off using your secure resume link: {{resume_link}}

— 52 Logistics Recruiting','Reminder for a saved but unsubmitted application.','{applicant_name,reference_code,resume_link}'),
('recruiter_alert','Recruiter alert','New 52 Logistics application: {{reference_code}}','A new application was submitted.

Applicant: {{applicant_name}}
Position: {{position}}
Reference: {{reference_code}}

Open the record: {{portal_link}}','Internal alert to recruiting staff.','{applicant_name,position,reference_code,portal_link}'),
('missing_item','Missing item','Additional information needed','Hello {{applicant_name}},

We need additional information before your application {{reference_code}} can continue: {{item_title}}

Please respond by {{deadline}} using your secure link: {{resume_link}}

— 52 Logistics Recruiting','Requests a correction or missing document.','{applicant_name,reference_code,item_title,deadline,resume_link}'),
('portal_invitation','Portal invitation','Your 52 Logistics Driver Portal access','Hello {{applicant_name}},

Your Driver Portal access is ready. Use this secure single-use link to set up your account: {{portal_link}}

— 52 Logistics','Invites a selected driver to set up portal access.','{applicant_name,portal_link}'),
('onboarding_assigned','Onboarding assigned','Your 52 Logistics onboarding tasks','Hello {{applicant_name}},

Your onboarding tasks are assigned in the Driver Portal: {{portal_link}}

Please complete them by {{deadline}}.

— 52 Logistics','Notifies a driver that onboarding items are assigned.','{applicant_name,portal_link,deadline}'),
('acknowledgement_assigned','Acknowledgement assigned','Action required: {{item_title}}','Hello {{applicant_name}},

{{item_title}} requires your acknowledgement by {{deadline}}.

Open the portal: {{portal_link}}

— 52 Logistics','Assigns a required acknowledgement.','{applicant_name,item_title,deadline,portal_link}'),
('safety_meeting_assigned','Safety meeting','Safety meeting assigned: {{item_title}}','Hello {{applicant_name}},

A safety meeting has been assigned: {{item_title}}

Acknowledgement deadline: {{deadline}}
Details: {{portal_link}}

— 52 Logistics Safety','Assigns a safety meeting to a driver.','{applicant_name,item_title,deadline,portal_link}'),
('onboarding_complete','Completion','52 Logistics onboarding completed','Hello {{applicant_name}},

Your onboarding requirements are recorded as complete. Management will verify before operational release.

— 52 Logistics','Confirms completed onboarding.','{applicant_name}'),
('email_failure','Email failure','Website email delivery issue','An outbound message failed to deliver.

Template: {{item_title}}
Reference: {{reference_code}}

Review delivery status in the admin console: {{portal_link}}','Internal alert for a delivery failure.','{item_title,reference_code,portal_link}');

-- ============ REQUIRED SYSTEMS ============
CREATE TABLE public.required_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  purpose text,
  official_url text,
  ios_url text,
  android_url text,
  phone text,
  setup_instructions text,
  support_info text,
  audience text NOT NULL DEFAULT 'drivers',
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.required_systems TO authenticated;
GRANT ALL ON public.required_systems TO service_role;
ALTER TABLE public.required_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read published systems" ON public.required_systems FOR SELECT TO authenticated
  USING (published = true OR public.is_staff(auth.uid()));
CREATE POLICY "content staff manage systems" ON public.required_systems FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

INSERT INTO public.required_systems (name, slug, description, purpose, setup_instructions, published, sort_order) VALUES
('MyFleetAI / Linehaul Central','myfleetai','Run assignment and linehaul dispatch information.','Find your assigned run, departure time and trailer information.','Log in with the credentials issued by management. Confirm receipt of each assignment.',true,1),
('Motive','motive','Electronic logging device and hours-of-service platform.','Record duty status and hours of service.','Install the app, log in with your assigned credentials and pair to the vehicle before driving.',true,2),
('Whip Around','whip-around','Pre-trip and post-trip inspection reporting.','Complete and submit DVIR inspections with photo evidence.','Install the app and complete the assigned inspection form before leaving the yard.',true,3),
('Trip Buddy','trip-buddy','Trip support tool.','Pending approval of the official destination.','Unpublished until the owner-approved destination is confirmed and link-tested.',false,4),
('FedEx AVR','fedex-avr','Automated vehicle report procedure.','Complete the AVR procedure as instructed for each applicable run.','Follow the AVR steps provided by management for your assignment.',true,5),
('Gate access procedure','gate-access','Terminal gate entry procedure.','Enter and exit the terminal correctly.','Follow the posted procedure at the gate. Access details are provided in person and are never published online.',true,6);

-- ============ MEDIA LIBRARY ============
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  alt_text text,
  category text NOT NULL DEFAULT 'general',
  storage_path text,
  public_url text,
  content_type text,
  width integer,
  height integer,
  size_bytes bigint,
  tags text[] NOT NULL DEFAULT '{}',
  usage_notes text,
  archived_at timestamptz,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read media" ON public.media_assets FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "content staff manage media" ON public.media_assets FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ TRIGGERS + INDEXES ============
CREATE TRIGGER safety_meetings_touch BEFORE UPDATE ON public.safety_meetings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER safety_meeting_assignments_touch BEFORE UPDATE ON public.safety_meeting_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER handbook_versions_touch BEFORE UPDATE ON public.handbook_versions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER email_templates_touch BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER required_systems_touch BEFORE UPDATE ON public.required_systems FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER media_assets_touch BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_meeting_assignments_user ON public.safety_meeting_assignments(user_id);
CREATE INDEX idx_meeting_assignments_meeting ON public.safety_meeting_assignments(meeting_id);
CREATE INDEX idx_announcement_ack_user ON public.announcement_acknowledgements(user_id);
CREATE INDEX idx_handbook_signatures_user ON public.handbook_signatures(user_id);
CREATE INDEX idx_applications_assigned ON public.applications(assigned_recruiter);
