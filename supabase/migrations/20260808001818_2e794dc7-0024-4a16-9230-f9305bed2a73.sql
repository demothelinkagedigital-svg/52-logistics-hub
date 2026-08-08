-- ============ ENUMS ============
CREATE TYPE public.lms_lesson_type AS ENUM ('video','text','image','document');
CREATE TYPE public.lms_difficulty AS ENUM ('foundational','intermediate','advanced');
CREATE TYPE public.lms_enrollment_status AS ENUM ('not_started','in_progress','completed');
CREATE TYPE public.lms_question_type AS ENUM ('multiple_choice','true_false');

-- ============ COURSES ============
CREATE TABLE public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  description text,
  category text NOT NULL DEFAULT 'general',
  image_url text,
  difficulty public.lms_difficulty NOT NULL DEFAULT 'foundational',
  estimated_minutes integer NOT NULL DEFAULT 0,
  objectives text[] NOT NULL DEFAULT '{}',
  owner_label text,
  is_required boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_courses TO authenticated;
GRANT ALL ON public.lms_courses TO service_role;
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read published courses" ON public.lms_courses FOR SELECT TO authenticated
  USING (published = true OR public.is_content_staff(auth.uid()) OR public.is_recruiting_staff(auth.uid()));
CREATE POLICY "content staff manage courses" ON public.lms_courses FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ MODULES ============
CREATE TABLE public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_modules TO authenticated;
GRANT ALL ON public.lms_modules TO service_role;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read modules" ON public.lms_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id
    AND (c.published OR public.is_content_staff(auth.uid()) OR public.is_recruiting_staff(auth.uid()))));
CREATE POLICY "content staff manage modules" ON public.lms_modules FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ LESSONS ============
CREATE TABLE public.lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  lesson_type public.lms_lesson_type NOT NULL DEFAULT 'text',
  body text,
  media_url text,
  document_url text,
  duration_minutes integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lessons TO authenticated;
GRANT ALL ON public.lms_lessons TO service_role;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read lessons" ON public.lms_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id
    AND (c.published OR public.is_content_staff(auth.uid()) OR public.is_recruiting_staff(auth.uid()))));
CREATE POLICY "content staff manage lessons" ON public.lms_lessons FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ QUIZZES ============
CREATE TABLE public.lms_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  passing_score integer NOT NULL DEFAULT 80,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_quizzes TO authenticated;
GRANT ALL ON public.lms_quizzes TO service_role;
ALTER TABLE public.lms_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read quizzes" ON public.lms_quizzes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id
    AND (c.published OR public.is_content_staff(auth.uid()) OR public.is_recruiting_staff(auth.uid()))));
CREATE POLICY "content staff manage quizzes" ON public.lms_quizzes FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

CREATE TABLE public.lms_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  question_type public.lms_question_type NOT NULL DEFAULT 'multiple_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_quiz_questions TO authenticated;
GRANT ALL ON public.lms_quiz_questions TO service_role;
ALTER TABLE public.lms_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read quiz questions" ON public.lms_quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_quizzes q JOIN public.lms_courses c ON c.id = q.course_id
    WHERE q.id = quiz_id AND (c.published OR public.is_content_staff(auth.uid()) OR public.is_recruiting_staff(auth.uid()))));
CREATE POLICY "content staff manage quiz questions" ON public.lms_quiz_questions FOR ALL TO authenticated
  USING (public.is_content_staff(auth.uid())) WITH CHECK (public.is_content_staff(auth.uid()));

-- ============ PROGRESS ============
CREATE TABLE public.lms_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  status public.lms_enrollment_status NOT NULL DEFAULT 'not_started',
  progress_percent integer NOT NULL DEFAULT 0,
  last_lesson_id uuid REFERENCES public.lms_lessons(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_enrollments TO authenticated;
GRANT ALL ON public.lms_enrollments TO service_role;
ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own enrollments" ON public.lms_enrollments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff read enrollments" ON public.lms_enrollments FOR SELECT TO authenticated
  USING (public.is_recruiting_staff(auth.uid()) OR public.is_content_staff(auth.uid()));

CREATE TABLE public.lms_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lesson_progress TO authenticated;
GRANT ALL ON public.lms_lesson_progress TO service_role;
ALTER TABLE public.lms_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lesson progress" ON public.lms_lesson_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff read lesson progress" ON public.lms_lesson_progress FOR SELECT TO authenticated
  USING (public.is_recruiting_staff(auth.uid()) OR public.is_content_staff(auth.uid()));

CREATE TABLE public.lms_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lms_quiz_attempts TO authenticated;
GRANT ALL ON public.lms_quiz_attempts TO service_role;
ALTER TABLE public.lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz attempts read" ON public.lms_quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_recruiting_staff(auth.uid()) OR public.is_content_staff(auth.uid()));
CREATE POLICY "own quiz attempts insert" ON public.lms_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ INDEXES ============
CREATE INDEX idx_lms_modules_course ON public.lms_modules(course_id, sort_order);
CREATE INDEX idx_lms_lessons_module ON public.lms_lessons(module_id, sort_order);
CREATE INDEX idx_lms_lessons_course ON public.lms_lessons(course_id);
CREATE INDEX idx_lms_quizzes_course ON public.lms_quizzes(course_id);
CREATE INDEX idx_lms_questions_quiz ON public.lms_quiz_questions(quiz_id, sort_order);
CREATE INDEX idx_lms_enrollments_user ON public.lms_enrollments(user_id);
CREATE INDEX idx_lms_lesson_progress_user ON public.lms_lesson_progress(user_id, course_id);
CREATE INDEX idx_lms_quiz_attempts_user ON public.lms_quiz_attempts(user_id, quiz_id);

-- ============ TRIGGERS ============
CREATE TRIGGER lms_courses_touch BEFORE UPDATE ON public.lms_courses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_modules_touch BEFORE UPDATE ON public.lms_modules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_lessons_touch BEFORE UPDATE ON public.lms_lessons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_quizzes_touch BEFORE UPDATE ON public.lms_quizzes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_questions_touch BEFORE UPDATE ON public.lms_quiz_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_enrollments_touch BEFORE UPDATE ON public.lms_enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lms_lesson_progress_touch BEFORE UPDATE ON public.lms_lesson_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED COURSES ============
INSERT INTO public.lms_courses (slug, title, summary, description, category, difficulty, estimated_minutes, objectives, is_required, published, sort_order) VALUES
('orientation','Company Orientation & Expectations','How the Harrisburg operation runs, who to contact, and what is expected of every driver.','This course introduces the 52 Logistics operating model, communication channels, professional conduct expectations, and the escalation path for operational issues.','Orientation','foundational',35,ARRAY['Describe the Harrisburg operation and reporting structure','Identify the correct escalation contact for common situations','State the professional conduct and appearance expectations'],true,true,1),
('driver-handbook','Driver Handbook Review','A guided walk through the policies every driver is accountable for.','Covers attendance, dispatch procedure, equipment care, personal conduct, and the acknowledgement drivers are required to record.','Policy','foundational',40,ARRAY['Locate any policy in the digital handbook','Explain attendance and dispatch expectations','Record a handbook acknowledgement'],true,true,2),
('apps-and-systems','Required Apps & Systems','Set up and correctly use the systems required for daily operations.','Motive, Whip Around, MyFleetAI / Linehaul Central, Trip Buddy, and the AVR procedure — installation, login, daily use, and troubleshooting.','Systems','foundational',30,ARRAY['Install and log in to each required application','Complete a daily workflow in each system','Follow the AVR procedure correctly'],true,true,3),
('safety-and-compliance','Safety & Compliance Fundamentals','Defensive driving, fatigue management, and DOT compliance expectations.','Reviews defensive driving technique, following distance, speed management, adverse weather operation, fatigue awareness, and fitness for duty.','Safety','intermediate',45,ARRAY['Apply defensive driving technique in linehaul conditions','Recognize fatigue indicators and take correct action','Explain fitness-for-duty responsibilities'],true,true,4),
('terminal-and-yard','Terminal & Yard Procedure','Safe movement, backing, coupling and dock procedure at the terminal.','Yard speed, spotter use, blind-side backing, coupling and uncoupling, dock approach, and pedestrian awareness inside the terminal.','Operations','intermediate',35,ARRAY['Move safely through the yard and dock areas','Perform correct coupling and uncoupling steps','Apply safe backing procedure including GOAL'],true,true,5),
('hos-and-eld','Hours of Service & ELD','Log accurately and stay compliant on every run.','Duty statuses, the 11/14 hour rules, 30-minute break, 34-hour restart, ELD malfunctions, and how to correct log errors.','Compliance','intermediate',40,ARRAY['Select the correct duty status for each activity','Apply the 11/14 hour and break rules','Respond correctly to an ELD malfunction'],true,true,6);

-- ============ SEED MODULES ============
INSERT INTO public.lms_modules (course_id, title, summary, sort_order)
SELECT c.id, m.title, m.summary, m.sort_order FROM public.lms_courses c
JOIN (VALUES
 ('orientation','Welcome to 52 Logistics','Who we are and how the operation is structured.',1),
 ('orientation','Communication & Escalation','Who to contact and when.',2),
 ('driver-handbook','Policy Foundations','Attendance, conduct and accountability.',1),
 ('driver-handbook','Acknowledgement','Recording your handbook acknowledgement.',2),
 ('apps-and-systems','Core Applications','Motive, Whip Around and daily use.',1),
 ('apps-and-systems','Dispatch & Trip Tools','MyFleetAI / Linehaul Central, Trip Buddy and AVR.',2),
 ('safety-and-compliance','Defensive Driving','Space, speed and hazard management.',1),
 ('safety-and-compliance','Fatigue & Fitness for Duty','Recognizing and acting on fatigue.',2),
 ('terminal-and-yard','Yard Movement','Speed, spotters and pedestrian awareness.',1),
 ('terminal-and-yard','Backing & Coupling','GOAL, blind-side backing and coupling steps.',2),
 ('hos-and-eld','Duty Statuses & Limits','The 11/14 rule, breaks and restarts.',1),
 ('hos-and-eld','ELD Operation','Malfunctions, edits and certification.',2)
) AS m(slug,title,summary,sort_order) ON m.slug = c.slug;

-- ============ SEED LESSONS ============
INSERT INTO public.lms_lessons (module_id, course_id, title, lesson_type, body, duration_minutes, sort_order)
SELECT mo.id, mo.course_id, l.title, l.ltype::public.lms_lesson_type, l.body, l.mins, l.sort_order
FROM public.lms_modules mo
JOIN public.lms_courses c ON c.id = mo.course_id
JOIN (VALUES
 ('orientation','Welcome to 52 Logistics','Who We Are','text','52 Logistics, Inc. is an independent contracted service provider supporting FedEx linehaul operations out of the Harrisburg, Pennsylvania terminal. This lesson covers the scope of the operation, the terminal you report to, and the roles you will interact with day to day.',8,1),
 ('orientation','Welcome to 52 Logistics','Professional Conduct Expectations','text','Drivers represent 52 Logistics at every terminal, dock and customer site. This lesson covers appearance, professionalism on the radio and in person, punctuality, and the standards management holds every driver to.',9,2),
 ('orientation','Communication & Escalation','Who To Contact','text','Learn the correct contact for dispatch questions, equipment defects, safety incidents, payroll and scheduling. Using the correct channel keeps issues from being lost and gets you an answer faster.',9,1),
 ('orientation','Communication & Escalation','Escalating an On-Road Issue','text','Step-by-step escalation for breakdowns, delays, weather holds and accidents: secure the vehicle, make the notification, document the event, and follow the instruction you receive.',9,2),
 ('driver-handbook','Policy Foundations','Attendance & Scheduling','text','Attendance expectations, call-off procedure, and how scheduled runs and spare coverage are assigned. Reliable attendance is the single largest factor in the operation running on time.',10,1),
 ('driver-handbook','Policy Foundations','Equipment Care & Reporting','text','You are responsible for the condition of the equipment assigned to you. This lesson covers pre-trip and post-trip responsibility, DVIR completion, and reporting defects before they become out-of-service violations.',10,2),
 ('driver-handbook','Acknowledgement','Reading the Digital Handbook','text','The full handbook lives in the Driver Portal and is searchable by category. This lesson shows you how to find a policy quickly and what to do when a policy is updated.',10,1),
 ('driver-handbook','Acknowledgement','Recording Your Acknowledgement','text','Acknowledgement records who read a policy and when. Complete your acknowledgement in the Handbook section of the portal after finishing this course.',10,2),
 ('apps-and-systems','Core Applications','Motive: ELD & Logs','text','Install Motive, log in with your assigned credentials, pair to the vehicle, and confirm your duty status. Covers what to do if the device fails to pair.',8,1),
 ('apps-and-systems','Core Applications','Whip Around: Inspections','text','Complete pre-trip and post-trip inspections in Whip Around, attach photos to defects, and confirm the report submitted before you leave the yard.',7,2),
 ('apps-and-systems','Dispatch & Trip Tools','MyFleetAI / Linehaul Central','text','Where to find your run assignment, departure time and trailer information, and how to confirm you have received the assignment.',8,1),
 ('apps-and-systems','Dispatch & Trip Tools','Trip Buddy & the AVR Procedure','text','Using Trip Buddy on a run and completing the AVR procedure correctly, including what to submit and when.',7,2),
 ('safety-and-compliance','Defensive Driving','Space & Following Distance','text','Following distance in a loaded Class 8 combination, stopping distance at highway speed, and managing space in traffic and construction zones.',12,1),
 ('safety-and-compliance','Defensive Driving','Adverse Weather Operation','text','Reduced speed, increased following distance, chain and shutdown decisions, and the safe pull-off procedure when conditions exceed safe operation.',11,2),
 ('safety-and-compliance','Fatigue & Fitness for Duty','Recognizing Fatigue','text','Fatigue indicators, circadian low points on night linehaul, and the correct action when you recognize you are impaired by fatigue.',11,1),
 ('safety-and-compliance','Fatigue & Fitness for Duty','Fitness for Duty','text','Medication, illness, and personal condition. You are responsible for reporting fit for duty, and management supports the decision not to drive when you are not.',11,2),
 ('terminal-and-yard','Yard Movement','Yard Speed & Pedestrians','text','Yard speed limits, pedestrian right of way, dock walkways, and expectations around other equipment operating in the same space.',9,1),
 ('terminal-and-yard','Yard Movement','Spotters & Blind Areas','text','When to use a spotter, agreed hand signals, and the rule that the driver stops immediately when the spotter is lost from view.',8,2),
 ('terminal-and-yard','Backing & Coupling','GOAL and Blind-Side Backing','text','Get Out And Look, setup position, and why blind-side backing is avoided whenever a sight-side option exists.',9,1),
 ('terminal-and-yard','Backing & Coupling','Coupling & Uncoupling','text','Full coupling and uncoupling sequence including tug test, landing gear, air lines and locking jaw verification.',9,2),
 ('hos-and-eld','Duty Statuses & Limits','Duty Statuses','text','Off duty, sleeper berth, driving and on-duty-not-driving: what each status means and the activities that belong in each.',10,1),
 ('hos-and-eld','Duty Statuses & Limits','The 11/14 Rule, Break & Restart','text','The 11-hour driving limit, 14-hour window, 30-minute break requirement and the 34-hour restart, with worked examples on a linehaul schedule.',10,2),
 ('hos-and-eld','ELD Operation','Log Edits & Certification','text','Correcting an incorrect log, annotating an edit, and certifying your logs at the end of each duty day.',10,1),
 ('hos-and-eld','ELD Operation','ELD Malfunctions','text','What to do when the ELD malfunctions: notify, switch to paper logs, reconstruct the prior days required, and get the unit repaired within the required window.',10,2)
) AS l(cslug,mtitle,title,ltype,body,mins,sort_order)
  ON l.cslug = c.slug AND l.mtitle = mo.title;

-- ============ SEED QUIZZES ============
INSERT INTO public.lms_quizzes (course_id, title, instructions, passing_score, max_attempts)
SELECT c.id, c.title || ' — Knowledge Check', 'Answer every question. A score of 80% or higher is required to complete this course.', 80, 3
FROM public.lms_courses c;

INSERT INTO public.lms_quiz_questions (quiz_id, prompt, question_type, options, correct_answers, explanation, sort_order)
SELECT q.id, x.prompt, x.qtype::public.lms_question_type, x.options::jsonb, x.correct::jsonb, x.explanation, x.sort_order
FROM public.lms_quizzes q
JOIN public.lms_courses c ON c.id = q.course_id
JOIN (VALUES
 ('orientation','52 Logistics operates out of which terminal?','multiple_choice','["Harrisburg, PA — Terminal 170","Allentown, PA","Baltimore, MD","Newark, NJ"]','["Harrisburg, PA — Terminal 170"]','The Harrisburg operation, Terminal 170, is the reporting location.',1),
 ('orientation','An equipment defect should be reported before the vehicle leaves the yard.','true_false','["True","False"]','["True"]','Defects are reported immediately, not at the end of the run.',2),
 ('orientation','What is the first step when an on-road issue occurs?','multiple_choice','["Secure the vehicle in a safe location","Post about it","Continue to the destination","Wait for someone to call you"]','["Secure the vehicle in a safe location"]','Secure the vehicle first, then make the notification.',3),
 ('driver-handbook','Where does the current driver handbook live?','multiple_choice','["The Driver Portal handbook section","A printed copy only","A personal email attachment","A third-party website"]','["The Driver Portal handbook section"]','The portal holds the current, searchable version.',1),
 ('driver-handbook','A handbook acknowledgement records who read a policy and when.','true_false','["True","False"]','["True"]','Acknowledgements are stored with the user and timestamp.',2),
 ('driver-handbook','Who is responsible for the condition of assigned equipment?','multiple_choice','["The assigned driver","Only the shop","Only dispatch","Nobody specific"]','["The assigned driver"]','The driver is accountable for pre-trip, post-trip and defect reporting.',3),
 ('apps-and-systems','Which application is used for vehicle inspections?','multiple_choice','["Whip Around","Motive","Trip Buddy","Linehaul Central"]','["Whip Around"]','Whip Around handles pre-trip and post-trip inspection reporting.',1),
 ('apps-and-systems','Motive is used for ELD and duty-status logging.','true_false','["True","False"]','["True"]','Motive is the ELD platform.',2),
 ('apps-and-systems','Where is your run assignment found?','multiple_choice','["MyFleetAI / Linehaul Central","Whip Around","The handbook","A public website"]','["MyFleetAI / Linehaul Central"]','Run assignments come through MyFleetAI / Linehaul Central.',1+2),
 ('safety-and-compliance','What should increase in adverse weather?','multiple_choice','["Following distance","Speed","Load weight","Radio volume"]','["Following distance"]','Reduce speed and increase following distance.',1),
 ('safety-and-compliance','A driver who recognizes they are impaired by fatigue should keep driving to finish the run.','true_false','["True","False"]','["False"]','Stop safely and notify. Management supports the decision not to drive.',2),
 ('safety-and-compliance','Fitness for duty is primarily the responsibility of:','multiple_choice','["The driver","Dispatch","The shop","Another driver"]','["The driver"]','The driver must report fit for duty.',3),
 ('terminal-and-yard','GOAL stands for:','multiple_choice','["Get Out And Look","Go On And Leave","Grab Onto A Ladder","Guide Over A Line"]','["Get Out And Look"]','Get Out And Look before and during backing.',1),
 ('terminal-and-yard','If you lose sight of your spotter you should stop immediately.','true_false','["True","False"]','["True"]','Losing visual contact with the spotter means stop.',2),
 ('terminal-and-yard','Which backing option is preferred when both are available?','multiple_choice','["Sight-side","Blind-side","Either, it does not matter","Whichever is faster"]','["Sight-side"]','Sight-side backing keeps the target area visible.',3),
 ('hos-and-eld','What is the maximum driving time after 10 consecutive hours off duty?','multiple_choice','["11 hours","14 hours","8 hours","12 hours"]','["11 hours"]','The driving limit is 11 hours within a 14-hour window.',1),
 ('hos-and-eld','A 30-minute break is required after 8 cumulative hours of driving time.','true_false','["True","False"]','["True"]','The 30-minute break requirement applies after 8 hours of driving.',2),
 ('hos-and-eld','When the ELD malfunctions the driver should:','multiple_choice','["Notify and switch to paper logs","Stop recording hours","Keep driving with no record","Delete prior logs"]','["Notify and switch to paper logs"]','Notify, use paper logs, and get the unit repaired within the required window.',3)
) AS x(cslug,prompt,qtype,options,correct,explanation,sort_order) ON x.cslug = c.slug;