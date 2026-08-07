import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { LOGO_URL, COMPANY } from "@/lib/brand";
import { useSession, useSignOut, ROLE_LABELS } from "@/lib/session";
import { cn } from "@/lib/utils";

export function PortalShell({ children }: { children: ReactNode }) {
  const { roles } = useSession();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/portal" as const, label: "Dashboard", icon: LayoutDashboard, show: true, exact: true },
  ].filter((i) => i.show);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <header className="sticky top-0 z-50 border-b border-border bg-surface">
        <div className="h-1 w-full rule-accent" aria-hidden="true" />
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt={`${COMPANY} logo`} className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold sm:inline">Driver Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">
              {roles.map((r) => ROLE_LABELS[r] ?? r).join(" · ") || "Applicant"}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-sm border border-input px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex size-10 items-center justify-center rounded-sm border border-input lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container-page flex flex-1 gap-8 py-6 lg:py-10">
        <aside
          className={cn(
            "w-full shrink-0 lg:block lg:w-60",
            open ? "block" : "hidden",
          )}
        >
          <nav aria-label="Portal" className="flex flex-col gap-1 lg:sticky lg:top-24">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact === true }}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-secondary data-[status=active]:bg-secondary data-[status=active]:text-primary"
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main" className={cn("min-w-0 flex-1", open ? "hidden lg:block" : "block")}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PortalHeading({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow?: string;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? <p className="eyebrow text-accent">{eyebrow}</p> : null}
      <h1 className="display-lg mt-2">{title}</h1>
      {blurb ? <p className="mt-3 max-w-2xl text-muted-foreground">{blurb}</p> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-sm border border-border bg-surface p-6", className)}>{children}</div>
  );
}
