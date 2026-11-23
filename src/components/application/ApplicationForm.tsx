import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@/lib/mock/server-fn";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Save, Trash2, Upload } from "lucide-react";
import {
  getApplicationByToken,
  saveApplicationDraftByToken,
  saveEmployersByToken,
  recordDocumentByToken,
  deleteDocumentByToken,
  submitApplicationByToken,
} from "@/lib/public-application.functions";
import type { PortalApplicationDraft } from "@/lib/portal.functions";
import { getPublicJobs, type PublicJob } from "@/lib/public-content.functions";
import {
  APPLICATION_STEPS,
  APPLICATION_STATUS_LABELS,
  DOCUMENT_TYPES,
  ENDORSEMENTS,
  type EmployerInput,
} from "@/lib/application-schema";
import { demoClient as supabase } from "@/lib/mock/client";
import { PortalHeading } from "@/components/portal/PortalShell";
import { ErrorState, Panel, StatusBadge, TableSkeleton } from "@/components/portal/ui";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const PUBLIC_JOBS_KEY = ["public-jobs"];
const isAcceptedMimeType = (type: string): type is (typeof ACCEPTED)[number] =>
  ACCEPTED.some((accepted) => accepted === type);

type Doc = {
  id: string;
  doc_type: string;
  file_name: string;
  verification_status: string;
  rejection_reason: string | null;
  created_at: string;
  size_bytes: number | null;
  storage_path: string;
};
type FormErrors = Record<string, string>;

function TextField({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  required,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  error?: string | undefined;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 min-h-11 w-full min-w-0 rounded-sm border bg-background px-3 py-2.5 text-sm disabled:bg-secondary disabled:text-muted-foreground ${error ? "border-destructive" : "border-input"}`}
      />
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
    </label>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  error,
  placeholder = "Choose an option",
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string | undefined;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 min-h-11 w-full min-w-0 rounded-sm border bg-background px-3 py-2.5 text-sm disabled:bg-secondary ${error ? "border-destructive" : "border-input"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
    </label>
  );
}

function YesNo({
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  error?: string | undefined;
}) {
  return (
    <div className="min-w-0 border-b border-border py-3 last:border-0">
      <span className="text-sm">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            aria-pressed={value === v}
            aria-invalid={Boolean(error)}
            onClick={() => onChange(v)}
            className={`min-h-11 min-w-20 rounded-sm border px-4 py-2 text-sm font-semibold uppercase ${
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-secondary"
            } disabled:opacity-60`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
  disabled,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string | undefined;
}) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>{label}</span>
      </label>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function ApplicationForm({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [resumeLink, setResumeLink] = useState<string | undefined>(undefined);

  useEffect(() => {
    setResumeLink(window.location.href);
  }, [token]);
  const fetchApp = useServerFn(getApplicationByToken);
  const saveDraft = useServerFn(saveApplicationDraftByToken);
  const saveEmp = useServerFn(saveEmployersByToken);
  const recordDoc = useServerFn(recordDocumentByToken);
  const removeDoc = useServerFn(deleteDocumentByToken);
  const submit = useServerFn(submitApplicationByToken);

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["public-application", token],
    queryFn: () => fetchApp({ data: { token } }),
    retry: false,
    staleTime: 30_000,
  });
  const { data: jobs = [] } = useQuery<PublicJob[]>({
    queryKey: PUBLIC_JOBS_KEY,
    queryFn: () => getPublicJobs(),
    staleTime: 60_000,
  });

  const submitted = data && "reference" in data ? data : null;
  const app = data && "application" in data ? data.application : null;
  const editable = Boolean(app && (app.status === "draft" || app.status === "corrections_requested"));
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<PortalApplicationDraft>({});
  const [employers, setEmployers] = useState<EmployerInput[]>([]);
  const [signature, setSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ state: "idle" | "saved" | "error"; time?: string }>({ state: "idle" });
  const saveFlight = useRef<Promise<boolean> | null>(null);
  const pendingSave = useRef<{ values: PortalApplicationDraft; employers: EmployerInput[]; step: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const hydrated = useRef(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const selectedJob = jobs.find((job) => job.id === values.job_id);
  const docs = ((data && "documents" in data ? data.documents : []) ?? []) as unknown as Doc[];
  const showConfirmation = Boolean(submitted);
  const schedules = useMemo(
    () =>
      jobs.map((job) => ({
        value: job.slug,
        label: `${job.position} — ${job.days}, ${job.schedule}`,
      })),
    [jobs],
  );

  useEffect(() => {
    if (!data || hydrated.current || !("application" in data)) return;
    hydrated.current = true;
    if (data.application) {
      const a = data.application;
      setValues({
        job_id: a.job_id,
        position_title: a.position_title,
        current_step: a.current_step,
        first_name: a.first_name ?? "",
        last_name: a.last_name ?? "",
        preferred_name: a.preferred_name ?? "",
        email: a.email ?? "",
        phone: a.phone ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        postal_code: a.postal_code ?? "",
        preferred_contact_method: a.preferred_contact_method,
        is_18_or_older: a.is_18_or_older,
        authorized_to_work: a.authorized_to_work,
        cdl_status: a.cdl_status,
        cdl_class: a.cdl_class ?? "",
        cdl_state: a.cdl_state ?? "",
        endorsements: a.endorsements ?? [],
        commercial_experience_years: a.commercial_experience_years,
        tractor_trailer_experience: a.tractor_trailer_experience,
        linehaul_pd_experience: a.linehaul_pd_experience,
        schedule_availability: a.schedule_availability ?? [],
        start_availability: a.start_availability ?? "",
        can_perform_duties_with_or_without_accommodation:
          a.can_perform_duties_with_or_without_accommodation,
        medical_card_status: a.medical_card_status,
        medical_card_expiration_month: a.medical_card_expiration_month,
        medical_card_expiration_year: a.medical_card_expiration_year,
        agrees_to_comply: a.agrees_to_comply,
        consent_electronic_records: a.consent_electronic_records,
        qualification_gap: a.qualification_gap,
        qualification_gap_reasons: a.qualification_gap_reasons,
      });
      setSignature(a.signature_name ?? "");
      setConsent(a.consent_electronic_records === true);
      setStep(Math.min(Math.max(Number(a.current_step) || 1, 1), 6));
    }
    setEmployers(
      ((data.employers ?? []) as any[]).map((employer) => ({
        employer_name: employer.employer_name,
        position_held: employer.position_held,
        city: employer.city,
        state: employer.state,
        start_date: employer.start_date ?? "",
        end_date: employer.end_date ?? "",
        reason_for_leaving: employer.reason_for_leaving,
        was_dot_regulated: employer.was_dot_regulated,
        current_employer: employer.current_employer,
        commercial_driving_relevant: employer.commercial_driving_relevant,
        permission_to_contact: employer.permission_to_contact,
      })),
    );
  }, [data]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(
        values.job_id &&
        values.first_name &&
        values.last_name &&
        values.email &&
        values.phone &&
        values.city &&
        values.state &&
        values.postal_code &&
        values.preferred_contact_method &&
        values.is_18_or_older === true,
      ),
      values.authorized_to_work != null &&
        Boolean(values.cdl_status) &&
        (values.cdl_status !== "valid_cdl" || Boolean(values.cdl_class && values.cdl_state)) &&
        values.commercial_experience_years != null &&
        values.tractor_trailer_experience != null &&
        values.linehaul_pd_experience != null,
      Boolean(
        values.schedule_availability?.length &&
        values.start_availability &&
        values.can_perform_duties_with_or_without_accommodation != null &&
        values.medical_card_status &&
        values.agrees_to_comply === true,
      ),
      employers.length > 0 &&
        Boolean(
          employers[0]?.employer_name &&
          employers[0]?.position_held &&
          employers[0]?.start_date &&
          employers[0]?.current_employer != null &&
          employers[0]?.commercial_driving_relevant != null &&
          employers[0]?.permission_to_contact != null,
        ),
      true,
      Boolean(consent && signature.trim().length >= 2),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [values, employers, consent, signature]);

  function set<K extends keyof PortalApplicationDraft>(key: K, value: PortalApplicationDraft[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function setEmployer<K extends keyof EmployerInput>(
    index: number,
    key: K,
    value: EmployerInput[K],
  ) {
    setEmployers((current) => current.map((employer, i) => {
      if (i !== index) return employer;
      const updated = { ...employer, [key]: value };
      if (key === "current_employer" && value === true) {
        updated.end_date = "";
        updated.reason_for_leaving = "";
      }
      return updated;
    }));
    setErrors({});
  }

  async function persist(nextStep?: number, extra: Partial<PortalApplicationDraft> = {}) {
    pendingSave.current = {
      values: {
        ...values,
        ...extra,
        job_id: values.job_id ?? null,
        position_title: selectedJob?.position ?? values.position_title ?? null,
        current_step: nextStep ?? step,
      },
      employers: structuredClone(employers),
      step: nextStep ?? step,
    };
    if (!saveFlight.current) {
      setSaving(true);
      setSaveStatus({ state: "idle" });
      saveFlight.current = (async () => {
        try {
          while (pendingSave.current) {
            const snapshot = pendingSave.current;
            pendingSave.current = null;
            await saveDraft({ data: { token, values: snapshot.values } });
            await saveEmp({ data: { token, employers: snapshot.employers } });
            const fresh = await fetchApp({ data: { token } });
            queryClient.setQueryData(["public-application", token], fresh);
          }
          const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setSaveStatus({ state: "saved", time });
          return true;
        } catch {
          pendingSave.current = null;
          setSaveStatus({ state: "error" });
          return false;
        } finally {
          setSaving(false);
          saveFlight.current = null;
        }
      })();
    }
    return saveFlight.current;
  }

  useEffect(() => {
    if (
      !hydrated.current ||
      isLoading ||
      !editable ||
      showConfirmation ||
      (!app && Object.keys(values).length === 0)
    )
      return;
    const timer = window.setTimeout(() => {
      void persist(step);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [values, employers, step, isLoading, editable, showConfirmation, app?.id, selectedJob]);

  function validateStep(stepToValidate: number): FormErrors {
    const next: FormErrors = {};
    const requireValue = (key: string, value: unknown, label: string) => {
      if (value === undefined || value === null || value === "")
        next[key] = `${label} is required.`;
    };
    if (stepToValidate === 1) {
      requireValue("job_id", values.job_id, "Opening");
      requireValue("first_name", values.first_name?.trim(), "First name");
      requireValue("last_name", values.last_name?.trim(), "Last name");
      requireValue("email", values.email?.trim(), "Email");
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
        next["email"] = "Enter a valid email address.";
      requireValue("phone", values.phone?.trim(), "Mobile phone");
      requireValue("city", values.city?.trim(), "City");
      requireValue("state", values.state?.trim(), "State");
      requireValue("postal_code", values.postal_code?.trim(), "ZIP");
      requireValue(
        "preferred_contact_method",
        values.preferred_contact_method,
        "Preferred contact method",
      );
      if (values.is_18_or_older !== true)
        next["is_18_or_older"] = "Confirm that you are at least 18 years old.";
    }
    if (stepToValidate === 2) {
      if (values.authorized_to_work == null) next["authorized_to_work"] = "Choose yes or no.";
      requireValue("cdl_status", values.cdl_status, "CDL status");
      if (values.cdl_status === "valid_cdl") {
        requireValue("cdl_class", values.cdl_class?.trim(), "CDL class");
        requireValue("cdl_state", values.cdl_state?.trim(), "Issuing state");
      }
      if (values.commercial_experience_years == null || values.commercial_experience_years < 0)
        next["commercial_experience_years"] =
          "Enter years of commercial driving experience (0 is allowed).";
      if (values.tractor_trailer_experience == null)
        next["tractor_trailer_experience"] = "Choose yes or no.";
      if (values.linehaul_pd_experience == null)
        next["linehaul_pd_experience"] = "Choose yes or no.";
    }
    if (stepToValidate === 3) {
      if (!values.schedule_availability?.length)
        next["schedule_availability"] = "Choose at least one schedule.";
      requireValue("start_availability", values.start_availability?.trim(), "Start availability");
      if (values.can_perform_duties_with_or_without_accommodation == null)
        next["can_perform_duties_with_or_without_accommodation"] = "Choose yes or no.";
      requireValue("medical_card_status", values.medical_card_status, "DOT medical card status");
      if (values.medical_card_status === "current" || values.medical_card_status === "expired") {
        if (
          !values.medical_card_expiration_month ||
          values.medical_card_expiration_month < 1 ||
          values.medical_card_expiration_month > 12
        )
          next["medical_card_expiration_month"] = "Choose an expiration month.";
        if (!values.medical_card_expiration_year || values.medical_card_expiration_year < 1900)
          next["medical_card_expiration_year"] = "Enter an expiration year.";
      }
      if (values.agrees_to_comply !== true)
        next["agrees_to_comply"] =
          "Confirm that you are willing to comply with these requirements.";
    }
    if (stepToValidate === 4) {
      if (!employers.length) next["employers"] = "Add your current or most recent employer.";
      employers.forEach((employer, index) => {
        const prefix = `employers.${index}.`;
        if (!employer.employer_name?.trim())
          next[`${prefix}employer_name`] = "Employer name is required.";
        if (!employer.position_held?.trim()) next[`${prefix}position_held`] = "Role is required.";
        if (!employer.start_date)
          next[`${prefix}start_date`] = "Start month and year are required.";
        if (employer.start_date && employer.start_date > new Date().toISOString().slice(0, 7))
          next[`${prefix}start_date`] = "Start date cannot be in the future.";
        if (employer.current_employer == null)
          next[`${prefix}current_employer`] = "Choose yes or no.";
        if (!employer.current_employer && !employer.end_date)
          next[`${prefix}end_date`] = "End month and year are required.";
        if (!employer.current_employer && employer.end_date && employer.end_date > new Date().toISOString().slice(0, 7))
          next[`${prefix}end_date`] = "End date cannot be in the future.";
        if (!employer.current_employer && employer.start_date && employer.end_date && employer.end_date < employer.start_date)
          next[`${prefix}end_date`] = "End date cannot be before the start date.";
        if (!employer.city?.trim()) next[`${prefix}city`] = "City is required.";
        if (!employer.state?.trim()) next[`${prefix}state`] = "State is required.";
        if (employer.commercial_driving_relevant == null)
          next[`${prefix}commercial_driving_relevant`] = "Choose yes or no.";
        if (!employer.current_employer && !employer.reason_for_leaving?.trim())
          next[`${prefix}reason_for_leaving`] = "Reason for leaving is required.";
        if (employer.permission_to_contact == null)
          next[`${prefix}permission_to_contact`] = "Choose yes or no.";
      });
    }
    if (stepToValidate === 6) {
      if (!consent)
        next["consent_electronic_records"] = "Consent is required to submit electronically.";
      if (signature.trim().length < 2)
        next["signature_name"] = "Type your full legal name to sign.";
    }
    return next;
  }

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.focus({ preventScroll: true });
    }
  }, [errors]);

  function goTo(nextStep: number) {
    if (nextStep > step) {
      for (let current = step; current < nextStep; current += 1) {
        const nextErrors = validateStep(current);
        if (Object.keys(nextErrors).length) {
          setErrors(nextErrors);
          setStep(current);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    }
    setErrors({});
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleUpload(docType: (typeof DOCUMENT_TYPES)[number]["key"], file: File) {
    if (!isAcceptedMimeType(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      toast.error("Upload a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Files must be 10 MiB or smaller.");
      return;
    }
    setUploading(docType);
    try {
      if (!app?.id) throw new Error("Application could not be loaded.");
      const ext = file.name.split(".").pop() ?? "dat";
      const path = `${app.id}/${docType}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("applicant-documents")
        .upload(path, file);
      if (uploadError)
        throw new Error(String((uploadError as { message?: string }).message ?? "Upload failed"));
      await recordDoc({
        data: {
          token,
          doc_type: docType,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      });
      queryClient.setQueryData(["public-application", token], await fetchApp({ data: { token } }));
      toast.success("Document uploaded");
    } catch (e) {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: Doc) {
    setBusy(true);
    try {
      await removeDoc({ data: { token, id: doc.id } });
      queryClient.setQueryData(["public-application", token], await fetchApp({ data: { token } }));
      toast.success("Document removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove document");
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    try {
      const doc = docs.find((item) => item.id === id);
      if (!doc) return;
      const { data: signed, error } = await supabase.storage.from("applicant-documents").createSignedUrl(doc.storage_path, 300);
      if (error || !signed) throw new Error("Could not open document");
      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Could not open document.");
    }
  }

  async function handleSubmit() {
    const nextErrors = [1, 2, 3, 4, 5, 6].reduce<FormErrors>(
      (all, stepToValidate) => ({ ...all, ...validateStep(stepToValidate) }),
      {},
    );
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      const firstInvalidStep = [1, 2, 3, 4, 5, 6].find((stepToValidate) =>
        Object.keys(validateStep(stepToValidate)).length > 0,
      );
      if (firstInvalidStep) setStep(firstInvalidStep);
      return;
    }
    setBusy(true);
    try {
      if (!app?.id) throw new Error("Application could not be loaded.");
      const qualificationGapReasons: string[] = [];
      if (values.is_18_or_older !== true)
        qualificationGapReasons.push("Applicant did not confirm they are at least 18 years old.");
      if (values.authorized_to_work !== true)
        qualificationGapReasons.push(
          "Applicant did not confirm authorization to work in the United States.",
        );
      if (values.cdl_status !== "valid_cdl")
        qualificationGapReasons.push(`CDL status: ${values.cdl_status ?? "not provided"}.`);
      if (values.commercial_experience_years === 0)
        qualificationGapReasons.push("No commercial driving experience reported.");
      if (values.tractor_trailer_experience === false)
        qualificationGapReasons.push("No tractor-trailer experience reported.");
      if (values.linehaul_pd_experience === false)
        qualificationGapReasons.push("No linehaul or pickup-and-delivery experience reported.");
      if (values.can_perform_duties_with_or_without_accommodation !== true)
        qualificationGapReasons.push(
          "Applicant indicated they may be unable to perform essential job functions with or without reasonable accommodation.",
        );
      if (values.medical_card_status !== "current")
        qualificationGapReasons.push(
          `DOT medical card status: ${values.medical_card_status ?? "not provided"}.`,
        );
      if (
        values.medical_card_status === "current" &&
        values.medical_card_expiration_month &&
        values.medical_card_expiration_year
      ) {
        const expiration = new Date(
          values.medical_card_expiration_year,
          values.medical_card_expiration_month,
          0,
          23,
          59,
          59,
          999,
        );
        if (expiration < new Date())
          qualificationGapReasons.push("DOT medical card expiration date has passed.");
      }
      const qualificationGap = qualificationGapReasons.length > 0;
      await saveDraft({
        data: {
          token,
          values: {
            ...values,
            job_id: values.job_id ?? null,
            position_title: selectedJob?.position ?? values.position_title ?? null,
            current_step: 6,
            consent_electronic_records: consent,
            qualification_gap: qualificationGap,
            qualification_gap_reasons: qualificationGapReasons,
          },
        },
      });
      await saveEmp({ data: { token, employers } });
      const result = await submit({ data: { token, signature_name: signature.trim() } });
      queryClient.setQueryData(["public-application", token], {
        reference: result.reference,
        position: result.position,
        submitted_at: result.submitted_at,
        label: "Application received",
      });
      toast.success("Application submitted for review");
    } catch (e) {
      toast.error("Could not submit your application. Please try again.");
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
  if (error) return <ErrorState error={new Error("This application link is invalid or expired.")} onRetry={() => void refetch()} />;

  if (showConfirmation) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PortalHeading eyebrow="Recruiting" title={submitted.label} />
        <Panel title="Thank you for applying">
          <div className="space-y-4 text-sm">
            <p>
              Reference number:{" "}
              <span className="font-mono font-semibold">{submitted.reference}</span>
            </p>
            <p>Selected position: {submitted.position ?? "—"}</p>
            <p>Submitted: {displayDate(submitted.submitted_at)}</p>
            <p className="leading-relaxed text-muted-foreground">
              Recruiting will review your application. If you advance, 52 Logistics may start a
              separate screening process through First Advantage, which will contact you directly.
              Submitting does not guarantee employment or an interview.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <PortalHeading
        eyebrow="Recruiting"
        title="Driver application"
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

      {resumeLink ? (
        <div className="mb-6 rounded-sm border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Your private resume link</p>
          <p className="mt-1 break-all font-mono text-xs">{resumeLink}</p>
          <button type="button" onClick={() => void navigator.clipboard.writeText(resumeLink)} className="mt-3 rounded-sm border border-input px-3 py-2 font-semibold">Copy</button>
          <p className="mt-3 text-xs">Keep this link private. Anyone with it can edit your application.</p>
        </div>
      ) : null}
      <p className="mb-5 text-sm" aria-live="polite">
        {saving ? "Saving…" : saveStatus.state === "saved" ? `Saved ✓ ${saveStatus.time}` : saveStatus.state === "error" ? "Couldn't save – retry" : ""}
      </p>

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

      <div className="mb-8 rounded-sm border border-border bg-surface p-4 sm:p-5">
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
        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {APPLICATION_STEPS.map((item) => (
            <li key={item.step}>
              <button
                type="button"
                onClick={() => void goTo(item.step)}
                className={`flex min-h-12 w-full min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2.5 text-left text-xs sm:gap-3 sm:px-3 sm:text-sm ${step === item.step ? "border-primary bg-secondary" : "border-border hover:bg-secondary"}`}
              >
                <span
                  className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.step < step ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground/70"}`}
                >
                  {item.step < step ? <Check className="size-3.5" /> : item.step}
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-medium">{item.title}</span>
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
              <div className="space-y-5">
                <SelectField
                  label="Selected opening"
                  required
                  value={values.job_id ?? ""}
                  options={jobs.map((job) => ({
                    value: job.id,
                    label: `${job.position} — ${job.days}, ${job.schedule}`,
                  }))}
                  onChange={(jobId) => {
                    const job = jobs.find((item) => item.id === jobId);
                    set("job_id", jobId || null);
                    set("position_title", job?.position ?? null);
                  }}
                  disabled={!editable || !jobs.length}
                  error={errors["job_id"]}
                  placeholder={
                    jobs.length ? "Choose an opening" : "No published openings available"
                  }
                />
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <TextField
                    label="First name (legal)"
                    required
                    disabled={!editable}
                    value={values.first_name ?? ""}
                    onChange={(v) => set("first_name", v)}
                    error={errors["first_name"]}
                  />
                  <TextField
                    label="Last name (legal)"
                    required
                    disabled={!editable}
                    value={values.last_name ?? ""}
                    onChange={(v) => set("last_name", v)}
                    error={errors["last_name"]}
                  />
                  <TextField
                    label="Preferred name"
                    disabled={!editable}
                    value={values.preferred_name ?? ""}
                    onChange={(v) => set("preferred_name", v)}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    required
                    disabled={!editable}
                    value={values.email ?? ""}
                    onChange={(v) => set("email", v)}
                    error={errors["email"]}
                  />
                  <TextField
                    label="Mobile phone"
                    required
                    disabled={!editable}
                    value={values.phone ?? ""}
                    onChange={(v) => set("phone", v)}
                    error={errors["phone"]}
                  />
                  <TextField
                    label="City"
                    required
                    disabled={!editable}
                    value={values.city ?? ""}
                    onChange={(v) => set("city", v)}
                    error={errors["city"]}
                  />
                  <TextField
                    label="State"
                    required
                    disabled={!editable}
                    value={values.state ?? ""}
                    onChange={(v) => set("state", v)}
                    error={errors["state"]}
                  />
                  <TextField
                    label="ZIP"
                    required
                    disabled={!editable}
                    value={values.postal_code ?? ""}
                    onChange={(v) => set("postal_code", v)}
                    error={errors["postal_code"]}
                  />
                  <SelectField
                    label="Preferred contact method"
                    required
                    value={values.preferred_contact_method ?? ""}
                    options={[
                      { value: "email", label: "Email" },
                      { value: "phone", label: "Phone call" },
                      { value: "text", label: "Text message" },
                    ]}
                    onChange={(v) =>
                      set("preferred_contact_method", v as "email" | "phone" | "text")
                    }
                    disabled={!editable}
                    error={errors["preferred_contact_method"]}
                  />
                </div>
                <CheckField
                  label="I confirm I am at least 18 years old."
                  checked={values.is_18_or_older === true}
                  onChange={(checked) => set("is_18_or_older", checked)}
                  disabled={!editable}
                  error={errors["is_18_or_older"]}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <YesNo
                  label="I am authorized to work in the United States"
                  value={values.authorized_to_work}
                  onChange={(v) => set("authorized_to_work", v)}
                  disabled={!editable}
                  error={errors["authorized_to_work"]}
                />
                <SelectField
                  label="CDL status"
                  required
                  value={values.cdl_status ?? ""}
                  options={[
                    { value: "valid_cdl", label: "Valid CDL" },
                    { value: "in_training", label: "In training" },
                    { value: "no_cdl", label: "No CDL" },
                  ]}
                  onChange={(v) => {
                    const status = v as "valid_cdl" | "in_training" | "no_cdl";
                    set("cdl_status", status);
                    if (status !== "valid_cdl") {
                      set("cdl_class", "");
                      set("cdl_state", "");
                    }
                  }}
                  disabled={!editable}
                  error={errors["cdl_status"]}
                />
                {values.cdl_status === "valid_cdl" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="CDL class"
                      required
                      disabled={!editable}
                      value={values.cdl_class ?? ""}
                      onChange={(v) => set("cdl_class", v)}
                      error={errors["cdl_class"]}
                    />
                    <TextField
                      label="Issuing state"
                      required
                      disabled={!editable}
                      value={values.cdl_state ?? ""}
                      onChange={(v) => set("cdl_state", v)}
                      error={errors["cdl_state"]}
                    />
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Endorsements
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ENDORSEMENTS.map((endorsement) => {
                      const active = (values.endorsements ?? []).includes(endorsement);
                      return (
                        <button
                          key={endorsement}
                          type="button"
                          disabled={!editable}
                          aria-pressed={active}
                          onClick={() =>
                            set(
                              "endorsements",
                              active
                                ? (values.endorsements ?? []).filter((item) => item !== endorsement)
                                : [...(values.endorsements ?? []), endorsement],
                            )
                          }
                          className={`min-h-11 rounded-sm border px-3 py-2 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-secondary"} disabled:opacity-60`}
                        >
                          {endorsement}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <TextField
                  label="Years of commercial driving experience"
                  type="number"
                  required
                  disabled={!editable}
                  value={
                    values.commercial_experience_years == null
                      ? ""
                      : String(values.commercial_experience_years)
                  }
                  onChange={(v) => set("commercial_experience_years", v === "" ? null : Number(v))}
                  error={errors["commercial_experience_years"]}
                />
                <YesNo
                  label="Tractor-trailer experience"
                  value={values.tractor_trailer_experience}
                  onChange={(v) => set("tractor_trailer_experience", v)}
                  disabled={!editable}
                  error={errors["tractor_trailer_experience"]}
                />
                <YesNo
                  label="Linehaul or pickup-and-delivery experience"
                  value={values.linehaul_pd_experience}
                  onChange={(v) => set("linehaul_pd_experience", v)}
                  disabled={!editable}
                  error={errors["linehaul_pd_experience"]}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium">
                    Schedule availability <span className="text-accent">*</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose all schedules you can work.
                  </p>
                  <div className="mt-2 space-y-2">
                    {schedules.map((schedule) => {
                      const checked = (values.schedule_availability ?? []).includes(schedule.value);
                      return (
                        <label
                          key={schedule.value}
                          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border border-border p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0 accent-primary"
                            checked={checked}
                            disabled={!editable}
                            aria-invalid={Boolean(errors["schedule_availability"])}
                            onChange={(event) =>
                              set(
                                "schedule_availability",
                                event.target.checked
                                  ? [...(values.schedule_availability ?? []), schedule.value]
                                  : (values.schedule_availability ?? []).filter(
                                      (id) => id !== schedule.value,
                                    ),
                              )
                            }
                          />
                          <span>{schedule.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors["schedule_availability"] ? (
                    <FieldError message={errors["schedule_availability"]} />
                  ) : null}
                </div>
                <TextField
                  label="When can you start?"
                  required
                  disabled={!editable}
                  value={values.start_availability ?? ""}
                  onChange={(v) => set("start_availability", v)}
                  error={errors["start_availability"]}
                />
                <YesNo
                  label="Can you perform the essential job functions with or without reasonable accommodation?"
                  value={values.can_perform_duties_with_or_without_accommodation}
                  onChange={(v) => set("can_perform_duties_with_or_without_accommodation", v)}
                  disabled={!editable}
                  error={errors["can_perform_duties_with_or_without_accommodation"]}
                />
                <SelectField
                  label="DOT medical card status"
                  required
                  value={values.medical_card_status ?? ""}
                  options={[
                    { value: "current", label: "Current" },
                    { value: "expired", label: "Expired" },
                    { value: "none", label: "None" },
                  ]}
                  onChange={(v) => {
                    const status = v as "current" | "expired" | "none";
                    set("medical_card_status", status);
                    if (status === "none") {
                      set("medical_card_expiration_month", null);
                      set("medical_card_expiration_year", null);
                    }
                  }}
                  disabled={!editable}
                  error={errors["medical_card_status"]}
                />
                {values.medical_card_status === "current" ||
                values.medical_card_status === "expired" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Expiration month"
                      required
                      value={
                        values.medical_card_expiration_month
                          ? String(values.medical_card_expiration_month)
                          : ""
                      }
                      options={MONTHS.map((month, index) => ({
                        value: String(index + 1),
                        label: month,
                      }))}
                      onChange={(v) => set("medical_card_expiration_month", v ? Number(v) : null)}
                      disabled={!editable}
                      error={errors["medical_card_expiration_month"]}
                    />
                    <TextField
                      label="Expiration year"
                      type="number"
                      required
                      disabled={!editable}
                      value={
                        values.medical_card_expiration_year == null
                          ? ""
                          : String(values.medical_card_expiration_year)
                      }
                      onChange={(v) => set("medical_card_expiration_year", v ? Number(v) : null)}
                      error={errors["medical_card_expiration_year"]}
                    />
                  </div>
                ) : null}
                <CheckField
                  label="I am willing to comply with 52 Logistics safety, attendance, drug and alcohol, and qualification requirements."
                  checked={values.agrees_to_comply === true}
                  onChange={(checked) => set("agrees_to_comply", checked)}
                  disabled={!editable}
                  error={errors["agrees_to_comply"]}
                />
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Complete regulated employment history may be collected later through a secure
                  process.
                </p>
                {errors["employers"] ? <FieldError message={errors["employers"]} /> : null}
                {employers.map((employer, index) => {
                  const fieldError = (name: string) => errors[`employers.${index}.${name}`];
                  return (
                    <div
                      key={index}
                      className="space-y-4 rounded-sm border border-border p-3 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {index === 0
                            ? "Current or most recent employer"
                            : `Previous employer ${index + 1}`}
                        </p>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEmployers((list) => list.filter((_, i) => i !== index))
                            }
                            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-destructive"
                          >
                            <Trash2 className="size-4" /> Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        <TextField
                          label="Employer name"
                          required
                          disabled={!editable}
                          value={employer.employer_name}
                          onChange={(v) => setEmployer(index, "employer_name", v)}
                          error={fieldError("employer_name")}
                        />
                        <TextField
                          label="Role"
                          required
                          disabled={!editable}
                          value={employer.position_held ?? ""}
                          onChange={(v) => setEmployer(index, "position_held", v)}
                          error={fieldError("position_held")}
                        />
                        <TextField
                          label="Start month and year"
                          type="month"
                          required
                          disabled={!editable}
                          value={employer.start_date ?? ""}
                          onChange={(v) => setEmployer(index, "start_date", v)}
                          error={fieldError("start_date")}
                        />
                        {employer.current_employer !== true ? (
                          <TextField
                            label="End month and year"
                            type="month"
                            required
                            disabled={!editable}
                            value={employer.end_date ?? ""}
                            onChange={(v) => setEmployer(index, "end_date", v)}
                            error={fieldError("end_date")}
                          />
                        ) : null}
                        <TextField
                          label="City"
                          required
                          disabled={!editable}
                          value={employer.city ?? ""}
                          onChange={(v) => setEmployer(index, "city", v)}
                          error={fieldError("city")}
                        />
                        <TextField
                          label="State"
                          required
                          disabled={!editable}
                          value={employer.state ?? ""}
                          onChange={(v) => setEmployer(index, "state", v)}
                          error={fieldError("state")}
                        />
                        {employer.current_employer !== true ? (
                          <TextField
                            label="Reason for leaving"
                            required
                            disabled={!editable}
                            value={employer.reason_for_leaving ?? ""}
                            onChange={(v) => setEmployer(index, "reason_for_leaving", v)}
                            error={fieldError("reason_for_leaving")}
                          />
                        ) : null}
                      </div>
                      <YesNo
                        label="Is this your current employer?"
                        value={employer.current_employer}
                        onChange={(v) => setEmployer(index, "current_employer", v)}
                        disabled={!editable}
                        error={fieldError("current_employer")}
                      />
                      <YesNo
                        label="Was this commercial driving?"
                        value={employer.commercial_driving_relevant}
                        onChange={(v) => setEmployer(index, "commercial_driving_relevant", v)}
                        disabled={!editable}
                        error={fieldError("commercial_driving_relevant")}
                      />
                      <YesNo
                        label="May we contact this employer?"
                        value={employer.permission_to_contact}
                        onChange={(v) => setEmployer(index, "permission_to_contact", v)}
                        disabled={!editable}
                        error={fieldError("permission_to_contact")}
                      />
                    </div>
                  );
                })}
                {editable && employers.length < 5 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEmployers((list) => [
                        ...list,
                        { employer_name: "", was_dot_regulated: true },
                      ])
                    }
                    className="min-h-11 rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary"
                  >
                    Add another employer
                  </button>
                ) : null}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <p className="rounded-sm border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed">
                  Do not upload a driver's license image, Social Security number, date of birth,
                  MVR, Clearinghouse, drug test or background check results. Those are handled
                  separately through approved providers.
                </p>
                <p className="text-sm text-muted-foreground">
                  Files are private. PDF, JPG, or PNG up to 10 MiB. These uploads are optional. If a
                  file is lost or will not open, remove it and upload a new copy; keep a copy until
                  recruiting confirms receipt.
                </p>
                {DOCUMENT_TYPES.map((type) => {
                  const items = docs.filter((doc) => doc.doc_type === type.key);
                  return (
                    <div key={type.key} className="rounded-sm border border-border p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {type.label}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              (optional)
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {items.length} file{items.length === 1 ? "" : "s"} uploaded
                          </p>
                        </div>
                        <input
                          ref={(element) => {
                            fileInputs.current[type.key] = element;
                          }}
                          type="file"
                          accept={ACCEPTED.join(",")}
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handleUpload(type.key, file);
                            event.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={!editable || uploading === type.key}
                          onClick={() => fileInputs.current[type.key]?.click()}
                          className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                        >
                          {uploading === type.key ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Upload className="size-4" />
                          )}{" "}
                          Upload
                        </button>
                      </div>
                      {items.length ? (
                        <ul className="mt-3 divide-y divide-border border-t border-border">
                          {items.map((doc) => (
                            <li key={doc.id} className="flex flex-wrap items-center gap-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => void view(doc.id)}
                                className="min-h-11 min-w-0 flex-1 break-all py-2 text-left text-sm font-medium underline-offset-4 hover:underline"
                              >
                                {doc.file_name}
                              </button>
                              <StatusBadge status={doc.verification_status} />
                              {editable ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleDelete(doc)}
                                  className="flex size-11 items-center justify-center text-destructive"
                                  aria-label={`Remove ${doc.file_name}`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                              {doc.verification_status === "rejected" && doc.rejection_reason ? (
                                <p className="w-full text-xs text-destructive">
                                  {doc.rejection_reason} — please re-upload.
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
                <div className="rounded-sm border border-border p-4">
                  <h3 className="text-sm font-semibold">Review your answers</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ReviewField
                      label="Opening"
                      value={
                        selectedJob
                          ? `${selectedJob.position} — ${selectedJob.days}, ${selectedJob.schedule}`
                          : app?.position_title
                      }
                    />
                    <ReviewField
                      label="Legal name"
                      value={[values.first_name, values.last_name].filter(Boolean).join(" ")}
                    />
                    <ReviewField label="Preferred name" value={values.preferred_name} />
                    <ReviewField
                      label="Email and phone"
                      value={[values.email, values.phone].filter(Boolean).join(" · ")}
                    />
                    <ReviewField
                      label="Location"
                      value={[values.city, values.state, values.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    />
                    <ReviewField
                      label="Preferred contact"
                      value={values.preferred_contact_method}
                    />
                    <ReviewField
                      label="At least 18"
                      value={values.is_18_or_older === true ? "Yes" : "No"}
                    />
                    <ReviewField
                      label="Authorized to work"
                      value={
                        values.authorized_to_work == null
                          ? "—"
                          : values.authorized_to_work
                            ? "Yes"
                            : "No"
                      }
                    />
                    <ReviewField
                      label="CDL status and class"
                      value={[values.cdl_status, values.cdl_class, values.cdl_state]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <ReviewField label="Endorsements" value={values.endorsements?.join(", ")} />
                    <ReviewField
                      label="Commercial experience"
                      value={
                        values.commercial_experience_years == null
                          ? ""
                          : `${values.commercial_experience_years} years`
                      }
                    />
                    <ReviewField
                      label="Tractor-trailer experience"
                      value={
                        values.tractor_trailer_experience == null
                          ? "—"
                          : values.tractor_trailer_experience
                            ? "Yes"
                            : "No"
                      }
                    />
                    <ReviewField
                      label="Linehaul or P&D experience"
                      value={
                        values.linehaul_pd_experience == null
                          ? "—"
                          : values.linehaul_pd_experience
                            ? "Yes"
                            : "No"
                      }
                    />
                    <ReviewField
                      label="Schedule availability"
                      value={values.schedule_availability
                        ?.map((id) => schedules.find((item) => item.value === id)?.label)
                        .filter(Boolean)
                        .join("; ")}
                    />
                    <ReviewField label="Start availability" value={values.start_availability} />
                    <ReviewField
                      label="Can perform essential functions"
                      value={
                        values.can_perform_duties_with_or_without_accommodation == null
                          ? "—"
                          : values.can_perform_duties_with_or_without_accommodation
                            ? "Yes"
                            : "No"
                      }
                    />
                    <ReviewField
                      label="Medical card"
                      value={[
                        values.medical_card_status,
                        values.medical_card_expiration_month
                          ? MONTHS[values.medical_card_expiration_month - 1]
                          : "",
                        values.medical_card_expiration_year,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <ReviewField
                      label="Agrees to requirements"
                      value={values.agrees_to_comply ? "Yes" : "No"}
                    />
                    {employers.map((employer, index) => (
                      <ReviewField
                        key={`employer-${index}`}
                        label={`${index === 0 ? "Most recent" : `Employer ${index + 1}`} employer`}
                        value={[
                          employer.employer_name,
                          employer.position_held,
                          employer.current_employer == null
                            ? ""
                            : employer.current_employer
                              ? "Current employer"
                              : "Former employer",
                          employer.start_date,
                          employer.end_date,
                          employer.city,
                          employer.state,
                          employer.commercial_driving_relevant == null
                            ? ""
                            : employer.commercial_driving_relevant
                              ? "Commercial driving"
                              : "Not commercial driving",
                          employer.reason_for_leaving,
                          employer.permission_to_contact == null
                            ? ""
                            : employer.permission_to_contact
                              ? "May contact"
                              : "Do not contact",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ))}
                    <ReviewField
                      label="Documents"
                      value={docs.map((doc) => doc.file_name).join(", ") || "None uploaded"}
                    />
                  </dl>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link to="/privacy" className="underline underline-offset-4">
                    Privacy
                  </Link>
                  <Link to="/applicant-notice" className="underline underline-offset-4">
                    Applicant Notice
                  </Link>
                </div>
                <div className="rounded-sm border border-border bg-surface-2 p-4 text-sm leading-relaxed">
                  <p>
                    I certify that the information I have provided is true and complete to the best
                    of my knowledge. I understand that submitting this application does not
                    guarantee employment and that false, misleading, or omitted information may
                    affect consideration or employment, subject to applicable law. I consent to
                    electronic records and communications regarding this application. If I advance,
                    I understand that additional qualifications and screening may be handled
                    separately through approved providers, including First Advantage, and that
                    provider terms and notices will apply.
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Draft certification text — pending legal approval.
                  </p>
                </div>
                <CheckField
                  label="I consent to electronic records and communications regarding this application."
                  checked={consent}
                  onChange={(checked) => {
                    setConsent(checked);
                    set("consent_electronic_records", checked);
                    if (checked)
                      setErrors((current) => {
                        const next = { ...current };
                        delete next["consent_electronic_records"];
                        return next;
                      });
                  }}
                  disabled={!editable}
                  error={errors["consent_electronic_records"]}
                />
                <TextField
                  label="Type your full legal name to sign"
                  required
                  disabled={!editable}
                  value={signature}
                  onChange={(value) => {
                    setSignature(value);
                    set("signature_name", value);
                    if (value.trim().length >= 2)
                      setErrors((current) => {
                        const next = { ...current };
                        delete next["signature_name"];
                        return next;
                      });
                  }}
                  error={errors["signature_name"]}
                />
                <button
                  type="button"
                  disabled={!editable || busy}
                  onClick={() => void handleSubmit()}
                  className="inline-flex min-h-12 items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {app?.status === "corrections_requested"
                    ? "Resubmit application"
                    : "Submit application"}
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
          className="min-h-11 rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          Previous
        </button>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <button
              type="button"
              onClick={() => void persist()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saveStatus.state === "error" ? "Retry save" : "Save progress"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={step === 6 || !editable}
            onClick={() => void goTo(step + 1)}
            className="min-h-11 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{value == null || value === "" ? "—" : value}</dd>
    </div>
  );
}
