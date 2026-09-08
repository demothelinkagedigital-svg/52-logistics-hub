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
import { APPLICATION_STATUS_LABELS } from "@/lib/application-schema";
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
        action={
          <StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status] ?? a.status} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Applicant information">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Email" value={a.email} />
              <Field label="Phone" value={a.phone} />
              <Field label="Date of birth" value={a.date_of_birth} />
              <Field label="Address" value={[a.address_line1, a.city, a.state, a.postal_code].filter(Boolean).join(", ")} />
              <Field label="CDL" value={`${a.cdl_class ?? ""} ${a.cdl_number ?? ""} ${a.cdl_state ?? ""}`.trim()} />
              <Field label="CDL expires" value={a.cdl_expiration_date} />
              <Field label="Experience" value={a.years_experience != null ? `${a.years_experience} yrs` : null} />
              <Field label="Endorsements" value={(a.endorsements ?? []).join(", ")} />
              <Field label="Medical card" value={a.medical_card_expiration} />
              <Field label="Accidents (3 yrs)" value={a.accidents_last_3_years} />
              <Field label="Violations (3 yrs)" value={a.violations_last_3_years} />
              <Field label="Notes from applicant" value={a.additional_notes} />
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
                      {[e.position_held, e.city, e.state, `${e.start_date ?? "?"} – ${e.end_date ?? "present"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {e.reason_for_leaving ? (
                      <p className="mt-1 text-xs text-muted-foreground">Left: {e.reason_for_leaving}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Documents">
            {!data.documents.length ? (
              <EmptyState title="No documents uploaded" />
            ) : (
              <ul className="divide-y divide-border">
                {data.documents.map((d) => (
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
                      {d.file_name}
                      <span className="ml-2 text-xs text-muted-foreground">{d.doc_type}</span>
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
                        const reason = window.prompt("Reason for rejection (shown to applicant):");
                        if (!reason) return;
                        void run(
                          () =>
                            verify({
                              data: { id: d.id, verification_status: "rejected", rejection_reason: reason },
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
              items={data.events.map((e) => ({
                id: e.id,
                title: String(e.event_type).replace(/_/g, " "),
                description: e.description,
                at: e.created_at,
              }))}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Review actions">
            <label className="block text-[11px] font-semibold uppercase text-muted-foreground">
              Change status
            </label>
            <select
              defaultValue={a.status}
              disabled={busy}
              onChange={(e) =>
                void run(
                  () => setStatus({ data: { id, status: e.target.value } }),
                  "Status updated",
                )
              }
              className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm"
            >
              {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

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
