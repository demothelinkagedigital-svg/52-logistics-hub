import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { siteBootstrapQuery } from "@/routes/_site";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About 52 Logistics, Inc. — Harrisburg Linehaul Operation" },
      {
        name: "description",
        content:
          "52 Logistics, Inc. is a Harrisburg-based transportation company and contracted service provider supporting FedEx linehaul operations from Terminal 170.",
      },
      { property: "og:title", content: "About 52 Logistics, Inc." },
      {
        property: "og:description",
        content:
          "52 Logistics, Inc. is a Harrisburg-based transportation company and contracted service provider focused on dependable service, safe operating practices, well-maintained equipment, and disciplined communication.",
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
            52 Logistics, Inc. is a Harrisburg-based transportation company and contracted service
            provider supporting FedEx linehaul operations from Terminal 170. We are focused on
            dependable service, safe operating practices, well-maintained equipment, and the
            disciplined communication required to move freight consistently.
          </p>
        </div>
      </section>

      <section className="container-page grid gap-14 py-20 lg:grid-cols-12 lg:py-24">
        <Reveal className="lg:col-span-7">
          <h2 className="display-lg">How we operate</h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-foreground/85">
            <p>
              Our company was built on the belief that strong transportation performance starts with
              strong people. We set clear expectations, provide structured onboarding, centralize the
              tools and information drivers need, and maintain direct communication between drivers
              and management. From the application process through ongoing training and company
              announcements, our goal is to make every step organized, professional, and easy to
              follow.
            </p>
            <p>
              52 Logistics currently operates from the Harrisburg terminal with a professionally
              maintained fleet. Our drivers support linehaul, pickup and delivery, hybrid, and spare
              coverage according to the needs of the operation. We value safety, accountability,
              punctuality, care of equipment, accurate documentation, and respect—for customers,
              terminal partners, the public, and one another.
            </p>
            <p>
              We are continuing to strengthen our company through better systems, better training
              access, and a driver-centered digital experience. Qualified professionals who take
              pride in doing the job correctly are invited to explore our current opportunities.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-5">
          <div className="panel sticky top-28 p-7">
            {data.settings["brand_qualifier"] ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {data.settings["brand_qualifier"]}
              </p>
            ) : null}
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
