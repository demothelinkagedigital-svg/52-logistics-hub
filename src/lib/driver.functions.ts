import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
import { z } from "zod";

export const getDriverHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [modulesRes, progressRes, handbookRes, safetyRes, ackRes, annRes] = await Promise.all([
      supabase.from("academy_modules").select("*").eq("published", true).order("sort_order"),
      supabase.from("academy_progress").select("*").eq("user_id", userId),
      supabase.from("handbook_sections").select("*").eq("published", true).order("sort_order"),
      supabase.from("safety_resources").select("*").eq("published", true).order("sort_order"),
      supabase.from("safety_acknowledgements").select("*").eq("user_id", userId),
      supabase
        .from("announcements")
        .select("*")
        .eq("published", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    return {
      modules: modulesRes.data ?? [],
      progress: progressRes.data ?? [],
      handbook: handbookRes.data ?? [],
      safety: safetyRes.data ?? [],
      acknowledgements: ackRes.data ?? [],
      announcements: annRes.data ?? [],
    };
  });

export const setModuleProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ module_id: z.string().uuid(), completed: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("academy_progress").upsert(
      {
        user_id: userId,
        module_id: data.module_id,
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,module_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ resource_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("safety_acknowledgements")
      .insert({ user_id: userId, resource_id: data.resource_id });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });
