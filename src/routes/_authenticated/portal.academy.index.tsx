import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { Award, BookOpen, Clock, GraduationCap, PlayCircle } from "lucide-react";
import { driverCertify, getAcademyOverview } from "@/lib/lms.functions";
import { toast } from "sonner";
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
  const { isDriver, isLoading: sessionLoading } = useSession();
  const fetchOverview = useServerFn(getAcademyOverview);
  const certifyDriver = useServerFn(driverCertify);
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["academy-overview"],
    queryFn: () => fetchOverview(),
    enabled: isDriver,
    retry: (failureCount, queryError) => {
      if (
        queryError instanceof Error &&
        /permission|not authorized|access denied/i.test(queryError.message)
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  async function certify() {
    const signature_name = window.prompt("Type your full name to certify completion:");
    if (!signature_name?.trim()) return;
    try {
      await certifyDriver({
        data: { signature_name: signature_name.trim() } as { signature_name: string },
      });
      await queryClient.invalidateQueries({ queryKey: ["academy-overview"] });
      toast.success("Driver certification recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record certification");
    }
  }

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isDriver) return <AccessDenied need="driver" />;

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
            <StatCard
              label="In progress"
              value={data.stats.inProgress}
              icon={PlayCircle}
              delay={0.05}
            />
            <StatCard label="Courses" value={data.stats.total} icon={BookOpen} delay={0.1} />
            <StatCard
              label="Total training"
              value={`${data.stats.minutes} min`}
              icon={Clock}
              delay={0.15}
            />
          </div>

          {data.stats.certificationReady || data.certification || data.verification ? (
            <div className="flex items-center gap-3 rounded-sm border border-emerald-600/30 bg-emerald-500/10 px-5 py-4">
              <GraduationCap className="size-5 text-emerald-700" aria-hidden="true" />
              <div className="text-sm font-semibold text-emerald-800">
                {data.stats.certificationReady && !data.certification
                  ? "All required Academy courses are complete. Certification is ready."
                  : data.certification
                    ? `Driver certification recorded${data.certification["certified_at"] ? ` on ${new Date(data.certification["certified_at"]).toLocaleDateString()}` : ""}.`
                    : null}
                {data.verification
                  ? ` Onboarding verified${data.verification["verified_at"] ? ` on ${new Date(data.verification["verified_at"]).toLocaleDateString()}` : ""}.`
                  : data.certification
                    ? " Awaiting management verification."
                    : ""}
              </div>
              {data.stats.certificationReady && !data.certification ? (
                <button
                  type="button"
                  onClick={() => void certify()}
                  className="ml-auto min-h-10 shrink-0 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Certify completion
                </button>
              ) : null}
            </div>
          ) : null}

          <ol className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => {
              const missingRequirements = course.missing ?? [];
              const status = !course.prerequisites_met
                ? "Locked"
                : course.complete
                  ? "Complete"
                  : course.status === "in_progress"
                    ? "In progress"
                    : "Not started";
              return (
                <li key={course.id} className="bg-surface">
                  <article className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="eyebrow text-accent">{course.category}</p>
                      <span
                        className={`rounded-sm px-2 py-1 text-[11px] font-semibold tracking-wide uppercase ${status === "Complete" ? "bg-emerald-500/10 text-emerald-700" : status === "Locked" ? "bg-secondary text-muted-foreground" : "bg-accent/15 text-accent-foreground"}`}
                      >
                        {status}
                      </span>
                    </div>
                    {course.is_required ? (
                      <span className="mt-2 w-fit rounded-sm bg-accent/15 px-2 py-1 text-[11px] font-semibold tracking-wide text-accent-foreground uppercase">
                        Required
                      </span>
                    ) : null}
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
                      {missingRequirements?.length ? (
                        <div className="pt-1 text-xs">
                          <p className="font-semibold">What’s left</p>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                            {missingRequirements.map((item) => (
                              <li key={item}>{item.replaceAll("_", " ")}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {course.quiz_passed ? (
                        <p className="text-xs font-semibold text-emerald-700">
                          Knowledge check passed — {course.best_score}%
                        </p>
                      ) : null}
                    </div>

                    <Link
                      to="/portal/academy/$slug"
                      params={{ slug: course.slug }}
                      className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors ${status === "Locked" ? "pointer-events-none bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                      aria-disabled={status === "Locked"}
                      tabIndex={status === "Locked" ? -1 : undefined}
                    >
                      {status === "Locked"
                        ? "Locked"
                        : course.percent === 0
                          ? "Start course"
                          : course.percent === 100
                            ? "Review course"
                            : "Continue course"}
                      <PlayCircle className="size-4" aria-hidden="true" />
                    </Link>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
