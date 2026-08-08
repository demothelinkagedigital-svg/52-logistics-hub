import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ShieldCheck,
  Route as RouteIcon,
  GraduationCap,
  Wrench,
  Clock,
  MapPin,
} from "lucide-react";
import { getPublicJobs } from "@/lib/public-content.functions";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { APPROVED_FLEET_IDS } from "@/lib/brand";

const jobsQuery = queryOptions({
  queryKey: ["public-jobs"],
  queryFn: () => getPublicJobs(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_site/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  head: () => ({
    meta: [
      { title: "52 Logistics, Inc. — CDL Driving Jobs in Harrisburg, PA" },
      {
        name: "description",
        content:
          "Move your career forward with 52 Logistics, Inc. Linehaul, P&D, hybrid and spare CDL openings at the Harrisburg operation, Terminal 170. Apply online in minutes.",
      },
      { property: "og:title", content: "52 Logistics, Inc. — CDL Driving Jobs in Harrisburg, PA" },
      {
        property: "og:description",
        content:
          "Join a professional Harrisburg-based linehaul team built around safety, accountability, reliable equipment, and respect for the people behind every mile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TRUST = [
  { label: "Harrisburg Terminal 170", icon: MapPin },
  { label: "Professional Fleet", icon: Wrench },
  { label: "Structured Onboarding", icon: GraduationCap },
  { label: "Safety-First Operations", icon: ShieldCheck },
];

function Home() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);

  return (
    <>
      {/* HERO */}
      <section className="surface-ink relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 hatch opacity-40 lg:block"
          aria-hidden="true"
        />
        <div className="container-page relative grid gap-14 py-20 lg:grid-cols-12 lg:py-28">
          <Reveal className="lg:col-span-7">
            <p className="eyebrow text-accent">Harrisburg, Pennsylvania · Terminal 170</p>
            <h1 className="display-xl mt-5 text-ink-foreground">
              Move Your Career
              <br />
              Forward with
              <span className="text-accent"> 52 Logistics.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted">
              Join a professional Harrisburg-based linehaul team built around safety,
              accountability, reliable equipment, and respect for the people behind every mile.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/careers"
                className="group inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
              >
                View Open Positions
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/apply"
                className="inline-flex items-center justify-center rounded-sm border border-ink-border px-6 py-3.5 text-base font-semibold text-ink-foreground transition-colors hover:border-accent"
              >
                Apply Now
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="lg:col-span-5">
            <div className="border border-ink-border bg-ink/40 p-1">
              <div className="flex aspect-4/3 flex-col items-center justify-center border border-dashed border-ink-border/80 p-8 text-center">
                <Wrench className="size-8 text-accent" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-foreground">
                  Company photography
                </p>
                <p className="mt-2 max-w-xs text-sm text-ink-muted">
                  Reserved for owner-supplied fleet photography. Replaceable from the admin media
                  library — no stock imagery is used here.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="border-t border-ink-border">
          <ul className="container-page grid grid-cols-2 divide-ink-border lg:grid-cols-4 lg:divide-x">
            {TRUST.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3 py-5 lg:px-6 lg:first:pl-0">
                <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium text-ink-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* OPPORTUNITIES */}
      <section className="container-page py-20 lg:py-24" aria-labelledby="openings-heading">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
          <div>
            <p className="eyebrow text-accent">Current opportunities</p>
            <h2 id="openings-heading" className="display-lg mt-3">
              Openings at the Harrisburg operation
            </h2>
          </div>
          <Link
            to="/careers"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            See all {jobs.length} openings
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <Stagger className="mt-8 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {jobs.slice(0, 6).map((job) => (
            <StaggerItem key={job.id} className="bg-surface">
              <article className="flex h-full flex-col p-6 transition-colors hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold">{job.position}</h3>
                  <span className="shrink-0 rounded-sm bg-success/12 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-success">
                    {job.status}
                  </span>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="sr-only">Days</dt>
                    <RouteIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <dd>{job.days}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="sr-only">Schedule</dt>
                    <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <dd>{job.schedule}</dd>
                  </div>
                </dl>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                  {job.summary}
                </p>
                <Link
                  to="/careers"
                  hash={job.slug}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View details
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* WHY */}
      <section
        className="border-y border-border bg-surface-2 py-20 lg:py-24"
        aria-labelledby="why-heading"
      >
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="eyebrow text-accent">Why drive with us</p>
            <h2 id="why-heading" className="display-lg mt-3">
              Built for drivers who take the work seriously.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              52 Logistics, Inc. is an independent contracted service provider supporting FedEx
              linehaul operations. We run a disciplined operation with clear expectations and direct
              communication between drivers and management.
            </p>
          </Reveal>

          <Stagger className="grid gap-px self-start bg-border sm:grid-cols-2 lg:col-span-8">
            {[
              {
                title: "Reliable, well-maintained equipment",
                body: "Equipment care and pre/post-trip discipline are part of the job, not an afterthought. Defects get reported and handled.",
              },
              {
                title: "Safety-first operating culture",
                body: "Hours of Service, ELD, DVIR, fatigue management and defensive driving expectations are documented and reinforced.",
              },
              {
                title: "Structured onboarding",
                body: "New drivers move through a defined Driver Academy path instead of learning the operation by guesswork.",
              },
              {
                title: "Direct communication",
                body: "Announcements, safety meetings and acknowledgements are centralized in the Driver Portal so nothing gets lost.",
              },
            ].map((item) => (
              <StaggerItem key={item.title} className="bg-surface p-7">
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FLEET */}
      <section className="container-page py-20 lg:py-24" aria-labelledby="fleet-heading">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="eyebrow text-accent">Professional fleet</p>
            <h2 id="fleet-heading" className="display-lg mt-3">
              Equipment our drivers can count on.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Our tractors are maintained to support consistent linehaul and P&amp;D service out of
              the Harrisburg operation. Approved unit identifiers you may see on the yard include:
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Approved fleet identifiers">
              {APPROVED_FLEET_IDS.map((id) => (
                <li
                  key={id}
                  className="rounded-sm border border-border bg-surface px-3 py-1.5 font-mono text-sm font-medium"
                >
                  {id}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Unit identifiers shown are approved examples and do not represent the full fleet.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <figure className="overflow-hidden rounded-sm border border-border">
              <img
                src={fleetImg}
                alt="Class 8 tractor with a dry van trailer staged at the 52 Logistics Harrisburg terminal"
                width={1600}
                height={1000}
                loading="lazy"
                decoding="async"
                className="aspect-16/10 w-full object-cover"
              />
            </figure>
          </Reveal>

        </div>
      </section>

      {/* SAFETY + ONBOARDING */}
      <section className="surface-ink py-20 lg:py-24" aria-labelledby="safety-heading">
        <div className="container-page grid gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-accent">Safety-first culture</p>
            <h2 id="safety-heading" className="display-lg mt-3 text-ink-foreground">
              Safety is an operating standard.
            </h2>
            <ul className="mt-7 space-y-4">
              {[
                "Hours of Service and ELD compliance",
                "DVIR and vehicle condition reporting",
                "Fatigue management and fitness for duty",
                "Backing, yard safety and weather operations",
                "Safe pull-off, breakdown and escalation procedure",
              ].map((s) => (
                <li key={s} className="flex gap-3 border-b border-ink-border pb-4 text-ink-muted">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="eyebrow text-accent">Structured onboarding</p>
            <h2 className="display-lg mt-3 text-ink-foreground">
              A defined path from offer to road.
            </h2>
            <ol className="mt-7 space-y-6">
              {[
                [
                  "01",
                  "Application review",
                  "A recruiter reviews your application. No automated hire or reject decisions.",
                ],
                [
                  "02",
                  "External screening",
                  "Where applicable, screening is completed through First Advantage, our external provider.",
                ],
                [
                  "03",
                  "Driver Portal invitation",
                  "Selected drivers receive a secure, single-use setup link.",
                ],
                [
                  "04",
                  "Driver Academy",
                  "Six structured modules covering expectations, handbook, systems, safety and terminal procedure.",
                ],
                [
                  "05",
                  "Management verification",
                  "Management verifies completion before operational release.",
                ],
              ].map(([n, title, body]) => (
                <li key={n} className="flex gap-5">
                  <span className="font-mono text-sm font-semibold text-accent">{n}</span>
                  <div>
                    <h3 className="font-bold text-ink-foreground">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* RESOURCES PREVIEW */}
      <section className="container-page py-20 lg:py-24" aria-labelledby="resources-heading">
        <p className="eyebrow text-accent">Driver resources</p>
        <h2 id="resources-heading" className="display-lg mt-3 max-w-2xl">
          Everything a driver needs, in one authenticated portal.
        </h2>
        <Stagger className="mt-10 grid gap-px bg-border md:grid-cols-3">
          {[
            {
              icon: GraduationCap,
              title: "Driver Academy",
              body: "Six modules with knowledge checks, passing thresholds and recorded acknowledgements. Progress persists across devices.",
            },
            {
              icon: ShieldCheck,
              title: "Safety Center",
              body: "Versioned safety topics with owners, review dates and approval status — summarized and linked, never copied wholesale.",
            },
            {
              icon: Wrench,
              title: "Required Apps & Systems",
              body: "Motive, Whip Around, MyFleetAI / Linehaul Central, Trip Buddy and the AVR procedure with official links and setup steps.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title} className="bg-surface p-7">
              <Icon className="size-6 text-accent" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Link
          to="/driver-resources"
          className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Preview driver resources
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface-2" aria-labelledby="cta-heading">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <h2 id="cta-heading" className="display-lg">
              Ready to put your CDL to work in Harrisburg?
            </h2>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Applications are reviewed by a person. Submitting an application does not guarantee
              employment or an interview. Questions? Recruiting is happy to help.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-4">
            <Link
              to="/apply"
              className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground"
            >
              Start your application
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-sm border border-input px-6 py-3.5 text-base font-semibold"
            >
              Contact recruiting
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
