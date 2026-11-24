import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
} from "@/lib/recruiting.functions";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  applicationStatusLabel,
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
  screening_update: "Screening updated",
  esign_update: "Electronic signature updated",
};

function ApplicantDetail() {
  const { id } = Route.useParams();
  const { isRecruiter, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getApplicationDetail);
  const setStatus = useServerFn(updateApplicationStatus);
  const addNote = useServerFn(addApplicationNote);
  const requestFix = useServerFn(requestCorrections);
  const verify = useServerFn(verifyDocument);
  const openDoc = useServerFn(getDocumentUrl);

  const [note, setNote] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [corrections, setCorrections] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchDetail({ data: { id } }),
    enabled: isRecruiter,
  });

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
