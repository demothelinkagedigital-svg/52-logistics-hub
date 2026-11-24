import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  getApplicationDetail,
  updateApplicationStatus,
  addApplicationNote,
  requestCorrections,
  verifyDocument,
  getDocumentUrl,
  saveFirstAdvantageHandoff,
  saveEsignRecord,
  deleteEsignRecord,
} from "@/lib/recruiting.functions";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  applicationStatusLabel,
  ESIGN_STATUSES,
} from "@/lib/application-schema";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  AccessDenied,
  EmptyState,
  ErrorState,
  Field,
  Panel,
  StatusBadge,
  TableSkeleton,
  Timeline,
  fullName,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/recruiting/$id")({
  head: () => ({
    meta: [
      { title: "Applicant Review — 52 Logistics Portal" },
      { name: "description", content: "Review an applicant's information, documents and history." },
      { property: "og:title", content: "Applicant Review — 52 Logistics Portal" },
      { property: "og:description", content: "Applicant profile, documents and review actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicantDetail,
});

function displayValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ") || null;
  return String(value);
}

const ACTIVITY_LABELS: Record<string, string> = {
  submitted: "Application submitted",
  status_change: "Status changed",
  corrections_requested: "Corrections requested",
  document_approved: "Document approved",
  document_rejected: "Document rejected",
  document_pending: "Document pending",
  first_advantage_handoff_update: "First Advantage handoff updated",
  esign_update: "DocuSign record updated",
};

const HANDOFF_STEPS = [
  [
    "reviewed_application",
    "Reviewed the application and confirmed Ready to Invite to First Advantage",
  ],
  ["opened_employer_portal", "Opened the First Advantage employer portal (outside this website)"],
  [
    "created_candidate_invitation",
    "Created or sent the candidate invitation in the First Advantage portal",
  ],
  [
    "recorded_handoff_details",
    "Recorded invitation date, recruiter, case ID and next check date here",
  ],
  ["updated_application_status", "Updated the status here from provider-side information"],
] as const;

const ESIGN_DOCUMENT_TYPES = ["Offer letter", "Employment forms", "Other"] as const;
type EsignDocumentType = (typeof ESIGN_DOCUMENT_TYPES)[number];
type EsignForm = {
  id?: string;
  document_type: EsignDocumentType;
  sent_date: string;
  sender_id: string;
  external_reference_id: string;
  completion_date: string;
  status: (typeof ESIGN_STATUSES)[number];
  notes: string;
};

function ApplicantDetail() {
  const { id } = Route.useParams();
  const { isRecruiter, user, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getApplicationDetail);
  const setStatus = useServerFn(updateApplicationStatus);
  const addNote = useServerFn(addApplicationNote);
  const requestFix = useServerFn(requestCorrections);
  const verify = useServerFn(verifyDocument);
  const openDoc = useServerFn(getDocumentUrl);
  const saveHandoff = useServerFn(saveFirstAdvantageHandoff);
  const saveEsign = useServerFn(saveEsignRecord);
  const removeEsign = useServerFn(deleteEsignRecord);

  const [handoffForm, setHandoffForm] = useState({
    invitation_date: "",
    responsible_recruiter_id: "",
    external_case_id: "",
    next_check_date: "",
    operational_note: "",
    checklist: {
      reviewed_application: false,
      opened_employer_portal: false,
      created_candidate_invitation: false,
      recorded_handoff_details: false,
      updated_application_status: false,
    },
  });
  const [esignForm, setEsignForm] = useState<EsignForm>({
    document_type: "Offer letter",
    sent_date: "",
    sender_id: "",
    external_reference_id: "",
    completion_date: "",
    status: "not_sent",
    notes: "",
  });
  const [note, setNote] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [corrections, setCorrections] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchDetail({ data: { id } }),
    enabled: isRecruiter,
  });

  useEffect(() => {
    if (!data) return;
    if (data.handoff) {
      const handoff = data.handoff as {
        invitation_date?: string | null;
        responsible_recruiter_id?: string | null;
        external_case_id?: string | null;
        next_check_date?: string | null;
        operational_note?: string | null;
        checklist?: Record<string, { done_at: string | null; done_by: string | null }>;
      };
      setHandoffForm({
        invitation_date: handoff.invitation_date ?? "",
        responsible_recruiter_id: handoff.responsible_recruiter_id ?? "",
        external_case_id: handoff.external_case_id ?? "",
        next_check_date: handoff.next_check_date ?? "",
        operational_note: handoff.operational_note ?? "",
        checklist: Object.fromEntries(
          HANDOFF_STEPS.map(([key]) => [key, Boolean(handoff.checklist?.[key]?.done_at)]),
        ) as typeof handoffForm.checklist,
      });
    }
    setEsignForm((current) =>
      current.sender_id || !user?.id ? current : { ...current, sender_id: user.id },
    );
  }, [data, user?.id]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["application", id] });
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.invalidateQueries({ queryKey: ["recruiting-stats"] });
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isRecruiter) return <AccessDenied need="recruiter" />;
  if (isLoading) return <TableSkeleton rows={10} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <EmptyState title="Application not found" />;

  const a = data.application;
  const statusForOrder = ["draft", "corrections_requested"].includes(a.status)
    ? "incomplete"
    : a.status;
  const shouldSuggestInvitationStatus =
    APPLICATION_STATUS_ORDER.indexOf(statusForOrder as (typeof APPLICATION_STATUS_ORDER)[number]) <
    APPLICATION_STATUS_ORDER.indexOf("fadv_invitation_sent");

  return (
    <div>
      <Link
        to="/portal/recruiting"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to pipeline
      </Link>
      <PortalHeading
        eyebrow={a.reference_code}
        title={fullName(a)}
        blurb={a.position_title ?? "No position selected"}
        action={<StatusBadge status={a.status} label={applicationStatusLabel(a.status)} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {a.qualification_gap ? (
            <Panel title="Qualification review flag">
              <p className="text-sm font-medium">
                This application has one or more qualification gaps for human review.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(a.qualification_gap_reasons ?? []).map((reason: string) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <Panel title="Applicant information">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Preferred name" value={displayValue(a.preferred_name)} />
              <Field label="Email" value={a.email} />
              <Field label="Phone" value={a.phone} />
              <Field
                label="Preferred contact method"
                value={displayValue(a.preferred_contact_method)}
              />
              <Field
                label="Location"
                value={[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
              />
              <Field label="18 or older" value={displayValue(a.is_18_or_older)} />
              <Field label="Authorized to work" value={displayValue(a.authorized_to_work)} />
              <Field label="CDL status" value={displayValue(a.cdl_status)} />
              <Field label="CDL class" value={displayValue(a.cdl_class)} />
              <Field label="CDL state" value={displayValue(a.cdl_state)} />
              <Field label="Endorsements" value={displayValue(a.endorsements)} />
              <Field
                label="Commercial driving experience (years)"
                value={displayValue(a.commercial_experience_years)}
              />
              <Field
                label="Tractor-trailer experience"
                value={displayValue(a.tractor_trailer_experience)}
              />
              <Field
                label="Linehaul / P&D experience"
                value={displayValue(a.linehaul_pd_experience)}
              />
              <Field label="Schedule availability" value={displayValue(a.schedule_availability)} />
              <Field label="Start availability" value={displayValue(a.start_availability)} />
              <Field
                label="Can perform duties with or without accommodation"
                value={displayValue(a.can_perform_duties_with_or_without_accommodation)}
              />
              <Field label="Medical card status" value={displayValue(a.medical_card_status)} />
              <Field
                label="Medical card expiration month"
                value={displayValue(a.medical_card_expiration_month)}
              />
              <Field
                label="Medical card expiration year"
                value={displayValue(a.medical_card_expiration_year)}
              />
              <Field label="Agrees to comply" value={displayValue(a.agrees_to_comply)} />
              <Field
                label="Consents to electronic records"
                value={displayValue(a.consent_electronic_records)}
              />
              <Field label="Signature signed at" value={displayValue(a.signature_signed_at)} />
              <Field label="Signature name" value={displayValue(a.signature_name)} />
              <Field label="Certified" value={displayValue(a.certified)} />
              <Field label="How did you hear about us" value={displayValue(a.how_did_you_hear)} />
              <Field label="Notes from applicant" value={displayValue(a.additional_notes)} />
            </dl>
          </Panel>

          <Panel title="Employment history">
            {!data.employers.length ? (
              <EmptyState title="No employers listed" />
            ) : (
              <ul className="divide-y divide-border">
                {data.employers.map((e) => (
                  <li key={e.id} className="py-3">
                    <p className="text-sm font-semibold">
                      {e.employer_name} {e.was_dot_regulated ? "· DOT" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        e.position_held,
                        e.city,
                        e.state,
                        `${e.start_date ?? "?"} – ${e.end_date ?? "present"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {e.reason_for_leaving ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Left: {e.reason_for_leaving}
                      </p>
                    ) : null}
                    <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Field label="Current employer" value={displayValue(e.current_employer)} />
                      <Field
                        label="Commercial driving relevant"
                        value={displayValue(e.commercial_driving_relevant)}
                      />
                      <Field
                        label="Permission to contact"
                        value={displayValue(e.permission_to_contact)}
                      />
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Documents">
            {!data.documents.some(
              (d) => d.doc_type === "medical_card" || d.doc_type === "resume",
            ) ? (
              <EmptyState title="No supported documents uploaded" />
            ) : (
              <ul className="divide-y divide-border">
                {data.documents
                  .filter((d) => d.doc_type === "medical_card" || d.doc_type === "resume")
                  .map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { url } = await openDoc({ data: { id: d.id } });
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Could not open");
                          }
                        }}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {d.doc_type === "medical_card" ? "Medical card document" : "Resume"}
                      </button>
                      <StatusBadge status={d.verification_status} />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => verify({ data: { id: d.id, verification_status: "approved" } }),
                            "Document approved",
                          )
                        }
                        className="rounded-sm border border-input px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt(
                            "Reason for rejection (shown to applicant):",
                          );
                          if (!reason) return;
                          void run(
                            () =>
                              verify({
                                data: {
                                  id: d.id,
                                  verification_status: "rejected",
                                  rejection_reason: reason,
                                },
                              }),
                            "Document rejected",
                          );
                        }}
                        className="rounded-sm border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5"
                      >
                        Reject
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title="First Advantage handoff">
            <p className="mb-4 rounded-sm border border-accent/30 bg-accent/5 p-3 text-sm">
              Record handoff details only. Never enter screening results, background details, drug
              or alcohol results, MVR or Clearinghouse data, passwords or screenshots.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Invitation date
                <input
                  type="date"
                  value={handoffForm.invitation_date}
                  onChange={(e) =>
                    setHandoffForm((form) => ({ ...form, invitation_date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Responsible recruiter
                <select
                  value={handoffForm.responsible_recruiter_id}
                  onChange={(e) =>
                    setHandoffForm((form) => ({
                      ...form,
                      responsible_recruiter_id: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                >
                  <option value="">Select recruiter</option>
                  {data.recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                External case ID (optional)
                <input
                  maxLength={160}
                  value={handoffForm.external_case_id}
                  onChange={(e) =>
                    setHandoffForm((form) => ({ ...form, external_case_id: e.target.value }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Next check date
                <input
                  type="date"
                  value={handoffForm.next_check_date}
                  onChange={(e) =>
                    setHandoffForm((form) => ({ ...form, next_check_date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              Operational note
              <textarea
                maxLength={300}
                rows={2}
                value={handoffForm.operational_note}
                onChange={(e) =>
                  setHandoffForm((form) => ({ ...form, operational_note: e.target.value }))
                }
                className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
              />
            </label>
            <div className="mt-4 space-y-2">
              {HANDOFF_STEPS.map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={handoffForm.checklist[key]}
                    onChange={(e) =>
                      setHandoffForm((form) => ({
                        ...form,
                        checklist: { ...form.checklist, [key]: e.target.checked },
                      }))
                    }
                    className="mt-1"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    saveHandoff({
                      data: {
                        application_id: id,
                        invitation_date: handoffForm.invitation_date || null,
                        responsible_recruiter_id: handoffForm.responsible_recruiter_id || null,
                        external_case_id: handoffForm.external_case_id.trim() || null,
                        next_check_date: handoffForm.next_check_date || null,
                        operational_note: handoffForm.operational_note.trim() || null,
                        checklist: handoffForm.checklist,
                      },
                    }),
                  "First Advantage handoff saved",
                )
              }
              className="mt-4 w-full rounded-sm border border-input px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              Save handoff details
            </button>
            {handoffForm.checklist.recorded_handoff_details && shouldSuggestInvitationStatus ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => setStatus({ data: { id, status: "fadv_invitation_sent" } }),
                    "Status updated",
                  )
                }
                className="mt-3 w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                Set status: First Advantage Invitation Sent
              </button>
            ) : null}
          </Panel>

          <Panel title="DocuSign tracking">
            <p className="mb-4 rounded-sm border border-accent/30 bg-accent/5 p-3 text-sm">
              Documents are signed in DocuSign. This only tracks them.
            </p>
            <ul className="mb-5 divide-y divide-border">
              {data.esignRecords.map((record) => (
                <li key={record.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{record.document_name}</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sent {record.sent_at ? new Date(record.sent_at).toLocaleDateString() : "—"} ·
                    Sender{" "}
                    {data.recruiters.find((r) => r.id === record.updated_by)?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reference {record.envelope_reference ?? "—"} · Completed{" "}
                    {record.completed_at ? new Date(record.completed_at).toLocaleDateString() : "—"}
                  </p>
                  {record.notes ? (
                    <p className="text-xs text-muted-foreground">{record.notes}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setEsignForm({
                          id: record.id,
                          document_type: ESIGN_DOCUMENT_TYPES.includes(
                            record.document_name as EsignDocumentType,
                          )
                            ? (record.document_name as EsignDocumentType)
                            : "Other",
                          sent_date: record.sent_at?.slice(0, 10) ?? "",
                          sender_id: record.updated_by ?? user?.id ?? "",
                          external_reference_id: record.envelope_reference ?? "",
                          completion_date: record.completed_at?.slice(0, 10) ?? "",
                          status: record.status,
                          notes: record.notes ?? "",
                        })
                      }
                      className="rounded-sm border border-input px-3 py-1.5 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Delete this DocuSign tracking entry?"))
                          void run(
                            () => removeEsign({ data: { id: record.id, application_id: id } }),
                            "DocuSign record deleted",
                          );
                      }}
                      className="rounded-sm border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Document type
                <select
                  value={esignForm.document_type}
                  onChange={(e) =>
                    setEsignForm((form) => ({
                      ...form,
                      document_type: e.target.value as EsignDocumentType,
                    }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                >
                  {ESIGN_DOCUMENT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Status
                <select
                  value={esignForm.status}
                  onChange={(e) =>
                    setEsignForm((form) => ({
                      ...form,
                      status: e.target.value as EsignForm["status"],
                    }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                >
                  {ESIGN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Sent date
                <input
                  type="date"
                  value={esignForm.sent_date}
                  onChange={(e) => setEsignForm((form) => ({ ...form, sent_date: e.target.value }))}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Sender
                <select
                  value={esignForm.sender_id}
                  onChange={(e) => setEsignForm((form) => ({ ...form, sender_id: e.target.value }))}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                >
                  <option value="">Select recruiter</option>
                  {data.recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                External envelope or reference ID
                <input
                  maxLength={160}
                  value={esignForm.external_reference_id}
                  onChange={(e) =>
                    setEsignForm((form) => ({ ...form, external_reference_id: e.target.value }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Completion date
                <input
                  type="date"
                  value={esignForm.completion_date}
                  onChange={(e) =>
                    setEsignForm((form) => ({ ...form, completion_date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              Notes
              <textarea
                rows={2}
                value={esignForm.notes}
                onChange={(e) => setEsignForm((form) => ({ ...form, notes: e.target.value }))}
                className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy || !esignForm.sender_id}
                onClick={() =>
                  void run(
                    async () => {
                      await saveEsign({
                        data: {
                          ...esignForm,
                          application_id: id,
                          sent_date: esignForm.sent_date || null,
                          completion_date: esignForm.completion_date || null,
                          external_reference_id: esignForm.external_reference_id.trim() || null,
                          notes: esignForm.notes.trim() || null,
                        },
                      });
                      setEsignForm({
                        document_type: "Offer letter",
                        sent_date: "",
                        sender_id: user?.id ?? "",
                        external_reference_id: "",
                        completion_date: "",
                        status: "not_sent",
                        notes: "",
                      });
                    },
                    esignForm.id ? "DocuSign record updated" : "DocuSign record added",
                  )
                }
                className="flex-1 rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {esignForm.id ? "Save changes" : "Add DocuSign record"}
              </button>
              {esignForm.id ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setEsignForm({
                      document_type: "Offer letter",
                      sent_date: "",
                      sender_id: user?.id ?? "",
                      external_reference_id: "",
                      completion_date: "",
                      status: "not_sent",
                      notes: "",
                    })
                  }
                  className="rounded-sm border border-input px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel title="Activity history">
            <Timeline
              items={data.events.map((e) => {
                const metadata =
                  e.metadata && typeof e.metadata === "object"
                    ? (e.metadata as Record<string, unknown>)
                    : {};
                const isStatusChange =
                  e.event_type === "status_change" && metadata["from"] && metadata["to"];
                return {
                  id: e.id,
                  title: isStatusChange
                    ? `${applicationStatusLabel(String(metadata["from"]))} → ${applicationStatusLabel(String(metadata["to"]))}`
                    : (ACTIVITY_LABELS[e.event_type] ?? "Application activity"),
                  description: e.description,
                  at: e.created_at,
                  who: e.actor_name ?? (e.actor_id ? "Staff member" : "Applicant"),
                };
              })}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Review actions">
            <label className="block text-[11px] font-semibold uppercase text-muted-foreground">
              Change status
            </label>
            <select
              value={
                ["draft", "corrections_requested"].includes(a.status) ? "incomplete" : a.status
              }
              disabled={busy}
              onChange={(e) =>
                void run(
                  () =>
                    setStatus({
                      data: {
                        id,
                        status: e.target.value as (typeof APPLICATION_STATUS_ORDER)[number],
                        note: statusNote.trim() || undefined,
                      },
                    }),
                  "Status updated",
                )
              }
              className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm"
            >
              {APPLICATION_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Optional status-change note…"
              className="mt-2 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm"
              aria-label="Optional status-change note"
            />

            <div className="mt-5">
              <label className="block text-[11px] font-semibold uppercase text-muted-foreground">
                Request corrections
              </label>
              <textarea
                rows={3}
                value={corrections}
                onChange={(e) => setCorrections(e.target.value)}
                placeholder="Tell the applicant exactly what to fix…"
                className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={busy || corrections.trim().length < 3}
                onClick={() =>
                  void run(async () => {
                    await requestFix({ data: { id, notes: corrections.trim() } });
                    setCorrections("");
                  }, "Corrections requested")
                }
                className="mt-2 w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                Send back to applicant
              </button>
            </div>
          </Panel>

          <Panel title="Internal notes">
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note…"
              className="w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={busy || note.trim().length < 1}
              onClick={() =>
                void run(async () => {
                  await addNote({ data: { id, body: note.trim() } });
                  setNote("");
                }, "Note added")
              }
              className="mt-2 w-full rounded-sm border border-input px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              Add note
            </button>
            <ul className="mt-4 space-y-3">
              {data.notes.map((n) => (
                <li key={n.id} className="rounded-sm bg-surface-2 p-3">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
