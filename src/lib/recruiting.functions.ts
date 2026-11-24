import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth, type DemoContext } from "@/lib/mock/server-fn";
import { z } from "zod";
import {
  APPLICATION_STATUSES,
  ESIGN_STATUSES,
  applicationStatusLabel,
} from "@/lib/application-schema";

const HANDOFF_STEPS = [
  "reviewed_application",
  "opened_employer_portal",
  "created_candidate_invitation",
  "recorded_handoff_details",
  "updated_application_status",
] as const;

type HandoffStep = (typeof HANDOFF_STEPS)[number];
type HandoffChecklist = Record<HandoffStep, { done_at: string | null; done_by: string | null }>;

async function requireRecruiterOrAdministrator(supabase: DemoContext["supabase"], userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["recruiter", "administrator"]);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Forbidden");
}

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, reference_code, first_name, last_name, email, phone, position_title, job_id, status, submitted_at, created_at, updated_at, assigned_recruiter_id, correction_notes",
      )
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRecruitingFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    const [jobsRes, roleRes] = await Promise.all([
      supabase.from("jobs").select("id, position").eq("published", true).order("sort_order"),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["recruiter", "administrator"]),
    ]);
    for (const result of [jobsRes, roleRes]) {
      if (result.error) throw new Error(result.error.message);
    }
    const recruiterIds = [...new Set((roleRes.data ?? []).map((role) => role.user_id))];
    const { data: recruiters, error } = recruiterIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", recruiterIds)
          .order("full_name")
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    return { jobs: jobsRes.data ?? [], recruiters: recruiters ?? [] };
  });

export const assignApplicationRecruiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        assigned_recruiter_id: z.string().uuid().nullable(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    if (data.assigned_recruiter_id)
      await requireRecruiterOrAdministrator(supabase, data.assigned_recruiter_id);
    const { data: current, error: readError } = await supabase
      .from("applications")
      .select("assigned_recruiter_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Application not found");
    if (current.assigned_recruiter_id === data.assigned_recruiter_id) return { ok: true };
    const { data: updated, error } = await supabase
      .from("applications")
      .update({ assigned_recruiter_id: data.assigned_recruiter_id } as never)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Application not found");
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "recruiter_assignment",
      description: "Recruiter assignment updated",
      metadata: { from: current.assigned_recruiter_id, to: data.assigned_recruiter_id },
    });
    if (eventError) throw new Error(eventError.message);
    return { ok: true };
  });

const EXPORT_COLUMNS = [
  "reference",
  "applicant name",
  "opening",
  "status label",
  "submitted date",
  "assigned recruiter",
] as const;

function csvCell(value: string | null | undefined) {
  const safe = String(value ?? "").replace(/^[=+\-@\t\r]/, "'$&");
  return `"${safe.replaceAll('"', '""')}"`;
}

export const exportRecruitingApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ application_ids: z.array(z.string().uuid()).max(1000) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    const ids = [...new Set(data.application_ids)];
    const [appsRes, jobsRes, roleRes] = await Promise.all([
      ids.length
        ? supabase
            .from("applications")
            .select(
              "id, reference_code, first_name, last_name, job_id, position_title, status, submitted_at, assigned_recruiter_id",
            )
            .in("id", ids)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("jobs").select("id, position"),
      supabase.from("user_roles").select("user_id").in("role", ["recruiter", "administrator"]),
    ]);
    for (const result of [appsRes, jobsRes, roleRes]) {
      if (result.error) throw new Error(result.error.message);
    }
    const recruiterIds = [...new Set((roleRes.data ?? []).map((role) => role.user_id))];
    const { data: profiles, error: profilesError } = recruiterIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", recruiterIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const jobs = new Map((jobsRes.data ?? []).map((job) => [job.id, job.position]));
    const recruiters = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const csv = [
      EXPORT_COLUMNS,
      ...(appsRes.data ?? []).map((application) => [
        application.reference_code,
        `${application.first_name} ${application.last_name}`.trim(),
        jobs.get(application.job_id) ?? application.position_title,
        applicationStatusLabel(application.status),
        application.submitted_at?.slice(0, 10) ?? null,
        recruiters.get(application.assigned_recruiter_id) ?? "Unassigned",
      ]),
    ]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\r\n");
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "recruiting_applications_exported",
      target_type: "applications",
      target_id: null,
      metadata: { row_count: appsRes.data?.length ?? 0, columns: EXPORT_COLUMNS },
    });
    if (auditError) throw new Error(auditError.message);
    return { csv, row_count: appsRes.data?.length ?? 0 };
  });

export const getApplicationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    const [appRes, empRes, docRes, noteRes, eventRes, handoffRes, esignRes, roleRes] =
      await Promise.all([
        supabase
          .from("applications")
          .select(
            "id, reference_code, first_name, last_name, preferred_name, email, phone, preferred_contact_method, city, state, postal_code, position_title, job_id, assigned_recruiter_id, status, is_18_or_older, cdl_class, cdl_state, cdl_status, endorsements, commercial_experience_years, tractor_trailer_experience, linehaul_pd_experience, schedule_availability, start_availability, authorized_to_work, can_perform_duties_with_or_without_accommodation, medical_card_status, medical_card_expiration_month, medical_card_expiration_year, agrees_to_comply, consent_electronic_records, signature_signed_at, signature_name, certified, how_did_you_hear, additional_notes, qualification_gap, qualification_gap_reasons",
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
          .select("id, event_type, created_at, actor_id, metadata, description")
          .eq("application_id", data.id)
          .neq("event_type", "screening_update")
          .order("created_at", { ascending: false }),
        supabase
          .from("application_events")
          .select("metadata, created_at")
          .eq("application_id", data.id)
          .eq("event_type", "first_advantage_handoff_update")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("esign_records")
          .select(
            "id, document_name, status, envelope_reference, sent_at, completed_at, notes, updated_by, created_at",
          )
          .eq("application_id", data.id)
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id").in("role", ["recruiter", "administrator"]),
      ]);
    for (const result of [
      appRes,
      empRes,
      docRes,
      noteRes,
      eventRes,
      handoffRes,
      esignRes,
      roleRes,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }
    if (!appRes.data) throw new Error("Application not found");
    const openingRes = appRes.data.job_id
      ? await supabase
          .from("jobs")
          .select("id, position, days, schedule")
          .eq("id", appRes.data.job_id)
          .maybeSingle()
      : { data: null, error: null };
    if (openingRes.error) throw new Error(openingRes.error.message);
    const actorIds = [
      ...new Set(
        (eventRes.data ?? [])
          .map((event) => event.actor_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: profiles, error: profilesError } = actorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const recruiterIds = [...new Set((roleRes.data ?? []).map((role) => role.user_id))];
    const { data: recruiterProfiles, error: recruiterProfilesError } = recruiterIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", recruiterIds)
      : { data: [], error: null };
    if (recruiterProfilesError) throw new Error(recruiterProfilesError.message);
    const actorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    return {
      application: appRes.data,
      opening: openingRes.data,
      employers: empRes.data ?? [],
      documents: docRes.data ?? [],
      notes: noteRes.data ?? [],
      events: (eventRes.data ?? []).map((event) => ({
        ...event,
        actor_name: event.actor_id ? (actorNames.get(event.actor_id) ?? null) : null,
      })),
      handoff: handoffRes.data?.metadata ?? null,
      esignRecords: esignRes.data ?? [],
      recruiters: recruiterProfiles ?? [],
    };
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(APPLICATION_STATUSES),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const terminalStatuses = ["hired", "rejected", "archived"];
    if (terminalStatuses.includes(data.status)) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "administrator",
      });
      if (!isAdmin) throw new Error("Final decisions require management");
    }
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    if (!application) throw new Error("Application not found");
    const from = application.status;
    if (from === data.status) return { ok: true };
    const { data: updated, error } = await supabase
      .from("applications")
      .update({ status: data.status as never })
      .eq("id", data.id)
      .eq("status", from as never)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Application status changed. Refresh and try again.");
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "status_change",
      description: data.note || "Status changed",
      metadata: { from, to: data.status },
    });
    if (eventError) throw new Error(eventError.message);
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

export const saveFirstAdvantageHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        invitation_date: z.string().date().nullable(),
        responsible_recruiter_id: z.string().uuid().nullable(),
        external_case_id: z.string().trim().max(160).nullable(),
        next_check_date: z.string().date().nullable(),
        operational_note: z.string().trim().max(300).nullable(),
        checklist: z
          .object({
            reviewed_application: z.boolean(),
            opened_employer_portal: z.boolean(),
            created_candidate_invitation: z.boolean(),
            recorded_handoff_details: z.boolean(),
            updated_application_status: z.boolean(),
          })
          .strict(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    if (data.responsible_recruiter_id) {
      await requireRecruiterOrAdministrator(supabase, data.responsible_recruiter_id);
    }
    const { data: previous, error: previousError } = await supabase
      .from("application_events")
      .select("metadata")
      .eq("application_id", data.application_id)
      .eq("event_type", "first_advantage_handoff_update")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousError) throw new Error(previousError.message);
    const previousChecklist =
      (previous?.metadata as { checklist?: Partial<HandoffChecklist> } | null)?.checklist ?? {};
    const now = new Date().toISOString();
    const checklist = Object.fromEntries(
      HANDOFF_STEPS.map((step) => [
        step,
        data.checklist[step]
          ? previousChecklist[step]?.done_at
            ? previousChecklist[step]!
            : { done_at: now, done_by: userId }
          : { done_at: null, done_by: null },
      ]),
    ) as HandoffChecklist;
    const { error } = await supabase.from("application_events").insert({
      application_id: data.application_id,
      actor_id: userId,
      event_type: "first_advantage_handoff_update",
      description: "First Advantage handoff updated",
      metadata: {
        invitation_date: data.invitation_date,
        responsible_recruiter_id: data.responsible_recruiter_id,
        external_case_id: data.external_case_id,
        next_check_date: data.next_check_date,
        operational_note: data.operational_note,
        checklist,
      },
      created_at: now,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ESIGN_RECORD_TYPES = ["Offer letter", "Employment forms", "Other"] as const;

const esignRecordSchema = z
  .object({
    id: z.string().uuid().optional(),
    application_id: z.string().uuid(),
    document_type: z.enum(ESIGN_RECORD_TYPES),
    sent_date: z.string().date().nullable(),
    sender_id: z.string().uuid(),
    external_reference_id: z.string().trim().max(160).nullable(),
    completion_date: z.string().date().nullable(),
    status: z.enum(ESIGN_STATUSES),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.sent_date && record.completion_date && record.completion_date < record.sent_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completion_date"],
        message: "Completion date cannot be earlier than sent date.",
      });
    }
  });

export const saveEsignRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esignRecordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    await requireRecruiterOrAdministrator(supabase, data.sender_id);
    const row = {
      application_id: data.application_id,
      document_name: data.document_type,
      status: data.status,
      envelope_reference: data.external_reference_id,
      sent_at: data.sent_date,
      completed_at: data.completion_date,
      notes: data.notes,
      updated_by: data.sender_id,
    };
    const result = data.id
      ? await supabase
          .from("esign_records")
          .update(row)
          .eq("id", data.id)
          .eq("application_id", data.application_id)
          .select("id")
          .maybeSingle()
      : await supabase.from("esign_records").insert(row);
    if (result.error) throw new Error(result.error.message);
    if (data.id && !result.data) throw new Error("DocuSign record not found");
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.application_id,
      actor_id: userId,
      event_type: "esign_update",
      description: data.id ? "DocuSign record updated" : "DocuSign record added",
    });
    if (eventError) throw new Error(eventError.message);
    return { ok: true };
  });

export const deleteEsignRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), application_id: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRecruiterOrAdministrator(supabase, userId);
    const { data: deleted, error } = await supabase
      .from("esign_records")
      .delete()
      .eq("id", data.id)
      .eq("application_id", data.application_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("DocuSign record not found");
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.application_id,
      actor_id: userId,
      event_type: "esign_update",
      description: "DocuSign record deleted",
    });
    if (eventError) throw new Error(eventError.message);
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
      total: apps.length,
      drafts: apps.filter((a) => a.status === "draft").length,
      newThisWeek: apps.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() > since)
        .length,
      awaitingReview: apps.filter((a) => ["new", "ready_for_review"].includes(a.status)).length,
      needingCorrections: apps.filter((a) =>
        ["incomplete", "corrections_requested"].includes(a.status),
      ).length,
      managementReview: apps.filter((a) => a.status === "screening_complete_review").length,
      rejected: apps.filter((a) => ["rejected", "archived"].includes(a.status)).length,
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
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    if (!application) throw new Error("Application not found");
    const { error } = await supabase
      .from("applications")
      .update({ status: "corrections_requested", correction_notes: data.notes })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.id,
      actor_id: userId,
      event_type: "status_change",
      description: data.notes,
      metadata: { from: application.status, to: "corrections_requested" },
    });
    if (eventError) throw new Error(eventError.message);
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
