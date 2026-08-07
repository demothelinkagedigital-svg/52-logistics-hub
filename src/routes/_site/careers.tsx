import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Route as RouteIcon, CheckCircle2 } from "lucide-react";
import { getPublicJobs } from "@/lib/public-content.functions";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";

const jobsQuery = queryOptions({
  queryKey: ["public-jobs"],
  queryFn: () => getPublicJobs(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_site/careers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  head: () => ({
    meta: [
      { title: "CDL Careers & Open Positions — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Current CDL openings at 52 Logistics, Inc. in Harrisburg, PA: linehaul, P&D, hybrid and spare positions. Review requirements and apply online.",
      },
      { property: "og:title", content: "CDL Careers & Open Positions — 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Linehaul, P&D, hybrid and spare CDL openings at the Harrisburg operation, Terminal 170.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Careers,
});

const REQUIREMENTS = [
  "Valid Class A Commercial Driver's License (CDL)",
  "Meet DOT physical and medical certification requirements",
  "Acceptable motor vehicle and safety record",
  "Ability to complete required screening through our external provider",
  "Willingness to follow documented safety and terminal procedures",
  "Reliable communication and professional conduct",
];

function Careers() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);

  return (
    <>
      <section className="surface-ink py-20 lg:py-24">
        <div className="container-page max-w-4xl">
          <p className="eyebrow text-accent">Careers</p>
          <h1 className="display-xl mt-5 text-ink-foreground">Open positions in Harrisburg.</h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            All openings are based at our Harrisburg, Pennsylvania operation. Every application is
            reviewed by a recruiter — no automated hire or reject decisions are made.
          </p>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" aria-labelledby="openings-heading">
        <h2 id="openings-heading" className="display-lg">
          {jobs.length} current openings
        </h2>
        <Stagger className="mt-8 space-y-px bg-border">
          {jobs.map((job) => (
            <StaggerItem key={job.id} className="bg-surface">
              <article id={job.slug} className="scroll-mt-28 p-7 lg:p-8">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-bold">{job.position}</h3>
                      <span className="rounded-sm bg-success/12 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-success">
                        {job.status}
                      </span>
                    </div>
                    <p className="mt-4 max-w-2xl leading-relaxed text-foreground/85">{job.summary}</p>
                    <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="size-4" aria-hidden="true" />
                        <dt className="sr-only">Days</dt>
                        <dd>{job.days}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-4" aria-hidden="true" />
                        <dt className="sr-only">Schedule</dt>
                        <dd>{job.schedule}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="lg:col-span-4 lg:text-right">
                    <Link
                      to="/apply"
                      search={{ position: job.slug }}
                      className="group inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
                    >
                      Apply for this role
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="border-y border-border bg-surface-2 py-16 lg:py-20" aria-labelledby="req-heading">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-accent">Requirements</p>
            <h2 id="req-heading" className="display-lg mt-3">
              What we look for
            </h2>
            <ul className="mt-6 space-y-3">
              {REQUIREMENTS.map((r) => (
                <li key={r} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow text-accent">Hiring process</p>
            <h2 className="display-lg mt-3">What happens after you apply</h2>
            <ol className="mt-6 space-y-5">
              {[
                ["01", "Recruiter review", "A member of our recruiting team reviews your application."],
                ["02", "Conversation", "If your background fits an opening, we reach out to talk through the role."],
                ["03", "Screening", "Where applicable, screening is completed through First Advantage, our external provider."],
                ["04", "Onboarding", "Selected drivers receive a secure Driver Portal invitation and begin the Driver Academy."],
              ].map(([n, title, body]) => (
                <li key={n} className="flex gap-5">
                  <span className="font-mono text-sm font-semibold text-accent">{n}</span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Submitting an application does not guarantee employment or an interview. 52 Logistics,
              Inc. is an equal opportunity employer.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
