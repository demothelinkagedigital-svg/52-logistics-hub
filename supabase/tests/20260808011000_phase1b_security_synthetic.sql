-- Synthetic Phase 1B policy/RPC tests for a disposable local Supabase database
-- after the draft migration is applied. This file creates only synthetic auth
-- users/data and rolls the entire transaction back. Never point it at production.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.fadv_handoffs') IS NULL
     OR to_regclass('public.security_audit_events') IS NULL
     OR to_regprocedure('public.resume_application(text)') IS NULL THEN
    RAISE EXCEPTION 'Phase 1B draft migration is not installed';
  END IF;
END;
$preflight$;

-- Minimal synthetic Supabase Auth principals. IDs are fixed for readable,
-- repeatable assertions; transaction rollback means these IDs are not retained.
INSERT INTO auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase1b-app-a@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('b2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase1b-app-b@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('c3333333-3333-4333-8333-333333333333','authenticated','authenticated','phase1b-recruiter@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('d4444444-4444-4444-8444-444444444444','authenticated','authenticated','phase1b-content@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('e5555555-5555-4555-8555-555555555555','authenticated','authenticated','phase1b-driver@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('f6666666-6666-4666-8666-666666666666','authenticated','authenticated','phase1b-developer@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('a7777777-7777-4777-8777-777777777777','authenticated','authenticated','phase1b-admin@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

INSERT INTO public.user_roles(user_id,role) VALUES
 ('a1111111-1111-4111-8111-111111111111','applicant'),
 ('b2222222-2222-4222-8222-222222222222','applicant'),
 ('c3333333-3333-4333-8333-333333333333','recruiter'),
 ('d4444444-4444-4444-8444-444444444444','content_manager'),
 ('e5555555-5555-4555-8555-555555555555','driver'),
 ('f6666666-6666-4666-8666-666666666666','developer'),
 ('a7777777-7777-4777-8777-777777777777','administrator');

INSERT INTO public.jobs (position,slug,days,schedule,published)
VALUES ('Synthetic Driver','phase1b-synthetic','Monday-Friday','Synthetic',true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.applications
 (id,user_id,job_id,status,first_name,last_name,email,date_of_birth,cdl_number,
  medical_card_expiration,suspension_details,drug_test_details,resume_token_hash,
  resume_expires_at,resume_revoked_at,resume_consumed_at)
SELECT '11111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',
       j.id,'draft','Applicant','Alpha','phase1b-app-a@example.invalid','1980-01-02',
       'SYNTHETIC-CDL-A','2028-01-01','Synthetic legacy suspension detail',
       'Synthetic legacy test detail',encode(extensions.digest(convert_to('phase1b-valid-token-a-0123456789abcdef','UTF8'),'sha256'),'hex'),
       now()+interval '1 day',NULL,NULL
FROM public.jobs j WHERE j.slug='phase1b-synthetic';
INSERT INTO public.applications
 (id,user_id,job_id,status,first_name,last_name,email,resume_token_hash,resume_expires_at)
SELECT '22222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222',
       j.id,'draft','Applicant','Beta','phase1b-app-b@example.invalid',
       encode(extensions.digest(convert_to('phase1b-valid-token-b-0123456789abcdef','UTF8'),'sha256'),'hex'),now()+interval '1 day'
FROM public.jobs j WHERE j.slug='phase1b-synthetic';
INSERT INTO public.applications
 (id,user_id,job_id,status,first_name,resume_token_hash,resume_expires_at)
SELECT '33333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111',
       j.id,'draft','Expired',encode(extensions.digest(convert_to('phase1b-expired-token-0123456789abcdef','UTF8'),'sha256'),'hex'),now()-interval '1 second'
FROM public.jobs j WHERE j.slug='phase1b-synthetic';
INSERT INTO public.applications
 (id,user_id,job_id,status,first_name,resume_token_hash,resume_expires_at,resume_revoked_at)
SELECT '44444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111',
       j.id,'draft','Revoked',encode(extensions.digest(convert_to('phase1b-revoked-token-0123456789abcdef','UTF8'),'sha256'),'hex'),now()+interval '1 day',now()
FROM public.jobs j WHERE j.slug='phase1b-synthetic';
INSERT INTO public.applications
 (id,user_id,job_id,status,first_name,resume_token_hash,resume_expires_at,resume_consumed_at)
SELECT '55555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111',
       j.id,'draft','Consumed',encode(extensions.digest(convert_to('phase1b-consumed-token-0123456789abcdef','UTF8'),'sha256'),'hex'),now()+interval '1 day',now()
FROM public.jobs j WHERE j.slug='phase1b-synthetic';

INSERT INTO public.application_documents
 (application_id,user_id,doc_type,storage_path,file_name,mime_type,size_bytes)
VALUES
 ('22222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222',
  'resume','synthetic/app-b/resume.pdf','synthetic-resume.pdf','application/pdf',128);

INSERT INTO public.drivers(user_id,status)
VALUES ('e5555555-5555-4555-8555-555555555555','active');

-- Anonymous and authenticated applicant direct access to protected application
-- rows must fail due to revoked privileges, regardless of forged application ID.
SET LOCAL ROLE anon;
DO $anon_checks$
BEGIN
  IF public.resume_application('not-a-high-entropy-token') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid token unexpectedly returned application data';
  END IF;
  BEGIN
    PERFORM 1 FROM public.applications;
    RAISE EXCEPTION 'anon unexpectedly has direct applications access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anon_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
DO $applicant_a_checks$
DECLARE payload jsonb;
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'applicant A read application rows directly';
  END IF;
  IF (SELECT count(id) FROM public.application_documents
      WHERE application_id='22222222-2222-4222-8222-222222222222') <> 0 THEN
    RAISE EXCEPTION 'applicant A read applicant B document metadata';
  END IF;
  IF public.has_role('c3333333-3333-4333-8333-333333333333','recruiter'::public.app_role) THEN
    RAISE EXCEPTION 'role helper disclosed another user role';
  END IF;
  payload := public.resume_application('phase1b-valid-token-a-0123456789abcdef');
  IF payload->>'id' <> '11111111-1111-4111-8111-111111111111' THEN
    RAISE EXCEPTION 'applicant A token did not resume the matching application';
  END IF;
  IF payload ?| ARRAY['date_of_birth','cdl_number','medical_card_expiration',
                       'suspension_details','drug_test_details','resume_token_hash'] THEN
    RAISE EXCEPTION 'resume RPC leaked a legacy sensitive/internal field';
  END IF;
  IF public.resume_application('phase1b-valid-token-b-0123456789abcdef')->>'id'
       <> '22222222-2222-4222-8222-222222222222' THEN
    RAISE EXCEPTION 'B token did not resolve exclusively to application B';
  END IF;
  IF public.resume_application('phase1b-expired-token-0123456789abcdef') IS NOT NULL
     OR public.resume_application('phase1b-revoked-token-0123456789abcdef') IS NOT NULL
     OR public.resume_application('phase1b-consumed-token-0123456789abcdef') IS NOT NULL THEN
    RAISE EXCEPTION 'expired, revoked, or consumed token was accepted';
  END IF;
  IF public.save_application_draft(
       'phase1b-valid-token-a-0123456789abcdef',
       '{"first_name":"Updated Alpha","cdl_number":"attacker-controlled"}'::jsonb) THEN
    RAISE EXCEPTION 'draft save accepted a non-allowlisted legacy sensitive field';
  END IF;
  IF NOT public.save_application_draft(
       'phase1b-valid-token-a-0123456789abcdef',
       '{"first_name":"Updated Alpha","current_step":2}'::jsonb) THEN
    RAISE EXCEPTION 'draft save rejected allowlisted changes';
  END IF;
  IF NOT public.submit_application_draft('phase1b-valid-token-a-0123456789abcdef') THEN
    RAISE EXCEPTION 'valid draft could not be submitted';
  END IF;
  IF public.resume_application('phase1b-valid-token-a-0123456789abcdef') IS NOT NULL THEN
    RAISE EXCEPTION 'consumed token remained usable after submission';
  END IF;
  IF (SELECT count(*) FROM public.notifications WHERE user_id <> auth.uid()) <> 0 THEN
    RAISE EXCEPTION 'applicant A read another user notification';
  END IF;
  IF has_table_privilege('authenticated','public.notifications','INSERT') THEN
    RAISE EXCEPTION 'applicant can insert arbitrary notifications';
  END IF;
END;
$applicant_a_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
DO $applicant_b_checks$
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'applicant B read application rows directly';
  END IF;
  IF public.resume_application('phase1b-valid-token-b-0123456789abcdef')->>'id'
       <> '22222222-2222-4222-8222-222222222222' THEN
    RAISE EXCEPTION 'applicant B token returned a cross-application record';
  END IF;
END;
$applicant_b_checks$;
RESET ROLE;

-- A recruiter may see applications, but no legacy sensitive columns and no
-- access to archived screening_records; a developer gets no recruiting access.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
DO $recruiter_checks$
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 5 THEN
    RAISE EXCEPTION 'recruiter cannot read all synthetic applications';
  END IF;
  IF has_column_privilege('authenticated','public.applications','date_of_birth','SELECT')
     OR has_column_privilege('authenticated','public.applications','cdl_number','SELECT') THEN
    RAISE EXCEPTION 'legacy sensitive application column privilege remains';
  END IF;
  BEGIN
    PERFORM 1 FROM public.screening_records;
    RAISE EXCEPTION 'recruiter unexpectedly has legacy screening_records access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.applications SET status='under_review'
    WHERE id='11111111-1111-4111-8111-111111111111';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recruiter could not record a human status decision';
  END IF;
END;
$recruiter_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f6666666-6666-4666-8666-666666666666',true);
DO $developer_checks$
BEGIN
  IF public.is_recruiting_staff(auth.uid()) THEN
    RAISE EXCEPTION 'developer role has blanket recruiting access';
  END IF;
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'developer read application rows';
  END IF;
END;
$developer_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
DO $content_manager_checks$
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'content manager read application rows';
  END IF;
  IF NOT public.is_content_staff(auth.uid()) THEN
    RAISE EXCEPTION 'content manager did not retain content authoring role';
  END IF;
END;
$content_manager_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','e5555555-5555-4555-8555-555555555555',true);
DO $driver_checks$
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'driver read application rows';
  END IF;
  IF (SELECT count(*) FROM public.drivers WHERE user_id <> auth.uid()) <> 0 THEN
    RAISE EXCEPTION 'driver read another driver row';
  END IF;
  IF has_column_privilege('authenticated','public.drivers','status','UPDATE')
     OR NOT has_column_privilege('authenticated','public.drivers','emergency_contact_phone','UPDATE') THEN
    RAISE EXCEPTION 'driver update column grants are too broad or too narrow';
  END IF;
END;
$driver_checks$;
RESET ROLE;

-- Notifications have no arbitrary recipient API or direct writes; each user can
-- only read/mark their own notices. Private storage must exist and be non-public.
DO $static_security_checks$
BEGIN
  IF has_table_privilege('authenticated','public.application_documents','INSERT') THEN
    RAISE EXCEPTION 'authenticated clients can create arbitrary document metadata';
  END IF;
  IF has_function_privilege('authenticated',
       'public.notify_user(uuid,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can call arbitrary-recipient notify_user';
  END IF;
  IF has_table_privilege('authenticated','public.notifications','INSERT') THEN
    RAISE EXCEPTION 'authenticated can insert notifications';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets
                 WHERE id='applicant-documents' AND public=false) THEN
    RAISE EXCEPTION 'applicant document bucket is absent or public';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='storage' AND p.tablename='objects'
      AND (p.roles @> ARRAY['anon'::name] OR p.roles @> ARRAY['authenticated'::name])
      AND (coalesce(p.qual,'') || ' ' || coalesce(p.with_check,''))
          ILIKE '%applicant-documents%'
  ) THEN
    RAISE EXCEPTION 'client storage policy still references applicant-documents';
  END IF;
END;
$static_security_checks$;

-- Admin role reads audit records; only trigger-owned inserts are possible.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a7777777-7777-4777-8777-777777777777',true);
DO $admin_checks$
BEGIN
  IF NOT public.has_role(auth.uid(),'administrator'::public.app_role) THEN
    RAISE EXCEPTION 'admin role helper failed for self';
  END IF;
  IF (SELECT count(*) FROM public.security_audit_events
      WHERE target_type='application'
        AND target_id='11111111-1111-4111-8111-111111111111') <> 2 THEN
    RAISE EXCEPTION 'admin cannot read expected append-only submission/status audit';
  END IF;
END;
$admin_checks$;
RESET ROLE;

ROLLBACK;
