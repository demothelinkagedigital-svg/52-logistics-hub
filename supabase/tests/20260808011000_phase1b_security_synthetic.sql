-- Synthetic database-level Phase 1B tests for a disposable local Supabase database
-- after the draft migration is applied. These do not verify API rate limits, generic
-- endpoint errors, log redaction, upload byte inspection, or malware scanning.
-- Synthetic auth users/data are rolled back; never point this file at production.
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
 (id,user_id,job_id,status,first_name,last_name,email,is_18_or_older,cdl_status,
  preferred_contact_method,authorized_to_work,consent_electronic_records,resume_token_hash,
  resume_expires_at,resume_revoked_at,resume_consumed_at)
SELECT '11111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',
       j.id,'draft','Applicant','Alpha','phase1b-app-a@example.invalid',
       true,'valid_cdl','email',true,true,
       encode(extensions.digest(convert_to('phase1b-valid-token-a-0123456789abcdef','UTF8'),'sha256'),'hex'),
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

UPDATE public.applications
SET phone='7175550100', city='Harrisburg', state='PA', postal_code='17101',
    cdl_state='PA', cdl_class='A', commercial_experience_years=4.0,
    tractor_trailer_experience=true, linehaul_pd_experience=false,
    schedule_availability=ARRAY['weekday_evenings'], start_availability='Two weeks',
    can_perform_duties_with_or_without_accommodation=true,
    medical_card_status='current', medical_card_expiration_month=12,
    medical_card_expiration_year=2027, agrees_to_comply=true
WHERE id='11111111-1111-4111-8111-111111111111';

INSERT INTO public.application_documents
 (id,application_id,user_id,doc_type,storage_path,file_name,mime_type,size_bytes)
VALUES
 ('00000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222',
  'b2222222-2222-4222-8222-222222222222','resume','synthetic/app-b/resume.pdf',
  'synthetic-resume.pdf','application/pdf',128);
INSERT INTO public.application_upload_intents
 (id,application_id,doc_type,file_name,mime_type,expected_size_bytes,storage_path,expires_at)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',
  'resume','synthetic-resume.pdf','application/pdf',128,
  'applicant/synthetic-app-b/resume.pdf',now()+interval '10 minutes');
INSERT INTO public.page_content (id,page_key,section_key,heading,body,approval_status,published)
VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','phase1b-test','approved','Approved test copy','Synthetic content','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','phase1b-test','draft','Unapproved test copy','Synthetic draft','pending',false);
INSERT INTO public.site_settings (key,value,label,group_name,is_public)
VALUES ('phase1b-test','synthetic','Synthetic test setting','test',false);

INSERT INTO public.drivers(user_id,status)
VALUES ('e5555555-5555-4555-8555-555555555555','active'),
       ('b2222222-2222-4222-8222-222222222222','active');

INSERT INTO public.academy_modules(slug,title,published)
VALUES ('phase1b-security-test','Synthetic security test',true)
ON CONFLICT (slug) DO NOTHING;

-- Anonymous and authenticated applicant direct access to protected application
-- rows must fail due to revoked privileges, regardless of forged application ID.
SET LOCAL ROLE anon;
DO $anon_checks$
BEGIN
  IF has_function_privilege('anon','public.start_public_application(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.resume_application(text)','EXECUTE')
     OR has_function_privilege('anon','public.save_application_draft(text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.save_application_employers(text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.submit_application_draft(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous clients can bypass the trusted applicant API';
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
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0 THEN
    RAISE EXCEPTION 'applicant A read application rows directly';
  END IF;
  IF (SELECT count(id) FROM public.application_documents
      WHERE application_id='22222222-2222-4222-8222-222222222222') <> 0 THEN
    RAISE EXCEPTION 'applicant A read applicant B document metadata';
  END IF;
  IF has_table_privilege('authenticated','public.application_events','INSERT')
     OR has_table_privilege('authenticated','public.application_documents','INSERT')
     OR (SELECT count(*) FROM public.application_notes) <> 0 THEN
    RAISE EXCEPTION 'applicant has direct event, note, or document table access';
  END IF;
  BEGIN
    UPDATE public.applications SET recruiting_status='hired'
    WHERE id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'applicant directly changed internal status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.has_role('c3333333-3333-4333-8333-333333333333','recruiter'::public.app_role) THEN
    RAISE EXCEPTION 'role helper disclosed another user role';
  END IF;
  IF has_function_privilege('authenticated','public.start_public_application(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.resume_application(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.save_application_draft(text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.save_application_employers(text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.submit_application_draft(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated clients can bypass the trusted applicant API';
  END IF;
  BEGIN
    INSERT INTO public.application_events(application_id,event_type,description)
    VALUES ('11111111-1111-4111-8111-111111111111','forged','Applicant event');
    RAISE EXCEPTION 'applicant inserted a forged event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.application_notes(application_id,body)
    VALUES ('11111111-1111-4111-8111-111111111111','Applicant note');
    RAISE EXCEPTION 'applicant inserted an internal note';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
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
END;
$applicant_b_checks$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $applicant_token_rpc_checks$
DECLARE payload jsonb; token_to_reject text;
BEGIN
  payload := public.start_public_application((SELECT id FROM public.jobs WHERE slug='phase1b-synthetic'));
  IF length(payload->>'resume_token') <> 64
     OR NOT EXISTS (
       SELECT 1 FROM public.applications a
       WHERE a.resume_token_hash = encode(extensions.digest(
         convert_to(payload->>'resume_token','UTF8'),'sha256'),'hex')
         AND a.resume_token_hash <> payload->>'resume_token'
     ) THEN
    RAISE EXCEPTION 'application start did not return a high-entropy token while storing only its hash';
  END IF;
  IF public.resume_application('not-a-high-entropy-token') IS NOT NULL
     OR public.resume_application('phase1b-expired-token-0123456789abcdef') IS NOT NULL
     OR public.resume_application('phase1b-revoked-token-0123456789abcdef') IS NOT NULL
     OR public.resume_application('phase1b-consumed-token-0123456789abcdef') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid, expired, revoked, or consumed token returned application data';
  END IF;
  FOREACH token_to_reject IN ARRAY ARRAY[
    'phase1b-expired-token-0123456789abcdef',
    'phase1b-revoked-token-0123456789abcdef',
    'phase1b-consumed-token-0123456789abcdef'
  ] LOOP
    IF public.save_application_draft(token_to_reject,'{"first_name":"Forged"}'::jsonb)
       OR public.save_application_employers(token_to_reject,'[]'::jsonb)
       OR public.submit_application_draft(token_to_reject,'Applicant Alpha') IS NOT NULL THEN
      RAISE EXCEPTION 'expired, revoked, or consumed token modified an application';
    END IF;
  END LOOP;
  IF public.save_application_draft('invalid-token-00000000000000000000000000000000','{"first_name":"Forged"}'::jsonb)
     OR public.save_application_employers('invalid-token-00000000000000000000000000000000','[]'::jsonb)
     OR public.submit_application_draft('invalid-token-00000000000000000000000000000000','Applicant Alpha') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid token modified or submitted an application';
  END IF;
  payload := public.resume_application('phase1b-valid-token-a-0123456789abcdef');
  IF payload->>'reference_code' IS DISTINCT FROM (
       SELECT reference_code FROM public.applications
       WHERE id='11111111-1111-4111-8111-111111111111'
     ) OR payload->>'reference_code' = (
       SELECT reference_code FROM public.applications
       WHERE id='22222222-2222-4222-8222-222222222222'
     ) OR payload ? 'id' THEN
    RAISE EXCEPTION 'resume token returned another application or exposed an application identifier';
  END IF;
  IF payload ?| ARRAY['date_of_birth','cdl_number','medical_card_expiration',
                       'suspension_details','drug_test_details','resume_token_hash'] THEN
    RAISE EXCEPTION 'resume RPC leaked a legacy sensitive/internal field';
  END IF;
  IF public.resume_application('phase1b-valid-token-b-0123456789abcdef')->>'reference_code' IS NULL THEN
    RAISE EXCEPTION 'valid second token could not resume its associated application';
  END IF;
  IF public.record_application_document(
       'phase1b-valid-token-a-0123456789abcdef','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'token A associated an upload intent belonging to application B';
  END IF;
  IF public.delete_application_document(
       'phase1b-valid-token-a-0123456789abcdef','00000000-0000-4000-8000-000000000002') IS NOT NULL
     OR public.complete_application_document_deletion(
       'phase1b-valid-token-a-0123456789abcdef','00000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'token A accessed or deleted application B document';
  END IF;
  IF public.save_application_draft(
       'phase1b-valid-token-a-0123456789abcdef',
       '{"first_name":"Forged","position_title":"Admin","signature_name":"Forged Applicant","certified":true,"qualification_gap":false,"qualification_gap_reasons":[]}'::jsonb)
     OR public.save_application_draft(
       'phase1b-valid-token-a-0123456789abcdef',
       '{"additional_notes":"unsupported free text"}'::jsonb) THEN
    RAISE EXCEPTION 'draft RPC accepted derived, server-controlled, or unsupported fields';
  END IF;
  IF NOT public.save_application_draft(
       'phase1b-valid-token-a-0123456789abcdef',
       '{"first_name":"Updated Alpha","current_step":2,"preferred_name":"Al","medical_card_status":"current","additional_notes":"Synthetic applicant note"}'::jsonb) THEN
    RAISE EXCEPTION 'draft save rejected allowlisted changes';
  END IF;
  IF (SELECT additional_notes FROM public.applications
      WHERE id='11111111-1111-4111-8111-111111111111') <> 'Synthetic applicant note' THEN
    RAISE EXCEPTION 'allowlisted additional_notes payload was discarded';
  END IF;
  IF NOT public.save_application_employers(
       'phase1b-valid-token-a-0123456789abcdef',
       '[{"employer_name":"Synthetic Carrier","position_held":"Driver","start_date":"2024-01-01","reason_for_leaving":"Seeking a new opportunity","current_employer":false,"commercial_driving_relevant":true,"permission_to_contact":false},{"employer_name":"Synthetic Carrier Two","position_held":"Driver","start_date":"2022-01-01","end_date":"2023-12-31","reason_for_leaving":"Moved to another opportunity","current_employer":false,"commercial_driving_relevant":true,"permission_to_contact":false}]'::jsonb) THEN
    RAISE EXCEPTION 'token-scoped employment history save failed';
  END IF;
  IF public.submit_application_draft('phase1b-valid-token-a-0123456789abcdef','') IS NOT NULL THEN
    RAISE EXCEPTION 'submission accepted a blank signature';
  END IF;
  IF public.submit_application_draft('phase1b-valid-token-a-0123456789abcdef','Updated Alpha') IS NULL THEN
    RAISE EXCEPTION 'valid draft could not be submitted';
  END IF;
  IF public.resume_application('phase1b-valid-token-a-0123456789abcdef') IS NOT NULL
     OR public.save_application_draft('phase1b-valid-token-a-0123456789abcdef','{"first_name":"After submission"}'::jsonb)
     OR public.save_application_employers('phase1b-valid-token-a-0123456789abcdef','[]'::jsonb)
     OR public.submit_application_draft('phase1b-valid-token-a-0123456789abcdef','Updated Alpha') IS NOT NULL THEN
    RAISE EXCEPTION 'consumed token remained usable after submission';
  END IF;
END;
$applicant_token_rpc_checks$;
DO $token_revocation_checks$
BEGIN
  IF NOT public.revoke_application_resume_token('phase1b-valid-token-b-0123456789abcdef') THEN
    RAISE EXCEPTION 'trusted server could not revoke an active resume token';
  END IF;
  IF public.resume_application('phase1b-valid-token-b-0123456789abcdef') IS NOT NULL
     OR public.save_application_draft('phase1b-valid-token-b-0123456789abcdef','{"first_name":"Revoked"}'::jsonb)
     OR public.save_application_employers('phase1b-valid-token-b-0123456789abcdef','[]'::jsonb) THEN
    RAISE EXCEPTION 'revoked token remained usable';
  END IF;
END;
$token_revocation_checks$;
RESET ROLE;

-- A recruiter may see applications, but no legacy sensitive columns and no
-- access to archived screening_records; a developer gets no recruiting access.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
DO $recruiter_checks$
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 6 THEN
    RAISE EXCEPTION 'recruiter cannot read all synthetic applications';
  END IF;
  IF has_column_privilege('authenticated','public.applications','date_of_birth','SELECT')
     OR has_column_privilege('authenticated','public.applications','cdl_number','SELECT') THEN
    RAISE EXCEPTION 'legacy sensitive application column privilege remains';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fadv_handoffs'
      AND column_name NOT IN ('id','application_id','invitation_date','recruiter_id',
                              'external_reference','next_check_date','created_at','updated_at','updated_by')
  ) THEN
    RAISE EXCEPTION 'First Advantage handoff stores fields outside approved metadata';
  END IF;
  BEGIN
    PERFORM 1 FROM public.screening_records;
    RAISE EXCEPTION 'recruiter unexpectedly has legacy screening_records access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.applications SET status='rejected'
    WHERE id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'recruiter directly changed protected application status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF NOT public.update_application_recruiting_status(
       '11111111-1111-4111-8111-111111111111','ready_for_review') THEN
    RAISE EXCEPTION 'recruiter could not record a pipeline status transition';
  END IF;
  INSERT INTO public.fadv_handoffs(application_id,invitation_date,external_reference,next_check_date)
    VALUES ('11111111-1111-4111-8111-111111111111',current_date,'SYNTHETIC-CASE-001',current_date+7);
  IF (SELECT recruiter_id FROM public.fadv_handoffs
      WHERE application_id='11111111-1111-4111-8111-111111111111') <> auth.uid() THEN
    RAISE EXCEPTION 'First Advantage handoff did not bind its responsible recruiter';
  END IF;
  IF NOT public.update_application_recruiting_status(
       '11111111-1111-4111-8111-111111111111','ready_to_invite_first_advantage')
     OR NOT public.update_application_recruiting_status(
       '11111111-1111-4111-8111-111111111111','first_advantage_invitation_sent') THEN
    RAISE EXCEPTION 'recruiter could not progress with minimal First Advantage metadata';
  END IF;
  IF public.update_application_recruiting_status(
       '11111111-1111-4111-8111-111111111111',NULL) THEN
    RAISE EXCEPTION 'recruiting status RPC accepted NULL';
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
  IF public.has_role(auth.uid(),'developer'::public.app_role)
     OR (SELECT count(*) FROM public.user_roles) <> 0 THEN
    RAISE EXCEPTION 'persistent developer role row authorized or exposed in app role checks';
  END IF;
END;
$developer_checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
DO $content_manager_checks$
DECLARE affected integer;
BEGIN
  IF (SELECT count(id) FROM public.applications) <> 0
     OR (SELECT count(*) FROM public.application_notes) <> 0 THEN
    RAISE EXCEPTION 'content manager read recruiting records';
  END IF;
  BEGIN
    PERFORM 1 FROM public.screening_records;
    RAISE EXCEPTION 'content manager read screening records';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF NOT public.is_content_staff(auth.uid()) THEN
    RAISE EXCEPTION 'content manager did not retain content authoring role';
  END IF;
  IF public.admin_set_user_role(
       'b2222222-2222-4222-8222-222222222222','recruiter'::public.app_role,true) THEN
    RAISE EXCEPTION 'content manager changed a user role';
  END IF;
  UPDATE public.site_settings SET value='forged' WHERE key='phase1b-test';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'content manager changed site settings';
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
  IF (SELECT count(*) FROM public.academy_modules WHERE slug='phase1b-security-test') <> 1 THEN
    RAISE EXCEPTION 'active driver cannot read published portal content';
  END IF;
  IF has_table_privilege('authenticated','public.lms_enrollments','INSERT')
     OR has_table_privilege('authenticated','public.lms_lesson_progress','INSERT')
     OR has_table_privilege('authenticated','public.lms_lesson_progress','UPDATE')
     OR has_table_privilege('authenticated','public.lms_quiz_attempts','INSERT') THEN
    RAISE EXCEPTION 'driver can forge Academy progress or quiz completion';
  END IF;
END;
$driver_checks$;
RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE public.drivers SET status='inactive'
WHERE user_id='e5555555-5555-4555-8555-555555555555';
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','e5555555-5555-4555-8555-555555555555',true);
DO $inactive_driver_checks$
BEGIN
  IF (SELECT count(*) FROM public.drivers WHERE user_id=auth.uid()) <> 0
     OR (SELECT count(*) FROM public.academy_modules WHERE slug='phase1b-security-test') <> 0 THEN
    RAISE EXCEPTION 'inactive driver retained portal access';
  END IF;
END;
$inactive_driver_checks$;
RESET ROLE;

DO $snapshot_checks$
BEGIN
  IF (SELECT submitted_response_snapshot ? 'employers'
      FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') IS DISTINCT FROM true
     OR (SELECT jsonb_array_length(submitted_response_snapshot->'employers')
         FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') <> 2
     OR (SELECT submitted_response_snapshot->'employers'->0->>'employer_name'
         FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') <> 'Synthetic Carrier'
     OR (SELECT submitted_response_snapshot->'employers'->1->>'employer_name'
         FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') <> 'Synthetic Carrier Two' THEN
    RAISE EXCEPTION 'submission snapshot omitted employment history';
  END IF;
  BEGIN
    UPDATE public.applications SET first_name='Corrupted'
    WHERE id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'submitted response update was not blocked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'submitted application responses are immutable' THEN RAISE; END IF;
  END;
  IF (SELECT first_name FROM public.applications
      WHERE id='11111111-1111-4111-8111-111111111111') <> 'Updated Alpha' THEN
    RAISE EXCEPTION 'immutable response changed after submission';
  END IF;
  IF (SELECT submitted_response_snapshot->>'qualification_gap'
      FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') <> 'true'
     OR NOT (SELECT submitted_response_snapshot->'qualification_gap_reasons'
       ? 'No linehaul or pickup-and-delivery experience reported.'
       FROM public.applications WHERE id='11111111-1111-4111-8111-111111111111') THEN
    RAISE EXCEPTION 'qualification gap was not derived from stored applicant answers';
  END IF;
  BEGIN
    UPDATE public.application_employers SET employer_name='Corrupted employer'
    WHERE application_id='11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'submitted employment history was not immutable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'submitted employment history is immutable' THEN RAISE; END IF;
  END;
END;
$snapshot_checks$;

-- A temporary developer receives only a bounded public-content grant; revocation
-- immediately invalidates the scoped helper without adding other role capabilities.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a7777777-7777-4777-8777-777777777777',true);
DO $developer_grant_checks$
BEGIN
  IF NOT public.grant_temporary_public_content_access(
       'f6666666-6666-4666-8666-666666666666','Synthetic support',interval '1 hour') THEN
    RAISE EXCEPTION 'administrator could not grant temporary scoped access';
  END IF;
END;
$developer_grant_checks$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f6666666-6666-4666-8666-666666666666',true);
DO $developer_scope_checks$
BEGIN
  IF NOT public.has_temporary_developer_scope(auth.uid(),'public_content') THEN
    RAISE EXCEPTION 'temporary developer scope did not activate';
  END IF;
  IF public.has_role(auth.uid(),'developer'::public.app_role)
     OR (SELECT count(*) FROM public.user_roles) <> 0 THEN
    RAISE EXCEPTION 'developer marker became an application role';
  END IF;
  IF public.has_temporary_developer_scope(auth.uid(),'security_settings') THEN
    RAISE EXCEPTION 'developer received an unapproved scope';
  END IF;
  IF (SELECT count(*) FROM public.page_content
      WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 0 THEN
    RAISE EXCEPTION 'temporary developer read unapproved or unpublished content';
  END IF;
END;
$developer_scope_checks$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a7777777-7777-4777-8777-777777777777',true);
DO $developer_revoke_checks$
BEGIN
  IF NOT public.revoke_temporary_developer_access('f6666666-6666-4666-8666-666666666666') THEN
    RAISE EXCEPTION 'administrator could not revoke temporary access';
  END IF;
END;
$developer_revoke_checks$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f6666666-6666-4666-8666-666666666666',true);
DO $developer_revoked_checks$
BEGIN
  IF public.has_temporary_developer_scope(auth.uid(),'public_content')
     OR public.has_role(auth.uid(),'developer'::public.app_role)
     OR (SELECT count(*) FROM public.user_roles) <> 0 THEN
    RAISE EXCEPTION 'revoked developer grant authorized access or exposed a role';
  END IF;
END;
$developer_revoked_checks$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a7777777-7777-4777-8777-777777777777',true);
DO $developer_expiry_setup$
BEGIN
  IF NOT public.grant_temporary_public_content_access(
       'f6666666-6666-4666-8666-666666666666','Synthetic expiry test',interval '1 hour') THEN
    RAISE EXCEPTION 'administrator could not create expiry test grant';
  END IF;
END;
$developer_expiry_setup$;
RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE public.temporary_developer_grants
SET expires_at=now()-interval '1 second'
WHERE user_id='f6666666-6666-4666-8666-666666666666' AND revoked_at IS NULL;
INSERT INTO public.user_roles(user_id,role,granted_by)
VALUES ('f6666666-6666-4666-8666-666666666666','developer','a7777777-7777-4777-8777-777777777777')
ON CONFLICT (user_id,role) DO NOTHING;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f6666666-6666-4666-8666-666666666666',true);
DO $developer_expiry_enforcement$
BEGIN
  IF public.has_temporary_developer_scope(auth.uid(),'public_content')
     OR public.has_role(auth.uid(),'developer'::public.app_role)
     OR (SELECT count(*) FROM public.user_roles) <> 0 THEN
    RAISE EXCEPTION 'expired grant or stale role marker authorized access before cleanup';
  END IF;
END;
$developer_expiry_enforcement$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $developer_expiry_cleanup$
BEGIN
  IF public.cleanup_expired_temporary_developer_access() <> 1 THEN
    RAISE EXCEPTION 'expiry cleanup did not remove the stale developer role marker';
  END IF;
END;
$developer_expiry_cleanup$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f6666666-6666-4666-8666-666666666666',true);
DO $developer_expired_checks$
BEGIN
  IF public.has_temporary_developer_scope(auth.uid(),'public_content')
     OR public.has_role(auth.uid(),'developer'::public.app_role)
     OR (SELECT count(*) FROM public.user_roles) <> 0 THEN
    RAISE EXCEPTION 'expired developer grant authorized access or exposed a role';
  END IF;
END;
$developer_expired_checks$;
RESET ROLE;

-- Notifications have no arbitrary recipient API or direct writes; each user can
-- only read/mark their own notices. Private storage must exist and be non-public.
DO $static_security_checks$
BEGIN
  IF has_table_privilege('authenticated','public.application_documents','INSERT') THEN
    RAISE EXCEPTION 'authenticated clients can create arbitrary document metadata';
  END IF;
  IF has_function_privilege('authenticated',
       'public.notify_user(uuid,text,text,text,text)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.notify_recruiting_staff(text,text,text,text)','EXECUTE')
     OR has_function_privilege('anon',
       'public.notify_user(uuid,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'untrusted client can target arbitrary notifications';
  END IF;
  IF has_function_privilege('authenticated','public.start_public_application(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.resume_application(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.save_application_draft(text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.save_application_employers(text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.submit_application_draft(text,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.start_public_application(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.resume_application(text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.save_application_draft(text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.save_application_employers(text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.submit_application_draft(text,text)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.create_application_upload_target(text,text,text,text,bigint)','EXECUTE')
     OR has_function_privilege('authenticated','public.record_application_document(text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.delete_application_document(text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.complete_application_document_deletion(text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.revoke_application_resume_token(text)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.create_application_upload_target(text,text,text,text,bigint)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.record_application_document(text,uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.delete_application_document(text,uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.complete_application_document_deletion(text,uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.revoke_application_resume_token(text)','EXECUTE') THEN
    RAISE EXCEPTION 'trusted upload or revocation function grants are incorrect';
  END IF;
  IF has_table_privilege('authenticated','public.notifications','INSERT') THEN
    RAISE EXCEPTION 'authenticated can insert notifications';
  END IF;
  IF has_table_privilege('authenticated','public.lms_enrollments','INSERT')
     OR has_table_privilege('authenticated','public.lms_enrollments','UPDATE')
     OR has_table_privilege('authenticated','public.lms_lesson_progress','INSERT')
     OR has_table_privilege('authenticated','public.lms_lesson_progress','UPDATE')
     OR has_table_privilege('authenticated','public.lms_quiz_attempts','INSERT')
     OR has_table_privilege('authenticated','public.announcement_acknowledgements','INSERT')
     OR has_table_privilege('authenticated','public.safety_acknowledgements','INSERT')
     OR has_table_privilege('authenticated','public.handbook_signatures','INSERT') THEN
    RAISE EXCEPTION 'client-facing Academy evidence writes are not restricted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets
                 WHERE id='applicant-documents' AND public=false) THEN
    RAISE EXCEPTION 'applicant document bucket is absent or public';
  END IF;
  IF (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname='storage' AND p.tablename='objects'
        AND p.permissive='RESTRICTIVE'
        AND p.policyname IN (
          'applicant_documents_client_select_block',
          'applicant_documents_client_insert_block',
          'applicant_documents_client_update_block',
          'applicant_documents_client_delete_block')) <> 4 THEN
    RAISE EXCEPTION 'applicant bucket is not guarded against broad client storage policies';
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
        AND target_id='11111111-1111-4111-8111-111111111111'
        AND action IN ('application_submitted','recruiting_status_changed')) <> 5 THEN
    RAISE EXCEPTION 'admin cannot read expected append-only submission/status audit';
  END IF;
END;
$admin_checks$;
RESET ROLE;

ROLLBACK;
