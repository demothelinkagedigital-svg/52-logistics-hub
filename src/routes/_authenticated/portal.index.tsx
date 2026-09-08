import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { ClipboardList, ArrowRight } from "lucide-react";
import { getMyPortal } from "@/lib/portal.functions";
import { PortalHeading, Card } from "@/components/portal/PortalShell";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-schema";
import { ROLE_LABELS, type AppRole } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "Portal Dashboard — 52 Logistics, Inc." },
      { name: "description", content: "Your 52 Logistics driver portal dashboard." },
      { property: "og:title", content: "Portal Dashboard — 52 Logistics, Inc." },
      { property: "og:description", content: "Application status, training and announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchPortal = useServerFn(getMyPortal);
  const { data, isLoading } = useQuery({ queryKey: ["portal"], queryFn: () => fetchPortal() });

  if (isLoading) return <p className="text-muted-foreground">Loading your portal…</p>;

  const app = data?.applications?.[0];

  return (
    <div>
      <PortalHeading
        eyebrow="Driver portal"
        title={`Welcome${data?.profile?.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}.`}
        blurb="Track your application, complete training and stay current on safety notices."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="eyebrow text-muted-foreground">Application</p>
          {app ? (
            <>
              <p className="mt-3 text-2xl font-semibold">
                {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{app.reference_code}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                {app.position_title ?? "Position not selected yet"}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg font-semibold">No application yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start your driver application — you can save and resume at any time.
              </p>
              <Link
                to="/apply"
                search={{}}
                className="mt-5 inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                <ClipboardList className="size-4" aria-hidden="true" />
                Start application
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </Card>

        <Card>
          <p className="eyebrow text-muted-foreground">Your access</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {(data?.roles ?? []).map((r) => (
              <li key={r} className="font-medium">
                {ROLE_LABELS[r as AppRole] ?? r}
              </li>
            ))}
          </ul>
          {data?.driver ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Driver record: {data.driver.status} · {data.driver.terminal}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
