import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Mail, MapPin, Building2 } from "lucide-react";
import { siteBootstrapQuery } from "@/routes/_site";
import { Reveal } from "@/components/site/Reveal";
import { formatAddress } from "@/lib/brand";

export const Route = createFileRoute("/_site/contact")({
  head: () => ({
    meta: [
      { title: "Contact 52 Logistics, Inc. — Harrisburg, PA" },
      {
        name: "description",
        content:
          "Reach 52 Logistics, Inc. for recruiting, driver support or general inquiries. Harrisburg, Pennsylvania operation — Terminal 170.",
      },
      { property: "og:title", content: "Contact 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Recruiting, driver support and general inquiries for the Harrisburg operation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { data } = useSuspenseQuery(siteBootstrapQuery);
  const s = data.settings;
  const address = formatAddress(s);

  return (
    <>
      <section className="surface-ink py-20 lg:py-24">
        <div className="container-page max-w-4xl">
          <p className="eyebrow text-accent">Contact</p>
          <h1 className="display-xl mt-5 text-ink-foreground">Talk to 52 Logistics.</h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            Questions about an opening, an application in progress, or the Driver Portal? Use the
            contact below and a real person will get back to you.
          </p>
          {s["recruiting_email"] && s["company_email"] ? (
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              For recruiting questions, application assistance, or information about current
              openings, contact{" "}
              <a
                href={`mailto:${s["recruiting_email"]}`}
                className="underline underline-offset-4"
              >
                {s["recruiting_email"]}
              </a>
              . For general company matters, contact{" "}
              <a href={`mailto:${s["company_email"]}`} className="underline underline-offset-4">
                {s["company_email"]}
              </a>
              . Do not email Social Security numbers, driver's-license images, background-check
              documents, drug-testing records, medical details, passwords, or gate-access information.
            </p>
          ) : null}
        </div>
      </section>

      <section className="container-page grid gap-10 py-16 lg:grid-cols-3 lg:py-20">
        <Reveal className="panel p-7">
          <Mail className="size-6 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold">Recruiting</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Openings, applications and hiring process questions.
          </p>
          {s["recruiting_email"] ? (
            <a
              href={`mailto:${s["recruiting_email"]}`}
              className="mt-4 inline-block break-all font-medium text-primary underline-offset-4 hover:underline"
            >
              {s["recruiting_email"]}
            </a>
          ) : null}
        </Reveal>

        <Reveal delay={0.08} className="panel p-7">
          <Building2 className="size-6 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold">Office</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            General and administrative inquiries.
          </p>
          {s["company_email"] ? (
            <a
              href={`mailto:${s["company_email"]}`}
              className="mt-4 inline-block break-all font-medium text-primary underline-offset-4 hover:underline"
            >
              {s["company_email"]}
            </a>
          ) : null}
        </Reveal>

        <Reveal delay={0.16} className="panel p-7">
          <MapPin className="size-6 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold">Locations</h2>
          {address ? (
            <address className="mt-3 text-sm not-italic text-muted-foreground">
              <p className="font-semibold text-foreground">Address</p>
              <p className="mt-1">{address}</p>
            </address>
          ) : null}
        </Reveal>
      </section>

      <section className="border-t border-border bg-surface-2 py-16">
        <div className="container-page flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="display-lg">Ready to apply?</h2>
            <p className="mt-2 text-muted-foreground">
              Review current openings or start your application now.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/careers"
              className="inline-flex items-center rounded-sm border border-input px-6 py-3 text-sm font-semibold"
            >
              Open positions
            </Link>
            <Link
              to="/apply"
              className="inline-flex items-center rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
            >
              Apply now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
