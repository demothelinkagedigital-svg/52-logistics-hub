import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/applicant-notice")({
  head: () => ({
    meta: [
      { title: "Applicant Notice — 52 Logistics, Inc." },
      { name: "description", content: "Important notices for applicants: review process, screening and equal opportunity employment." },
      { property: "og:title", content: "Applicant Notice — 52 Logistics, Inc." },
      { property: "og:description", content: "Review process, screening and equal opportunity employment notices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <section className="container-page max-w-3xl py-20">
      <p className="eyebrow text-accent">Legal</p>
      <h1 className="display-xl mt-5">Applicant Notice</h1>
      <div className="mt-8 space-y-5 leading-relaxed text-foreground/85">
        <p>Submitting an application does not guarantee employment or an interview.</p>
        <p>
          All applications are reviewed by a member of our recruiting team. No automated hire or
          reject decisions are made.
        </p>
        <p>
          Where applicable, background and screening checks are completed through First Advantage, our
          external screening provider, with the disclosures and authorizations required by law.
        </p>
        <p>
          52 Logistics, Inc. is an equal opportunity employer. We do not discriminate on the basis of
          race, color, religion, sex, national origin, age, disability, veteran status, or any other
          characteristic protected by applicable law.
        </p>
      </div>
    </section>
  ),
});
