import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicJob = {
  id: string;
  position: string;
  slug: string;
  days: string;
  schedule: string;
  location: string;
  summary: string | null;
  requirements: string[];
  responsibilities: string[];
  experience_notes: string | null;
  employment_type: string;
  work_category: string;
  application_deadline: string | null;
  pay_notes: string | null;
  benefits_notes: string | null;
  equipment_notes: string | null;
  status: string;
  updated_at: string;
};

const JOB_COLUMNS =
  "id, position, slug, days, schedule, location, summary, requirements, responsibilities, experience_notes, employment_type, work_category, application_deadline, pay_notes, benefits_notes, equipment_notes, status, updated_at";

export type SiteSettings = Record<string, string | null>;

export type PublicFaq = { id: string; question: string; answer: string };

export type PublicSocialLink = { id: string; platform: string; url: string | null };

export type SiteBootstrap = {
  settings: SiteSettings;
  social: PublicSocialLink[];
};

export const getSiteBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteBootstrap> => {
    const sb = publicClient();
    const [settingsRes, socialRes] = await Promise.all([
      sb.from("site_settings").select("key, value"),
      sb.from("social_links").select("id, platform, url").order("sort_order"),
    ]);
    const settings: SiteSettings = {};
    for (const row of settingsRes.data ?? []) settings[row.key] = row.value;
    return { settings, social: socialRes.data ?? [] };
  },
);

export const getPublicJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicJob[]> => {
    const sb = publicClient();
    const { data } = await sb
      .from("jobs")
      .select(
        "id, position, slug, days, schedule, location, summary, requirements, pay_notes, benefits_notes, equipment_notes, status",
      )
      .order("sort_order");
    return (data ?? []) as PublicJob[];
  },
);

export const getPublicFaqs = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicFaq[]> => {
    const sb = publicClient();
    const { data } = await sb.from("faqs").select("id, question, answer").order("sort_order");
    return data ?? [];
  },
);
