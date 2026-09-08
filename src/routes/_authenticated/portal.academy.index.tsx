import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { Award, BookOpen, Clock, GraduationCap, PlayCircle } from "lucide-react";
import { getAcademyOverview } from "@/lib/lms.functions";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  AccessDenied,
  EmptyState,
  ErrorState,
  StatCard,
  TableSkeleton,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/academy/")({
  head: () => ({
    meta: [
      { title: "Driver Academy — 52 Logistics Portal" },
      {
        name: "description",
        content:
          "Structured driver training courses with lessons, knowledge checks and tracked completion.",
      },
      { property: "og:title", content: "Driver Academy — 52 Logistics Portal" },
      {
        property: "og:description",
        content: "Course catalog, progress tracking and knowledge checks for 52 Logistics drivers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyCatalog,
});

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Course progress"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function AcademyCatalog() {
  const { isDriver, isAdmin, isLoading: sessionLoading } = useSession();
  const fetchOverview = useServerFn(getAcademyOverview);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["academy-overview"],
    queryFn: () => fetchOverview(),
    enabled: isDriver || isAdmin,
  });

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isDriver && !isAdmin) return <AccessDenied need="driver" />;

  return (
    <div>
      <PortalHeading
        eyebrow="Learning"
        title="Driver Academy"
        blurb="Structured training with lessons, knowledge checks and recorded completion."
      />

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.courses.length ? (
        <EmptyState title="No courses published yet" />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Required complete"
              value={`${data.stats.completedRequired}/${data.stats.required}`}
              icon={Award}
            />
            <StatCard label="In progress" value={data.stats.inProgress} icon={PlayCircle} delay={0.05} />
            <StatCard label="Courses" value={data.stats.total} icon={BookOpen} delay={0.1} />
            <StatCard
              label="Total training"
              value={`${data.stats.minutes} min`}
              icon={Clock}
              delay={0.15}
            />
          </div>

          {data.stats.certificationReady ? (
            <div className="flex items-center gap-3 rounded-sm border border-emerald-600/30 bg-emerald-500/10 px-5 py-4">
              <GraduationCap className="size-5 text-emerald-700" aria-hidden="true" />
              <p className="text-sm font-semibold text-emerald-800">
                All required Academy courses are complete. Management will verify before operational
                release.
              </p>
            </div>
          ) : null}

          <ul className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <li key={course.id} className="bg-surface">
                <article className="flex h-full flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="eyebrow text-accent">{course.category}</p>
                    {course.is_required ? (
                      <span className="rounded-sm bg-accent/15 px-2 py-1 text-[11px] font-semibold tracking-wide text-accent-foreground uppercase">
                        Required
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-bold">{course.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {course.summary}
                  </p>

                  <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Duration</dt>
                      <Clock className="size-3.5" aria-hidden="true" />
                      <dd>{course.estimated_minutes} min</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Lessons</dt>
                      <BookOpen className="size-3.5" aria-hidden="true" />
                      <dd>{course.lesson_count} lessons</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Level</dt>
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                      <dd className="capitalize">{course.difficulty}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">
                        {course.lessons_completed}/{course.lesson_count} lessons
                      </span>
                      <span className="tabular-nums">{course.percent}%</span>
                    </div>
                    <ProgressBar percent={course.percent} />
                    {course.quiz_passed ? (
                      <p className="text-xs font-semibold text-emerald-700">
                        Knowledge check passed — {course.best_score}%
                      </p>
                    ) : null}
                  </div>

                  <Link
                    to="/portal/academy/$slug"
                    params={{ slug: course.slug }}
                    className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {course.percent === 0
                      ? "Start course"
                      : course.percent === 100
                        ? "Review course"
                        : "Continue course"}
                    <PlayCircle className="size-4" aria-hidden="true" />
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
