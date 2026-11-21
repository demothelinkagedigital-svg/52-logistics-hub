-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('administrator','recruiter','content_manager','driver','applicant','developer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('administrator','recruiter','content_manager'));
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ SHARED ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  preferred_name text,
  phone text,
  title text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins update any" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL,
  slug text UNIQUE NOT NULL,
  days text NOT NULL,
  schedule text NOT NULL,
  location text NOT NULL DEFAULT 'Harrisburg, PA — Terminal 170',
  summary text,
  requirements text[] NOT NULL DEFAULT '{}',
  pay_notes text,
  benefits_notes text,
  equipment_notes text,
  status text NOT NULL DEFAULT 'open',
  published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads published jobs" ON public.jobs FOR SELECT TO anon, authenticated
  USING (published = true AND archived_at IS NULL);
CREATE POLICY "staff read all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "content manages jobs" ON public.jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'));
CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SITE SETTINGS ============
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text,
  label text,
  group_name text NOT NULL DEFAULT 'general',
  is_public boolean NOT NULL DEFAULT true,
  needs_verification boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public settings readable" ON public.site_settings FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "staff read settings" ON public.site_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage settings" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ SOCIAL LINKS ============
CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
GRANT ALL ON public.social_links TO service_role;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active social" ON public.social_links FOR SELECT TO anon, authenticated
  USING (is_active = true AND url IS NOT NULL);
CREATE POLICY "staff read social" ON public.social_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage social" ON public.social_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ PAGE CONTENT ============
CREATE TABLE public.page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  section_key text NOT NULL,
  heading text,
  body text,
  approval_status text NOT NULL DEFAULT 'approved',
  published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, section_key)
);
GRANT SELECT ON public.page_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_content TO authenticated;
GRANT ALL ON public.page_content TO service_role;
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads published copy" ON public.page_content FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "staff read copy" ON public.page_content FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "content manages copy" ON public.page_content FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'));

-- ============ FAQ ============
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads faqs" ON public.faqs FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "content manages faqs" ON public.faqs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'content_manager'));

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- ============ SEED ============
INSERT INTO public.jobs (position, slug, days, schedule, location, summary, requirements, status, published, sort_order) VALUES
('Linehaul URR','linehaul-urr-sun-thu','Sunday–Thursday','9:30 AM until finished','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,1),
('Linehaul URR','linehaul-urr-tue-sat','Tuesday–Saturday','9:30 AM until finished','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,2),
('P&D URR','pd-urr-mon-fri','Monday–Friday','9:30 AM until finished','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,3),
('Hybrid URR','hybrid-urr-mon-fri-day','Monday–Friday','2:00 PM–1:00 AM','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,4),
('Hybrid URR','hybrid-urr-mon-fri-evening','Monday–Friday','4:00 PM–11:00 PM','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,5),
('Spare URR','spare-urr-fri-mon','Friday–Monday','Times TBD','Harrisburg, PA','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ''Until finished'' does not promise a fixed end time.','{}','open',true,6);

INSERT INTO public.site_settings (key, value, label, group_name, is_public, needs_verification) VALUES
('company_name','52 Logistics, Inc.','Company name','general',true,false),
('terminal','FedEx – Harrisburg, Terminal 170','Terminal','general',true,false),
('address_line1','510 Industrial Dr.','Address line 1','general',true,true),
('address_city','Harrisburg','City','general',true,true),
('address_state','PA','State','general',true,true),
('address_zip','17339','ZIP','general',true,true),
('address_note','Owner-supplied address. City/ZIP formatting must be verified before production.','Address verification note','general',true,true),
('recruiting_email','recruiting@52logisticsinc.com','Recruiting email','contact',true,false),
('company_email','office@52logisticsinc.com','General office email','contact',true,false),
('brand_qualifier','52 Logistics, Inc. is an independent contracted service provider. FedEx names and marks remain the property of their respective owner.','Brand qualifier','legal',true,false),
('avr_phone','(888) 867-1142','FedEx AVR phone','operations',false,false),
('indeed_url',NULL,'Indeed employer profile URL','social',true,false),
('independent_contractor_notice','52 Logistics, Inc. is an independent contracted service provider supporting FedEx linehaul operations. 52 Logistics, Inc. is not FedEx and does not speak for FedEx.','Independent contractor notice','legal',true,true),
('job_disclaimer','Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. “Until finished” does not promise a fixed end time.','Opening disclaimer','careers',true,false);

INSERT INTO public.social_links (platform, url, sort_order, is_active) VALUES
('Facebook',NULL,1,false),('LinkedIn',NULL,2,false),('Instagram',NULL,3,false),('Indeed',NULL,4,false);

INSERT INTO public.faqs (question, answer, sort_order) VALUES
('Where is 52 Logistics based?','52 Logistics, Inc. operates from the Harrisburg, Pennsylvania area, working out of FedEx Terminal 170. Harrisburg is our only operating location.',1),
('How do I apply?','Review the current openings on the Careers page, select a position, and use its Apply for This Position button. You can change your selected position before emailing recruiting.',2),
('Does applying guarantee employment?','No. Submitting an application does not guarantee employment, an interview, or any specific outcome. Every application is reviewed by a person.',3),
('What happens after I apply?','A recruiter reviews your application inquiry. If your background fits a current opening, the team may contact you about next steps. Any required screening is completed through the external screening provider.',4),
('Should I send sensitive documents by email?','No. Never email sensitive personal documents. Use the secure process provided by the recruiting team.',5),
('Can I apply from my phone?','Yes. You can browse openings, select a position, and email recruiting from your phone.',6);
