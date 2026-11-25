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
const COURSE_ACKNOWLEDGEMENT_STATEMENT = "I have completed this module and understand its content.";
const CERTIFICATION_STATEMENT = "I certify that I have completed Academy modules 1 through 5.";
const now = () => new Date().toISOString();
const active = (row: Row) => row["superseded_at"] == null;

type ModuleEvaluation = {
  course_id: string;
  title: string;
  complete: boolean;
  missing: string[];
  status: "not_started" | "in_progress" | "completed";
  percent: number;
  total_lessons: number;
  lessons_completed: number;
  prerequisites_met: boolean;
};
type CourseOverviewRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  description: string | null;
  estimated_minutes: number;
  difficulty: string;
  is_required: boolean;
  sort_order: number;
  completion_rules: Record<string, unknown>;
  lesson_count: number;
  missing_requirements: string[];
  quiz_passed: boolean;
  best_score: number;
} & ModuleEvaluation;
type CourseDetailRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  description: string | null;
  estimated_minutes: number;
  difficulty: string;
  objectives: string[];
  completion_rules: Record<string, unknown>;
};
type QuizDetailRow = {
  id: string;
  title: string;
  instructions: string;
  max_attempts: number;
  passing_score: number;
} | null;
type LessonDetailRow = {
  id: string;
  module_id: string;
  sort_order: number;
  title: string;
  body: string;
  duration_minutes: number;
  lesson_type: string;
  media_url: string | null;
  document_url: string | null;
  completed: boolean;
  opened_at: string | null;
  min_view_seconds: number;
};
type DriverProfile = { full_name?: string | null; email?: string | null };
type ModuleDetailRow = { id: string; title: string; sort_order: number };
type QuizQuestionRow = {
  id: string;
  prompt: string;
  question_type: string;
  options: string[];
  sort_order: number;
};
type QuizAttemptRow = {
  id: string;
  score: number;
  passed: boolean;
  attempt_number: number;
  answers: Record<string, string>;
};
type CourseProgressRow = { lesson_id: string; completed: boolean };
type QuizResultRow = {
  question_id: string;
  prompt: string;
  given: string;
  correct: boolean;
  correct_answer: string;
  explanation: string;
};

function requireCurrentUser(userId: string) {
  if (!userId || getDemoUserId() !== userId) throw new Error("Your session has changed.");
  const roles = demoRoles(userId);
  if (!roles.includes("driver") && !roles.includes("administrator"))
    throw new Error("You don't have permission to access the Driver Academy.");
  return roles;
}

function requireDriver(userId: string) {
  requireCurrentUser(userId);
  if (!demoRoles(userId).includes("driver"))
    throw new Error("Only drivers can complete Academy activities.");
}

function requireAdmin(userId: string) {
  requireCurrentUser(userId);
  if (!demoRoles(userId).includes("administrator"))
    throw new Error("Only administrators can manage driver onboarding.");
}

function authorizeTarget(actorId: string, targetId: string) {
  requireCurrentUser(actorId);
  if (actorId !== targetId && !demoRoles(actorId).includes("administrator"))
    throw new Error("You don't have permission to access another driver's Academy records.");
  if (!demoRoles(targetId).includes("driver"))
    throw new Error("Academy records are only available for drivers.");
}

function course(courseId: string): Row {
  const found = table("lms_courses").find(
    (row) => row["id"] === courseId && row["published"] === true && row["archived_at"] == null,
  );
  if (!found) throw new Error("Course not found.");
  return found;
}

function courseIndex(courseId: string) {
  const index = COURSE_ORDER.indexOf(courseId as (typeof COURSE_ORDER)[number]);
  if (index < 0) throw new Error("Course is not part of the required Academy sequence.");
  return index;
}

function lessonsFor(courseId: string) {
  return table("lms_lessons")
    .filter((row) => row["course_id"] === courseId && row["published"] !== false)
    .sort((a, b) => (Number(a["sort_order"]) || 0) - (Number(b["sort_order"]) || 0));
}

function enrollmentFor(userId: string, courseId: string) {
  return table("lms_enrollments").find(
    (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
  );
}

function lessonIsComplete(userId: string, lessonId: string) {
  return table("lms_lesson_progress").some(
    (row) =>
      row["user_id"] === userId &&
      row["lesson_id"] === lessonId &&
      row["completed"] === true &&
      active(row),
  );
}

function currentHandbookSignature(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const version = table("handbook_versions")
    .filter((row) => {
      const date = row["effective_date"];
      return (
        row["published"] === true &&
        row["approval_state"] === "approved" &&
        row["archived_at"] == null &&
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !Number.isNaN(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date &&
        date <= today
      );
    })
    .sort(
      (a, b) =>
        String(b["effective_date"]).localeCompare(String(a["effective_date"])) ||
        String(a["id"]).localeCompare(String(b["id"])),
    )[0];
  if (!version) return null;
  return (
    table("handbook_acknowledgements").find(
      (row) =>
        row["user_id"] === userId && row["handbook_version_id"] === version["id"] && active(row),
    ) ?? null
  );
}

function latestActive<T extends Row>(rows: T[], predicate: (row: T) => boolean) {
  return (
    rows
      .filter((row) => active(row) && predicate(row))
      .sort((a, b) =>
        String(b["created_at"] ?? "").localeCompare(String(a["created_at"] ?? "")),
      )[0] ?? null
  );
}

function evidenceState(userId: string, courseId: string) {
  const courseRow = course(courseId);
  const rules = (courseRow["completion_rules"] ?? {}) as Record<string, unknown>;
  const courseLessons = lessonsFor(courseId);
  const completedLessons = courseLessons.filter((lesson) =>
    lessonIsComplete(userId, String(lesson["id"])),
  );
  const missing: string[] = [];
  if (rules["lessons"] === true && completedLessons.length < courseLessons.length)
    missing.push("lessons");

  const quiz = table("lms_quizzes").find(
    (row) => row["course_id"] === courseId && row["published"] === true,
  );
  const attempts = table("lms_quiz_attempts").filter(
    (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
  );
  const quizPassed = Boolean(quiz && attempts.some((row) => row["passed"] === true));
  if (rules["quiz"] === true && !quizPassed) missing.push("quiz");

  const handbookSignature = currentHandbookSignature(userId);
  if (rules["derived"] === "handbook_signed" && !handbookSignature) missing.push("handbook_signed");

  const confirmations = Array.isArray(rules["confirmations"])
    ? (rules["confirmations"] as string[])
    : [];
  const confirmedKeys = new Set(
    table("lms_item_confirmations")
      .filter((row) => row["user_id"] === userId && row["course_id"] === courseId && active(row))
      .map((row) => String(row["item_key"])),
  );
  for (const key of confirmations) if (!confirmedKeys.has(key)) missing.push(key);

  if (
    rules["acknowledgement"] === true &&
    !table("lms_course_acknowledgements").some(
      (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
    )
  ) {
    missing.push("acknowledgement");
  }

  const certification = latestActive(
    table("lms_driver_certifications"),
    (row) => row["user_id"] === userId,
  );
  const managementVerification = latestActive(
    table("lms_onboarding_verifications"),
    (row) => row["driver_id"] === userId,
  );
  if (rules["certification"] === true && !certification) missing.push("certification");
  if (rules["management_verification"] === true && !managementVerification)
    missing.push("management_verification");

  return {
    missing,
    completedLessons,
    totalLessons: courseLessons.length,
    quizPassed,
    handbookSignature,
    certification,
    managementVerification,
  };
}

function evaluateModuleCore(userId: string, courseId: string): ModuleEvaluation {
  const courseRow = course(courseId);
  const index = courseIndex(courseId);
  const previousCourseComplete =
    index === 0 || evaluateModuleCore(userId, COURSE_ORDER[index - 1]!).complete;
  const evidence = evidenceState(userId, courseId);
  const missing = [...evidence.missing];
  if (!previousCourseComplete) missing.unshift("prerequisite_course");
  const complete = previousCourseComplete && missing.length === 0;
  const previousEnrollment = enrollmentFor(userId, courseId);
  const started =
    previousEnrollment?.["status"] === "in_progress" ||
    previousEnrollment?.["status"] === "completed" ||
    table("lms_course_starts").some(
      (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
    ) ||
    table("lms_lesson_opens").some(
      (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
    ) ||
    evidence.completedLessons.length > 0 ||
    table("lms_quiz_attempts").some(
      (row) => row["user_id"] === userId && row["course_id"] === courseId && active(row),
    );
  const percent = evidence.totalLessons
    ? Math.round((evidence.completedLessons.length / evidence.totalLessons) * 100)
    : 0;
  const status = complete ? "completed" : started ? "in_progress" : "not_started";
  const timestamp = now();
  const updated: Row = {
    ...(previousEnrollment ?? {
      id: uid(),
      user_id: userId,
      course_id: courseId,
      started_at: started ? timestamp : null,
    }),
    status,
    progress_percent: percent,
    last_accessed_at: timestamp,
    completed_at: complete ? (previousEnrollment?.["completed_at"] ?? timestamp) : null,
    missing_requirements: missing,
    updated_at: timestamp,
  };
  if (previousEnrollment) Object.assign(previousEnrollment, updated);
  else table("lms_enrollments").push(updated);
  persist();
  return {
    course_id: courseId,
    title: courseRow["title"],
    complete,
    missing,
    status,
    percent,
    total_lessons: evidence.totalLessons,
    lessons_completed: evidence.completedLessons.length,
    prerequisites_met: previousCourseComplete,
  };
}

/** Server-derived evaluation. Drivers may evaluate themselves; administrators may inspect drivers. */
export function evaluateModule(userId: string, courseId: string): ModuleEvaluation {
  const actorId = getDemoUserId();
  if (!actorId) throw new Error("Please sign in to continue.");
  authorizeTarget(actorId, userId);
  return evaluateModuleCore(userId, courseId);
}

function assertCourseUnlocked(userId: string, courseId: string) {
  const evaluation = evaluateModuleCore(userId, courseId);
  if (!evaluation.prerequisites_met)
    throw new Error("Complete the previous Academy course before starting this course.");
  return evaluation;
}

function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Row = {},
) {
  const entry = {
    id: uid(),
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    created_at: now(),
  };
  table("lms_audit_logs").push(entry);
  table("audit_logs").push({ ...entry });
  persist();
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
    requireCurrentUser(context.userId);
    const courses: CourseOverviewRow[] = table("lms_courses")
      .filter((row) => row["published"] === true && row["archived_at"] == null)
      .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
      .map((row): CourseOverviewRow => {
        const evaluation = evaluateModule(context.userId, String(row["id"]));
        const attempts = table("lms_quiz_attempts").filter(
          (attempt) =>
            attempt["user_id"] === context.userId &&
            attempt["course_id"] === row["id"] &&
            active(attempt),
        );
        return {
          ...row,
          ...evaluation,
          lesson_count: evaluation.total_lessons,
          missing_requirements: evaluation.missing,
          quiz_passed: attempts.some((attempt) => attempt["passed"] === true),
          best_score: attempts.reduce(
            (max, attempt) => Math.max(max, Number(attempt["score"]) || 0),
            0,
          ),
        } as CourseOverviewRow;
      });
    const certification = latestActive(
      table("lms_driver_certifications"),
      (row) => row["user_id"] === context.userId,
    );
    const verification = latestActive(
      table("lms_onboarding_verifications"),
      (row) => row["driver_id"] === context.userId,
    );
    const required = courses.filter((row) => row["is_required"] === true);
    return {
      courses,
      certification,
      verification,
      stats: {
        total: courses.length,
        required: required.length,
        completedRequired: required.filter((row) => row["complete"] === true).length,
        inProgress: courses.filter((row) => row["status"] === "in_progress").length,
        minutes: courses.reduce((sum, row) => sum + (Number(row["estimated_minutes"]) || 0), 0),
        certificationReady: CERTIFICATION_COURSES.every(
          (id) => courses.find((row) => row["id"] === id)?.["complete"] === true,
        ),
      },
    };
  });

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    requireCurrentUser(context.userId);
    const selectedCourseRow = table("lms_courses").find(
      (row) => row["slug"] === data.slug && row["published"] === true && row["archived_at"] == null,
    );
    if (!selectedCourseRow) throw new Error("Course not found.");
    const selectedCourse = selectedCourseRow as Row & CourseDetailRow;
    const courseId = String(selectedCourse["id"]);
    const evaluation = evaluateModule(context.userId, courseId);
    const modules: ModuleDetailRow[] = table("lms_modules")
      .filter((row) => row["course_id"] === courseId)
      .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
      .map((row) => ({
        id: String(row["id"]),
        title: String(row["title"]),
        sort_order: Number(row["sort_order"]) || 0,
      }));
    const lessons: LessonDetailRow[] = lessonsFor(courseId).map((lesson) => ({
      id: String(lesson["id"]),
      module_id: String(lesson["module_id"]),
      sort_order: Number(lesson["sort_order"]) || 0,
      title: String(lesson["title"] ?? ""),
      body: String(lesson["body"] ?? ""),
      duration_minutes: Number(lesson["duration_minutes"]) || 0,
      lesson_type: String(lesson["lesson_type"] ?? "text"),
      media_url: lesson["media_url"] == null ? null : String(lesson["media_url"]),
      document_url: lesson["document_url"] == null ? null : String(lesson["document_url"]),
      min_view_seconds: Math.max(0, Number(lesson["min_view_seconds"]) || 0),
      completed: lessonIsComplete(context.userId, String(lesson["id"])),
      opened_at:
        latestActive(
          table("lms_lesson_opens"),
          (opened) => opened["user_id"] === context.userId && opened["lesson_id"] === lesson["id"],
        )?.["opened_at"] ?? null,
    }));
    const quizRow = table("lms_quizzes").find(
      (row) => row["course_id"] === courseId && row["published"] === true,
    );
    const quiz: QuizDetailRow = quizRow
      ? {
          id: String(quizRow["id"]),
          title: String(quizRow["title"] ?? "Knowledge check"),
          instructions: String(quizRow["description"] ?? ""),
          max_attempts: Number(quizRow["max_attempts"]) || 0,
          passing_score: Number(quizRow["passing_score"]) || 80,
        }
      : null;
    const questions: QuizQuestionRow[] = quiz
      ? table("lms_quiz_questions")
          .filter((row) => row["quiz_id"] === quiz["id"])
          .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
          .map((question) => ({
            id: String(question["id"]),
            prompt: String(question["prompt"] ?? ""),
            question_type: String(question["question_type"] ?? "single_choice"),
            options: Array.isArray(question["options"]) ? question["options"].map(String) : [],
            sort_order: Number(question["sort_order"]) || 0,
          }))
      : [];
    const progress: CourseProgressRow[] = table("lms_lesson_progress")
      .filter(
        (row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row),
      )
      .map((row) => ({
        lesson_id: String(row["lesson_id"]),
        completed: row["completed"] === true,
      }));
    const attempts: QuizAttemptRow[] = table("lms_quiz_attempts")
      .filter(
        (row) => row["user_id"] === context.userId && row["course_id"] === courseId && active(row),
      )
      .sort((a, b) => Number(b["attempt_number"]) - Number(a["attempt_number"]))
      .map((row) => ({
        id: String(row["id"]),
        score: Number(row["score"]) || 0,
        passed: row["passed"] === true,
        attempt_number: Number(row["attempt_number"]) || 0,
        answers: row["answers"] ?? {},
      }));
    const rules = (selectedCourse["completion_rules"] ?? {}) as Record<string, unknown>;
    const links: Array<{ link_key: string; label: string; url: string | null }> = table(
      "required_systems",
    )
      .filter(
        (row) =>
          row["published"] === true && (row["audience"] === "drivers" || row["audience"] === "all"),
      )
      .map((row) => ({
        link_key: String(row["slug"]),
        label: String(row["name"]),
        url: row["official_url"] == null ? null : String(row["official_url"]),
      }));
    return {
      course: selectedCourse,
      modules,
      lessons,
      quiz,
      questions,
      progress,
      enrollment: enrollmentFor(context.userId, courseId) ?? null,
      attempts,
      evaluation,
      rules,
      links,
      evidence: {
        handbook_signed: Boolean(currentHandbookSignature(context.userId)),
        confirmations: table("lms_item_confirmations")
          .filter(
            (row) =>
              row["user_id"] === context.userId && row["course_id"] === courseId && active(row),
          )
          .map((row) => String(row["item_key"])),
        acknowledged: table("lms_course_acknowledgements").some(
          (row) =>
            row["user_id"] === context.userId && row["course_id"] === courseId && active(row),
        ),
        certification: Boolean(
          evaluation.missing.includes("certification") === false && rules["certification"] === true,
        ),
        management_verification: Boolean(
          evaluation.missing.includes("management_verification") === false &&
          rules["management_verification"] === true,
        ),
      },
    };
  });

export const startCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ course_id: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    course(data.course_id);
    assertCourseUnlocked(context.userId, data.course_id);
    appendEvent("lms_course_starts", context.userId, { course_id: data.course_id });
    return { ok: true, evaluation: evaluateModule(context.userId, data.course_id) };
  });

export const openLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lesson_id: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    const lesson = table("lms_lessons").find(
      (row) => row["id"] === data.lesson_id && row["published"] !== false,
    );
    if (!lesson) throw new Error("Lesson not found.");
    const courseId = String(lesson["course_id"]);
    assertCourseUnlocked(context.userId, courseId);
    const opened = appendEvent("lms_lesson_opens", context.userId, {
      lesson_id: data.lesson_id,
      course_id: courseId,
      opened_at: now(),
    });
    return { ok: true, opened_at: opened["opened_at"] };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lesson_id: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    const lesson = table("lms_lessons").find(
      (row) => row["id"] === data.lesson_id && row["published"] !== false,
    );
    if (!lesson) throw new Error("Lesson not found.");
    const courseId = String(lesson["course_id"]);
    assertCourseUnlocked(context.userId, courseId);
    if (lessonIsComplete(context.userId, data.lesson_id))
      return { ok: true, evaluation: evaluateModule(context.userId, courseId) };
    const opened = latestActive(
      table("lms_lesson_opens"),
      (row) => row["user_id"] === context.userId && row["lesson_id"] === data.lesson_id,
    );
    const minSeconds = Math.max(0, Number(lesson["min_view_seconds"]) || 0);
    if (!opened) throw new Error("Open the lesson before completing it.");
    const openedAt = Date.parse(String(opened["opened_at"]));
    const elapsedSeconds = (Date.now() - openedAt) / 1000;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < minSeconds)
      throw new Error("Please finish reviewing this lesson");
    appendEvent("lms_lesson_progress", context.userId, {
      lesson_id: data.lesson_id,
      course_id: courseId,
      completed: true,
      completed_at: now(),
    });
    return { ok: true, evaluation: evaluateModule(context.userId, courseId) };
  });

export const logExternalLinkOpened = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ course_id: z.string().uuid(), link_key: z.string().trim().min(1).max(120) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    course(data.course_id);
    assertCourseUnlocked(context.userId, data.course_id);
    const link = table("required_systems").find(
      (row) => row["slug"] === data.link_key && row["published"] === true,
    );
    if (!link) throw new Error("The requested external link is not configured.");
    const record = appendEvent("lms_external_link_opens", context.userId, {
      course_id: data.course_id,
      link_key: data.link_key,
      official_url: link["official_url"] ?? null,
      opened_at: now(),
    });
    audit(context.userId, "academy_external_link_opened", "lms_external_link_opens", record["id"], {
      course_id: data.course_id,
      link_key: data.link_key,
    });
    return { ok: true, opened_at: record["opened_at"] };
  });

export const confirmItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ course_id: z.string().uuid(), item_key: z.string().trim().min(1).max(160) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    const selectedCourse = course(data.course_id);
    assertCourseUnlocked(context.userId, data.course_id);
    const rules = (selectedCourse["completion_rules"] ?? {}) as Record<string, unknown>;
    const configured = Array.isArray(rules["confirmations"])
      ? (rules["confirmations"] as string[])
      : [];
    if (!configured.includes(data.item_key))
      throw new Error("This confirmation is not configured for the course.");
    const remaining = evidenceState(context.userId, data.course_id).missing;
    if (remaining.some((item) => !configured.includes(item)))
      throw new Error("Complete the course lessons and quiz before recording confirmations.");
    const record = appendEvent("lms_item_confirmations", context.userId, {
      course_id: data.course_id,
      item_key: data.item_key,
      confirmed: true,
    });
    audit(context.userId, "academy_item_confirmed", "lms_item_confirmations", record["id"], {
      course_id: data.course_id,
      item_key: data.item_key,
    });
    return { ok: true, id: record["id"] };
  });

export const acknowledgeModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ course_id: z.string().uuid(), signature_name: z.string().trim().min(2).max(120) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    const selectedCourse = course(data.course_id);
    assertCourseUnlocked(context.userId, data.course_id);
    const rules = (selectedCourse["completion_rules"] ?? {}) as Record<string, unknown>;
    if (rules["acknowledgement"] !== true)
      throw new Error("This course does not require a signed acknowledgement.");
    if (
      evidenceState(context.userId, data.course_id).missing.some(
        (item) => item !== "acknowledgement",
      )
    )
      throw new Error("Complete the course lessons and quiz before acknowledging this course.");
    const timestamp = now();
    const courseVersion = String(selectedCourse["course_version"] ?? "1.0");
    const record = appendEvent("lms_course_acknowledgements", context.userId, {
      course_id: data.course_id,
      course_version: courseVersion,
      statement: COURSE_ACKNOWLEDGEMENT_STATEMENT,
      signature_name: data.signature_name,
      signed_at: timestamp,
      source: {
        method: "web",
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
      },
    });
    audit(
      context.userId,
      "academy_course_acknowledged",
      "lms_course_acknowledgements",
      record["id"],
      {
        course_id: data.course_id,
        course_version: record["course_version"],
      },
    );
    return record;
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ quiz_id: z.string().uuid(), answers: z.record(z.string(), z.string()) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireDriver(context.userId);
    const quiz = table("lms_quizzes").find(
      (row) => row["id"] === data.quiz_id && row["published"] === true,
    );
    if (!quiz) throw new Error("Quiz not found.");
    const courseId = String(quiz["course_id"]);
    assertCourseUnlocked(context.userId, courseId);
    const selectedCourse = course(courseId);
    const rules = (selectedCourse["completion_rules"] ?? {}) as Record<string, unknown>;
    if (rules["quiz"] !== true) throw new Error("This course does not have a required quiz.");
    if (
      lessonsFor(courseId).some((lesson) => !lessonIsComplete(context.userId, String(lesson["id"])))
    )
      throw new Error("Complete every lesson before taking the quiz.");
    const questions = table("lms_quiz_questions")
      .filter((row) => row["quiz_id"] === quiz["id"])
      .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]));
    if (!questions.length) throw new Error("This quiz has no questions.");
    const questionIds = new Set(questions.map((row) => String(row["id"])));
    if (Object.keys(data.answers).some((id) => !questionIds.has(id)))
      throw new Error("Answers include a question that is not part of this quiz.");
    for (const question of questions) {
      const answer = data.answers[String(question["id"])];
      const options = Array.isArray(question["options"]) ? (question["options"] as string[]) : [];
      if (typeof answer !== "string" || !options.includes(answer))
        throw new Error("Select one of the listed options for every question.");
    }
    const prior = table("lms_quiz_attempts").filter(
      (row) => row["user_id"] === context.userId && row["quiz_id"] === quiz["id"] && active(row),
    );
    const attemptNumber = prior.length + 1;
    const maxAttempts = Number(quiz["max_attempts"]) || 0;
    if (maxAttempts > 0 && attemptNumber > maxAttempts)
      throw new Error("You have used all available attempts. Contact your manager to reset.");
    const results: QuizResultRow[] = questions.map((question) => {
      const answer = data.answers[String(question["id"])]!;
      const correctAnswers = Array.isArray(question["correct_answers"])
        ? (question["correct_answers"] as string[])
        : [];
      return {
        question_id: String(question["id"]),
        prompt: String(question["prompt"] ?? ""),
        given: answer,
        correct: correctAnswers.includes(answer),
        correct_answer: correctAnswers[0] ?? "",
        explanation: String(question["explanation"] ?? ""),
      };
    });
    const score = Math.round(
      (results.filter((row) => row.correct).length / questions.length) * 100,
    );
    const passed = score >= Number(quiz["passing_score"] ?? 80);
    const attempt = appendEvent("lms_quiz_attempts", context.userId, {
      quiz_id: quiz["id"],
      course_id: courseId,
      attempt_number: attemptNumber,
      score,
      passed,
      answers: data.answers,
    });
    audit(context.userId, "academy_quiz_submitted", "lms_quiz_attempts", attempt["id"], {
      course_id: courseId,
      score,
      passed,
    });
    return {
      score,
      passed,
      passing_score: Number(quiz["passing_score"] ?? 80),
      attempt_number: attemptNumber,
      attempts_remaining: maxAttempts > 0 ? Math.max(0, maxAttempts - attemptNumber) : null,
      results,
    };
  });

export const driverCertify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ signature_name: z.string().trim().min(2).max(120) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = requireCurrentUser(context.userId);
    if (!roles.includes("driver"))
      throw new Error("Only a driver can certify their own Academy completion.");
    const evaluations = CERTIFICATION_COURSES.map((id) => evaluateModule(context.userId, id));
    if (evaluations.some((result) => !result.complete))
      throw new Error("Complete Academy modules 1 through 5 before certifying.");
    const timestamp = now();
    const record = appendEvent("lms_driver_certifications", context.userId, {
      course_ids: [...CERTIFICATION_COURSES],
      signature_name: data.signature_name,
      statement: CERTIFICATION_STATEMENT,
      source: {
        method: "web",
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
      },
      certified_at: timestamp,
    });
    audit(context.userId, "academy_driver_certified", "lms_driver_certifications", record["id"], {
      course_ids: [...CERTIFICATION_COURSES],
      signature_name: data.signature_name,
    });
    return record;
  });

export const verifyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ driver_id: z.string().uuid(), note: z.string().trim().min(1).max(500) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context.userId);
    if (!demoRoles(data.driver_id).includes("driver"))
      throw new Error("Onboarding verification is only available for drivers.");
    const evaluations = CERTIFICATION_COURSES.map((id) => evaluateModule(data.driver_id, id));
    if (evaluations.some((result) => !result.complete))
      throw new Error("The driver must complete Academy modules 1 through 5 first.");
    const certification = latestActive(
      table("lms_driver_certifications"),
      (row) => row["user_id"] === data.driver_id,
    );
    if (!certification) throw new Error("The driver must certify Academy completion first.");
    const record = appendEvent("lms_onboarding_verifications", data.driver_id, {
      driver_id: data.driver_id,
      verified_by: context.userId,
      note: data.note,
      verified_at: now(),
      certification_id: certification["id"],
      course_ids: [...CERTIFICATION_COURSES],
    });
    audit(
      context.userId,
      "academy_onboarding_verified",
      "lms_onboarding_verifications",
      record["id"],
      {
        driver_id: data.driver_id,
        certification_id: certification["id"],
        note: data.note,
      },
    );
    return record;
  });

export const resetModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        course_id: z.string().uuid(),
        reason: z.string().trim().min(5).max(300),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context.userId);
    if (!demoRoles(data.user_id).includes("driver"))
      throw new Error("Only driver Academy records can be reset.");
    const selectedCourse = course(data.course_id);
    courseIndex(data.course_id);
    const affected = [data.course_id];
    const affectedSet = new Set<string>(affected);
    const stamp = now();
    const eventTables = [
      "lms_course_starts",
      "lms_lesson_opens",
      "lms_lesson_progress",
      "lms_quiz_attempts",
      "lms_external_link_opens",
      "lms_item_confirmations",
      "lms_course_acknowledgements",
      "lms_module_acknowledgements",
    ];
    for (const name of eventTables)
      for (const row of table(name))
        if (
          row["user_id"] === data.user_id &&
          affectedSet.has(String(row["course_id"])) &&
          active(row)
        )
          row["superseded_at"] = stamp;
    for (const row of table("lms_enrollments"))
      if (
        row["user_id"] === data.user_id &&
        affectedSet.has(String(row["course_id"])) &&
        active(row)
      )
        row["superseded_at"] = stamp;
    for (const name of ["lms_driver_certifications", "lms_onboarding_verifications"])
      for (const row of table(name))
        if ((row["user_id"] === data.user_id || row["driver_id"] === data.user_id) && active(row))
          row["superseded_at"] = stamp;
    audit(context.userId, "academy_module_reset", "lms_courses", selectedCourse["id"], {
      user_id: data.user_id,
      reason: data.reason,
      affected_course_ids: affected,
    });
    for (const id of affected) evaluateModuleCore(data.user_id, id);
    persist();
    return { ok: true, affected_course_ids: affected };
  });

export const listDriverOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      Array<{
        user_id: string;
        profile: DriverProfile | null;
        evaluations: ModuleEvaluation[];
        certification: Row | null;
        verification: Row | null;
      }>
    > => {
      requireAdmin(context.userId);
      return table("user_roles")
        .filter((row) => row["role"] === "driver")
        .map((role) => {
          const userId = String(role["user_id"]);
          const evaluations = COURSE_ORDER.map((id) => evaluateModule(userId, id));
          return {
            user_id: userId,
            profile:
              (table("profiles").find((row) => row["id"] === userId) as
                DriverProfile | undefined) ?? null,
            evaluations,
            certification: latestActive(
              table("lms_driver_certifications"),
              (row) => row["user_id"] === userId,
            ),
            verification: latestActive(
              table("lms_onboarding_verifications"),
              (row) => row["driver_id"] === userId,
            ),
          };
        });
    },
  );
