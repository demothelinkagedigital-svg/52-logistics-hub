import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/application")({
  beforeLoad: () => {
    throw redirect({ to: "/apply" });
  },
});
