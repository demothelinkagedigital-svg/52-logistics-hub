import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AlertTriangle, Inbox, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------- badges --------------------------------- */

const STATUS_TONE: Record<string, string> = {
  draft: "bg-secondary text-foreground/70",
  submitted: "bg-primary/10 text-primary",
  under_review: "bg-primary/10 text-primary",
  corrections_requested: "bg-accent/15 text-accent-foreground",
  screening: "bg-primary/10 text-primary",
  interview: "bg-primary/10 text-primary",
  conditional_offer: "bg-emerald-500/12 text-emerald-700",
  background_check: "bg-primary/10 text-primary",
  onboarding: "bg-emerald-500/12 text-emerald-700",
  hired: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-secondary text-muted-foreground",
  pending: "bg-secondary text-foreground/70",
  approved: "bg-emerald-500/15 text-emerald-700",
  clear: "bg-emerald-500/15 text-emerald-700",
  failed: "bg-destructive/10 text-destructive",
  review_required: "bg-accent/15 text-accent-foreground",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold tracking-wide uppercase",
        STATUS_TONE[status] ?? "bg-secondary text-foreground/70",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

/* ---------------------------------- layout --------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="rounded-sm border border-border bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-accent" /> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </motion.div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-sm border border-border bg-surface", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ----------------------------------- states -------------------------------- */

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 w-full animate-pulse rounded-sm bg-secondary" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({
  title,
  blurb,
  action,
}: {
  title: string;
  blurb?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border px-6 py-14 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-semibold">{title}</p>
      {blurb ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{blurb}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const message =
    error instanceof Error && error.message && !/forbidden/i.test(error.message)
      ? error.message
      : "We couldn't load this data. Please try again.";
  return (
    <div className="flex flex-col items-center rounded-sm border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      <p className="mt-3 font-semibold">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-sm border border-input px-3 py-2 text-sm font-medium hover:bg-secondary"
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function AccessDenied({ need }: { need: string }) {
  return (
    <div className="flex flex-col items-center rounded-sm border border-border bg-surface px-6 py-16 text-center">
      <Lock className="size-6 text-accent" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You need {need} permissions to open this area. If you believe this is a mistake, contact an
        administrator.
      </p>
      <Link
        to="/portal"
        className="mt-6 inline-flex items-center rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

/* ---------------------------------- timeline -------------------------------- */

export function Timeline({
  items,
}: {
  items: { id: string; title: string; description?: string | null; at: string; who?: string }[];
}) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className="absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-accent"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {new Date(item.at).toLocaleString()}
            {item.who ? ` · ${item.who}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------------- misc ---------------------------------- */

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
    </div>
  );
}

export function fullName(a: { first_name?: string | null; last_name?: string | null }) {
  return [a.first_name, a.last_name].filter(Boolean).join(" ") || "Unnamed applicant";
}
