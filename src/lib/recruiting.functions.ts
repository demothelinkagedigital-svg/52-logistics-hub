import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
import { z } from "zod";
import { APPLICATION_STATUSES, SCREENING_STATUSES, ESIGN_STATUSES } from "@/lib/application-schema";

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, reference_code, first_name, last_name, email, phone, position_title, status, submitted_at, created_at, updated_at",
      )
      .neq("status", "draft")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getApplicationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const [appRes, empRes, docRes, noteRes, eventRes] = await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, reference_code, first_name, last_name, preferred_name, email, phone, preferred_contact_method, city, state, postal_code, position_title, status, is_18_or_older, cdl_class, cdl_state, cdl_status, endorsements, commercial_experience_years, tractor_trailer_experience, linehaul_pd_experience, schedule_availability, start_availability, authorized_to_work, can_perform_duties_with_or_without_accommodation, medical_card_status, medical_card_expiration_month, medical_card_expiration_year, agrees_to_comply, consent_electronic_records, signature_signed_at, signature_name, certified, how_did_you_hear, additional_notes, qualification_gap, qualification_gap_reasons",
        )
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("application_employers")
        .select(
          "id, employer_name, position_held, city, state, start_date, end_date, reason_for_leaving, was_dot_regulated, current_employer, commercial_driving_relevant, permission_to_contact",
        )
        .eq("application_id", data.id)
        .order("sort_order"),
      supabase
        .from("application_documents")
        .select("id, doc_type, verification_status, created_at")
        .eq("application_id", data.id)
        .order("created_at"),
      supabase
        .from("application_notes")
        .select("id, body, created_at")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("application_events")
        .select("id, event_type, created_at")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    for (const result of [appRes, empRes, docRes, noteRes, eventRes]) {
      if (result.error) throw new Error(result.error.message);
    }
    if (!appRes.data) throw new Error("Application not found");
    return {
      application: appRes.data,
      employers: empRes.data ?? [],
      documents: docRes.data ?? [],
      notes: noteRes.data ?? [],
      events: eventRes.data ?? [],
    };
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(APPLICATION_STATUSES as [string, ...string[]]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { error } = await supabase
      .from("applications")
      .update({ status: data.status as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "status_change",
      description: data.note ? `${data.status} — ${data.note}` : `Status set to ${data.status}`,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

export const addApplicationNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("application_notes")
      .insert({ application_id: data.id, author_id: userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        status: z.enum(SCREENING_STATUSES),
        reference_number: z.string().trim().max(120).optional(),
        initiated_at: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { error } = await supabase.from("screening_records").upsert(
      {
        application_id: data.application_id,
        status: data.status,
        reference_number: data.reference_number || null,
        initiated_at: data.initiated_at ? new Date(data.initiated_at).toISOString() : null,
        status_updated_at: new Date().toISOString(),
        notes: data.notes || null,
        updated_by: userId,
      },
      { onConflict: "application_id" },
    );
    if (error) throw new Error(error.message);
    await supabase.from("application_events").insert({
      application_id: data.application_id,
      actor_id: userId,
      event_type: "screening_update",
      description: `First Advantage screening: ${data.status}`,
    });
    return { ok: true };
  });

export const upsertEsign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        application_id: z.string().uuid(),
        document_name: z.string().trim().min(1).max(160),
        status: z.enum(ESIGN_STATUSES),
        envelope_reference: z.string().trim().max(160).optional(),
        sent_at: z.string().trim().max(40).optional(),
        completed_at: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const row = {
      application_id: data.application_id,
      document_name: data.document_name,
      status: data.status,
      envelope_reference: data.envelope_reference || null,
      sent_at: data.sent_at ? new Date(data.sent_at).toISOString() : null,
      completed_at: data.completed_at ? new Date(data.completed_at).toISOString() : null,
      notes: data.notes || null,
      updated_by: userId,
    };
    const { error } = data.id
      ? await supabase.from("esign_records").update(row).eq("id", data.id)
      : await supabase.from("esign_records").insert(row);
    if (error) throw new Error(error.message);
    await supabase.from("application_events").insert({
      application_id: data.application_id,
      actor_id: userId,
      event_type: "esign_update",
      description: `DocuSign "${data.document_name}": ${data.status}`,
    });
    return { ok: true };
  });

export const getRecruitingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const [appsRes, docsRes, eventsRes] = await Promise.all([
      supabase.from("applications").select("id, status, submitted_at, created_at"),
      supabase.from("application_documents").select("id, verification_status"),
      supabase
        .from("application_events")
        .select("id, application_id, event_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    const apps = appsRes.data ?? [];
    const docs = docsRes.data ?? [];
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byStatus: Record<string, number> = {};
    for (const a of apps) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    return {
      total: apps.filter((a) => a.status !== "draft").length,
      drafts: apps.filter((a) => a.status === "draft").length,
      newThisWeek: apps.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() > since)
        .length,
      awaitingReview: apps.filter((a) => a.status === "submitted").length,
      needingCorrections: apps.filter((a) => a.status === "corrections_requested").length,
      approved: apps.filter((a) => ["conditional_offer", "onboarding", "hired"].includes(a.status))
        .length,
      rejected: apps.filter((a) => ["rejected", "withdrawn"].includes(a.status)).length,
      byStatus,
      documents: {
        total: docs.length,
        pending: docs.filter((d) => d.verification_status === "pending").length,
        approved: docs.filter((d) => d.verification_status === "approved").length,
        rejected: docs.filter((d) => d.verification_status === "rejected").length,
      },
      recentActivity: eventsRes.data ?? [],
    };
  });

export const requestCorrections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().trim().min(3).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { error } = await supabase
      .from("applications")
      .update({ status: "corrections_requested", correction_notes: data.notes })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "corrections_requested",
      description: data.notes,
    });
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "application_corrections_requested",
      target_type: "application",
      target_id: data.id,
      metadata: { notes: data.notes },
    });
    return { ok: true };
  });

export const verifyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        verification_status: z.enum(["pending", "approved", "rejected"]),
        rejection_reason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { data: doc, error } = await supabase
      .from("application_documents")
      .update({
        verification_status: data.verification_status,
        rejection_reason:
          data.verification_status === "rejected" ? (data.rejection_reason ?? null) : null,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("application_id, file_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (doc) {
      await supabase.from("application_events").insert({
        application_id: doc.application_id,
        actor_id: userId,
        event_type: `document_${data.verification_status}`,
        description: `${doc.file_name}${data.rejection_reason ? ` — ${data.rejection_reason}` : ""}`,
      });
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: `document_${data.verification_status}`,
        target_type: "document",
        target_id: data.id,
        metadata: { file_name: doc.file_name },
      });
    }
    return { ok: true };
  });

export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("application_documents")
      .select("storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== userId) {
      const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
      if (!isStaff) throw new Error("Forbidden");
    }
    const { data: signed, error } = await supabase.storage
      .from("applicant-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !signed) throw new Error(error?.message ?? "Could not open document");
    return { url: signed.signedUrl };
  });
