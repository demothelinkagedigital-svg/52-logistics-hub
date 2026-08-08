/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Managed resource registry                                                  */
/*                                                                            */
/*  Every admin collection screen is driven by this registry rather than a     */
/*  hand-written endpoint per table. The registry is the server-side           */
/*  allowlist: a table that is not listed here cannot be read or written       */
/*  through these functions, and each entry declares the columns that may be   */
/*  written and the role required to write them. RLS remains the second gate.  */
/* -------------------------------------------------------------------------- */

type Access = "admin" | "content" | "recruiting";

type ResourceDef = {
  table: string;
  label: string;
  /** Columns a manager may write. Anything else in the payload is dropped. */
  columns: readonly string[];
  order: { column: string; ascending: boolean };
  read: Access;
  write: Access;
  /** Soft-archive column used instead of destructive deletes. */
  archiveColumn?: string;
};

export const RESOURCES = {
  jobs: {
    table: "jobs",
    label: "Job opening",
    columns: [
      "position","slug","days","schedule","location","summary","requirements","responsibilities",
      "experience_notes","pay_notes","benefits_notes","equipment_notes","employment_type",
      "work_category","application_deadline","status","published","sort_order","archived_at",
    ],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
    archiveColumn: "archived_at",
  },
  announcements: {
    table: "announcements",
    label: "Announcement",
    columns: [
      "title","body","audience","priority","status","publish_at","expires_at","attachment_url",
      "requires_acknowledgement","pinned","published",
    ],
    order: { column: "created_at", ascending: false },
    read: "content",
    write: "content",
  },
  safety_meetings: {
    table: "safety_meetings",
    label: "Safety meeting",
    columns: [
      "title","description","meeting_date","mode","audience","instructions","materials_url",
      "acknowledgement_deadline","status",
    ],
    order: { column: "meeting_date", ascending: false },
    read: "content",
    write: "content",
  },
  safety_resources: {
    table: "safety_resources",
    label: "Safety resource",
    columns: ["title","summary","body","category","requires_acknowledgement","published","sort_order"],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
  },
  handbook_versions: {
    table: "handbook_versions",
    label: "Handbook version",
    columns: [
      "version_label","title","description","document_url","storage_path","effective_date",
      "requires_signature","published","archived_at",
    ],
    order: { column: "effective_date", ascending: false },
    read: "content",
    write: "content",
    archiveColumn: "archived_at",
  },
  handbook_sections: {
    table: "handbook_sections",
    label: "Handbook section",
    columns: ["slug","title","category","body","published","sort_order"],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
  },
  required_systems: {
    table: "required_systems",
    label: "Required system",
    columns: [
      "name","slug","description","purpose","official_url","ios_url","android_url","phone",
      "setup_instructions","support_info","audience","published","sort_order",
    ],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
  },
  lms_courses: {
    table: "lms_courses",
    label: "Academy course",
    columns: [
      "slug","title","summary","description","category","image_url","difficulty",
      "estimated_minutes","objectives","owner_label","is_required","published","sort_order","archived_at",
    ],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
    archiveColumn: "archived_at",
  },
  media_assets: {
    table: "media_assets",
    label: "Media asset",
    columns: [
      "title","alt_text","category","storage_path","public_url","content_type","width","height",
      "size_bytes","tags","usage_notes","archived_at",
    ],
    order: { column: "created_at", ascending: false },
    read: "content",
    write: "content",
    archiveColumn: "archived_at",
  },
  faqs: {
    table: "faqs",
    label: "FAQ",
    columns: ["question","answer","sort_order","published"],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
  },
  page_content: {
    table: "page_content",
    label: "Page content block",
    columns: ["page_key","section_key","heading","body","approval_status","published","sort_order"],
    order: { column: "page_key", ascending: true },
    read: "content",
    write: "content",
  },
  social_links: {
    table: "social_links",
    label: "Social link",
    columns: ["platform","url","sort_order","is_active"],
    order: { column: "sort_order", ascending: true },
    read: "content",
    write: "content",
  },
  email_templates: {
    table: "email_templates",
    label: "Email template",
    columns: ["template_key","name","subject","body","description","variables","is_active"],
    order: { column: "name", ascending: true },
    read: "admin",
    write: "admin",
  },
  site_settings: {
    table: "site_settings",
    label: "Setting",
    columns: ["key","value","label","group_name","is_public","needs_verification"],
    order: { column: "group_name", ascending: true },
    read: "admin",
    write: "admin",
  },
} satisfies Record<string, ResourceDef>;

export type ResourceKey = keyof typeof RESOURCES;

const resourceKey = z.enum(Object.keys(RESOURCES) as [ResourceKey, ...ResourceKey[]]);

/* Generic, table-name-driven query surface. The generated Supabase types are
   keyed by literal table names, so the registry-driven screens use this loose
   view of the same authenticated client. RLS and the registry still apply. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type ResourceRow = Record<string, Json>;
type LooseClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};
const loose = (client: unknown) => client as LooseClient;

async function assertAccess(supabase: LooseClient, userId: string, level: Access) {
  const rpcName =
    level === "admin" ? "has_role" : level === "content" ? "is_content_staff" : "is_recruiting_staff";
  const args =
    level === "admin"
      ? { _user_id: userId, _role: "administrator" }
      : { _user_id: userId };
  const { data } = await supabase.rpc(rpcName, args);
  if (!data) throw new Error("You don't have permission to manage this area.");
}

function pick(values: Record<string, unknown>, columns: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const c of columns) if (c in values) out[c] = values[c] === "" ? null : values[c];
  return out;
}

/* -------------------------------- read ----------------------------------- */

export const listResource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ resource: resourceKey }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = loose(supabase);
    const def = RESOURCES[data.resource] as ResourceDef;
    await assertAccess(db, userId, def.read);
    const { data: rows, error } = await db
      .from(def.table)
      .select("*")
      .order(def.order.column, { ascending: def.order.ascending, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as ResourceRow[] };
  });

/* ------------------------------- write ----------------------------------- */

export const saveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        resource: resourceKey,
        id: z.string().optional(),
        values: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = loose(supabase);
    const def = RESOURCES[data.resource] as ResourceDef;
    await assertAccess(db, userId, def.write);

    const payload = pick(data.values, def.columns);
    if (!Object.keys(payload).length) throw new Error("Nothing to save.");

    let recordId = data.id ?? null;
    if (data.id) {
      const idColumn = def.table === "site_settings" ? "key" : "id";
      const { error } = await db.from(def.table).update(payload).eq(idColumn, data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabase
        .from(def.table)
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      recordId = ((inserted as Record<string, string>)?.["id"] as string) ?? null;
    }

    await db.from("audit_logs").insert({
      actor_id: userId,
      action: data.id ? `${data.resource}_updated` : `${data.resource}_created`,
      target_type: data.resource,
      target_id: recordId,
      metadata: { fields: Object.keys(payload) },
    });

    return { ok: true, id: recordId };
  });

export const archiveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ resource: resourceKey, id: z.string(), restore: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = loose(supabase);
    const def = RESOURCES[data.resource] as ResourceDef;
    await assertAccess(db, userId, def.write);

    if (def.archiveColumn) {
      const { error } = await supabase
        .from(def.table)
        .update({
          [def.archiveColumn]: data.restore ? null : new Date().toISOString(),
          ...(def.columns.includes("published") && !data.restore ? { published: false } : {}),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from(def.table).delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    await db.from("audit_logs").insert({
      actor_id: userId,
      action: data.restore ? `${data.resource}_restored` : `${data.resource}_archived`,
      target_type: data.resource,
      target_id: data.id,
      metadata: {},
    });
    return { ok: true };
  });

export const duplicateResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ resource: resourceKey, id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = loose(supabase);
    const def = RESOURCES[data.resource] as ResourceDef;
    await assertAccess(db, userId, def.write);

    const { data: row, error } = await db
      .from(def.table)
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const copy = pick(row as Record<string, unknown>, def.columns);
    const stamp = Date.now().toString(36);
    if ("slug" in copy && typeof copy["slug"] === "string") copy["slug"] = `${copy["slug"]}-copy-${stamp}`;
    if ("template_key" in copy && typeof copy["template_key"] === "string")
      copy["template_key"] = `${copy["template_key"]}_copy_${stamp}`;
    if ("position" in copy && typeof copy["position"] === "string")
      copy["position"] = `${copy["position"]} (copy)`;
    if ("title" in copy && typeof copy["title"] === "string") copy["title"] = `${copy["title"]} (copy)`;
    if ("published" in copy) copy["published"] = false;
    if ("status" in copy) copy["status"] = "draft";

    const { data: inserted, error: insErr } = await db
      .from(def.table)
      .insert(copy)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await db.from("audit_logs").insert({
      actor_id: userId,
      action: `${data.resource}_duplicated`,
      target_type: data.resource,
      target_id: String((inserted as { id: string }).id),
      metadata: { source_id: data.id },
    });
    return { ok: true, id: String((inserted as { id: string }).id) };
  });

export const reorderResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        resource: resourceKey,
        order: z.array(z.object({ id: z.string(), sort_order: z.number().int() })).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = loose(supabase);
    const def = RESOURCES[data.resource] as ResourceDef;
    await assertAccess(db, userId, def.write);
    if (!def.columns.includes("sort_order")) throw new Error("This resource is not orderable.");
    for (const item of data.order) {
      const { error } = await supabase
        .from(def.table)
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
