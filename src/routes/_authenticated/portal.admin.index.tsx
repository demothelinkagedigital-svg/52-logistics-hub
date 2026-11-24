import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { toast } from "sonner";
import { Users, ClipboardList, Truck, Bell } from "lucide-react";
import { listUsers, setUserRole, getAdminStats } from "@/lib/admin.functions";
import { useSession, ROLE_LABELS, type AppRole } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  AccessDenied,
  EmptyState,
  ErrorState,
  Panel,
  StatCard,
  TableSkeleton,
} from "@/components/portal/ui";

const ROLES: AppRole[] = [
  "administrator",
  "recruiter",
  "content_manager",
  "driver",
  "developer",
];

export const Route = createFileRoute("/_authenticated/portal/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — 52 Logistics Portal" },
      { name: "description", content: "Manage users, roles and platform activity." },
      { property: "og:title", content: "Admin Console — 52 Logistics Portal" },
      { property: "og:description", content: "User and role administration for 52 Logistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isLoading: sessionLoading } = useSession();
  const fetchUsers = useServerFn(listUsers);
  const fetchStats = useServerFn(getAdminStats);
  const changeRole = useServerFn(setUserRole);
  const queryClient = useQueryClient();

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers(), enabled: isAdmin });
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats(), enabled: isAdmin });

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isAdmin) return <AccessDenied need="administrator" />;

  async function toggleRole(userId: string, role: AppRole, grant: boolean) {
    try {
      await changeRole({ data: { user_id: userId, role, grant } });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(grant ? "Role granted" : "Role removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update role");
    }
  }

  return (
    <div>
      <PortalHeading
        eyebrow="Administration"
        title="Admin console"
        blurb="Users, roles and platform-wide activity for 52 Logistics."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={stats.data?.users ?? "—"} icon={Users} />
        <StatCard label="Pending applications" value={stats.data?.pendingApplications ?? "—"} icon={ClipboardList} delay={0.05} />
        <StatCard label="Active drivers" value={stats.data?.activeDrivers ?? "—"} icon={Truck} delay={0.1} />
        <StatCard label="Needs attention" value={stats.data?.needsAttention ?? "—"} icon={Bell} delay={0.15} />
      </div>

      <Panel title="Users & roles">
        {users.isLoading ? (
          <TableSkeleton rows={8} />
        ) : users.error ? (
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        ) : !users.data?.profiles.length ? (
          <EmptyState title="No users yet" />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2.5 pr-3 font-semibold">User</th>
                  <th className="py-2.5 pr-3 font-semibold">Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data.profiles.map((p) => {
                  const roles = users.data.roles.filter((r) => r.user_id === p.id).map((r) => r.role);
                  return (
                    <tr key={p.id}>
                      <td className="py-3 pr-3 align-top">
                        <p className="font-semibold">{p.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {ROLES.map((role) => {
                            const has = roles.includes(role);
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => void toggleRole(p.id, role, !has)}
                                className={`rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase ${has ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-secondary"}`}
                              >
                                {ROLE_LABELS[role]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
