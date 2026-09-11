import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DEMO_USERS, resetDb } from "@/lib/mock/db";
import { getDemoUserId, setDemoUserId } from "@/lib/mock/client";
import { LOGO_URL } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Driver Portal Sign In — 52 Logistics, Inc." },
      {
        name: "description",
        content:
          "Sign in to the 52 Logistics, Inc. Driver Portal for applications, onboarding, safety material and announcements.",
      },
      { property: "og:title", content: "Driver Portal Sign In — 52 Logistics, Inc." },
      {
        property: "og:description",
        content: "Secure sign in for 52 Logistics drivers, applicants and staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (getDemoUserId()) void navigate({ to: "/portal", replace: true });
  }, [navigate]);

  async function signInAs(id: string, label: string) {
    setBusy(id);
    setDemoUserId(id);
    await queryClient.invalidateQueries();
    toast.success(`Signed in as ${label}`);
    void navigate({ to: "/portal", replace: true });
  }

  function restoreSample() {
    resetDb();
    queryClient.clear();
    toast.success("Sample data restored");
  }

  return (
    <main className="surface-ink relative isolate min-h-screen overflow-hidden py-16">
      <div className="grid-lines pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
      <div className="hatch pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-1/4 opacity-20 lg:block" aria-hidden="true" />
      <div className="container-page max-w-3xl">

        <Link to="/" className="inline-flex items-center gap-3">
          <img src={LOGO_URL} alt="52 Logistics, Inc. logo" className="h-11 w-auto" />
        </Link>

        <p className="eyebrow mt-10 text-accent">Portal access</p>
        <h1 className="display-xl mt-4 text-ink-foreground">Choose an account to explore.</h1>
        <p className="mt-6 max-w-xl text-ink-muted">
          This is a demonstration build. Pick any account below to enter the portal instantly — no
          password needed. Anything you add or change is kept in this browser only.
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {DEMO_USERS.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => void signInAs(u.id, u.label)}
                disabled={busy !== null}
                className="flex h-full w-full flex-col items-start gap-1.5 rounded-sm border border-ink-muted/25 bg-white/5 p-5 text-left transition hover:border-accent hover:bg-white/10 disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-accent uppercase">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {u.label}
                </span>
                <span className="text-lg font-bold text-ink-foreground">{u.full_name}</span>
                <span className="text-xs text-ink-muted">{u.title}</span>
                <span className="mt-1 text-sm leading-relaxed text-ink-muted">{u.blurb}</span>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-ink-foreground">
                  {busy === u.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Enter portal
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={restoreSample}
            className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-ink-muted/30 px-4 text-sm font-semibold text-ink-foreground hover:bg-white/10"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset sample data
          </button>
          <Link to="/" className="text-sm text-ink-muted underline-offset-4 hover:underline">
            Back to the website
          </Link>
        </div>
      </div>
    </main>
  );
}
