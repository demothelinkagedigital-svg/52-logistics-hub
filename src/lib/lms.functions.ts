import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Catalog + dashboard                                                        */
/* -------------------------------------------------------------------------- */

export const getAcademyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [coursesRes, lessonsRes, enrollRes, progressRes, attemptsRes] = await Promise.all([
      supabase
        .from("lms_courses")
        .select("*")
        .eq("published", true)
        .is("archived_at", null)
        .order("sort_order"),
      supabase.from("lms_lessons").select("id, course_id, duration_minutes"),
      supabase.from("lms_enrollments").select("*").eq("user_id", userId),
      supabase.from("lms_lesson_progress").select("*").eq("user_id", userId),
      supabase.from("lms_quiz_attempts").select("*").eq("user_id", userId),
    ]);

    const lessons = lessonsRes.data ?? [];
    const progress = progressRes.data ?? [];
    const enrollments = enrollRes.data ?? [];
    const attempts = attemptsRes.data ?? [];

    const courses = (coursesRes.data ?? []).map((course) => {
      const courseLessons = lessons.filter((l) => l.course_id === course.id);
      const done = progress.filter(
        (p) => p.course_id === course.id && p.completed,
      ).length;
      const total = courseLessons.length;
      const enrollment = enrollments.find((e) => e.course_id === course.id) ?? null;
      const bestScore = attempts
        .filter((a) => a.course_id === course.id)
        .reduce((max, a) => Math.max(max, a.score), 0);
      const passed = attempts.some((a) => a.course_id === course.id && a.passed);
      return {
        ...course,
        lesson_count: total,
        lessons_completed: done,
        percent: total ? Math.round((done / total) * 100) : 0,
        status: enrollment?.status ?? ("not_started" as const),
        quiz_passed: passed,
        best_score: bestScore,
      };
    });

    const requiredCourses = courses.filter((c) => c.is_required);
    const completedRequired = requiredCourses.filter(
      (c) => c.percent === 100 && c.quiz_passed,
    ).length;

    return {
      courses,
      stats: {
        total: courses.length,
        required: requiredCourses.length,
        completedRequired,
        inProgress: courses.filter((c) => c.percent > 0 && c.percent < 100).length,
        minutes: courses.reduce((sum, c) => sum + (c.estimated_minutes ?? 0), 0),
        certificationReady:
          requiredCourses.length > 0 && completedRequired === requiredCourses.length,
      },
    };
  });

/* -------------------------------------------------------------------------- */
/*  Course detail                                                              */
/* -------------------------------------------------------------------------- */

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: course, error } = await supabase
      .from("lms_courses")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) throw new Error("Course not found");

    const [modulesRes, lessonsRes, quizRes, progressRes, enrollRes, attemptsRes] =
      await Promise.all([
        supabase.from("lms_modules").select("*").eq("course_id", course.id).order("sort_order"),
        supabase.from("lms_lessons").select("*").eq("course_id", course.id).order("sort_order"),
        supabase.from("lms_quizzes").select("*").eq("course_id", course.id).maybeSingle(),
        supabase
          .from("lms_lesson_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", course.id),
        supabase
          .from("lms_enrollments")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", course.id)
          .maybeSingle(),
        supabase
          .from("lms_quiz_attempts")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", course.id)
          .order("attempt_number", { ascending: false }),
      ]);

    const quiz = quizRes.data ?? null;
    let questions: Array<{
      id: string;
      prompt: string;
      question_type: string;
      options: string[];
      sort_order: number;
    }> = [];
    if (quiz) {
      const { data: qs } = await supabase
        .from("lms_quiz_questions")
        .select("id, prompt, question_type, options, sort_order")
        .eq("quiz_id", quiz.id)
        .order("sort_order");
      // Correct answers are deliberately never sent to the client.
      questions = (qs ?? []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        question_type: q.question_type,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        sort_order: q.sort_order,
      }));
    }

    return {
      course,
      modules: modulesRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      quiz,
      questions,
      progress: progressRes.data ?? [],
      enrollment: enrollRes.data ?? null,
      attempts: attemptsRes.data ?? [],
    };
  });

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                  */
/* -------------------------------------------------------------------------- */

async function recomputeEnrollment(
  supabase: { from: (t: string) => any },
  userId: string,
  courseId: string,
  lastLessonId?: string,
) {
  const [{ count: total }, { count: done }] = await Promise.all([
    supabase.from("lms_lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    supabase
      .from("lms_lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .eq("completed", true),
  ]);
  const totalLessons = total ?? 0;
  const completed = done ?? 0;
  const percent = totalLessons ? Math.round((completed / totalLessons) * 100) : 0;
  const now = new Date().toISOString();
  await supabase.from("lms_enrollments").upsert(
    {
      user_id: userId,
      course_id: courseId,
      status: percent === 0 ? "not_started" : percent === 100 ? "completed" : "in_progress",
      progress_percent: percent,
      last_lesson_id: lastLessonId ?? null,
      started_at: now,
      completed_at: percent === 100 ? now : null,
      last_accessed_at: now,
    },
    { onConflict: "user_id,course_id" },
  );
  return percent;
}

export const startCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ course_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const percent = await recomputeEnrollment(supabase as never, userId, data.course_id);
    return { ok: true, percent };
  });

export const setLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lesson_id: z.string().uuid(),
        course_id: z.string().uuid(),
        completed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("lms_lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: data.lesson_id,
        course_id: data.course_id,
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);
    const percent = await recomputeEnrollment(
      supabase as never,
      userId,
      data.course_id,
      data.lesson_id,
    );
    return { ok: true, percent };
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        quiz_id: z.string().uuid(),
        answers: z.record(z.string(), z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: quiz, error: quizErr } = await supabase
      .from("lms_quizzes")
      .select("*")
      .eq("id", data.quiz_id)
      .maybeSingle();
    if (quizErr) throw new Error(quizErr.message);
    if (!quiz) throw new Error("Quiz not found");

    const { count: usedAttempts } = await supabase
      .from("lms_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("quiz_id", quiz.id);
    const attemptNumber = (usedAttempts ?? 0) + 1;
    if (quiz.max_attempts > 0 && attemptNumber > quiz.max_attempts) {
      throw new Error("You have used all available attempts. Contact your manager to reset.");
    }

    const { data: questions } = await supabase
      .from("lms_quiz_questions")
      .select("id, correct_answers, explanation, prompt")
      .eq("quiz_id", quiz.id)
      .order("sort_order");

    const rows = questions ?? [];
    const results = rows.map((q) => {
      const correct = Array.isArray(q.correct_answers) ? (q.correct_answers as string[]) : [];
      const given = data.answers[q.id] ?? "";
      return {
        question_id: q.id,
        prompt: q.prompt,
        given,
        correct: correct.includes(given),
        correct_answer: correct[0] ?? "",
        explanation: q.explanation,
      };
    });

    const right = results.filter((r) => r.correct).length;
    const score = rows.length ? Math.round((right / rows.length) * 100) : 0;
    const passed = score >= quiz.passing_score;

    const { error: insertErr } = await supabase.from("lms_quiz_attempts").insert({
      user_id: userId,
      quiz_id: quiz.id,
      course_id: quiz.course_id,
      attempt_number: attemptNumber,
      score,
      passed,
      answers: data.answers,
    });
    if (insertErr) throw new Error(insertErr.message);

    return {
      score,
      passed,
      passing_score: quiz.passing_score,
      attempt_number: attemptNumber,
      attempts_remaining: Math.max(0, quiz.max_attempts - attemptNumber),
      results,
    };
  });
