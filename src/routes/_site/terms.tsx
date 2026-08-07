import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — 52 Logistics, Inc." },
      { name: "description", content: "Terms governing use of the 52 Logistics, Inc. website and Driver Portal." },
      { property: "og:title", content: "Terms of Use — 52 Logistics, Inc." },
      { property: "og:description", content: "Terms governing use of our website and Driver Portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <section className="container-page max-w-3xl py-20">
      <p className="eyebrow text-accent">Legal</p>
      <h1 className="display-xl mt-5">Terms of Use</h1>
      <div className="mt-8 space-y-5 leading-relaxed text-foreground/85">
        <p>
          This website and the Driver Portal are provided by 52 Logistics, Inc. for informational,
          recruiting and operational purposes. By using them you agree to use them lawfully and only
          for their intended purpose.
        </p>
        <p>
          Driver Portal accounts are issued by management and are personal to the driver. Sharing
          credentials, attempting to access records belonging to others, or circumventing access
          controls is prohibited and may result in loss of access.
        </p>
        <p>
          Content on this site, including job postings and training material, may be updated or
          removed at any time. Job postings are not offers of employment.
        </p>
        <p>
          52 Logistics, Inc. is an independent contracted service provider. References to customers or
          third-party systems are descriptive and do not imply endorsement or affiliation beyond the
          contracted relationship.
        </p>
      </div>
    </section>
  ),
});
