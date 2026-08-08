import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/admin.functions";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import { AccessDenied, EmptyState, ErrorState, Panel, TableSkeleton } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — 52 Logistics Admin" },
      { name: "description", content: "Chronological record of administrative actions." },
      { property: "og:title", content: "Audit Log — 52 Logistics Admin" },
      { property: "og:description", content: "Track role changes and privileged actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { isAdmin, isLoading: sessionLoading } = useSession();
  const fetchLog = useServerFn(listAuditLog);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => fetchLog(),
    enabled: isAdmin,
  });

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isAdmin) return <AccessDenied need="administrator" />;

  return (
    <div>
      <PortalHeading eyebrow="Administration" title="Audit log" blurb="The 100 most recent privileged actions." />
      <Panel title="Activity">
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-sm font-semibold">{String(e.action).replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">
                  {e.actor_email ?? e.actor_id ?? "system"} · {e.target_type ?? ""} {e.target_id ?? ""}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
