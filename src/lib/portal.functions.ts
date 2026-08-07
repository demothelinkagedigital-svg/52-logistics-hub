import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applicationDraftSchema,
  employerSchema,
  type ApplicationDraft,
} from "@/lib/application-schema";
import { z } from "zod";

export const getMyPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, rolesRes, appsRes, driverRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("applications")
        .select("id, reference_code, position_title, status, current_step, submitted_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      profile: profileRes.data ?? null,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      applications: appsRes.data ?? [],
      driver: driverRes.data ?? null,
    };
  });

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!app) return { application: null, employers: [], documents: [] };
    const [empRes, docRes] = await Promise.all([
      supabase
        .from("application_employers")
        .select("*")
        .eq("application_id", app.id)
        .order("sort_order"),
      supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", app.id)
        .order("created_at"),
    ]);
    return { application: app, employers: empRes.data ?? [], documents: docRes.data ?? [] };
  });

export const startApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { position_title?: string; job_id?: string }) =>
    z
      .object({ position_title: z.string().max(160).optional(), job_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "draft")
      .maybeSingle();
    if (existing) return { id: existing.id };
    const { data: created, error } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        position_title: data.position_title ?? null,
        job_id: data.job_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const saveApplicationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; values: ApplicationDraft }) =>
    z.object({ id: z.string().uuid(), values: applicationDraftSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data.values)) {
      if (value !== undefined) patch[key] = value;
    }
    const { error } = await supabase
      .from("applications")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const saveEmployers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), employers: z.array(employerSchema).max(10) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("applications")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Application not found");
    await supabase.from("application_employers").delete().eq("application_id", data.id);
    if (data.employers.length) {
      const rows = data.employers.map((e, i) => ({
        application_id: data.id,
        employer_name: e.employer_name,
        position_held: e.position_held ?? null,
        city: e.city ?? null,
        state: e.state ?? null,
        phone: e.phone ?? null,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        reason_for_leaving: e.reason_for_leaving ?? null,
        was_dot_regulated: e.was_dot_regulated,
        equipment_operated: e.equipment_operated ?? null,
        sort_order: i,
      }));
      const { error } = await supabase.from("application_employers").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const recordDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        doc_type: z.string().max(40),
        storage_path: z.string().max(400),
        file_name: z.string().max(255),
        mime_type: z.string().max(120).optional(),
        size_bytes: z.number().int().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("application_documents").insert({
      application_id: data.application_id,
      user_id: userId,
      doc_type: data.doc_type,
      storage_path: data.storage_path,
      file_name: data.file_name,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("application_documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), signature_name: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applications")
      .update({
        status: "submitted",
        certified: true,
        signature_name: data.signature_name,
        submitted_at: new Date().toISOString(),
        current_step: 6,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
