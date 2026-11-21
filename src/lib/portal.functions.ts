import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
import {
  applicationDraftSchema,
  employerSchema,
} from "@/lib/application-schema";
import { z } from "zod";

const portalDraftSchema = applicationDraftSchema.omit({ signature_signed_at: true });
export type PortalApplicationDraft = z.infer<typeof portalDraftSchema>;

export const getMyPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      profileRes,
      rolesRes,
      appsRes,
      driverRes,
      annRes,
      notifRes,
      coursesRes,
      lessonsRes,
      progressRes,
      attemptsRes,
      docsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("applications")
        .select(
          "id, reference_code, position_title, status, current_step, submitted_at, updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("lms_courses").select("id, title, is_required").eq("published", true),
      supabase.from("lms_lessons").select("id, course_id"),
      supabase.from("lms_lesson_progress").select("*").eq("user_id", userId),
      supabase.from("lms_quiz_attempts").select("*").eq("user_id", userId),
      supabase.from("application_documents").select("id, doc_type").eq("user_id", userId),
    ]);

    const notifs = notifRes.data ?? [];
    const lessons = lessonsRes.data ?? [];
    const progress = (progressRes.data ?? []).filter((p) => p.completed);
    const attempts = attemptsRes.data ?? [];
    const courses = (coursesRes.data ?? []).map((c) => {
      const total = lessons.filter((l) => l.course_id === c.id).length;
      const done = progress.filter((p) => p.course_id === c.id).length;
      const passed = attempts.some((a) => a.course_id === c.id && a.passed);
      return {
        id: c.id,
        title: c.title,
        is_required: c.is_required,
        percent: total ? Math.round((done / total) * 100) : 0,
        quiz_passed: passed,
      };
    });

    return {
      profile: profileRes.data ?? null,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      applications: appsRes.data ?? [],
      driver: driverRes.data ?? null,
      announcements: annRes.data ?? [],
      notifications: notifs,
      unread: notifs.filter((n) => !n.read_at).length,
      documents: docsRes.data ?? [],
      academy: {
        courses,
        completed: courses.filter((c) => c.percent === 100).length,
      },
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
    const appId = app?.id ?? "00000000-0000-0000-0000-000000000000";
    const [empRes, docRes, evRes] = await Promise.all([
      supabase
        .from("application_employers")
        .select("*")
        .eq("application_id", appId)
        .order("sort_order"),
      supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", appId)
        .order("created_at"),
      supabase
        .from("application_events")
        .select("*")
        .eq("application_id", appId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      application: app,
      employers: empRes.data ?? [],
      documents: docRes.data ?? [],
      events: evRes.data ?? [],
    };
  });

export const startApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { position_title?: string; job_id?: string }) =>
    z
      .object({
        position_title: z.string().max(160).optional(),
        job_id: z.string().uuid().optional(),
      })
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
    // Check before inserting for the demo client; the unique index also protects
    // against concurrent inserts when using a database-backed client.
    const start = Math.floor(Math.random() * 10000);
    for (let i = 0; i < 10000; i++) {
      const reference_code = `52L-${String((start + i) % 10000).padStart(4, "0")}`;
      const { data: used, error: lookupError } = await supabase
        .from("applications")
        .select("id")
        .eq("reference_code", reference_code)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (used) continue;
      const { data: created, error } = await supabase
        .from("applications")
        .insert({
          user_id: userId,
          position_title: data.position_title ?? null,
          job_id: data.job_id ?? null,
          reference_code,
          status: "draft",
          current_step: 1,
        })
        .select("id")
        .single();
      if (!error) return { id: created.id };
      if (!/duplicate key|unique constraint/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("No application reference numbers are available.");
  });

export const saveApplicationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; values: PortalApplicationDraft }) =>
    z.object({ id: z.string().uuid(), values: portalDraftSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data.values)) {
      if (value !== undefined) patch[key] = value;
    }
    const { error } = await supabase
      .from("applications")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveEmployers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), employers: z.array(employerSchema).max(10) }).parse(input),
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
        current_employer: e.current_employer ?? null,
        commercial_driving_relevant: e.commercial_driving_relevant ?? null,
        permission_to_contact: e.permission_to_contact ?? null,
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
        doc_type: z.enum(["medical_card", "resume"]),
        storage_path: z.string().max(400),
        file_name: z.string().max(255).regex(/\.(pdf|jpe?g|png)$/i, "Upload a PDF, JPG, or PNG file."),
        mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"], {
          errorMap: () => ({ message: "Upload a PDF, JPG, or PNG file." }),
        }),
        size_bytes: z.number({ required_error: "File size is required." })
          .int().nonnegative().max(10 * 1024 * 1024, "Files must be 10 MiB or smaller."),
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
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
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
    z
      .object({ id: z.string().uuid(), signature_name: z.string().trim().min(2).max(120) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const submittedAt = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("applications")
      .update({
        status: "submitted",
        certified: true,
        signature_name: data.signature_name,
        submitted_at: submittedAt,
        signature_signed_at: submittedAt,
        correction_notes: null,
        current_step: 6,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .in("status", ["draft", "corrections_requested"])
      .select("id, reference_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("This application is locked and cannot be submitted again.");
    await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "submitted",
      description: `Application ${updated.reference_code} submitted for review`,
    });
    return { ok: true };
  });
