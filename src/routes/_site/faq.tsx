import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getPublicFaqs } from "@/lib/public-content.functions";

const faqsQuery = queryOptions({
  queryKey: ["public-faqs"],
  queryFn: () => getPublicFaqs(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/_site/faq")({
  loader: ({ context }) => context.queryClient.ensureQueryData(faqsQuery),
  head: () => ({
    meta: [
      { title: "Driver FAQ — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Answers to common questions about applying, screening, onboarding, equipment and the Driver Portal at 52 Logistics, Inc. in Harrisburg, PA.",
      },
      { property: "og:title", content: "Driver FAQ — 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Common questions about applying, screening, onboarding and the Driver Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Faq,
});

function Faq() {
  const { data: faqs } = useSuspenseQuery(faqsQuery);
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);

  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  return (
    <>
      <section className="surface-ink py-20 lg:py-24">
        <div className="container-page max-w-4xl">
          <p className="eyebrow text-accent">Support</p>
          <h1 className="display-xl mt-5 text-ink-foreground">Frequently asked questions.</h1>
          <p className="mt-7 text-lg leading-relaxed text-ink-muted">
            Answers about applying, screening, onboarding, equipment and the Driver Portal. If your
            question isn't here, recruiting is happy to help.
          </p>
        </div>
      </section>

      <section className="container-page max-w-3xl py-16 lg:py-20">
        {categories.map((category) => (
          <div key={category} className="mb-12 last:mb-0">
            <h2 className="eyebrow text-accent">{category}</h2>
            <ul className="mt-4 border-t border-border">
              {faqs
                .filter((f) => f.category === category)
                .map((faq) => {
                  const expanded = open === faq.id;
                  return (
                    <li key={faq.id} className="border-b border-border">
                      <h3>
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : faq.id)}
                          aria-expanded={expanded}
                          aria-controls={`faq-panel-${faq.id}`}
                          className="flex w-full items-start justify-between gap-4 py-5 text-left"
                        >
                          <span className="font-semibold">{faq.question}</span>
                          <ChevronDown
                            className={`mt-0.5 size-5 shrink-0 text-accent transition-transform ${expanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </h3>
                      {expanded ? (
                        <div id={`faq-panel-${faq.id}`} className="pb-5 pr-10">
                          <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
