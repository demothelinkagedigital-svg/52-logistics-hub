import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { ResourceManager } from "@/components/portal/ResourceManager";
import { AccessDenied } from "@/components/portal/ui";
import { RESOURCE_VIEWS, MANAGE_GROUPS } from "@/lib/resource-fields";
import type { ResourceKey } from "@/lib/ops.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/portal/admin/manage/$resource")({
  head: () => ({
    meta: [
      { title: "Manage content — 52 Logistics Portal" },
      { name: "description", content: "Administrative management console for 52 Logistics content and operations." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManageResourcePage,
});

function ManageResourcePage() {
  const { resource } = Route.useParams();
  const { isAdmin, isRecruiter, isContent, isLoading } = useSession();
  const view = RESOURCE_VIEWS[resource as ResourceKey];

  if (!view) throw notFound();

  return (
    <PortalShell>
      {isLoading ? null : !isAdmin && !isRecruiter && !isContent ? (
        <AccessDenied need="administrator or recruiter" />
      ) : (
        <div>
          <nav aria-label="Management sections" className="mb-6 flex flex-wrap gap-2">
            {MANAGE_GROUPS.flatMap((g) => g.items).map((item) => (
              <Link
                key={item.resource}
                to="/portal/admin/manage/$resource"
                params={{ resource: item.resource }}
                className="min-h-9 rounded-sm border border-input px-3 py-1.5 text-xs font-semibold tracking-wide uppercase hover:bg-secondary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <header className="mb-6">
            <p className="eyebrow text-accent">{view.eyebrow}</p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{view.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{view.blurb}</p>
          </header>
          <ResourceManager resource={resource as ResourceKey} view={view} />
        </div>
      )}
    </PortalShell>
  );
}
