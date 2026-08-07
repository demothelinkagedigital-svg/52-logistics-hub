import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const [profileRes, roleRes, driverRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, phone, title, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("drivers").select("user_id, driver_code, status, truck_number, hire_date"),
    ]);
    return {
      profiles: profileRes.data ?? [],
      roles: roleRes.data ?? [],
      drivers: driverRes.data ?? [],
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum([
          "administrator",
          "recruiter",
          "content_manager",
          "driver",
          "applicant",
          "developer",
        ]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.user_id === userId && data.role === "administrator" && !data.grant) {
      throw new Error("You cannot remove your own administrator role.");
    }
    if (data.grant) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role, granted_by: userId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: data.grant ? "role_granted" : "role_revoked",
      target_type: "user",
      target_id: data.user_id,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

export const upsertDriverRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        driver_code: z.string().trim().max(40).optional(),
        truck_number: z.string().trim().max(40).optional(),
        hire_date: z.string().trim().max(20).optional(),
        position_title: z.string().trim().max(160).optional(),
        status: z.enum(["onboarding", "active", "inactive", "terminated"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { error } = await supabase.from("drivers").upsert(
      {
        user_id: data.user_id,
        driver_code: data.driver_code || null,
        truck_number: data.truck_number || null,
        hire_date: data.hire_date || null,
        position_title: data.position_title || null,
        status: data.status,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
