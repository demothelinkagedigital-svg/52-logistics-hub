import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "How 52 Logistics, Inc. collects, uses and protects applicant and driver information.",
      },
      { property: "og:title", content: "Privacy Policy — 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "How we collect, use and protect applicant and driver information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <section className="container-page prose-page max-w-3xl py-20">
      <p className="eyebrow text-accent">Legal</p>
      <h1 className="display-xl mt-5">Privacy Policy</h1>
      <div className="mt-8 space-y-5 leading-relaxed text-foreground/85">
        <p>
          52 Logistics, Inc. collects information you provide when you apply for a position, contact
          us, or use the Driver Portal. This includes contact details, employment and licensing
          information, and records related to onboarding, training acknowledgements and safety.
        </p>
        <p>
          We use this information to evaluate applications, operate our transportation business,
          meet regulatory and recordkeeping obligations, and communicate with drivers and
          applicants. We do not sell personal information.
        </p>
        <p>
          Where applicable, background and screening checks are performed by First Advantage, an
          external provider. Their handling of your information is governed by the disclosures and
          authorizations you receive as part of that process.
        </p>
        <p>
          Access to applicant and driver records is restricted to authorized personnel based on
          role. Portal activity may be recorded in audit logs for security and compliance purposes.
        </p>
        <p>
          To ask about the information we hold, email{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="mailto:office@52logisticsinc.com"
          >
            office@52logisticsinc.com
          </a>
          .
        </p>
      </div>
    </section>
  ),
});
