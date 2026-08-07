import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LOGO_URL, COMPANY } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/portal", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      await queryClient.invalidateQueries();
      await navigate({ to: "/portal" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign in failed");
    }
  }

  return (
    <main className="surface-ink flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md border border-ink-border bg-ink/40 p-8">
        <Link to="/" className="flex justify-center">
          <img src={LOGO_URL} alt={`${COMPANY} logo`} className="h-12 w-auto" />
        </Link>
        <div className="mt-6 text-center">
          <Lock className="mx-auto size-6 text-accent" aria-hidden="true" />
          <h1 className="display-lg mt-4 text-ink-foreground">Driver Portal</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {mode === "signin"
              ? "Sign in to continue your application or access driver resources."
              : "Create an account to start and save your driver application."}
          </p>
        </div>

        {sent ? (
          <p className="mt-8 rounded-sm border border-accent/40 bg-accent/10 p-4 text-sm text-ink-foreground">
            Check your email to confirm your address, then come back and sign in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" ? (
              <label className="block text-sm">
                <span className="text-ink-muted">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-sm border border-ink-border bg-ink/60 px-3 py-2.5 text-ink-foreground outline-none focus:border-accent"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="text-ink-muted">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                autoComplete="email"
                className="mt-1.5 w-full rounded-sm border border-ink-border bg-ink/60 px-3 py-2.5 text-ink-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="mt-1.5 w-full rounded-sm border border-ink-border bg-ink/60 px-3 py-2.5 text-ink-foreground outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-sm border border-ink-border px-6 py-3 text-sm font-semibold text-ink-foreground hover:bg-ink/60"
          >
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {mode === "signin" ? "New applicant?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setSent(false);
            }}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <Link
          to="/"
          className="mt-6 block text-center text-xs text-ink-muted hover:text-ink-foreground"
        >
          Back to site
        </Link>
      </div>
    </main>
  );
}
