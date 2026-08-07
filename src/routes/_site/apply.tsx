import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_site/apply")({
  validateSearch: (search: Record<string, unknown>): { position?: string } =>
    typeof search["position"] === "string" ? { position: search["position"] } : {},

  head: () => ({
    meta: [
      { title: "Apply — Driver Application | 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Start your CDL driver application with 52 Logistics, Inc. in Harrisburg, PA. Applications are reviewed by a recruiter — no automated decisions.",
      },
      { property: "og:title", content: "Apply — Driver Application | 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Start your CDL driver application for the Harrisburg operation, Terminal 170.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Apply,
});

function Apply() {
  const { position } = Route.useSearch();

  return (
    <section className="container-page max-w-3xl py-20 lg:py-24">
      <p className="eyebrow text-accent">Driver application</p>
      <h1 className="display-xl mt-5">Apply to drive with 52 Logistics.</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
        The multi-step application form arrives in the next build phase. In the meantime, email
        recruiting with your name, phone number, CDL class and the position you're interested in and
        a recruiter will follow up.
      </p>

      {position ? (
        <p className="mt-6 inline-flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-4 py-2.5 text-sm">
          <ClipboardList className="size-4 text-accent" aria-hidden="true" />
          Selected position: <span className="font-mono font-semibold">{position}</span>
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href="mailto:recruiting@52logisticsinc.com?subject=Driver%20Application"
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground"
        >
          Email recruiting
          <ArrowRight className="size-4" aria-hidden="true" />
        </a>
        <Link
          to="/careers"
          className="inline-flex items-center justify-center rounded-sm border border-input px-6 py-3.5 text-sm font-semibold"
        >
          Back to open positions
        </Link>
      </div>

      <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
        Submitting an application does not guarantee employment or an interview. All applications are
        reviewed by a person; no automated hire or reject decisions are made. Where applicable,
        screening is completed through First Advantage, our external provider. 52 Logistics, Inc. is
        an equal opportunity employer.
      </p>
    </section>
  );
}
