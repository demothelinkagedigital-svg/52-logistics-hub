import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
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
        role: z.enum(["administrator", "recruiter", "content_manager", "driver", "applicant"]),
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
    const { data: updated, error } = await supabase.rpc("admin_set_user_role", {
      _user_id: data.user_id,
      _role: data.role,
      _grant: data.grant,
    });
    if (!updated) throw new Error("Role change was denied.");
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

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const [profileRes, roleRes, appRes, docRes, driverRes, auditRes] = await Promise.all([
      supabase.from("profiles").select("id, status"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("applications").select("id, status"),
      supabase.from("application_documents").select("id, verification_status"),
      supabase.from("drivers").select("id, status"),
      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const roles = roleRes.data ?? [];
    const apps = appRes.data ?? [];
    const docs = docRes.data ?? [];
    return {
      users: (profileRes.data ?? []).length,
      activeUsers: (profileRes.data ?? []).filter((p) => p.status === "active").length,
      applicants: new Set(roles.filter((r) => r.role === "applicant").map((r) => r.user_id)).size,
      recruiters: new Set(roles.filter((r) => r.role === "recruiter").map((r) => r.user_id)).size,
      administrators: new Set(
        roles.filter((r) => r.role === "administrator").map((r) => r.user_id),
      ).size,
      activeDrivers: (driverRes.data ?? []).filter((d) => d.status === "active").length,
      pendingApplications: apps.filter((a) =>
        ["submitted", "under_review", "corrections_requested"].includes(a.status),
      ).length,
      needsAttention: apps.filter((a) => a.status === "submitted").length,
      documents: {
        total: docs.length,
        pending: docs.filter((d) => d.verification_status === "pending").length,
        approved: docs.filter((d) => d.verification_status === "approved").length,
        rejected: docs.filter((d) => d.verification_status === "rejected").length,
      },
      recentAudit: auditRes.data ?? [],
    };
  });

export const setProfileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ user_id: z.string().uuid(), status: z.enum(["active", "suspended"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.user_id === userId) throw new Error("You cannot change your own account status.");
    const { error } = await supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: `user_${data.status}`,
      target_type: "user",
      target_id: data.user_id,
      metadata: { status: data.status },
    });
    return { ok: true };
  });
