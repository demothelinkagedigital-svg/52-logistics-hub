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
  { step: 1, title: "Position & identity", blurb: "Opening and contact information." },
  { step: 2, title: "Eligibility & CDL", blurb: "Work eligibility and driving experience." },
  { step: 3, title: "Safety & availability", blurb: "Schedule, start date, and medical card." },
  { step: 4, title: "Employment history", blurb: "Current or most recent employer." },
  { step: 5, title: "Documents", blurb: "Optional private uploads." },
  { step: 6, title: "Certification", blurb: "Review, consent, and sign." },
] as const;

export const employerSchema = z.object({
  id: z.string().optional(),
  employer_name: z.string().trim().max(160),
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
  qualification_gap: z.boolean().optional(),
  qualification_gap_reasons: z.array(z.string().max(160)).optional(),
});
export const portalDraftSchema = applicationDraftSchema.omit({ signature_signed_at: true });

export const applicationAssignmentSchema = z.object({
  assigned_recruiter_id: z.string().uuid().nullable(),
});
export type ApplicationAssignment = z.infer<typeof applicationAssignmentSchema>;

export const applicationAccessSchema = z.object({
  user_id: z.string().uuid().nullable(),
  resume_token_hash: z.string().nullable(),
  resume_expires_at: z.string().datetime({ offset: true }).nullable(),
  source: z.literal("web"),
  last_saved_at: z.string().datetime({ offset: true }).nullable(),
});

export const applicationRelatedOwnershipSchema = z.object({
  user_id: z.string().uuid().nullable(),
});

export const applicationEmployerSchema = employerSchema.merge(applicationRelatedOwnershipSchema);

export const applicationDocumentSchema = z.object({
  doc_type: z.enum(["medical_card", "resume"]),
  storage_path: z.string().max(400),
  file_name: z
    .string()
    .max(255)
    .regex(/\.(pdf|jpe?g|png)$/i, "Upload a PDF, JPG, or PNG file."),
  mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"], {
    errorMap: () => ({ message: "Upload a PDF, JPG, or PNG file." }),
  }),
  size_bytes: z
    .number({ required_error: "File size is required." })
    .int()
    .nonnegative()
    .max(10 * 1024 * 1024, "Files must be 10 MiB or smaller."),
});
export const applicationDocumentRecordSchema = applicationDocumentSchema.merge(
  applicationRelatedOwnershipSchema,
);

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  new: "New",
  incomplete: "Incomplete",
  ready_for_review: "Ready for Review",
  ready_to_invite_fadv: "Ready to Invite to First Advantage",
  fadv_invitation_sent: "First Advantage Invitation Sent",
  fadv_in_progress: "Candidate Completing First Advantage",
  screening_complete_review: "Screening Complete – Management Review",
  hired: "Hired",
  rejected: "Rejected",
  archived: "Archived",
};

export const APPLICATION_STATUS_ORDER = [
  "new",
  "incomplete",
  "ready_for_review",
  "ready_to_invite_fadv",
  "fadv_invitation_sent",
  "fadv_in_progress",
  "screening_complete_review",
  "hired",
  "rejected",
  "archived",
] as const;

export const APPLICATION_STATUSES = APPLICATION_STATUS_ORDER;

export function applicationStatusLabel(status: string): string {
  if (status === "draft" || status === "corrections_requested") return "Incomplete";
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

export const handbookSignSchema = z
  .object({
    version_id: z.string().uuid(),
    signature_name: z.string().trim().min(2).max(120),
    agreed: z.boolean().refine((agreed) => agreed, "You must agree to the acknowledgement."),
  })
  .strict();

export const handbookAcknowledgementSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    handbook_version_id: z.string().uuid(),
    version_label: z.string().min(1),
    handbook_title: z.string().min(1),
    statement: z.string().min(1),
    signature_name: z.string().trim().min(2).max(120),
    signed_at: z.string().datetime(),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.object({ method: z.literal("web"), user_agent: z.string().nullable() }).strict(),
    created_at: z.string().datetime(),
    effective_date: z.string(),
  })
  .strict();

export type HandbookAcknowledgement = z.infer<typeof handbookAcknowledgementSchema>;

export const handbookReceiptSchema = z.object({ id: z.string().uuid() }).strict();

export const ESIGN_STATUSES = [
  "not_sent",
  "sent",
  "viewed",
  "completed",
  "declined",
  "voided",
] as const;
