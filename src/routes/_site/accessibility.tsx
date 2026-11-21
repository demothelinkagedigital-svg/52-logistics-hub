import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility — 52 Logistics, Inc." },
      {
        name: "description",
        content: "Our commitment to an accessible website and Driver Portal at 52 Logistics, Inc.",
      },
      { property: "og:title", content: "Accessibility — 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Our commitment to an accessible website and Driver Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <section className="container-page max-w-3xl py-20">
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
        Draft — pending review and approval by 52 Logistics counsel/HR before production use.
      </p>
      <p className="eyebrow text-accent">Legal</p>
      <h1 className="display-xl mt-5">Accessibility</h1>
      <div className="mt-8 space-y-5 leading-relaxed text-foreground/85">
        <p>
          52 Logistics, Inc. is committed to keeping this website and the Driver Portal usable by
          everyone, including drivers and applicants who use assistive technology.
        </p>
        <p>
          We aim to meet WCAG 2.1 AA expectations: semantic structure, keyboard operability, visible
          focus indicators, sufficient color contrast, descriptive alternative text, and support for
          reduced-motion preferences.
        </p>
        <p>
          If you encounter a barrier on any page, email{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="mailto:office@52logisticsinc.com"
          >
            office@52logisticsinc.com
          </a>{" "}
          with the page address and a short description, and we will work to resolve it.
        </p>
      </div>
    </section>
  ),
});
