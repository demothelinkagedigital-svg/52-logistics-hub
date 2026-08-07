import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { siteBootstrapQuery } from "@/routes/_site";
import { Reveal } from "@/components/site/Reveal";
import { APPROVED_FLEET_IDS } from "@/lib/brand";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About 52 Logistics, Inc. — Harrisburg Linehaul Operation" },
      {
        name: "description",
        content:
          "52 Logistics, Inc. is a Harrisburg-based transportation company and independent contracted service provider supporting FedEx linehaul operations from Terminal 170.",
      },
      { property: "og:title", content: "About 52 Logistics, Inc." },
      {
        property: "og:description",
        content:
          "A Harrisburg-based transportation company built on dependable service, safe operating practices and well-maintained equipment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  const { data } = useSuspenseQuery(siteBootstrapQuery);

  return (
    <>
      <section className="surface-ink py-20 lg:py-24">
        <div className="container-page max-w-4xl">
          <p className="eyebrow text-accent">About the company</p>
          <h1 className="display-xl mt-5 text-ink-foreground">
            A Harrisburg operation, run with discipline.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            52 Logistics, Inc. is a Harrisburg-based transportation company and an independent
            contracted service provider supporting FedEx linehaul operations from Terminal 170.
          </p>
        </div>
      </section>

      <section className="container-page grid gap-14 py-20 lg:grid-cols-12 lg:py-24">
        <Reveal className="lg:col-span-7">
          <h2 className="display-lg">How we operate</h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-foreground/85">
            <p>
              Our work is straightforward: move freight on schedule, safely, with equipment that is
              maintained and drivers who know what is expected of them. That standard is what our
              customer relationship is built on, and it is what we hire for.
            </p>
            <p>
              We keep communication direct. Drivers know who to call, what the escalation path is,
              and where to find the current version of any procedure. Announcements, safety
              material, handbook versions and acknowledgements all live in one authenticated Driver
              Portal rather than scattered across text threads.
            </p>
            <p>
              New drivers are not left to figure the operation out on their own. Structured
              onboarding through the Driver Academy covers company expectations, the handbook,
              required apps and systems, safety fundamentals, and terminal and gate procedure — with
              management verification before operational release.
            </p>
          </div>

          <h2 className="display-lg mt-14">What we stand on</h2>
          <ul className="mt-6 grid gap-px bg-border sm:grid-cols-2">
            {[
              [
                "Dependable service",
                "Consistent, on-schedule performance for the operation we support.",
              ],
              [
                "Safe operating practices",
                "Documented safety expectations, reinforced and acknowledged.",
              ],
              ["Well-maintained equipment", "Pre/post-trip discipline and real defect reporting."],
              [
                "Disciplined communication",
                "Clear channels, clear escalation, current information.",
              ],
              ["Strong people", "Professional drivers who take responsibility for the work."],
              ["Clear expectations", "Nothing important left implied or undocumented."],
            ].map(([title, body]) => (
              <li key={title} className="bg-surface p-6">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-5">
          <div className="panel sticky top-28 p-7">
            <h2 className="eyebrow text-accent">Operation at a glance</h2>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="font-semibold">Location</dt>
                <dd className="mt-1 text-muted-foreground">
                  Harrisburg, Pennsylvania — our only operating location.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Terminal</dt>
                <dd className="mt-1 text-muted-foreground">{data.settings["terminal"]}</dd>
              </div>
              <div>
                <dt className="font-semibold">Service type</dt>
                <dd className="mt-1 text-muted-foreground">
                  Linehaul, P&amp;D, hybrid and spare assignments.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Approved unit identifiers</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5 font-mono text-xs">
                  {APPROVED_FLEET_IDS.map((id) => (
                    <span key={id} className="rounded-sm border border-border px-2 py-1">
                      {id}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              {data.settings["independent_contractor_notice"]}
            </p>
            <Link
              to="/careers"
              className="mt-6 inline-flex w-full items-center justify-center rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
            >
              View open positions
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
