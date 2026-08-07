import { Link } from "@tanstack/react-router";
import { LOGO_URL, COMPANY, PUBLIC_NAV, LEGAL_NAV, formatAddress } from "@/lib/brand";
import type { PublicSocialLink, SiteSettings } from "@/lib/public-content.functions";

export function SiteFooter({
  settings,
  social,
}: {
  settings: SiteSettings;
  social: PublicSocialLink[];
}) {
  const active = social.filter((s) => s.url);
  const indeed = settings["indeed_url"];

  return (
    <footer className="surface-ink mt-24">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <img
            src={LOGO_URL}
            alt={`${COMPANY} logo`}
            className="h-14 w-auto rounded-sm bg-ink-foreground p-1.5"
            width={168}
            height={56}
          />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-muted">
            {settings["independent_contractor_notice"]}
          </p>
          <address className="mt-5 space-y-1 text-sm not-italic text-ink-muted">
            <div className="font-medium text-ink-foreground">{settings["terminal"]}</div>
            <div>{formatAddress(settings)}</div>
            <div className="text-xs">Address pending final verification.</div>
          </address>
        </div>

        <nav aria-label="Footer" className="md:col-span-3">
          <h2 className="eyebrow text-accent">Navigate</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PUBLIC_NAV.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="text-ink-muted transition-colors hover:text-ink-foreground">
                  {i.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/apply" className="text-ink-muted transition-colors hover:text-ink-foreground">
                Apply
              </Link>
            </li>
            <li>
              <Link to="/auth" className="text-ink-muted transition-colors hover:text-ink-foreground">
                Driver Portal
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <h2 className="eyebrow text-accent">Contact</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <span className="block text-xs uppercase tracking-wide text-ink-muted">Recruiting</span>
              <a
                href={`mailto:${settings["email_recruiting"]}`}
                className="font-medium text-ink-foreground underline-offset-4 hover:underline"
              >
                {settings["email_recruiting"]}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase tracking-wide text-ink-muted">General office</span>
              <a
                href={`mailto:${settings["email_office"]}`}
                className="font-medium text-ink-foreground underline-offset-4 hover:underline"
              >
                {settings["email_office"]}
              </a>
            </li>
          </ul>

          <h2 className="eyebrow mt-8 text-accent">Follow</h2>
          {active.length === 0 && !indeed ? (
            <p className="mt-3 text-sm text-ink-muted">
              Social profiles are not published yet. They are configured from the admin settings once
              verified.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {active.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex rounded-sm border border-ink-border px-3 py-1.5 text-sm text-ink-foreground hover:border-accent"
                  >
                    {s.platform}
                  </a>
                </li>
              ))}
              {indeed ? (
                <li>
                  <a
                    href={indeed}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex rounded-sm border border-ink-border px-3 py-1.5 text-sm text-ink-foreground hover:border-accent"
                  >
                    Indeed
                  </a>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-ink-border">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_NAV.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="transition-colors hover:text-ink-foreground">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
