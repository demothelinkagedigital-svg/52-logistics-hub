import { createServerFn } from "@/lib/mock/server-fn";
import { requireSupabaseAuth } from "@/lib/mock/server-fn";
import { portalDraftSchema } from "@/lib/application-schema";
import { z } from "zod";
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
