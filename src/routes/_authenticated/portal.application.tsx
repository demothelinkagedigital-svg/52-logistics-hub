import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/mock/server-fn";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Save, Trash2, Upload } from "lucide-react";
import {
  getMyApplication,
  startApplication,
  saveApplicationDraft,
  saveEmployers,
  recordDocument,
  deleteDocument,
  submitApplication,
} from "@/lib/portal.functions";
import { getDocumentUrl } from "@/lib/recruiting.functions";
import {
  APPLICATION_STEPS,
  APPLICATION_STATUS_LABELS,
  DOCUMENT_TYPES,
  ENDORSEMENTS,
  type ApplicationDraft,
  type EmployerInput,
} from "@/lib/application-schema";
import { demoClient as supabase } from "@/lib/mock/client";
import { PortalHeading } from "@/components/portal/PortalShell";
import {
  EmptyState,
  ErrorState,
  Panel,
  StatusBadge,
  TableSkeleton,
  Timeline,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/application")({
  head: () => ({
    meta: [
      { title: "My Application — 52 Logistics Portal" },
      { name: "description", content: "Complete, save and submit your 52 Logistics driver application." },
      { property: "og:title", content: "My Application — 52 Logistics Portal" },
      { property: "og:description", content: "Six-step DOT driver application with save and resume." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicationPage,
});

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

type Doc = {
  id: string;
  doc_type: string;
  file_name: string;
  verification_status: string;
  rejection_reason: string | null;
  created_at: string;
  size_bytes: number | null;
};

function TextField({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm disabled:bg-secondary disabled:text-muted-foreground"
      />
    </label>
  );
}

function AreaField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <textarea
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm disabled:bg-secondary disabled:text-muted-foreground"
      />
    </label>
  );
}

function YesNo({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase ${
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-secondary"
            } disabled:opacity-60`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ApplicationPage() {
  const queryClient = useQueryClient();
  const fetchApp = useServerFn(getMyApplication);
  const start = useServerFn(startApplication);
  const saveDraft = useServerFn(saveApplicationDraft);
  const saveEmp = useServerFn(saveEmployers);
  const recordDoc = useServerFn(recordDocument);
  const removeDoc = useServerFn(deleteDocument);
  const submit = useServerFn(submitApplication);
  const openDoc = useServerFn(getDocumentUrl);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-application"],
    queryFn: () => fetchApp(),
  });

  const app = data?.application ?? null;
  const editable = !app || app.status === "draft" || app.status === "corrections_requested";

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<ApplicationDraft>({});
  const [employers, setEmployers] = useState<EmployerInput[]>([]);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const hydrated = useRef(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!data || hydrated.current) return;
    hydrated.current = true;
    if (data.application) {
      const a = data.application as Record<string, unknown>;
      const picked: Record<string, unknown> = {};
      for (const key of Object.keys(a)) picked[key] = a[key];
      setValues({
        first_name: (a["first_name"] as string) ?? "",
        middle_name: (a["middle_name"] as string) ?? "",
        last_name: (a["last_name"] as string) ?? "",
        email: (a["email"] as string) ?? "",
        phone: (a["phone"] as string) ?? "",
        address_line1: (a["address_line1"] as string) ?? "",
        address_line2: (a["address_line2"] as string) ?? "",
        city: (a["city"] as string) ?? "",
        state: (a["state"] as string) ?? "",
        postal_code: (a["postal_code"] as string) ?? "",
        date_of_birth: (a["date_of_birth"] as string) ?? "",
        cdl_number: (a["cdl_number"] as string) ?? "",
        cdl_state: (a["cdl_state"] as string) ?? "",
        cdl_class: (a["cdl_class"] as string) ?? "",
        cdl_issue_date: (a["cdl_issue_date"] as string) ?? "",
        cdl_expiration_date: (a["cdl_expiration_date"] as string) ?? "",
        endorsements: (a["endorsements"] as string[]) ?? [],
        years_experience: (a["years_experience"] as number) ?? null,
        medical_card_expiration: (a["medical_card_expiration"] as string) ?? "",
        twic_card: Boolean(a["twic_card"]),
        authorized_to_work: a["authorized_to_work"] as boolean | null,
        age_21_or_older: a["age_21_or_older"] as boolean | null,
        accidents_last_3_years: (a["accidents_last_3_years"] as string) ?? "",
        violations_last_3_years: (a["violations_last_3_years"] as string) ?? "",
        license_ever_suspended: a["license_ever_suspended"] as boolean | null,
        suspension_details: (a["suspension_details"] as string) ?? "",
        positive_drug_test: a["positive_drug_test"] as boolean | null,
        drug_test_details: (a["drug_test_details"] as string) ?? "",
        can_perform_duties: a["can_perform_duties"] as boolean | null,
        how_did_you_hear: (a["how_did_you_hear"] as string) ?? "",
        additional_notes: (a["additional_notes"] as string) ?? "",
      });
      setSignature((a["signature_name"] as string) ?? "");
      setStep(Math.min(Math.max(Number(a["current_step"]) || 1, 1), 6));
    }
    setEmployers(
      (data.employers ?? []).map((e) => ({
        employer_name: e.employer_name,
        position_held: e.position_held,
        city: e.city,
        state: e.state,
        phone: e.phone,
        start_date: e.start_date ?? "",
        end_date: e.end_date ?? "",
        reason_for_leaving: e.reason_for_leaving,
        was_dot_regulated: e.was_dot_regulated,
        equipment_operated: e.equipment_operated,
      })),
    );
  }, [data]);

  const docs = (data?.documents ?? []) as unknown as Doc[];

  const completion = useMemo(() => {
    const checks = [
      Boolean(values.first_name && values.last_name && values.phone && values.email),
      Boolean(values.cdl_number && values.cdl_state && values.cdl_class),
      employers.length > 0,
      values.authorized_to_work !== null && values.can_perform_duties !== null,
      docs.some((d) => d.doc_type === "cdl") && docs.some((d) => d.doc_type === "medical_card"),
      Boolean(app?.submitted_at),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [values, employers, docs, app]);

  function set<K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function ensureApp(): Promise<string> {
    if (app?.id) return app.id;
    const created = await start({ data: {} });
    await queryClient.invalidateQueries({ queryKey: ["my-application"] });
    await queryClient.invalidateQueries({ queryKey: ["portal"] });
    return created.id;
  }

  async function persist(nextStep?: number) {
    setSaving(true);
    try {
      const id = await ensureApp();
      await saveDraft({ data: { id, values: { ...values, current_step: nextStep ?? step } } });
      await saveEmp({ data: { id, employers } });
      await queryClient.invalidateQueries({ queryKey: ["my-application"] });
      toast.success("Progress saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function goTo(next: number) {
    if (editable) await persist(next);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleUpload(docType: string, file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Upload a PDF, JPG, PNG or WEBP file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    setUploading(docType);
    try {
      const id = await ensureApp();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expired — please sign in again.");
      const ext = file.name.split(".").pop() ?? "dat";
      const path = `${uid}/${id}/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("applicant-documents")
        .upload(path, file);
      if (upErr) throw new Error(String((upErr as { message?: string }).message ?? "Upload failed"));
      await recordDoc({
        data: {
          application_id: id,
          doc_type: docType,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-application"] });
      toast.success("Document uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: Doc) {
    setBusy(true);
    try {
      await removeDoc({ data: { id: doc.id } });
      await queryClient.invalidateQueries({ queryKey: ["my-application"] });
      toast.success("Document removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove document");
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    try {
      const { url } = await openDoc({ data: { id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    }
  }

  async function handleSubmit() {
    if (signature.trim().length < 2) {
      toast.error("Type your full legal name to certify the application.");
      return;
    }
    const missing = DOCUMENT_TYPES.filter(
      (d) => d.required && !docs.some((x) => x.doc_type === d.key),
    );
    if (missing.length) {
      toast.error(`Upload required documents: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      const id = await ensureApp();
      await saveDraft({ data: { id, values: { ...values, current_step: 6 } } });
      await saveEmp({ data: { id, employers } });
      await submit({ data: { id, signature_name: signature.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["my-application"] });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Application submitted for review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div>
        <PortalHeading eyebrow="Recruiting" title="My application" />
        <TableSkeleton rows={8} />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div>
      <PortalHeading
        eyebrow="Recruiting"
        title="My application"
        blurb="Save at any time and resume later. Required fields are marked with an asterisk."
        action={
          app ? (
            <div className="text-right">
              <StatusBadge
                status={app.status}
                label={APPLICATION_STATUS_LABELS[app.status] ?? app.status}
              />
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">{app.reference_code}</p>
            </div>
          ) : undefined
        }
      />

      {app?.status === "corrections_requested" && app.correction_notes ? (
        <div className="mb-6 flex gap-3 rounded-sm border border-accent/40 bg-accent/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Corrections requested</p>
            <p className="mt-1 text-sm text-muted-foreground">{app.correction_notes}</p>
          </div>
        </div>
      ) : null}

      {!editable ? (
        <div className="mb-6 rounded-sm border border-border bg-surface p-4 text-sm text-muted-foreground">
          Your application is under review and locked for editing. A recruiter will contact you if
          anything else is needed.
        </div>
      ) : null}

      {/* progress */}
      <div className="mb-8 rounded-sm border border-border bg-surface p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Completion</span>
          <span className="tabular-nums text-muted-foreground">{completion}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {APPLICATION_STEPS.map((s) => (
            <li key={s.step}>
              <button
                type="button"
                onClick={() => void goTo(s.step)}
                className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left text-sm ${
                  step === s.step ? "border-primary bg-secondary" : "border-border hover:bg-secondary"
                }`}
              >
                <span
                  className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.step < step
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-foreground/70"
                  }`}
                >
                  {s.step < step ? <Check className="size-3.5" /> : s.step}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Panel title={`Step ${step} — ${APPLICATION_STEPS[step - 1]?.title ?? ""}`}>
            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="First name" required disabled={!editable} value={values.first_name ?? ""} onChange={(v) => set("first_name", v)} />
                <TextField label="Last name" required disabled={!editable} value={values.last_name ?? ""} onChange={(v) => set("last_name", v)} />
                <TextField label="Email" type="email" required disabled={!editable} value={values.email ?? ""} onChange={(v) => set("email", v)} />
                <TextField label="Phone" required disabled={!editable} value={values.phone ?? ""} onChange={(v) => set("phone", v)} />
                <TextField label="Date of birth" type="date" disabled={!editable} value={values.date_of_birth ?? ""} onChange={(v) => set("date_of_birth", v)} />
                <TextField label="Address" disabled={!editable} value={values.address_line1 ?? ""} onChange={(v) => set("address_line1", v)} />
                <TextField label="City" disabled={!editable} value={values.city ?? ""} onChange={(v) => set("city", v)} />
                <TextField label="State" disabled={!editable} value={values.state ?? ""} onChange={(v) => set("state", v)} />
                <TextField label="ZIP" disabled={!editable} value={values.postal_code ?? ""} onChange={(v) => set("postal_code", v)} />
                <TextField label="How did you hear about us?" disabled={!editable} value={values.how_did_you_hear ?? ""} onChange={(v) => set("how_did_you_hear", v)} />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="CDL number" required disabled={!editable} value={values.cdl_number ?? ""} onChange={(v) => set("cdl_number", v)} />
                  <TextField label="CDL state" required disabled={!editable} value={values.cdl_state ?? ""} onChange={(v) => set("cdl_state", v)} />
                  <TextField label="CDL class" placeholder="A" disabled={!editable} value={values.cdl_class ?? ""} onChange={(v) => set("cdl_class", v)} />
                  <TextField label="Years of experience" type="number" disabled={!editable} value={values.years_experience != null ? String(values.years_experience) : ""} onChange={(v) => set("years_experience", v === "" ? null : Number(v))} />
                  <TextField label="CDL issue date" type="date" disabled={!editable} value={values.cdl_issue_date ?? ""} onChange={(v) => set("cdl_issue_date", v)} />
                  <TextField label="CDL expiration" type="date" disabled={!editable} value={values.cdl_expiration_date ?? ""} onChange={(v) => set("cdl_expiration_date", v)} />
                  <TextField label="Medical card expiration" type="date" disabled={!editable} value={values.medical_card_expiration ?? ""} onChange={(v) => set("medical_card_expiration", v)} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Endorsements</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ENDORSEMENTS.map((e) => {
                      const active = (values.endorsements ?? []).includes(e);
                      return (
                        <button
                          key={e}
                          type="button"
                          disabled={!editable}
                          onClick={() =>
                            set(
                              "endorsements",
                              active
                                ? (values.endorsements ?? []).filter((x) => x !== e)
                                : [...(values.endorsements ?? []), e],
                            )
                          }
                          className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-secondary"} disabled:opacity-60`}
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <YesNo label="Do you hold a valid TWIC card?" value={values.twic_card} onChange={(v) => set("twic_card", v)} disabled={!editable} />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  List your employment for the last 3 years, most recent first. DOT-regulated
                  employers are required for verification.
                </p>
                {employers.length === 0 ? (
                  <EmptyState title="No employers added" blurb="Add at least your most recent employer." />
                ) : null}
                {employers.map((emp, i) => (
                  <div key={i} className="rounded-sm border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">Employer {i + 1}</p>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setEmployers((list) => list.filter((_, x) => x !== i))}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          ["employer_name", "Employer name", "text"],
                          ["position_held", "Position held", "text"],
                          ["city", "City", "text"],
                          ["state", "State", "text"],
                          ["phone", "Phone", "text"],
                          ["start_date", "Start date", "date"],
                          ["end_date", "End date", "date"],
                          ["equipment_operated", "Equipment operated", "text"],
                          ["reason_for_leaving", "Reason for leaving", "text"],
                        ] as const
                      ).map(([key, label, type]) => (
                        <TextField
                          key={key}
                          label={label}
                          type={type}
                          disabled={!editable}
                          required={key === "employer_name"}
                          value={(emp[key] as string) ?? ""}
                          onChange={(v) =>
                            setEmployers((list) =>
                              list.map((row, x) => (x === i ? { ...row, [key]: v } : row)),
                            )
                          }
                        />
                      ))}
                    </div>
                    <YesNo
                      label="Was this position DOT-regulated?"
                      value={emp.was_dot_regulated}
                      disabled={!editable}
                      onChange={(v) =>
                        setEmployers((list) =>
                          list.map((row, x) => (x === i ? { ...row, was_dot_regulated: v } : row)),
                        )
                      }
                    />
                  </div>
                ))}
                {editable && employers.length < 10 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEmployers((list) => [...list, { employer_name: "", was_dot_regulated: true }])
                    }
                    className="rounded-sm border border-input px-3 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    Add employer
                  </button>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div>
                  <YesNo label="Are you legally authorized to work in the United States?" value={values.authorized_to_work} onChange={(v) => set("authorized_to_work", v)} disabled={!editable} />
                  <YesNo label="Are you 21 years of age or older?" value={values.age_21_or_older} onChange={(v) => set("age_21_or_older", v)} disabled={!editable} />
                  <YesNo label="Has your license ever been suspended or revoked?" value={values.license_ever_suspended} onChange={(v) => set("license_ever_suspended", v)} disabled={!editable} />
                  <YesNo label="Have you ever tested positive on a DOT drug/alcohol test?" value={values.positive_drug_test} onChange={(v) => set("positive_drug_test", v)} disabled={!editable} />
                  <YesNo label="Can you perform the essential functions of the job, with or without accommodation?" value={values.can_perform_duties} onChange={(v) => set("can_perform_duties", v)} disabled={!editable} />
                </div>
                <div className="grid gap-4">
                  <AreaField label="Accidents in the last 3 years" value={values.accidents_last_3_years ?? ""} onChange={(v) => set("accidents_last_3_years", v)} disabled={!editable} />
                  <AreaField label="Moving violations in the last 3 years" value={values.violations_last_3_years ?? ""} onChange={(v) => set("violations_last_3_years", v)} disabled={!editable} />
                  {values.license_ever_suspended ? (
                    <AreaField label="Suspension details" value={values.suspension_details ?? ""} onChange={(v) => set("suspension_details", v)} disabled={!editable} />
                  ) : null}
                  {values.positive_drug_test ? (
                    <AreaField label="Drug/alcohol test details" value={values.drug_test_details ?? ""} onChange={(v) => set("drug_test_details", v)} disabled={!editable} />
                  ) : null}
                  <AreaField label="Anything else we should know?" value={values.additional_notes ?? ""} onChange={(v) => set("additional_notes", v)} disabled={!editable} />
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Documents are stored privately and are visible only to you and 52 Logistics
                  recruiting staff. PDF, JPG, PNG or WEBP up to 10 MB.
                </p>
                {DOCUMENT_TYPES.map((type) => {
                  const items = docs.filter((d) => d.doc_type === type.key);
                  return (
                    <div key={type.key} className="rounded-sm border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {type.label}
                            {type.required ? <span className="text-accent"> *</span> : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {items.length} file{items.length === 1 ? "" : "s"} uploaded
                          </p>
                        </div>
                        <input
                          ref={(el) => {
                            fileInputs.current[type.key] = el;
                          }}
                          type="file"
                          accept={ACCEPTED.join(",")}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUpload(type.key, f);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={!editable || uploading === type.key}
                          onClick={() => fileInputs.current[type.key]?.click()}
                          className="inline-flex items-center gap-2 rounded-sm border border-input px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                        >
                          {uploading === type.key ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          Upload
                        </button>
                      </div>
                      {items.length ? (
                        <ul className="mt-3 divide-y divide-border border-t border-border">
                          {items.map((d) => (
                            <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => void view(d.id)}
                                className="min-w-0 flex-1 truncate text-left text-sm font-medium underline-offset-4 hover:underline"
                              >
                                {d.file_name}
                              </button>
                              <StatusBadge status={d.verification_status} />
                              {editable ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleDelete(d)}
                                  className="text-destructive"
                                  aria-label={`Delete ${d.file_name}`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                              {d.verification_status === "rejected" && d.rejection_reason ? (
                                <p className="w-full text-xs text-destructive">
                                  {d.rejection_reason} — please re-upload.
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Applicant</dt>
                    <dd className="text-sm">{[values.first_name, values.last_name].filter(Boolean).join(" ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Contact</dt>
                    <dd className="text-sm">{values.email} · {values.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-muted-foreground">CDL</dt>
                    <dd className="text-sm">{values.cdl_class} · {values.cdl_number} ({values.cdl_state})</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Employers listed</dt>
                    <dd className="text-sm">{employers.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Documents</dt>
                    <dd className="text-sm">{docs.length} uploaded</dd>
                  </div>
                </dl>
                <div className="rounded-sm border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                  I certify that the information provided is true and complete. I authorize 52
                  Logistics, Inc. to verify my employment history, driving record and to conduct
                  DOT-required screening.
                </div>
                <TextField
                  label="Type your full legal name to certify"
                  required
                  disabled={!editable}
                  value={signature}
                  onChange={setSignature}
                />
                <button
                  type="button"
                  disabled={!editable || busy}
                  onClick={() => void handleSubmit()}
                  className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {app?.status === "corrections_requested" ? "Resubmit application" : "Submit application"}
                </button>
              </div>
            ) : null}
          </Panel>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => void goTo(step - 1)}
          className="rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-2">
          {editable ? (
            <button
              type="button"
              onClick={() => void persist()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save progress
            </button>
          ) : null}
          <button
            type="button"
            disabled={step === 6}
            onClick={() => void goTo(step + 1)}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>

      <div className="mt-10">
        <Panel title="Application timeline">
          <Timeline
            items={(data?.events ?? []).map((e) => ({
              id: e.id,
              title: (e.event_type as string).replace(/_/g, " "),
              description: e.description,
              at: e.created_at,
            }))}
          />
          <p className="mt-5 text-sm text-muted-foreground">
            Questions? <Link to="/contact" className="underline underline-offset-4">Contact recruiting</Link>.
          </p>
        </Panel>
      </div>
    </div>
  );
}
