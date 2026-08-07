import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async (): Promise<{ user: User | null; roles: AppRole[] }> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user ?? null;
    if (!user) return { user: null, roles: [] };
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    return { user, roles: (roleRows ?? []).map((r) => r.role as AppRole) };
  },
  staleTime: 60 * 1000,
});

export function useSession() {
  const { data, isLoading } = useQuery(sessionQuery);
  const roles = data?.roles ?? [];
  return {
    user: data?.user ?? null,
    roles,
    isLoading,
    has: (...r: AppRole[]) => r.some((x) => roles.includes(x)),
    isAdmin: roles.includes("administrator") || roles.includes("developer"),
    isRecruiter:
      roles.includes("recruiter") || roles.includes("administrator") || roles.includes("developer"),
    isContent:
      roles.includes("content_manager") ||
      roles.includes("administrator") ||
      roles.includes("developer"),
    isDriver: roles.includes("driver"),
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
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
