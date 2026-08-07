import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Driver Portal Sign In — 52 Logistics, Inc." },
      { name: "description", content: "Sign in to the 52 Logistics, Inc. Driver Portal for onboarding, safety material and announcements." },
      { property: "og:title", content: "Driver Portal Sign In — 52 Logistics, Inc." },
      { property: "og:description", content: "Secure sign in for 52 Logistics drivers and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

function Auth() {
  return (
    <main className="surface-ink flex min-h-dvh items-center justify-center px-4 py-20">
      <div className="w-full max-w-md border border-ink-border bg-ink/40 p-8 text-center">
        <Lock className="mx-auto size-7 text-accent" aria-hidden="true" />
        <h1 className="display-lg mt-5 text-ink-foreground">Driver Portal</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Portal sign-in arrives in the next build phase. Accounts are issued by management with a
          secure, single-use setup link.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
        >
          Back to site
        </Link>
      </div>
    </main>
  );
}
