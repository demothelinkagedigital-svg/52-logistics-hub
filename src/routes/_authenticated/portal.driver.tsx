import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { toast } from "sonner";
import { getDriverHub, setModuleProgress, acknowledgeSafety } from "@/lib/driver.functions";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import { AccessDenied, EmptyState, ErrorState, Panel, TableSkeleton } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/driver")({
  head: () => ({
    meta: [
      { title: "Driver Hub — 52 Logistics Portal" },
      { name: "description", content: "Academy training, handbook and safety acknowledgements." },
      { property: "og:title", content: "Driver Hub — 52 Logistics Portal" },
      { property: "og:description", content: "Training, handbook and safety center for drivers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverHub,
});

function DriverHub() {
  const { isDriver, isAdmin, isLoading: sessionLoading } = useSession();
  const fetchHub = useServerFn(getDriverHub);
  const setProgress = useServerFn(setModuleProgress);
  const ack = useServerFn(acknowledgeSafety);
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["driver-hub"],
    queryFn: () => fetchHub(),
    enabled: isDriver || isAdmin,
  });

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isDriver && !isAdmin) return <AccessDenied need="driver" />;

  async function toggle(moduleId: string, completed: boolean) {
    try {
      await setProgress({ data: { module_id: moduleId, completed } });
      await queryClient.invalidateQueries({ queryKey: ["driver-hub"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update progress");
    }
  }

  async function acknowledge(resourceId: string) {
    try {
      await ack({ data: { resource_id: resourceId } });
      await queryClient.invalidateQueries({ queryKey: ["driver-hub"] });
      toast.success("Acknowledged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not acknowledge");
    }
  }

  return (
    <div>
      <PortalHeading
        eyebrow="Operations"
        title="Driver hub"
        blurb="Training, handbook and safety notices for active 52 Logistics drivers."
      />
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <Panel title="Announcements">
            {!data?.announcements.length ? (
              <EmptyState title="No announcements" />
            ) : (
              <ul className="space-y-4">
                {data.announcements.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Driver academy">
            {!data?.modules.length ? (
              <EmptyState title="No modules published" />
            ) : (
              <ul className="divide-y divide-border">
                {data.modules.map((m) => {
                  const done = data.progress.some((p) => p.module_id === m.id && p.completed);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.description} {m.duration_minutes ? `· ${m.duration_minutes} min` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggle(m.id, !done)}
                        className={`rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase ${done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-secondary"}`}
                      >
                        {done ? "Completed" : "Mark complete"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Safety center">
            {!data?.safety.length ? (
              <EmptyState title="No safety resources" />
            ) : (
              <ul className="divide-y divide-border">
                {data.safety.map((s) => {
                  const acked = data.acknowledgements.some((a) => a.resource_id === s.id);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.summary}</p>
                      </div>
                      {s.requires_acknowledgement ? (
                        <button
                          type="button"
                          disabled={acked}
                          onClick={() => void acknowledge(s.id)}
                          className="rounded-sm border border-input px-3 py-1.5 text-xs font-semibold uppercase hover:bg-secondary disabled:opacity-60"
                        >
                          {acked ? "Acknowledged" : "Acknowledge"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Handbook">
            {!data?.handbook.length ? (
              <EmptyState title="No handbook sections" />
            ) : (
              <ul className="space-y-4">
                {data.handbook.map((h) => (
                  <li key={h.id}>
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{h.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
