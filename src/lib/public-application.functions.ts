import { z } from "zod";
import { createServerFn } from "./mock/server-fn";
import { getDb, persist, table, uid, type Row } from "./mock/db";
import { applicationDocumentSchema, employerSchema, portalDraftSchema } from "./application-schema";
import { generateResumeToken, hashToken, resumeExpiry } from "./application-access";

const tokenSchema = z.object({ token: z.string() });
const invalidToken = "Application link is invalid or expired.";
let failedLookups: number[] = [];

async function verifiedApplication(token: string): Promise<Row> {
  const now = Date.now();
  failedLookups = failedLookups.filter((time) => time > now - 60_000);
  if (failedLookups.length >= 20) throw new Error(invalidToken);
  const hash = token.length <= 1024 ? await hashToken(token) : "";
  if (failedLookups.length >= 20) throw new Error(invalidToken);
  const application = table("applications").find((row) => row["resume_token_hash"] === hash);
  if (
    !application ||
    !Number.isFinite(Date.parse(application["resume_expires_at"])) ||
    Date.parse(application["resume_expires_at"]) <= Date.now()
  ) {
    failedLookups.push(Date.now());
    throw new Error(invalidToken);
  }
  return application;
}

function requireEditable(application: Row) {
  if (application["status"] !== "draft" && application["status"] !== "corrections_requested") {
    throw new Error("This application is locked and cannot be edited.");
  }
}

function saved(application: Row) {
  const now = Date.now();
  application["last_saved_at"] = new Date(now).toISOString();
  application["updated_at"] = application["last_saved_at"];
  application["resume_expires_at"] = resumeExpiry(now);
  persist();
}

export const startPublicApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ job_id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const job = data.job_id ? table("jobs").find((row) => row["id"] === data.job_id) : null;
    if (data.job_id && !job) throw new Error("Job not found.");
    const resume_token = generateResumeToken();
    const resume_token_hash = await hashToken(resume_token);
    const applications = table("applications");
    if (applications.some((row) => row["resume_token_hash"] === resume_token_hash)) {
      throw new Error("Could not create a unique application token. Please try again.");
    }
    const start = crypto.getRandomValues(new Uint32Array(1))[0]! % 10000;
    let reference_code = "";
    for (let i = 0; i < 10000; i++) {
      const candidate = `52L-${String((start + i) % 10000).padStart(4, "0")}`;
      if (!applications.some((row) => row["reference_code"] === candidate)) {
        reference_code = candidate;
        break;
      }
    }
    if (!reference_code) throw new Error("No application reference numbers are available.");
    const now = Date.now();
    const stamp = new Date(now).toISOString();
    applications.push({
      id: uid(),
      user_id: null,
      assigned_recruiter_id: null,
      job_id: data.job_id ?? null,
      position_title: job?.["position"] ?? null,
      reference_code,
      resume_token_hash,
      resume_expires_at: resumeExpiry(now),
      source: "web",
      status: "draft",
      current_step: 1,
      submitted_at: null,
      last_saved_at: stamp,
      created_at: stamp,
      updated_at: stamp,
    });
    persist();
    return { reference_code, resume_token };
  });

export const getApplicationByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    if (application["status"] !== "draft" && application["status"] !== "corrections_requested") {
      return {
        reference: application["reference_code"],
        position: application["position_title"],
        submitted_at: application["submitted_at"],
        label: "Application received",
      };
    }
    const { resume_token_hash: _hash, ...safeApplication } = application;
    return structuredClone({
      application: safeApplication,
      employers: table("application_employers")
        .filter((row) => row["application_id"] === application["id"])
        .sort((a, b) => a["sort_order"] - b["sort_order"]),
      documents: table("application_documents").filter(
        (row) => row["application_id"] === application["id"],
      ),
    });
  });

export const saveApplicationDraftByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenSchema.extend({ values: portalDraftSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    requireEditable(application);
    for (const [key, value] of Object.entries(data.values))
      if (value !== undefined) application[key] = value;
    saved(application);
    return { ok: true };
  });

export const saveEmployersByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenSchema.extend({ employers: z.array(employerSchema).max(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    requireEditable(application);
    const db = getDb();
    const stamp = new Date().toISOString();
    const employers = data.employers.map(({ id: _id, ...employer }, sort_order) => ({
      ...employer,
      id: uid(),
      application_id: application["id"],
      user_id: null,
      sort_order,
      created_at: stamp,
      updated_at: stamp,
    }));
    db["application_employers"] = table("application_employers")
      .filter((row) => row["application_id"] !== application["id"])
      .concat(employers);
    saved(application);
    return { ok: true };
  });

export const recordDocumentByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    applicationDocumentSchema.extend({ token: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    requireEditable(application);
    const { token: _token, ...document } = data;
    const documents = table("application_documents");
    const existing = documents.find(
      (row) =>
        row["application_id"] === application["id"] &&
        row["storage_path"] === document.storage_path,
    );
    if (existing) {
      if (
        existing["doc_type"] !== document.doc_type ||
        existing["file_name"] !== document.file_name ||
        existing["mime_type"] !== document.mime_type ||
        existing["size_bytes"] !== document.size_bytes
      ) {
        Object.assign(existing, {
          verification_status: "pending",
          rejection_reason: null,
          verified_by: null,
          verified_at: null,
        });
      }
      Object.assign(existing, document);
    } else
      documents.push({
        ...document,
        id: uid(),
        application_id: application["id"],
        user_id: null,
        verification_status: "pending",
        created_at: new Date().toISOString(),
      });
    saved(application);
    return { ok: true };
  });

export const deleteDocumentByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    requireEditable(application);
    const db = getDb();
    db["application_documents"] = table("application_documents").filter(
      (row) => row["application_id"] !== application["id"] || row["id"] !== data.id,
    );
    saved(application);
    return { ok: true };
  });

export const submitApplicationByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenSchema.extend({ signature_name: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const application = await verifiedApplication(data.token);
    requireEditable(application);
    const previousStatus = String(application["status"]);
    const submittedAt = new Date().toISOString();
    Object.assign(application, {
      status: "new",
      certified: true,
      signature_name: data.signature_name,
      submitted_at: submittedAt,
      signature_signed_at: submittedAt,
      correction_notes: null,
      current_step: 6,
    });
    table("application_events").push({
      id: uid(),
      application_id: application["id"],
      actor_id: null,
      event_type: "status_change",
      description: `Application ${application["reference_code"]} submitted for review`,
      metadata: { from: previousStatus, to: "new" },
      created_at: submittedAt,
    });
    saved(application);
    return {
      ok: true,
      reference: application["reference_code"],
      position: application["position_title"],
      submitted_at: submittedAt,
      status: "new" as const,
    };
  });
