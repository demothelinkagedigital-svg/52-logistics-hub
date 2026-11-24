import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import * as handbook from "../src/lib/handbook.functions";
import { setDemoUserId } from "../src/lib/mock/client";
import { DEMO_USERS, resetDb, table } from "../src/lib/mock/db";

// The mock authentication and database persist in browser localStorage.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userAgent: "handbook-test/1.0" },
});
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
}

resetDb();
assert.deepEqual(table("handbook_acknowledgements"), [], "seed must not contain acknowledgements");
const driverId = DEMO_USERS.find((user) => user.roles.includes("driver"))!.id;
const recruiterId = DEMO_USERS.find((user) => user.roles.includes("recruiter"))!.id;
const contentManagerId = DEMO_USERS.find((user) => user.roles.includes("content_manager"))!.id;
const otherDriverId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
table("user_roles").push({ user_id: otherDriverId, role: "driver" });
setDemoUserId(driverId);

const dateOffset = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const versions = table("handbook_versions");
const current = versions[0]!;
assert.equal(current["title"], "Driver Handbook (sample content)");
assert.equal(current["approval_state"], "approved");
assert.equal(current["published"], true);
current["effective_date"] = dateOffset(-20);
const currentId = current["id"] as string;
const draftId = "aaaaaaaa-0000-4000-a000-000000000001";
const newerId = "aaaaaaaa-0000-4000-a000-000000000002";
const draft = { ...current, id: draftId, effective_date: dateOffset(-1), approval_state: "draft" };
versions.push(
  draft,
  { ...current, id: "aaaaaaaa-0000-4000-a000-000000000003", effective_date: dateOffset(1) },
  {
    ...current,
    id: "aaaaaaaa-0000-4000-a000-000000000004",
    effective_date: dateOffset(-1),
    archived_at: new Date().toISOString(),
  },
  {
    ...current,
    id: "aaaaaaaa-0000-4000-a000-000000000005",
    effective_date: dateOffset(-1),
    approval_state: "under_review",
  },
  {
    ...current,
    id: "aaaaaaaa-0000-4000-a000-000000000006",
    effective_date: dateOffset(-1),
    published: false,
  },
  { ...current, id: "aaaaaaaa-0000-4000-a000-000000000007", effective_date: "not-a-date" },
);

// Independent fixtures make the hash test sensitive to section ordering and publication.
const sections = table("handbook_sections");
sections.splice(
  0,
  sections.length,
  { id: "section-b", title: "Second & final", body: "Second body", sort_order: 2, published: true },
  {
    id: "section-a",
    title: "First",
    body: "First body\nSecond line",
    sort_order: 1,
    published: true,
  },
  {
    id: "section-hidden",
    title: "Unpublished",
    body: "Not included",
    sort_order: 0,
    published: false,
  },
);
const expectedContent = JSON.stringify([
  { title: "First", body: "First body\nSecond line" },
  { title: "Second & final", body: "Second body" },
]);
const expectedHash = createHash("sha256").update(expectedContent, "utf8").digest("hex");
const expectedStatement = (label: string) =>
  `I have read and understand the 52 Logistics Driver Handbook, version ${label}, and agree to follow its policies.`;
const lockedDownloadError = { message: "Sign the current handbook to unlock the download" };
const signData = { version_id: currentId, signature_name: "  Alicia Grant  ", agreed: true };

let view = await handbook.getHandbook();
assert.equal(
  view.version?.["id"],
  currentId,
  "only an effective, approved, published, unarchived version is current",
);
assert.deepEqual(
  view.sections.map((section) => section["id"]),
  ["section-a", "section-b"],
);
assert.equal(view.signature, null);
assert.deepEqual(view.history, []);
assert.equal(view.canSign, true);
await assert.rejects(handbook.getHandbookDownload(), lockedDownloadError);

for (const versionId of ["aaaaaaaa-0000-4000-a000-000000000099", draftId]) {
  await assert.rejects(
    handbook.signHandbook({ data: { ...signData, version_id: versionId } }),
    /no longer current/i,
  );
}
await assert.rejects(
  handbook.signHandbook({ data: { ...signData, agreed: false } }),
  /must agree/i,
);
await assert.rejects(handbook.signHandbook({ data: { ...signData, signature_name: " A " } }));
for (const userId of [contentManagerId, recruiterId]) {
  setDemoUserId(userId);
  await assert.rejects(handbook.signHandbook({ data: signData }), /only drivers/i);
}
assert.equal(table("handbook_acknowledgements").length, 0);
assert.equal(table("audit_logs").filter((row) => row["action"] === "handbook_signed").length, 0);

setDemoUserId(driverId);
// Two simultaneous requests exercise the post-hash duplicate check, too.
const [receipt, duplicate] = await Promise.all([
  handbook.signHandbook({ data: signData }),
  handbook.signHandbook({ data: signData }),
]);
assert.deepEqual(duplicate, receipt);
assert.match(
  receipt["id"],
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);
assert.ok(!Number.isNaN(Date.parse(receipt["signed_at"])));
assert.equal(
  handbook.handbookStatement(current["version_label"]),
  expectedStatement(current["version_label"]),
);
assert.deepEqual(receipt, {
  id: receipt["id"],
  user_id: driverId,
  handbook_version_id: currentId,
  version_label: current["version_label"],
  handbook_title: current["title"],
  statement: expectedStatement(current["version_label"]),
  signature_name: "Alicia Grant",
  signed_at: receipt["signed_at"],
  content_hash: expectedHash,
  source: { method: "web", user_agent: "handbook-test/1.0" },
  created_at: receipt["signed_at"],
  effective_date: current["effective_date"],
});
assert.deepEqual(table("handbook_acknowledgements"), [receipt]);
assert.deepEqual(await handbook.getHandbookReceipt({ data: { id: receipt["id"] } }), receipt);
assert.deepEqual(
  await handbook.signHandbook({ data: { ...signData, signature_name: "Different Name" } }),
  receipt,
);
assert.equal(table("handbook_acknowledgements").length, 1);
const audits = table("audit_logs").filter((row) => row["action"] === "handbook_signed");
assert.equal(audits.length, 1);
assert.equal(audits[0]!["actor_id"], driverId);
assert.equal(audits[0]!["target_type"], "handbook_acknowledgements");
assert.equal(audits[0]!["target_id"], receipt["id"]);
assert.equal(audits[0]!["created_at"], receipt["signed_at"]);
assert.deepEqual(audits[0]!["metadata"], { version_id: currentId, content_hash: expectedHash });
view = await handbook.getHandbook();
assert.deepEqual(view.signature, receipt);
assert.deepEqual(view.history, [receipt]);
assert.equal(view.canSign, false);
const download = await handbook.getHandbookDownload();
assert.ok(download.html?.includes("First body"));
assert.ok(download.html?.includes("Second &amp; final"));
assert.equal(download.html?.includes("Unpublished"), false);

setDemoUserId(otherDriverId);
await assert.rejects(
  handbook.getHandbookReceipt({ data: { id: receipt["id"] } }),
  /not found or access denied/i,
);
assert.deepEqual((await handbook.getHandbook()).history, []);
setDemoUserId(driverId);

versions.push({
  ...current,
  id: newerId,
  effective_date: dateOffset(-1),
  version_label: "New release",
});
view = await handbook.getHandbook();
assert.equal(view.version?.["id"], newerId);
assert.equal(view.signature, null);
assert.equal(view.canSign, true);
assert.deepEqual(view.history, [receipt]);
await assert.rejects(handbook.getHandbookDownload(), lockedDownloadError);
await assert.rejects(handbook.signHandbook({ data: signData }), /no longer current/i);
assert.deepEqual(await handbook.getHandbookReceipt({ data: { id: receipt["id"] } }), receipt);
const newReceipt = await handbook.signHandbook({ data: { ...signData, version_id: newerId } });
assert.equal(newReceipt["handbook_version_id"], newerId);
assert.equal(newReceipt["version_label"], "New release");
assert.equal(newReceipt["statement"], expectedStatement("New release"));
assert.deepEqual(newReceipt["source"], { method: "web", user_agent: "handbook-test/1.0" });
assert.notEqual(newReceipt["id"], receipt["id"]);
assert.equal(table("handbook_acknowledgements").length, 2);
const history = (await handbook.getHandbook()).history;
assert.equal(history.length, 2);
assert.deepEqual(
  history.find((entry) => entry["id"] === receipt["id"]),
  receipt,
);
assert.deepEqual(
  history.find((entry) => entry["id"] === newReceipt["id"]),
  newReceipt,
);
assert.ok((await handbook.getHandbookDownload()).html);

// Assert the complete handbook API surface, not just a few guessed mutation names.
// The mock database itself is directly mutable; this checks the server-function exports only.
assert.deepEqual(
  Object.keys(handbook).sort(),
  [
    "handbookStatement",
    "getHandbook",
    "getHandbookDownload",
    "getHandbookReceipt",
    "signHandbook",
  ].sort(),
);

console.log("Handbook tests passed.");
