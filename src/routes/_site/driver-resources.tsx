import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, Smartphone, Lock } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";

export const Route = createFileRoute("/_site/driver-resources")({
  head: () => ({
    meta: [
      { title: "Driver Resources — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Preview the 52 Logistics Driver Portal: Driver Academy modules, Safety Center topics, and the required apps and systems drivers use every day.",
      },
      { property: "og:title", content: "Driver Resources — 52 Logistics, Inc." },
      {
        property: "og:description",
        content:
          "Driver Academy, Safety Center and required apps — inside the authenticated Driver Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverResources,
});

const MODULES = [
  [
    "Module 1",
    "Company expectations",
    "Who we are, how the operation runs, and the standard every driver is held to.",
  ],
  [
    "Module 2",
    "Driver handbook",
    "The current handbook version, with acknowledgement recorded to your profile.",
  ],
  [
    "Module 3",
    "Required apps & systems",
    "Motive, Whip Around, MyFleetAI / Linehaul Central and Trip Buddy setup.",
  ],
  [
    "Module 4",
    "Safety fundamentals",
    "Hours of Service, DVIR, fatigue management and defensive driving.",
  ],
  [
    "Module 5",
    "Terminal & gate procedure",
    "Terminal 170 arrival, yard movement, gate and dispatch process.",
  ],
  [
    "Module 6",
    "Final verification",
    "Knowledge check and management verification before operational release.",
  ],
];

const APPS = [
  ["Motive", "Electronic logging, Hours of Service and vehicle telematics."],
  ["Whip Around", "Pre-trip and post-trip inspections and DVIR submission."],
  ["MyFleetAI / Linehaul Central", "Assignment visibility and linehaul operational information."],
  ["Trip Buddy", "Trip support tooling used alongside daily assignments."],
  ["AVR procedure", "The documented Automated Vehicle Report escalation process."],
];

function DriverResources() {
  return (
    <>
      <section className="surface-ink py-20 lg:py-24">
        <div className="container-page max-w-4xl">
          <p className="eyebrow text-accent">Driver resources</p>
          <h1 className="display-xl mt-5 text-ink-foreground">What's inside the Driver Portal.</h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            Onboarding, safety material, announcements and required systems live in one
            authenticated place. This page is a public preview — full content requires a Driver
            Portal account.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 border border-ink-border px-4 py-3 text-sm text-ink-muted">
            <Lock className="size-4 shrink-0 text-accent" aria-hidden="true" />
            Portal access is issued by management with a secure, single-use setup link.
          </div>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" aria-labelledby="academy-heading">
        <Reveal>
          <GraduationCap className="size-7 text-accent" aria-hidden="true" />
          <h2 id="academy-heading" className="display-lg mt-4">
            Driver Academy
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Six structured modules with knowledge checks and recorded acknowledgements. Progress is
            saved to your profile and verified by management before operational release.
          </p>
        </Reveal>
        <Stagger className="mt-8 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(([label, title, body]) => (
            <StaggerItem key={label} className="bg-surface p-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">
                {label}
              </p>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section
        className="border-y border-border bg-surface-2 py-16 lg:py-20"
        aria-labelledby="safety-heading"
      >
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <Reveal>
            <ShieldCheck className="size-7 text-accent" aria-hidden="true" />
            <h2 id="safety-heading" className="display-lg mt-4">
              Safety Center
            </h2>
            <p className="mt-4 text-muted-foreground">
              Safety topics are versioned, owned and review-dated. Material is summarized and linked
              to official sources rather than copied wholesale.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-foreground/85">
              {[
                "Hours of Service and ELD compliance",
                "DVIR and vehicle condition reporting",
                "Fatigue management and fitness for duty",
                "Backing, yard safety and weather operations",
                "Safe pull-off, breakdown and escalation",
              ].map((t) => (
                <li key={t} className="border-b border-border pb-2.5">
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <Smartphone className="size-7 text-accent" aria-hidden="true" />
            <h2 className="display-lg mt-4">Required apps &amp; systems</h2>
            <p className="mt-4 text-muted-foreground">
              Drivers are set up with these systems during onboarding, with official links and setup
              steps provided in the portal.
            </p>
            <dl className="mt-6 space-y-4">
              {APPS.map(([name, body]) => (
                <div key={name} className="border-b border-border pb-4">
                  <dt className="font-bold">{name}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{body}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <section className="container-page flex flex-wrap items-center justify-between gap-6 py-16">
        <div>
          <h2 className="display-lg">Already onboarded?</h2>
          <p className="mt-2 text-muted-foreground">Sign in to the Driver Portal to continue.</p>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
        >
          Driver sign in
        </Link>
      </section>
    </>
  );
}
