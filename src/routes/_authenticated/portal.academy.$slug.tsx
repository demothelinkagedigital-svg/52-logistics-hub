import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Target,
  XCircle,
} from "lucide-react";
import { getCourse, setLessonComplete, submitQuiz } from "@/lib/lms.functions";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import { AccessDenied, ErrorState, Panel, TableSkeleton } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/academy/$slug")({
  head: () => ({
    meta: [
      { title: "Course — Driver Academy — 52 Logistics Portal" },
      {
        name: "description",
        content: "Work through Driver Academy lessons and complete the course knowledge check.",
      },
      { property: "og:title", content: "Course — Driver Academy — 52 Logistics Portal" },
      {
        property: "og:description",
        content: "Lessons, objectives and knowledge check for a 52 Logistics Academy course.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursePlayer,
});

type QuizResult = Awaited<ReturnType<typeof submitQuiz>>;

function CoursePlayer() {
  const { slug } = Route.useParams();
  const { isDriver, isAdmin, isLoading: sessionLoading } = useSession();
  const fetchCourse = useServerFn(getCourse);
  const markLesson = useServerFn(setLessonComplete);
  const sendQuiz = useServerFn(submitQuiz);
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"lesson" | "quiz">("lesson");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["academy-course", slug],
    queryFn: () => fetchCourse({ data: { slug } }),
    enabled: isDriver || isAdmin,
  });

  const ordered = useMemo(() => {
    if (!data) return [];
    return data.modules.flatMap((m) =>
      data.lessons
        .filter((l) => l.module_id === m.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({ ...l, moduleTitle: m.title })),
    );
  }, [data]);

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isDriver && !isAdmin) return <AccessDenied need="driver" />;
  if (isLoading) return <TableSkeleton rows={8} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  const completedIds = new Set(data.progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const current = ordered.find((l) => l.id === activeId) ?? ordered[0];
  const currentIndex = current ? ordered.findIndex((l) => l.id === current.id) : -1;
  const percent = ordered.length ? Math.round((completedIds.size / ordered.length) * 100) : 0;
  const allLessonsDone = ordered.length > 0 && completedIds.size === ordered.length;
  const bestAttempt = data.attempts[0] ?? null;
  const quizPassed = data.attempts.some((a) => a.passed);

  async function complete(lessonId: string, next: boolean) {
    try {
      await markLesson({
        data: { lesson_id: lessonId, course_id: data!.course.id, completed: next },
      });
      await queryClient.invalidateQueries({ queryKey: ["academy-course", slug] });
      await queryClient.invalidateQueries({ queryKey: ["academy-overview"] });
      if (next && currentIndex >= 0 && currentIndex < ordered.length - 1) {
        setActiveId(ordered[currentIndex + 1]!.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save progress");
    }
  }

  async function handleQuizSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.quiz) return;
    if (data.questions.some((q) => !answers[q.id])) {
      toast.error("Answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await sendQuiz({ data: { quiz_id: data.quiz.id, answers } });
      setResult(res);
      await queryClient.invalidateQueries({ queryKey: ["academy-course", slug] });
      await queryClient.invalidateQueries({ queryKey: ["academy-overview"] });
      if (res.passed) toast.success(`Passed with ${res.score}%`);
      else toast.error(`Scored ${res.score}% — ${res.passing_score}% required`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit knowledge check");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        to="/portal/academy"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Driver Academy
      </Link>

      <PortalHeading
        eyebrow={data.course.category}
        title={data.course.title}
        blurb={data.course.description ?? data.course.summary ?? ""}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden="true" />
          {data.course.estimated_minutes} min
        </span>
        <span className="inline-flex items-center gap-1.5 capitalize">
          <Target className="size-3.5" aria-hidden="true" />
          {data.course.difficulty}
        </span>
        <span className="font-semibold tabular-nums text-foreground">{percent}% complete</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <nav aria-label="Course contents" className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-sm border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold tracking-wide uppercase">Contents</h2>
            </div>
            <ol className="divide-y divide-border">
              {data.modules.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {m.title}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {ordered
                      .filter((l) => l.module_id === m.id)
                      .map((l) => {
                        const done = completedIds.has(l.id);
                        const active = mode === "lesson" && current?.id === l.id;
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveId(l.id);
                                setMode("lesson");
                              }}
                              aria-current={active ? "true" : undefined}
                              className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors ${
                                active ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
                              }`}
                            >
                              {done ? (
                                <CheckCircle2
                                  className="size-4 shrink-0 text-emerald-600"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Circle
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="min-w-0 flex-1">{l.title}</span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
              {data.quiz ? (
                <li className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMode("quiz")}
                    aria-current={mode === "quiz" ? "true" : undefined}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors ${
                      mode === "quiz" ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
                    }`}
                  >
                    {quizPassed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    )}
                    <span>Knowledge check</span>
                  </button>
                </li>
              ) : null}
            </ol>
          </div>
        </nav>

        {/* Content */}
        <div className="lg:col-span-8 xl:col-span-9">
          {mode === "quiz" && data.quiz ? (
            <Panel title={data.quiz.title}>
              <p className="text-sm text-muted-foreground">{data.quiz.instructions}</p>
              {!allLessonsDone ? (
                <p className="mt-4 rounded-sm border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium">
                  Complete every lesson before taking the knowledge check.
                </p>
              ) : null}
              {bestAttempt ? (
                <p className="mt-4 text-sm">
                  Last attempt:{" "}
                  <span className="font-semibold tabular-nums">{bestAttempt.score}%</span> —{" "}
                  {bestAttempt.passed ? "passed" : "not passed"} (attempt{" "}
                  {bestAttempt.attempt_number} of {data.quiz.max_attempts})
                </p>
              ) : null}

              {result ? (
                <div className="mt-6 space-y-4">
                  <div
                    className={`rounded-sm border px-4 py-3 ${
                      result.passed
                        ? "border-emerald-600/30 bg-emerald-500/10"
                        : "border-destructive/30 bg-destructive/10"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {result.passed ? "Passed" : "Not passed"} — {result.score}% (
                      {result.passing_score}% required)
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.attempts_remaining} attempt
                      {result.attempts_remaining === 1 ? "" : "s"} remaining.
                    </p>
                  </div>
                  <ul className="divide-y divide-border">
                    {result.results.map((r) => (
                      <li key={r.question_id} className="flex gap-3 py-3">
                        {r.correct ? (
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <XCircle
                            className="mt-0.5 size-4 shrink-0 text-destructive"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{r.prompt}</p>
                          {!r.correct ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Correct answer: {r.correct_answer}
                            </p>
                          ) : null}
                          {r.explanation ? (
                            <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!result.passed && result.attempts_remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setAnswers({});
                      }}
                      className="min-h-11 rounded-sm border border-input px-4 text-sm font-semibold hover:bg-secondary"
                    >
                      Retake knowledge check
                    </button>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleQuizSubmit} className="mt-6 space-y-6">
                  {data.questions.map((q, i) => (
                    <fieldset key={q.id} className="border-t border-border pt-4">
                      <legend className="text-sm font-semibold">
                        {i + 1}. {q.prompt}
                      </legend>
                      <div className="mt-3 space-y-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-border px-3 text-sm hover:bg-secondary/60"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                              className="size-4 accent-[var(--color-accent)]"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <button
                    type="submit"
                    disabled={submitting || !allLessonsDone}
                    className="min-h-11 rounded-sm bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Submit knowledge check"}
                  </button>
                </form>
              )}
            </Panel>
          ) : current ? (
            <Panel title={current.moduleTitle}>
              <h2 className="text-xl font-bold">{current.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {current.duration_minutes} min · {current.lesson_type}
              </p>

              {current.media_url && current.lesson_type === "image" ? (
                <img
                  src={current.media_url}
                  alt={current.title}
                  loading="lazy"
                  className="mt-5 w-full rounded-sm border border-border object-cover"
                />
              ) : null}
              {current.media_url && current.lesson_type === "video" ? (
                <video
                  src={current.media_url}
                  controls
                  className="mt-5 aspect-video w-full rounded-sm border border-border"
                />
              ) : null}

              <p className="mt-5 text-base leading-relaxed whitespace-pre-line text-foreground/90">
                {current.body}
              </p>

              {current.document_url ? (
                <a
                  href={current.document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  Open reference document
                </a>
              ) : null}

              {data.course.objectives.length && currentIndex === 0 ? (
                <div className="mt-6 rounded-sm border border-border bg-surface-2 p-4">
                  <p className="eyebrow text-accent">What you will be able to do</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {data.course.objectives.map((o) => (
                      <li key={o} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => void complete(current.id, !completedIds.has(current.id))}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold ${
                    completedIds.has(current.id)
                      ? "border border-input hover:bg-secondary"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {completedIds.has(current.id) ? "Mark incomplete" : "Mark complete & continue"}
                  {!completedIds.has(current.id) ? (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  ) : null}
                </button>
                {currentIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveId(ordered[currentIndex - 1]!.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-4 text-sm font-semibold hover:bg-secondary"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Previous
                  </button>
                ) : null}
                {currentIndex < ordered.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveId(ordered[currentIndex + 1]!.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-4 text-sm font-semibold hover:bg-secondary"
                  >
                    Next lesson
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                ) : data.quiz ? (
                  <button
                    type="button"
                    onClick={() => setMode("quiz")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-4 text-sm font-semibold hover:bg-secondary"
                  >
                    Go to knowledge check
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
