import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  Route as RouteIcon,
  MapPin,
  Search,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  X,
} from "lucide-react";
import { getPublicJobs } from "@/lib/public-content.functions";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import terminalImg from "@/assets/terminal-dock.jpg";

const jobsQuery = queryOptions({
  queryKey: ["public-jobs"],
  queryFn: () => getPublicJobs(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_site/careers/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  head: () => ({
    meta: [
      { title: "CDL Careers & Job Search — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Search current linehaul, P&D, hybrid and spare openings at 52 Logistics, Inc. in Harrisburg, PA. Review schedules and apply online.",
      },
      { property: "og:title", content: "CDL Careers & Job Search — 52 Logistics, Inc." },
      {
        property: "og:description",
        content:
          "Linehaul, P&D, hybrid and spare CDL openings at the Harrisburg operation, Terminal 170.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Careers,
});

const WHY = [
  {
    icon: ShieldCheck,
    title: "Safety-first operations",
    body: "Hours of Service, ELD, DVIR and fatigue management expectations are documented, trained and reinforced — not assumed.",
  },
  {
    icon: GraduationCap,
    title: "Structured onboarding",
    body: "Every new driver moves through the Driver Academy: orientation, handbook, systems, safety and yard procedure.",
  },
  {
    icon: RouteIcon,
    title: "Schedules listed with each opening",
    body: "Review the days and start times listed for each opening. Schedules may change with operational needs.",
  },
  {
    icon: Briefcase,
    title: "Direct communication",
    body: "Announcements, safety meetings and acknowledgements live in the Driver Portal so nothing gets lost in a group text.",
  },
];

type Sort = "recommended" | "title" | "category";

function Careers() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");

  const categories = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.work_category))).sort(),
    [jobs],
  );
  const locations = useMemo(() => Array.from(new Set(jobs.map((j) => j.location))).sort(), [jobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = jobs.filter((j) => {
      if (category !== "all" && j.work_category !== category) return false;
      if (location !== "all" && j.location !== location) return false;
      if (!needle) return true;
      return [j.position, j.summary, j.days, j.schedule, j.location, j.work_category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
    if (sort === "title") return [...rows].sort((a, b) => a.position.localeCompare(b.position));
    if (sort === "category")
      return [...rows].sort((a, b) => a.work_category.localeCompare(b.work_category));
    return rows;
  }, [jobs, q, category, location, sort]);

  const active = q !== "" || category !== "all" || location !== "all";

  function reset() {
    setQ("");
    setCategory("all");
    setLocation("all");
    setSort("recommended");
  }

  const selectClass =
    "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm font-medium outline-none focus:border-accent";

  return (
    <>
      <section className="surface-ink relative overflow-hidden py-20 lg:py-24">
        <img
          src={terminalImg}
          alt=""
          aria-hidden="true"
          width={1600}
          height={1008}
          className="absolute inset-0 size-full object-cover opacity-20"
        />
        <div className="container-page relative max-w-4xl">
          <p className="eyebrow text-accent">Careers</p>
          <h1 className="display-xl mt-5 text-ink-foreground">
            Drive for an operation that runs on standards.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            All openings are based at our Harrisburg, Pennsylvania operation, Terminal 170. Every
            application is reviewed by a recruiter — no automated hire or reject decisions are made.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#openings-heading"
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              Search open roles
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <Link
              to="/apply"
              className="inline-flex items-center rounded-sm border border-ink-border px-5 py-3 text-sm font-semibold text-ink-foreground hover:bg-ink/50"
            >
              Start an application
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-2 py-14" aria-labelledby="why-heading">
        <div className="container-page">
          <p className="eyebrow text-accent">Why 52 Logistics</p>
          <h2 id="why-heading" className="display-lg mt-3">
            What you can expect from us
          </h2>
          <Stagger className="mt-8 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w) => (
              <StaggerItem key={w.title} className="bg-surface p-6">
                <w.icon className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-4 text-base font-bold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" aria-labelledby="openings-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-accent">Job search</p>
            <h2 id="openings-heading" className="display-lg mt-3 scroll-mt-28">
              Open positions
            </h2>
          </div>
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
            {jobs.length} openings
          </p>
        </div>

        <div className="mt-8 rounded-sm border border-border bg-surface p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <label className="block text-sm">
              <span className="sr-only">Search openings</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title, schedule or keyword"
                  className="w-full rounded-sm border border-input bg-surface py-2.5 pr-3 pl-9 text-sm outline-none focus:border-accent"
                />
              </span>
            </label>
            <label className="block text-sm">
              <span className="sr-only">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="sr-only">Location</span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={selectClass}
              >
                <option value="all">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className={selectClass}
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="title">Sort: Title A–Z</option>
                <option value="category">Sort: Category</option>
              </select>
            </label>
          </div>
          {active ? (
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              <X className="size-4" aria-hidden="true" />
              Reset filters
            </button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-sm border border-dashed border-border bg-surface-2 p-12 text-center">
            <h3 className="text-lg font-bold">No openings match those filters</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try clearing a filter or broadening your search. You can also submit an application
              and a recruiter will contact you when a matching run opens.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-sm border border-input px-5 py-2.5 text-sm font-semibold"
              >
                Clear filters
              </button>
              <Link
                to="/apply"
                className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                Apply anyway
              </Link>
            </div>
          </div>
        ) : (
          <Stagger className="mt-8 space-y-px bg-border">
            {filtered.map((job) => (
              <StaggerItem key={job.id} className="bg-surface">
                <article id={job.slug} className="scroll-mt-28 p-7 lg:p-8">
                  <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold">
                          <Link
                            to="/careers/$slug"
                            params={{ slug: job.slug }}
                            className="hover:text-primary"
                          >
                            {job.position}
                          </Link>
                        </h3>
                        <span className="rounded-sm bg-success/12 px-2 py-1 text-xs font-semibold tracking-wide uppercase text-success">
                          {job.status}
                        </span>
                        <span className="rounded-sm border border-border px-2 py-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                          {job.work_category}
                        </span>
                      </div>
                      <p className="mt-4 max-w-2xl leading-relaxed text-foreground/85">
                        {job.summary}
                      </p>
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
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4" aria-hidden="true" />
                          <dt className="sr-only">Location</dt>
                          <dd>{job.location}</dd>
                        </div>
                        {job.employment_type ? (
                          <div className="flex items-center gap-2">
                            <Briefcase className="size-4" aria-hidden="true" />
                            <dt className="sr-only">Employment type</dt>
                            <dd>{job.employment_type}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="flex flex-col gap-2 lg:col-span-4 lg:items-end">
                      <Link
                        to="/careers/$slug"
                        params={{ slug: job.slug }}
                        className="inline-flex items-center justify-center gap-2 rounded-sm border border-input px-6 py-3 text-sm font-semibold hover:bg-secondary"
                      >
                        View details
                      </Link>
                      <Link
                        to="/apply"
                        search={{ position: job.slug }}
                        className="group inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
                      >
                        Apply for This Position
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <section
        className="border-y border-border bg-surface-2 py-16 lg:py-20"
        aria-labelledby="hiring-heading"
      >
        <div className="container-page grid gap-12 lg:grid-cols-1">
          <Reveal className="max-w-2xl">
            <p className="eyebrow text-accent">Hiring process</p>
            <h2 id="hiring-heading" className="display-lg mt-3">What happens after you apply</h2>
            <ol className="mt-6 space-y-5">
              {[
                [
                  "01",
                  "Recruiter review",
                  "A member of our recruiting team reviews your application.",
                ],
                [
                  "02",
                  "Conversation",
                  "If your background fits an opening, we reach out to talk through the role.",
                ],
                [
                  "03",
                  "Screening",
                  "Where applicable, screening is completed through First Advantage, our external provider.",
                ],
                [
                  "04",
                  "Onboarding",
                  "Selected drivers receive a secure Driver Portal invitation and begin the Driver Academy.",
                ],
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
