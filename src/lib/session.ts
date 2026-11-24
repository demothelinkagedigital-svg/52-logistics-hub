import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { demoRoles, getDemoUser, setDemoUserId } from "@/lib/mock/client";

export type AppRole =
  | "administrator"
  | "recruiter"
  | "content_manager"
  | "driver"
  | "applicant"
  | "developer";

export type SessionUser = {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
};

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async (): Promise<{ user: SessionUser | null; roles: AppRole[] }> => {
    const user = getDemoUser();
    if (!user) return { user: null, roles: [] };
    return { user, roles: demoRoles(user.id) as AppRole[] };
  },
  staleTime: 60 * 1000,
});

export function useSession() {
  const { data, isLoading } = useQuery(sessionQuery);
  const roles: AppRole[] = (data?.roles ?? []).filter((role) => role !== "developer");
  return {
    user: data?.user ?? null,
    roles,
    isLoading,
    has: (...r: AppRole[]) => r.some((x) => roles.includes(x)),
    isAdmin: roles.includes("administrator"),
    isRecruiter: roles.includes("recruiter") || roles.includes("administrator"),
    isContent: roles.includes("content_manager") || roles.includes("administrator"),
    isDriver: roles.includes("driver"),
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    setDemoUserId(null);
    window.location.assign("/auth");
  };
}

export const ROLE_LABELS: Record<AppRole, string> = {
  administrator: "Administrator",
  recruiter: "Recruiter",
  content_manager: "Content Manager",
  driver: "Driver",
  applicant: "Applicant",
  developer: "Developer",
};
