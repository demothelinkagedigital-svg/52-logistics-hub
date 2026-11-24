import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { Users, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";
import { listApplications, getRecruitingStats } from "@/lib/recruiting.functions";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  applicationStatusLabel,
} from "@/lib/application-schema";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  AccessDenied,
  EmptyState,
  ErrorState,
  Panel,
  StatCard,
  StatusBadge,
  TableSkeleton,
  Timeline,
  fullName,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/recruiting/")({
  head: () => ({
    meta: [
      { title: "Recruiting Pipeline — 52 Logistics Portal" },
      { name: "description", content: "Review, filter and manage driver applications." },
      { property: "og:title", content: "Recruiting Pipeline — 52 Logistics Portal" },
      { property: "og:description", content: "Applicant pipeline and review workflow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecruitingPage,
});

function RecruitingPage() {
  const navigate = useNavigate();
  const { isRecruiter, isLoading: sessionLoading } = useSession();
  const fetchApps = useServerFn(listApplications);
  const fetchStats = useServerFn(getRecruitingStats);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const apps = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps(),
    enabled: isRecruiter,
  });
  const stats = useQuery({
    queryKey: ["recruiting-stats"],
    queryFn: () => fetchStats(),
    enabled: isRecruiter,
  });

  const filtered = useMemo(() => {
    const list = apps.data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((a) => {
      if (
        status !== "all" &&
        (status === "incomplete"
          ? !["draft", "incomplete", "corrections_requested"].includes(a.status)
          : a.status !== status)
      )
        return false;
      if (!needle) return true;
      return [a.first_name, a.last_name, a.email, a.phone, a.reference_code, a.position_title]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [apps.data, q, status]);

  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isRecruiter) return <AccessDenied need="recruiter" />;

  return (
    <div>
      <PortalHeading
        eyebrow="Operations"
        title="Recruiting pipeline"
        blurb="Every driver application, with review status and activity."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applications" value={stats.data?.total ?? "—"} icon={Users} />
        <StatCard
          label="Awaiting review"
          value={stats.data?.awaitingReview ?? "—"}
          icon={Inbox}
          delay={0.05}
        />
        <StatCard
          label="Corrections requested"
          value={stats.data?.needingCorrections ?? "—"}
          icon={AlertTriangle}
          delay={0.1}
        />
        <StatCard
          label="Management review"
          value={stats.data?.managementReview ?? "—"}
          icon={CheckCircle2}
          delay={0.15}
        />
      </div>

      <Panel
        title="Applicants"
        action={
          <div className="flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search name, email, reference…"
              className="w-56 rounded-sm border border-input bg-background px-3 py-2 text-sm"
              aria-label="Search applicants"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by status"
              className="rounded-sm border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {APPLICATION_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {apps.isLoading ? (
          <TableSkeleton rows={8} />
        ) : apps.error ? (
          <ErrorState error={apps.error} onRetry={() => void apps.refetch()} />
        ) : !rows.length ? (
          <EmptyState title="No applications match" blurb="Try clearing your search or filters." />
        ) : (
          <>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2.5 pr-3 font-semibold">Applicant</th>
                    <th className="py-2.5 pr-3 font-semibold">Reference</th>
                    <th className="py-2.5 pr-3 font-semibold">Position</th>
                    <th className="py-2.5 pr-3 font-semibold">Status</th>
                    <th className="py-2.5 pr-3 font-semibold">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer hover:bg-secondary/60"
                      onClick={() =>
                        void navigate({ to: "/portal/recruiting/$id", params: { id: a.id } })
                      }
                    >
                      <td className="py-3 pr-3">
                        <Link
                          to="/portal/recruiting/$id"
                          params={{ id: a.id }}
                          className="font-semibold underline-offset-4 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {fullName(a)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{a.email}</span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">{a.reference_code}</td>
                      <td className="py-3 pr-3">{a.position_title ?? "—"}</td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={a.status} label={applicationStatusLabel(a.status)} />
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-sm border border-input px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-sm border border-input px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title="Recent activity">
          <Timeline
            items={(stats.data?.recentActivity ?? []).map((e) => ({
              id: e.id,
              title: String(e.event_type).replace(/_/g, " "),
              description: e.description,
              at: e.created_at,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
