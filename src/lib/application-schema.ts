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
  { key: "cdl", label: "CDL (front)", required: true },
  { key: "medical_card", label: "DOT Medical Card", required: true },
  { key: "mvr", label: "Motor Vehicle Report", required: false },
  { key: "twic", label: "TWIC Card", required: false },
  { key: "other", label: "Other supporting document", required: false },
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
  equipment_operated: z.string().trim().max(200).optional().nullable(),
});
export type EmployerInput = z.infer<typeof employerSchema>;

const nn = (max: number) => z.string().trim().max(max).optional().nullable();
const nd = () => z.string().trim().max(20).optional().nullable();

export const applicationDraftSchema = z.object({
  job_id: z.string().uuid().optional().nullable(),
  position_title: nn(160),
  current_step: z.number().int().min(1).max(6).optional(),
  first_name: nn(80),
  middle_name: nn(80),
  last_name: nn(80),
  email: z.string().trim().max(255).optional().nullable(),
  phone: nn(40),
  address_line1: nn(160),
  address_line2: nn(160),
  city: nn(80),
  state: nn(40),
  postal_code: nn(20),
  date_of_birth: nd(),
  cdl_number: nn(60),
  cdl_state: nn(40),
  cdl_class: nn(10),
  cdl_issue_date: nd(),
  cdl_expiration_date: nd(),
  endorsements: z.array(z.string().max(60)).max(12).optional(),
  years_experience: z.number().min(0).max(60).optional().nullable(),
  medical_card_expiration: nd(),
  twic_card: z.boolean().optional(),
  authorized_to_work: z.boolean().optional().nullable(),
  age_21_or_older: z.boolean().optional().nullable(),
  accidents_last_3_years: nn(1000),
  violations_last_3_years: nn(1000),
  license_ever_suspended: z.boolean().optional().nullable(),
  suspension_details: nn(1000),
  positive_drug_test: z.boolean().optional().nullable(),
  drug_test_details: nn(1000),
  can_perform_duties: z.boolean().optional().nullable(),
  how_did_you_hear: nn(160),
  additional_notes: nn(2000),
  signature_name: nn(120),
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
