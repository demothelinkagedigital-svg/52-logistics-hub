import { useEffect, useRef, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useServerFn } from "@/lib/mock/server-fn";
import { getPublicJobs } from "@/lib/public-content.functions";
import { startPublicApplication } from "@/lib/public-application.functions";

const jobsQuery = queryOptions({ queryKey: ["public-jobs"], queryFn: () => getPublicJobs(), staleTime: 60_000 });

export const Route = createFileRoute("/_site/apply/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { position?: string } =>
    typeof search["position"] === "string" ? { position: search["position"] } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  head: () => ({
    meta: [
      { title: "Apply — Driver Application | 52 Logistics, Inc." },
      { name: "description", content: "Start a secure driver application with 52 Logistics. No account is needed." },
    ],
  }),
  component: Apply,
});

function Apply() {
  const { position } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useServerFn(startPublicApplication);
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [selectedPosition, setSelectedPosition] = useState(position ?? "");
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const startingRef = useRef(false);
  const selectedJob = jobs.find((job) => job.slug === selectedPosition);

  useEffect(() => setSelectedPosition(position ?? ""), [position]);

  async function begin() {
    if (startingRef.current || !selectedJob) return;
    startingRef.current = true;
    setStarting(true);
    setStartFailed(false);
    try {
      const created = await start({ data: { job_id: selectedJob.id } });
      await queryClient.invalidateQueries({ queryKey: ["public-application"] });
      await navigate({ to: "/apply/resume/$token", params: { token: created.resume_token } });
    } catch {
      startingRef.current = false;
      setStarting(false);
      setStartFailed(true);
    }
  }

  return (
    <section className="container-page max-w-3xl py-20 lg:py-24">
      <p className="eyebrow text-accent">Driver application</p>
      <h1 className="display-xl mt-5">Apply to drive with 52 Logistics.</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
        No account is needed. Start your application and receive a private link you can use to save your progress and return later.
      </p>
      <label className="mt-8 block max-w-xl text-sm font-semibold">
        Choose an opening
        <select
          value={selectedPosition}
          onChange={(event) => setSelectedPosition(event.target.value)}
          className="mt-2 block min-h-12 w-full rounded-sm border border-input bg-surface px-3 py-3 font-normal"
        >
          <option value="">Choose an opening</option>
          {jobs.map((job) => <option key={job.id} value={job.slug}>{job.position} — {job.days}, {job.schedule}</option>)}
        </select>
      </label>
      {startFailed ? <p className="mt-4 text-sm text-destructive" role="alert">We could not start your application. Please try again.</p> : null}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!selectedJob || starting}
          onClick={() => void begin()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Start my application
        </button>
        <Link to="/careers" className="inline-flex min-h-12 items-center justify-center rounded-sm border border-input px-6 py-3.5 text-sm font-semibold">Back to open positions</Link>
      </div>
      <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
        Submitting an application does not guarantee employment or an interview. All applications are reviewed by a person.
      </p>
    </section>
  );
}
