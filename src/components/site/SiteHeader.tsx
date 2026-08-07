import { Link } from "@tanstack/react-router";
import { Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { LOGO_URL, PUBLIC_NAV, COMPANY } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="h-1 w-full rule-accent" aria-hidden="true" />
      <div className="container-page flex h-18 items-center justify-between gap-4 py-3">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3"
          aria-label={`${COMPANY} — home`}
          onClick={() => setOpen(false)}
        >
          <img src={LOGO_URL} alt={`${COMPANY} logo`} className="h-11 w-auto" width={132} height={44} />
          <span className="sr-only">{COMPANY}</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-sm px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/auth"
            className="rounded-sm border border-input px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Driver Portal
          </Link>
          <Link
            to="/apply"
            className="group inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-px"
          >
            Apply Now
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex size-11 items-center justify-center rounded-sm border border-input lg:hidden"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "overflow-hidden border-t border-border bg-surface lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-sm px-3 py-3 text-base font-medium text-foreground/85 hover:bg-secondary data-[status=active]:text-primary"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 grid gap-2">
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-input px-4 py-3 text-center text-base font-medium"
            >
              Driver Portal
            </Link>
            <Link
              to="/apply"
              onClick={() => setOpen(false)}
              className="rounded-sm bg-accent px-4 py-3 text-center text-base font-semibold text-accent-foreground"
            >
              Apply Now
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
