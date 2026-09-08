import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { listApplications } from "@/lib/recruiting.functions";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-schema";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  AccessDenied,
  EmptyState,
  ErrorState,
  Panel,
  StatusBadge,
  TableSkeleton,
  fullName,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/applications")({
  head: () => ({
    meta: [
      { title: "All Applications — 52 Logistics Admin" },
      { name: "description", content: "Administrator view of every driver application." },
      { property: "og:title", content: "All Applications — 52 Logistics Admin" },
      { property: "og:description", content: "Complete application record for administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminApplications,
});

function AdminApplications() {
  const { isAdmin, isLoading: sessionLoading } = useSession();
  const fetchApps = useServerFn(listApplications);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps(),
    enabled: isAdmin,
  });

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isAdmin) return <AccessDenied need="administrator" />;

  return (
    <div>
      <PortalHeading eyebrow="Administration" title="All applications" blurb="Every application on record." />
      <Panel title="Applications">
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState title="No applications yet" />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2.5 pr-3 font-semibold">Applicant</th>
                  <th className="py-2.5 pr-3 font-semibold">Reference</th>
                  <th className="py-2.5 pr-3 font-semibold">Status</th>
                  <th className="py-2.5 pr-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/60">
                    <td className="py-3 pr-3">
                      <Link
                        to="/portal/recruiting/$id"
                        params={{ id: a.id }}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {fullName(a)}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">{a.reference_code}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status] ?? a.status} />
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
