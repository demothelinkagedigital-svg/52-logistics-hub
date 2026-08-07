import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  APPLICATION_STATUSES,
  SCREENING_STATUSES,
  ESIGN_STATUSES,
} from "@/lib/application-schema";

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_recruiting_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, reference_code, first_name, last_name, email, phone, position_title, status, cdl_class, years_experience, city, state, submitted_at, created_at, updated_at",
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
    const [appRes, empRes, docRes, noteRes, eventRes, screenRes, esignRes] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("application_employers").select("*").eq("application_id", data.id).order("sort_order"),
      supabase.from("application_documents").select("*").eq("application_id", data.id).order("created_at"),
      supabase.from("application_notes").select("*").eq("application_id", data.id).order("created_at", { ascending: false }),
      supabase.from("application_events").select("*").eq("application_id", data.id).order("created_at", { ascending: false }),
      supabase.from("screening_records").select("*").eq("application_id", data.id).maybeSingle(),
      supabase.from("esign_records").select("*").eq("application_id", data.id).order("created_at"),
    ]);
    if (!appRes.data) throw new Error("Application not found");
    return {
      application: appRes.data,
      employers: empRes.data ?? [],
      documents: docRes.data ?? [],
      notes: noteRes.data ?? [],
      events: eventRes.data ?? [],
      screening: screenRes.data ?? null,
      esign: esignRes.data ?? [],
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
