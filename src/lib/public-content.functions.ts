import { createServerFn } from "@/lib/mock/server-fn";
import { demoClient } from "@/lib/mock/client";

function publicClient() {
  return demoClient;
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

export type PublicSocialLink = { id: string; platform: string; url: string | null; is_active: boolean };

export type SiteBootstrap = {
  settings: SiteSettings;
  social: PublicSocialLink[];
};

export const getSiteBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteBootstrap> => {
    const sb = publicClient();
    const [settingsRes, socialRes] = await Promise.all([
      sb.from("site_settings").select("key, value"),
      sb.from("social_links").select("id, platform, url, is_active").order("sort_order"),
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
      .select(JOB_COLUMNS)
      .eq("published", true)
      .is("archived_at", null)
      .order("sort_order");
    return (data ?? []) as unknown as PublicJob[];
  },
);

export const getPublicJob = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<PublicJob | null> => {
    const sb = publicClient();
    const { data } = await sb
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("slug", slug)
      .eq("published", true)
      .is("archived_at", null)
      .maybeSingle();
    return (data ?? null) as unknown as PublicJob | null;
  });

export const getPublicFaqs = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicFaq[]> => {
    const sb = publicClient();
    const { data } = await sb.from("faqs").select("id, question, answer").order("sort_order");
    return data ?? [];
  },
);
