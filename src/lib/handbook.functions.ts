import { handbookReceiptSchema, handbookSignSchema } from "@/lib/application-schema";
import { demoRoles, getDemoUserId } from "@/lib/mock/client";
import { persist, table, uid, type Row } from "@/lib/mock/db";
import { createServerFn, requireSupabaseAuth } from "@/lib/mock/server-fn";

// This exact text is stored with every signature; never accept it from the caller.
export const HANDBOOK_ACKNOWLEDGEMENT_STATEMENT =
  "I acknowledge that I have received, read, and understand the Driver Handbook, and I agree to comply with its policies.";

type SectionContent = { title: string; body: string };

function access(userId: string) {
  const roles = demoRoles(userId);
  return {
    driver: roles.includes("driver"),
    admin: roles.includes("administrator"),
    preview: roles.includes("administrator") || roles.includes("content_manager"),
  };
}

function requireReader(userId: string) {
  const permissions = access(userId);
  if (!permissions.driver && !permissions.preview)
    throw new Error("You don't have permission to access the handbook.");
  return permissions;
}

function currentVersion(): Row | null {
  const today = new Date().toISOString().slice(0, 10);
  return (
    table("handbook_versions")
      .filter((version) => {
        const date = version["effective_date"];
        return (
          version["published"] === true &&
          version["approval_state"] === "approved" &&
          version["archived_at"] == null &&
          typeof date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          !Number.isNaN(Date.parse(date)) &&
          new Date(date).toISOString().slice(0, 10) === date &&
          date <= today
        );
      })
      .sort(
        (a, b) =>
          b["effective_date"].localeCompare(a["effective_date"]) ||
          String(a["id"]).localeCompare(String(b["id"])),
      )[0] ?? null
  );
}

function publishedSections(): Row[] {
  return table("handbook_sections")
    .filter((section) => section["published"] === true)
    .sort(
      (a, b) =>
        (Number(a["sort_order"]) || 0) - (Number(b["sort_order"]) || 0) ||
        String(a["id"]).localeCompare(String(b["id"])),
    );
}

// JSON array order follows the displayed section order; each object has only title then body.
function serializeSections(sections: Row[]): string {
  const content: SectionContent[] = sections.map((section) => ({
    title: String(section["title"] ?? ""),
    body: String(section["body"] ?? ""),
  }));
  return JSON.stringify(content);
}

async function sha256(value: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signatureFor(userId: string, versionId: string): Row | undefined {
  return table("handbook_signatures").find(
    (signature) => signature["user_id"] === userId && signature["version_id"] === versionId,
  );
}

function receipt(signature: Row): Row {
  const version = table("handbook_versions").find((row) => row["id"] === signature["version_id"]);
  return structuredClone({
    ...signature,
    effective_date: signature["effective_date"] ?? version?.["effective_date"] ?? null,
    version_label: signature["version_label"] ?? version?.["version_label"] ?? null,
  });
}

export const getHandbook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const permissions = requireReader(context.userId);
    const version = currentVersion();
    const signature =
      permissions.driver && version ? signatureFor(context.userId, version["id"]) : undefined;
    const history = permissions.driver
      ? table("handbook_signatures")
          .filter((row) => row["user_id"] === context.userId)
          .sort((a, b) => String(b["signed_at"]).localeCompare(String(a["signed_at"])))
          .map(receipt)
      : [];
    return structuredClone({
      version,
      sections: version ? publishedSections() : [],
      signature: signature ? receipt(signature) : null,
      history,
      canSign: Boolean(permissions.driver && version && !signature),
    });
  });

export const signHandbook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => handbookSignSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!access(context.userId).driver) throw new Error("Only drivers can sign the handbook.");
    const version = currentVersion();
    if (!version || version["id"] !== data.version_id)
      throw new Error("This handbook version is no longer current.");
    const existing = signatureFor(context.userId, data.version_id);
    if (existing) return receipt(existing);

    const content = serializeSections(publishedSections());
    const contentHash = await sha256(content);
    // The digest is asynchronous: recheck identity, current release and content before committing.
    if (getDemoUserId() !== context.userId || !access(context.userId).driver)
      throw new Error("Your session has changed.");
    if (
      currentVersion()?.["id"] !== data.version_id ||
      serializeSections(publishedSections()) !== content
    ) {
      throw new Error("The handbook changed. Please review it again before signing.");
    }
    const duplicate = signatureFor(context.userId, data.version_id);
    if (duplicate) return receipt(duplicate);
    const signedAt = new Date().toISOString();
    const signature: Row = {
      id: uid(),
      user_id: context.userId,
      version_id: data.version_id,
      signature_name: data.signature_name,
      signed_at: signedAt,
      acknowledgement_statement: HANDBOOK_ACKNOWLEDGEMENT_STATEMENT,
      content_hash: contentHash,
      effective_date: version["effective_date"],
      version_label: version["version_label"],
      user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    };
    table("handbook_signatures").push(signature);
    table("audit_logs").push({
      id: uid(),
      actor_id: context.userId,
      action: "handbook_signed",
      target_type: "handbook_signatures",
      target_id: signature["id"],
      metadata: { version_id: data.version_id, content_hash: contentHash },
      created_at: signedAt,
    });
    persist();
    return receipt(signature);
  });

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

export const getHandbookDownload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url?: string; html?: string }> => {
    if (!access(context.userId).driver)
      throw new Error("Only drivers can download a signed handbook.");
    const version = currentVersion();
    const signature = version && signatureFor(context.userId, version["id"]);
    if (!version || !signature) throw new Error("Sign the current handbook before downloading it.");
    const sections = publishedSections();
    const serialized = serializeSections(sections);
    const hash = await sha256(serialized);
    if (
      getDemoUserId() !== context.userId ||
      !access(context.userId).driver ||
      currentVersion()?.["id"] !== version["id"] ||
      serializeSections(publishedSections()) !== serialized
    ) {
      throw new Error("The handbook or your session changed. Please try again.");
    }
    if (signature["content_hash"] !== hash)
      throw new Error("Handbook content changed since signing. Contact an administrator.");
    if (typeof version["document_url"] === "string") {
      try {
        const url = new URL(version["document_url"]);
        if (url.protocol === "https:" || url.protocol === "http:") return { url: url.href };
      } catch {
        /* Invalid links fall back to the escaped text document. */
      }
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(version["title"])}</title></head><body><h1>${escapeHtml(version["title"])}</h1><p>Version ${escapeHtml(version["version_label"])} · Effective ${escapeHtml(version["effective_date"])}</p>${sections.map((section) => `<section><h2>${escapeHtml(section["title"])}</h2><div style="white-space: pre-wrap">${escapeHtml(section["body"])}</div></section>`).join("")}</body></html>`;
    return { html };
  });

export const getHandbookReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => handbookReceiptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const permissions = requireReader(context.userId);
    const signature = table("handbook_signatures").find((row) => row["id"] === data.id);
    if (
      !signature ||
      (!permissions.admin && (!permissions.driver || signature["user_id"] !== context.userId))
    ) {
      throw new Error("Handbook receipt not found or access denied.");
    }
    return receipt(signature);
  });
