import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/apply")({
  component: () => <Outlet />,
});
