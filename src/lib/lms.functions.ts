import { createServerFn, requireSupabaseAuth } from "@/lib/mock/server-fn";
import { demoRoles, getDemoUserId } from "@/lib/mock/client";
import { persist, table, uid, type Row } from "@/lib/mock/db";
import { z } from "zod";

const COURSE_ORDER = [
  "c1000000-0000-4000-a000-000000000001",
  "c1000000-0000-4000-a000-000000000002",
  "c1000000-0000-4000-a000-000000000003",
  "c1000000-0000-4000-a000-000000000004",
  "c1000000-0000-4000-a000-000000000005",
  "c1000000-0000-4000-a000-000000000006",
] as const;
const CERTIFICATION_COURSES = COURSE_ORDER.slice(0, 5);
const now = () => new Date().toISOString();
const active = (row: Row) => row["superseded_at"] == null;

function requireCurrentUser(userId: string) {
  if (!userId || getDemoUserId() !== userId) throw new Error("Your session has changed.");
  const roles = demoRoles(userId);
  if (!roles.includes("driver") && !roles.includes("administrator"))
    throw new Error("You don't have permission to access the Driver Academy.");
  return roles;
}

function requireAdmin(userId: string) {
  requireCurrentUser(userId);
  if (!demoRoles(userId).includes("administrator"))
    throw new Error("Only administrators can manage driver onboarding.");
}

function course(courseId: string): Row {
  const found = table("lms_courses").find((row) => row["id"] === courseId && row["published"] === true && row["archived_at"] == null);
  if (!found) throw new Error("Course not found.");
  return found;
}

function lessonsFor(courseId: string) {
  return table("lms_lessons")
    .filter((row) => row["course_id"] === courseId && row["published"] !== false)
    .sort((a, b) => (Number(a["sort_order"]) || 0) - (Number(b["sort_order"]) || 0));
}

function enrollmentFor(userId: string, courseId: string) {
  return table("lms_enrollments").find((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row));
}

function lessonIsComplete(userId: string, lessonId: string) {
  return table("lms_lesson_progress").some((row) => row["user_id"] === userId && row["lesson_id"] === lessonId && row["completed"] === true && active(row));
}

function currentHandbookSignature(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const version = table("handbook_versions")
    .filter((row) => {
      const date = row["effective_date"];
      return row["published"] === true && row["approval_state"] === "approved" && row["archived_at"] == null &&
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date && date <= today;
    })
    .sort((a, b) => String(b["effective_date"]).localeCompare(String(a["effective_date"])) || String(a["id"]).localeCompare(String(b["id"])))[0];
  if (!version) return null;
  return table("handbook_acknowledgements").find((row) => row["user_id"] === userId && row["handbook_version_id"] === version["id"] && active(row)) ?? null;
}

function latestActive<T extends Row>(rows: T[], predicate: (row: T) => boolean) {
  return rows.filter((row) => active(row) && predicate(row)).sort((a, b) => String(b["created_at"] ?? "").localeCompare(String(a["created_at"] ?? "")))[0] ?? null;
}

type ModuleEvaluation = {
  course_id: string;
  title: unknown;
  status: string;
  completed: boolean;
  percent: number;
  total_lessons: number;
  lessons_completed: number;
  missing_requirements: string[];
  prerequisites_met: boolean;
  rules: Record<string, unknown>;
};

function coursePrerequisitesMet(userId: string, courseId: string) {
  const courseRow = course(courseId);
  const rules = (courseRow["completion_rules"] ?? {}) as Record<string, unknown>;
  const prereqs = Array.isArray(rules["prerequisite_course_ids"]) ? rules["prerequisite_course_ids"] as string[] : [];
  return prereqs.every((prereqId) => evaluateModuleCore(userId, prereqId).completed);
}

function evidenceState(userId: string, courseId: string) {
  const courseRow = course(courseId);
  const rules = (courseRow["completion_rules"] ?? {}) as Record<string, unknown>;
  const currentLessons = lessonsFor(courseId);
  const missing: string[] = [];
  const completedLessons = currentLessons.filter((lesson) => lessonIsComplete(userId, String(lesson["id"])));
  if (rules["requires_all_lessons"] === true && completedLessons.length < currentLessons.length) missing.push("lessons");

  const quiz = table("lms_quizzes").find((row) => row["course_id"] === courseId && row["published"] === true);
  const attempts = table("lms_quiz_attempts").filter((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row));
  const quizPassed = quiz ? attempts.some((row) => row["passed"] === true) : rules["requires_quiz"] !== true;
  if (rules["requires_quiz"] === true && !quizPassed) missing.push("quiz");

  const signature = currentHandbookSignature(userId);
  if (rules["requires_current_handbook_signature"] === true && !signature) missing.push("current_handbook_signature");
  if (rules["requires_external_link_open"] === true && !table("lms_external_link_opens").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row))) missing.push("external_link_open");
  if (rules["requires_item_confirmation"] === true && !table("lms_item_confirmations").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row))) missing.push("item_confirmation");
  if (rules["requires_module_acknowledgement"] === true && !table("lms_module_acknowledgements").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row))) missing.push("module_acknowledgement");

  return { missing, completedLessons, totalLessons: currentLessons.length, quizPassed, signature };
}

function requirementsMetExcept(userId: string, courseId: string, ignored: string) {
  if (!coursePrerequisitesMet(userId, courseId)) return false;
  const evidence = evidenceState(userId, courseId);
  return evidence.missing.every((item) => item === ignored);
}

function evaluateModuleCore(userId: string, courseId: string): ModuleEvaluation {
  const courseRow = course(courseId);
  const rules = (courseRow["completion_rules"] ?? {}) as Record<string, unknown>;
  const prerequisitesMet = coursePrerequisitesMet(userId, courseId);
  const evidence = evidenceState(userId, courseId);
  const missing = [...evidence.missing];
  if (!prerequisitesMet) missing.unshift("prerequisites");
  const completed = prerequisitesMet && missing.length === 0;
  const previous = enrollmentFor(userId, courseId);
  const lessonOpens = table("lms_lesson_opens").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row));
  const started = previous?.["status"] === "in_progress" || previous?.["status"] === "completed" || lessonOpens || evidence.completedLessons.length > 0 ||
    table("lms_course_starts").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row)) ||
    table("lms_quiz_attempts").some((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row));
  const percent = evidence.totalLessons ? Math.round((evidence.completedLessons.length / evidence.totalLessons) * 100) : 0;
  const status = completed ? "completed" : started ? "in_progress" : "not_started";
  const stamp = now();
  const updated: Row = {
    ...(previous ?? { id: uid(), user_id: userId, course_id: courseId, started_at: started ? stamp : null }),
    status,
    progress_percent: percent,
    last_accessed_at: stamp,
    completed_at: completed ? (previous?.["completed_at"] ?? stamp) : null,
    missing_requirements: missing,
    updated_at: stamp,
  };
  if (previous) Object.assign(previous, updated);
  else table("lms_enrollments").push(updated);
  persist();
  return {
    course_id: courseId,
    title: courseRow["title"],
    status,
    completed,
    percent,
    total_lessons: evidence.totalLessons,
    lessons_completed: evidence.completedLessons.length,
    missing_requirements: missing,
    prerequisites_met: prerequisitesMet,
    rules,
  };
}

function audit(actorId: string, action: string, targetType: string, targetId: string | null, metadata: Row = {}) {
  table("lms_audit_logs").push({ id: uid(), actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata, created_at: now() });
  table("audit_logs").push({ id: uid(), actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata, created_at: now() });
}

function appendEvent(tableName: string, userId: string, values: Row): Row {
  const record = { id: uid(), user_id: userId, ...values, created_at: now() };
  table(tableName).push(record);
  persist();
  return record;
}

export const getAcademyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    requireCurrentUser(userId);
    const courses: Row[] = table("lms_courses").filter((row) => row["published"] === true && row["archived_at"] == null)
      .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
      .map((row) => {
        const evaluation = evaluateModuleCore(userId, String(row["id"]));
        const attempts = table("lms_quiz_attempts").filter((attempt) => attempt["user_id"] === userId && attempt["course_id"] === row["id"] && active(attempt));
        return { ...row, ...evaluation, quiz_passed: attempts.some((attempt) => attempt["passed"] === true), best_score: attempts.reduce((max, attempt) => Math.max(max, Number(attempt["score"]) || 0), 0) };
      });
    const certifications = table("lms_driver_certifications").filter((row) => row["user_id"] === userId && active(row));
    const verifications = table("lms_onboarding_verifications").filter((row) => row["user_id"] === userId && active(row));
    const required = courses.filter((row) => row["is_required"] === true);
    const completedRequired = required.filter((row) => row["completed"] === true).length;
    return {
      courses,
      certification: certifications.at(-1) ?? null,
      verification: verifications.at(-1) ?? null,
      stats: {
        total: courses.length,
        required: required.length,
        completedRequired,
        inProgress: courses.filter((row) => row["status"] === "in_progress").length,
        minutes: courses.reduce((sum, row) => sum + (Number(row["estimated_minutes"]) || 0), 0),
        certificationReady: CERTIFICATION_COURSES.every((id) => courses.find((row) => row["id"] === id)?.["completed"] === true),
      },
    };
  });

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const found = table("lms_courses").find((row) => row["slug"] === data.slug && row["published"] === true && row["archived_at"] == null);
    if (!found) throw new Error("Course not found.");
    const courseId = String(found["id"]);
    const evaluation = evaluateModuleCore(context.userId, courseId);
    const modules = table("lms_modules").filter((row) => row["course_id"] === courseId).sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]));
    const lessons = lessonsFor(courseId).map((lesson) => ({ ...lesson, completed: lessonIsComplete(context.userId, String(lesson["id"])), opened_at: latestActive(table("lms_lesson_opens"), (open) => open["user_id"] === context.userId && open["lesson_id"] === lesson["id"])?.["opened_at"] ?? null }));
    const quiz = table("lms_quizzes").find((row) => row["course_id"] === courseId && row["published"] === true) ?? null;
    const questions = quiz ? table("lms_quiz_questions").filter((row) => row["quiz_id"] === quiz["id"]).sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
      .map(({ id, prompt, question_type, options, sort_order }) => ({ id, prompt, question_type, options, sort_order })) : [];
    const progress = table("lms_lesson_progress").filter((row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row));
    const attempts = table("lms_quiz_attempts").filter((row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row)).sort((a, b) => Number(b["attempt_number"]) - Number(a["attempt_number"]));
    return {
      course: found,
      modules,
      lessons,
      quiz,
      questions,
      progress,
      enrollment: enrollmentFor(context.userId, courseId) ?? null,
      attempts,
      evaluation,
      evidence: {
        handbook_signed: Boolean(currentHandbookSignature(context.userId)),
        external_link_opened: table("lms_external_link_opens").some((row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row)),
        item_confirmed: table("lms_item_confirmations").some((row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row)),
        module_acknowledged: table("lms_module_acknowledgements").some((row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row)),
      },
    };
  });

export const startCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ course_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    course(data.course_id);
    if (!coursePrerequisitesMet(context.userId, data.course_id)) throw new Error("Complete the prerequisite course before starting this course.");
    appendEvent("lms_course_starts", context.userId, { course_id: data.course_id });
    return { ok: true, evaluation: evaluateModuleCore(context.userId, data.course_id) };
  });

export const openLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const lesson = table("lms_lessons").find((row) => row["id"] === data.lesson_id && row["published"] !== false);
    if (!lesson) throw new Error("Lesson not found.");
    const courseId = String(lesson["course_id"]);
    if (!coursePrerequisitesMet(context.userId, courseId)) throw new Error("Complete the prerequisite course before opening this lesson.");
    const opened = appendEvent("lms_lesson_opens", context.userId, { lesson_id: data.lesson_id, course_id: courseId, opened_at: now() });
    return { ok: true, opened_at: opened["opened_at"] };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const lesson = table("lms_lessons").find((row) => row["id"] === data.lesson_id && row["published"] !== false);
    if (!lesson) throw new Error("Lesson not found.");
    const courseId = String(lesson["course_id"]);
    if (!coursePrerequisitesMet(context.userId, courseId)) throw new Error("Complete the prerequisite course before completing this lesson.");
    if (lessonIsComplete(context.userId, data.lesson_id)) return { ok: true, evaluation: evaluateModuleCore(context.userId, courseId) };
    const opened = latestActive(table("lms_lesson_opens"), (row) => row["user_id"] === context.userId && row["lesson_id"] === data.lesson_id);
    const minSeconds = Math.max(0, Number(lesson["min_view_seconds"]) || 0);
    if (!opened) throw new Error("Open the lesson before marking it complete.");
    const elapsedSeconds = (Date.now() - Date.parse(String(opened["opened_at"]))) / 1000;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < minSeconds) throw new Error(`Review this lesson for at least ${minSeconds} seconds before completing it.`);
    appendEvent("lms_lesson_progress", context.userId, { lesson_id: data.lesson_id, course_id: courseId, completed: true, completed_at: now() });
    return { ok: true, evaluation: evaluateModuleCore(context.userId, courseId) };
  });

export const logExternalLinkOpened = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ course_id: z.string().uuid(), item_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    course(data.course_id);
    if (!requirementsMetExcept(context.userId, data.course_id, "external_link_open")) throw new Error("Complete the other course requirements before opening the required external link.");
    const item = table("required_systems").find((row) => row["id"] === data.item_id && row["published"] === true);
    if (!item) throw new Error("The selected approved system was not found.");
    const record = appendEvent("lms_external_link_opens", context.userId, { course_id: data.course_id, item_id: data.item_id, official_url: item["official_url"] ?? null });
    audit(context.userId, "academy_external_link_opened", "lms_external_link_opens", record["id"], { course_id: data.course_id, item_id: data.item_id });
    return { ok: true, opened_at: record["created_at"] };
  });

export const confirmItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ course_id: z.string().uuid(), item_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    course(data.course_id);
    if (!requirementsMetExcept(context.userId, data.course_id, "item_confirmation")) throw new Error("Complete the other course requirements before confirming this item.");
    const item = [...table("lms_modules"), ...table("lms_lessons")].find((row) => row["id"] === data.item_id && row["course_id"] === data.course_id);
    if (!item) throw new Error("The item does not belong to this course.");
    if (table("lms_item_confirmations").some((row) => row["user_id"] === context.userId && row["course_id"] === data.course_id && row["item_id"] === data.item_id && active(row))) return { ok: true };
    const record = appendEvent("lms_item_confirmations", context.userId, { course_id: data.course_id, item_id: data.item_id, confirmed: true });
    audit(context.userId, "academy_item_confirmed", "lms_item_confirmations", record["id"], { course_id: data.course_id, item_id: data.item_id });
    return { ok: true };
  });

export const acknowledgeModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ module_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const module = table("lms_modules").find((row) => row["id"] === data.module_id && row["published"] === true);
    if (!module) throw new Error("Module not found.");
    const courseId = String(module["course_id"]);
    if (!requirementsMetExcept(context.userId, courseId, "module_acknowledgement")) throw new Error("Complete the other course requirements before acknowledging this module.");
    const rules = (course(courseId)["completion_rules"] ?? {}) as Record<string, unknown>;
    if (rules["requires_current_handbook_signature"] === true && !currentHandbookSignature(context.userId)) throw new Error("Sign the current handbook before acknowledging this module.");
    if (table("lms_module_acknowledgements").some((row) => row["user_id"] === context.userId && row["module_id"] === data.module_id && active(row))) return { ok: true };
    const record = appendEvent("lms_module_acknowledgements", context.userId, { course_id: courseId, module_id: data.module_id, acknowledged: true });
    audit(context.userId, "academy_module_acknowledged", "lms_module_acknowledgements", record["id"], { course_id: courseId, module_id: data.module_id });
    return { ok: true };
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quiz_id: z.string().uuid(), answers: z.record(z.string(), z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const quiz = table("lms_quizzes").find((row) => row["id"] === data.quiz_id && row["published"] === true);
    if (!quiz) throw new Error("Quiz not found.");
    const courseId = String(quiz["course_id"]);
    if (!coursePrerequisitesMet(context.userId, courseId)) throw new Error("Complete the prerequisite course first.");
    const courseLessons = lessonsFor(courseId);
    if (courseLessons.some((lesson) => !lessonIsComplete(context.userId, String(lesson["id"])))) throw new Error("Complete every lesson before taking the quiz.");
    const questions = table("lms_quiz_questions").filter((row) => row["quiz_id"] === quiz["id"]).sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]));
    if (!questions.length) throw new Error("This quiz has no questions.");
    const questionIds = new Set(questions.map((row) => String(row["id"])));
    if (Object.keys(data.answers).some((id) => !questionIds.has(id))) throw new Error("Answers include a question that is not part of this quiz.");
    for (const question of questions) {
      const answer = data.answers[String(question["id"])];
      const options = Array.isArray(question["options"]) ? question["options"] as string[] : [];
      if (typeof answer !== "string" || !options.includes(answer)) throw new Error("Select one of the listed options for every question.");
    }
    const prior = table("lms_quiz_attempts").filter((row) => row["user_id"] === context.userId && row["quiz_id"] === quiz["id"] && active(row));
    const attemptNumber = prior.length + 1;
    const maxAttempts = Number(quiz["max_attempts"]) || 0;
    if (maxAttempts > 0 && attemptNumber > maxAttempts) throw new Error("You have used all available attempts. Contact your manager to reset.");
    const results = questions.map((question) => {
      const answer = data.answers[String(question["id"])]!;
      return {
        question_id: question["id"],
        given: answer,
        correct: (Array.isArray(question["correct_answers"]) ? question["correct_answers"] as string[] : []).includes(answer),
      };
    });
    const score = Math.round((results.filter((row) => row.correct).length / questions.length) * 100);
    const passed = score >= Number(quiz["passing_score"] ?? 80);
    const attempt = appendEvent("lms_quiz_attempts", context.userId, { quiz_id: quiz["id"], course_id: courseId, attempt_number: attemptNumber, score, passed, answers: data.answers });
    audit(context.userId, "academy_quiz_submitted", "lms_quiz_attempts", attempt["id"], { course_id: courseId, score, passed });
    return { score, passed, passing_score: Number(quiz["passing_score"] ?? 80), attempt_number: attemptNumber, attempts_remaining: maxAttempts > 0 ? Math.max(0, maxAttempts - attemptNumber) : null, results };
  });

export const evaluateModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ course_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    return evaluateModuleCore(context.userId, data.course_id);
  });

export const driverCertify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    const roles = requireCurrentUser(context.userId);
    if (!roles.includes("driver")) throw new Error("Only a driver can certify their own Academy completion.");
    const evaluations = CERTIFICATION_COURSES.map((id) => evaluateModuleCore(context.userId, id));
    if (evaluations.some((result) => !result.completed)) throw new Error("Complete Academy modules 1 through 5 before certifying.");
    const existing = latestActive(table("lms_driver_certifications"), (row) => row["user_id"] === context.userId);
    if (existing) return existing;
    const record = appendEvent("lms_driver_certifications", context.userId, { course_ids: [...CERTIFICATION_COURSES], certified_at: now() });
    audit(context.userId, "academy_driver_certified", "lms_driver_certifications", record["id"], { course_ids: [...CERTIFICATION_COURSES] });
    return record;
  });

export const verifyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    requireAdmin(context.userId);
    const roles = demoRoles(data.user_id);
    if (!roles.includes("driver")) throw new Error("Onboarding verification is only available for drivers.");
    const evaluations = CERTIFICATION_COURSES.map((id) => evaluateModuleCore(data.user_id, id));
    if (evaluations.some((result) => !result.completed)) throw new Error("The driver must complete Academy modules 1 through 5 first.");
    const certification = latestActive(table("lms_driver_certifications"), (row) => row["user_id"] === data.user_id);
    if (!certification) throw new Error("The driver must certify Academy completion first.");
    const record = appendEvent("lms_onboarding_verifications", data.user_id, { verified_by: context.userId, verified_at: now(), certification_id: certification["id"], course_ids: [...CERTIFICATION_COURSES] });
    audit(context.userId, "academy_onboarding_verified", "lms_onboarding_verifications", record["id"], { user_id: data.user_id, certification_id: certification["id"] });
    return record;
  });

export const resetModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid(), course_id: z.string().uuid(), reason: z.string().trim().min(5).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    requireAdmin(context.userId);
    if (!demoRoles(data.user_id).includes("driver")) throw new Error("Only driver Academy records can be reset.");
    const selectedCourse = course(data.course_id);
    const sortOrder = Number(selectedCourse["sort_order"]);
    const affected = table("lms_courses").filter((row) => Number(row["sort_order"]) >= sortOrder).map((row) => String(row["id"]));
    const affectedSet = new Set(affected);
    const stamp = now();
    const eventTables = ["lms_course_starts", "lms_lesson_opens", "lms_lesson_progress", "lms_quiz_attempts", "lms_external_link_opens", "lms_item_confirmations", "lms_module_acknowledgements"];
    for (const name of eventTables) for (const row of table(name)) if (row["user_id"] === data.user_id && affectedSet.has(String(row["course_id"])) && active(row)) row["superseded_at"] = stamp;
    for (const row of table("lms_enrollments")) if (row["user_id"] === data.user_id && affectedSet.has(String(row["course_id"])) && active(row)) row["superseded_at"] = stamp;
    if (CERTIFICATION_COURSES.some((id) => affectedSet.has(id))) {
      for (const name of ["lms_driver_certifications", "lms_onboarding_verifications"])
        for (const row of table(name))
          if (row["user_id"] === data.user_id && active(row)) row["superseded_at"] = stamp;
    }
    audit(context.userId, "academy_module_reset", "lms_courses", data.course_id, { user_id: data.user_id, reason: data.reason, affected_course_ids: affected });
    for (const id of affected) evaluateModuleCore(data.user_id, id);
    persist();
    return { ok: true, affected_course_ids: affected };
  });

export const listDriverOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    requireAdmin(context.userId);
    return table("user_roles").filter((row) => row["role"] === "driver").map((role) => {
      const userId = String(role["user_id"]);
      const evaluations = CERTIFICATION_COURSES.map((id) => evaluateModuleCore(userId, id));
      return {
        user_id: userId,
        profile: table("profiles").find((row) => row["id"] === userId) ?? null,
        evaluations,
        certification: latestActive(table("lms_driver_certifications"), (row) => row["user_id"] === userId),
        verification: latestActive(table("lms_onboarding_verifications"), (row) => row["user_id"] === userId),
      };
    });
  });
