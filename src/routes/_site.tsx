import { createFileRoute, Outlet } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getSiteBootstrap } from "@/lib/public-content.functions";

export const siteBootstrapQuery = queryOptions({
  queryKey: ["site-bootstrap"],
  queryFn: () => getSiteBootstrap(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/_site")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteBootstrapQuery),
  component: SiteLayout,
  errorComponent: () => (
    <div className="container-page py-24">
      <h1 className="display-lg">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        This page could not load. Please refresh, or email office@52logisticsinc.com if it keeps happening.
      </p>
    </div>
  ),
});

function SiteLayout() {
  const { data } = useSuspenseQuery(siteBootstrapQuery);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter settings={data.settings} social={data.social} />
    </div>
  );
}
