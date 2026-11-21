import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Route as RouteIcon,
} from "lucide-react";
import { getPublicJob } from "@/lib/public-content.functions";
import { COMPANY } from "@/lib/brand";

const jobQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-job", slug],
    queryFn: () => getPublicJob({ data: slug }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/_site/careers/$slug")({
  loader: async ({ context, params }) => {
    const job = await context.queryClient.ensureQueryData(jobQuery(params.slug));
    if (!job) throw notFound();
    return job;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Position not found — 52 Logistics, Inc." }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.position} — ${loaderData.location} | 52 Logistics, Inc.`;
    const description =
      loaderData.summary ??
      `${loaderData.position} CDL opening at 52 Logistics, Inc. in ${loaderData.location}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: description.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: JobDetail,
  notFoundComponent: JobNotFound,
});

function JobNotFound() {
  return (
    <section className="container-page max-w-2xl py-24 text-center">
      <h1 className="display-lg">This position is no longer posted</h1>
      <p className="mt-4 text-muted-foreground">
        The opening you're looking for has been filled or removed. Browse current openings below.
      </p>
      <Link
        to="/careers"
        className="mt-8 inline-flex items-center gap-2 rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
      >
        View open positions
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function JobDetail() {
  const job = useSuspenseQuery(jobQuery(Route.useParams().slug)).data!;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.position,
    description: job.summary ?? job.position,
    ...(job.employment_type
      ? { employmentType: job.employment_type.toUpperCase().replace(/[^A-Z]/g, "_") }
      : {}),
    datePosted: job.updated_at,
    ...(job.application_deadline ? { validThrough: job.application_deadline } : {}),
    hiringOrganization: { "@type": "Organization", name: COMPANY },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Harrisburg", addressRegion: "PA", addressCountry: "US" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="surface-ink py-16 lg:py-20">
        <div className="container-page max-w-4xl">
          <Link
            to="/careers"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All open positions
          </Link>
          <p className="eyebrow mt-8 text-accent">{job.work_category}</p>
          <h1 className="display-xl mt-4 text-ink-foreground">{job.position}</h1>
          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <MapPin className="size-4" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd>{job.location}</dd>
            </div>
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
            {job.employment_type ? (
              <div className="flex items-center gap-2">
                <Briefcase className="size-4" aria-hidden="true" />
                <dt className="sr-only">Employment type</dt>
                <dd>{job.employment_type}</dd>
              </div>
            ) : null}
            {job.application_deadline ? (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                <dt className="sr-only">Apply by</dt>
                <dd>Apply by {job.application_deadline}</dd>
              </div>
            ) : null}
          </dl>
          <Link
            to="/apply"
            search={{ position: job.slug }}
            className="group mt-8 inline-flex items-center gap-2 rounded-sm bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground"
          >
            Apply for this role
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      <section className="container-page grid max-w-6xl gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-8">
          {job.summary ? (
            <>
              <h2 className="display-lg">About the role</h2>
              <p className="mt-5 leading-relaxed text-foreground/85">{job.summary}</p>
            </>
          ) : null}

          {job.responsibilities.length > 0 ? (
            <div className="mt-12">
              <h2 className="display-lg">Responsibilities</h2>
              <ul className="mt-5 space-y-3">
                {job.responsibilities.map((r) => (
                  <li key={r} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {job.requirements.length > 0 ? (
            <div className="mt-12">
              <h2 className="display-lg">Qualifications</h2>
              <ul className="mt-5 space-y-3">
                {job.requirements.map((r) => (
                  <li key={r} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {job.experience_notes ? (
            <div className="mt-12">
              <h2 className="display-lg">Experience</h2>
              <p className="mt-5 leading-relaxed text-foreground/85">{job.experience_notes}</p>
            </div>
          ) : null}
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-px bg-border lg:sticky lg:top-28">
            {[
              ["Pay", job.pay_notes],
              ["Benefits", job.benefits_notes],
              ["Equipment", job.equipment_notes],
            ]
              .filter(([, v]) => Boolean(v))
              .map(([label, value]) => (
                <div key={label as string} className="bg-surface p-6">
                  <h3 className="eyebrow text-accent">{label}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">{value}</p>
                </div>
              ))}
            <div className="bg-surface p-6">
              <h3 className="eyebrow text-accent">Ready to apply?</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Applications are reviewed by a recruiter. You can save your progress and return at
                any time.
              </p>
              <Link
                to="/apply"
                search={{ position: job.slug }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
              >
                Start application
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
