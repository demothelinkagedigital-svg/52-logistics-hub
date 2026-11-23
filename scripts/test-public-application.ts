import assert from "node:assert/strict";
import { getDb, resetDb, table } from "../src/lib/mock/db";
import { hashToken } from "../src/lib/application-access";
import {
  startPublicApplication, getApplicationByToken, saveApplicationDraftByToken,
  saveEmployersByToken, recordDocumentByToken, deleteDocumentByToken, submitApplicationByToken,
} from "../src/lib/public-application.functions";

resetDb();
const demoToken = "demo-resume-tyrone-baker-0000000000000000";
const seeded = await getApplicationByToken({ data: { token: demoToken } });
assert.equal(seeded.application?.["first_name"], "Tyrone");
const [first, second] = await Promise.all([
  startPublicApplication({ data: {} }),
  startPublicApplication({ data: {} }),
]);
assert.notEqual(first.resume_token, second.resume_token);
assert.notEqual(first.reference_code, second.reference_code);
assert.match(first.resume_token, /^[A-Za-z0-9_-]{43}$/);
const token = first.resume_token;
const firstHash = await hashToken(token);
const app = table("applications").find((row) => row["resume_token_hash"] === firstHash)!;
assert.equal(table("applications").filter((row) => row["resume_token_hash"] === firstHash).length, 1);
assert.equal(app["user_id"], null);
const setting = table("site_settings").find((row) => row["key"] === "application_resume_days")!;
setting["value"] = "5";
app["resume_expires_at"] = new Date(Date.now() + 1000).toISOString();

await Promise.all([
  saveApplicationDraftByToken({ data: { token, values: { current_step: 3, schedule_availability: ["Weekdays"], start_availability: "Two weeks", medical_card_status: "current" } } }),
  saveApplicationDraftByToken({ data: { token, values: { additional_notes: "Available for linehaul" } } }),
]);
assert.ok(Date.parse(app["resume_expires_at"]) > Date.now() + 4 * 86400000);
assert.ok(Date.parse(app["resume_expires_at"]) <= Date.now() + 5 * 86400000);
const employer = { employer_name: "Example Freight", was_dot_regulated: true };
await Promise.all([
  saveEmployersByToken({ data: { token, employers: [employer] } }),
  saveEmployersByToken({ data: { token, employers: [employer] } }),
]);
const doc = { token, doc_type: "resume" as const, storage_path: "public-app/resume.pdf", file_name: "resume.pdf", mime_type: "application/pdf" as const, size_bytes: 123 };
await Promise.all([recordDocumentByToken({ data: doc }), recordDocumentByToken({ data: doc })]);
let loaded = await getApplicationByToken({ data: { token } });
assert.deepEqual(loaded.application?.["schedule_availability"], ["Weekdays"]);
assert.equal(loaded.application?.["start_availability"], "Two weeks");
assert.equal(loaded.application?.["medical_card_status"], "current");
assert.equal(loaded.application?.["additional_notes"], "Available for linehaul");
assert.equal(loaded.employers?.length, 1);
assert.equal(loaded.documents?.length, 1);
assert.equal(loaded.application?.["resume_token_hash"], undefined);
await deleteDocumentByToken({ data: { token: second.resume_token, id: loaded.documents![0]!["id"] } });
assert.equal((await getApplicationByToken({ data: { token } })).documents?.length, 1);
await deleteDocumentByToken({ data: { token, id: loaded.documents![0]!["id"] } });
loaded = await getApplicationByToken({ data: { token } });
assert.equal(loaded.documents?.length, 0);

const submissions = await Promise.allSettled([
  submitApplicationByToken({ data: { token, signature_name: "Test Applicant" } }),
  submitApplicationByToken({ data: { token, signature_name: "Test Applicant" } }),
]);
assert.equal(submissions.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(table("applications").filter((row) => row["reference_code"] === first.reference_code && row["status"] === "submitted").length, 1);
assert.deepEqual(app["schedule_availability"], ["Weekdays"]);
assert.equal(app["start_availability"], "Two weeks");
assert.equal(app["medical_card_status"], "current");
assert.equal(app["signature_signed_at"], app["submitted_at"]);
for (const status of ["submitted", "under_review", "interview", "hired", "rejected", "archived", "unknown_status"]) {
  app["status"] = status;
  const summary = await getApplicationByToken({ data: { token } });
  assert.deepEqual(summary, { reference: first.reference_code, position: null, submitted_at: app["submitted_at"], label: "Application received" });
  assert.equal("status" in summary, false);
}
await assert.rejects(saveApplicationDraftByToken({ data: { token, values: { first_name: "Changed" } } }), /locked/);

const secondHash = await hashToken(second.resume_token);
const expired = table("applications").find((row) => row["resume_token_hash"] === secondHash)!;
expired["resume_expires_at"] = new Date(Date.now() - 1).toISOString();
const failure = async (value: string) => {
  try { await getApplicationByToken({ data: { token: value } }); assert.fail("Expected invalid token"); }
  catch (error) { return (error as Error).message; }
};
const expiredError = await failure(second.resume_token);
assert.match(expiredError, /invalid or expired/i);
assert.equal(await failure("wrong-token"), expiredError);
const json = JSON.stringify(getDb());
for (const value of [demoToken, first.resume_token, second.resume_token]) assert.equal(json.includes(value), false);

await Promise.all(Array.from({ length: 25 }, (_, i) => failure(`wrong-${i}`)));
assert.equal(await failure(token), expiredError);
console.log("Public application tests passed.");
