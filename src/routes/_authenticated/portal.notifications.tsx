import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Check, CheckCheck } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { PortalHeading } from "@/components/portal/PortalShell";
import { EmptyState, ErrorState, Panel, TableSkeleton } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — 52 Logistics Portal" },
      { name: "description", content: "Your 52 Logistics portal notifications and updates." },
      { property: "og:title", content: "Notifications — 52 Logistics Portal" },
      { property: "og:description", content: "Application and document updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });

  async function mark(payload: { id?: string; all?: boolean }) {
    await markRead({ data: payload });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div>
      <PortalHeading
        eyebrow="Updates"
        title="Notifications"
        blurb="Application, document and platform activity relevant to you."
        action={
          data && data.unread > 0 ? (
            <button
              type="button"
              onClick={() => void mark({ all: true })}
              className="inline-flex items-center gap-2 rounded-sm border border-input px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <CheckCheck className="size-4" aria-hidden="true" /> Mark all read
            </button>
          ) : undefined
        }
      />

      <Panel>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data?.notifications.length ? (
          <EmptyState title="No notifications yet" blurb="We'll let you know when something changes." />
        ) : (
          <ul className="divide-y divide-border">
            {data.notifications.map((n, i) => (
              <motion.li
                key={n.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                className="flex items-start gap-4 py-4 first:pt-0"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-border" : "bg-accent"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read_at ? (
                  <button
                    type="button"
                    onClick={() => void mark({ id: n.id })}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    <Check className="size-3.5" aria-hidden="true" /> Read
                  </button>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
