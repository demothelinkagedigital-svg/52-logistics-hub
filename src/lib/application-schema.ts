import { z } from "zod";

export const ENDORSEMENTS = [
  "H — Hazmat",
  "N — Tanker",
  "X — Hazmat/Tanker",
  "T — Doubles/Triples",
  "P — Passenger",
  "S — School Bus",
] as const;

export const DOCUMENT_TYPES = [
  { key: "medical_card", label: "DOT Medical Card", required: false },
  { key: "resume", label: "Resume", required: false },
] as const;

export const APPLICATION_STEPS = [
  { step: 1, title: "Personal Information", blurb: "How we reach you." },
  { step: 2, title: "CDL & Experience", blurb: "License, endorsements, driving history." },
  { step: 3, title: "Employment History", blurb: "Last 3 years, DOT-regulated employers." },
  { step: 4, title: "Eligibility & Safety", blurb: "DOT screening questions." },
  { step: 5, title: "Documents", blurb: "Securely upload your credentials." },
  { step: 6, title: "Review & Certify", blurb: "Confirm and submit." },
] as const;

export const employerSchema = z.object({
  id: z.string().optional(),
  employer_name: z.string().trim().min(1, "Employer name is required").max(160),
  position_held: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  start_date: z.string().trim().max(20).optional().nullable(),
  end_date: z.string().trim().max(20).optional().nullable(),
  reason_for_leaving: z.string().trim().max(400).optional().nullable(),
  was_dot_regulated: z.boolean().default(true),
  current_employer: z.boolean().optional().nullable(),
  commercial_driving_relevant: z.boolean().optional().nullable(),
  permission_to_contact: z.boolean().optional().nullable(),
  equipment_operated: z.string().trim().max(200).optional().nullable(),
});
export type EmployerInput = z.infer<typeof employerSchema>;

const nn = (max: number) => z.string().trim().max(max).optional().nullable();

export const applicationDraftSchema = z.object({
  job_id: z.string().uuid().optional().nullable(),
  position_title: nn(160),
  current_step: z.number().int().min(1).max(6).optional(),
  first_name: nn(80),
  middle_name: nn(80),
  last_name: nn(80),
  preferred_name: nn(80),
  email: z.string().trim().max(255).optional().nullable(),
  phone: nn(40),
  preferred_contact_method: z.enum(["email", "phone", "text"]).optional().nullable(),
  city: nn(80),
  state: nn(40),
  postal_code: nn(20),
  is_18_or_older: z.boolean().optional().nullable(),
  cdl_status: z.enum(["valid_cdl", "in_training", "no_cdl"]).optional().nullable(),
  cdl_state: nn(40),
  cdl_class: nn(10),
  endorsements: z.array(z.string().max(60)).max(12).optional(),
  commercial_experience_years: z.number().min(0).max(60).optional().nullable(),
  tractor_trailer_experience: z.boolean().optional().nullable(),
  linehaul_pd_experience: z.boolean().optional().nullable(),
  schedule_availability: z.array(z.string()).optional(),
  start_availability: nn(160),
  medical_card_status: z.enum(["current", "expired", "none"]).optional().nullable(),
  medical_card_expiration_month: z.number().int().min(1).max(12).optional().nullable(),
  medical_card_expiration_year: z.number().int().optional().nullable(),
  authorized_to_work: z.boolean().optional().nullable(),
  can_perform_duties_with_or_without_accommodation: z.boolean().optional().nullable(),
  agrees_to_comply: z.boolean().optional().nullable(),
  consent_electronic_records: z.boolean().optional().nullable(),
  how_did_you_hear: nn(160),
  additional_notes: nn(2000),
  signature_name: nn(120),
  signature_signed_at: z.string().datetime({ offset: true }).optional().nullable(),
  certified: z.boolean().optional(),
});
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  screening: "Screening",
  interview: "Interview",
  conditional_offer: "Conditional offer",
  background_check: "Background check",
  onboarding: "Onboarding",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABELS);

export const SCREENING_STATUSES = [
  "not_started",
  "initiated",
  "pending",
  "clear",
  "review_required",
  "failed",
  "cancelled",
] as const;

export const ESIGN_STATUSES = [
  "not_sent",
  "sent",
  "viewed",
  "completed",
  "declined",
  "voided",
] as const;

export function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
