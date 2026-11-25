import assert from "node:assert/strict";
import { getDb, resetDb, table } from "../src/lib/mock/db";
import { hashToken } from "../src/lib/application-access";
import { DEMO_USERS } from "../src/lib/mock/db";
import { setDemoUserId } from "../src/lib/mock/client";
import { archiveResource, duplicateResource, saveResource } from "../src/lib/ops.functions";
import {
  getApplicationDetail,
  assignApplicationRecruiter,
  exportRecruitingApplications,
  saveFirstAdvantageHandoff,
  saveEsignRecord,
  deleteEsignRecord,
} from "../src/lib/recruiting.functions";
import {
  startPublicApplication,
  getApplicationByToken,
  saveApplicationDraftByToken,
  saveEmployersByToken,
  recordDocumentByToken,
  deleteDocumentByToken,
  submitApplicationByToken,
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
assert.equal(
  table("applications").filter((row) => row["resume_token_hash"] === firstHash).length,
  1,
);
assert.equal(app["user_id"], null);
const setting = table("site_settings").find((row) => row["key"] === "application_resume_days")!;
setting["value"] = "5";
app["resume_expires_at"] = new Date(Date.now() + 1000).toISOString();

await Promise.all([
  saveApplicationDraftByToken({
    data: {
      token,
      values: {
        current_step: 3,
        schedule_availability: ["Weekdays"],
        start_availability: "Two weeks",
        medical_card_status: "current",
      },
    },
  }),
  saveApplicationDraftByToken({
    data: { token, values: { additional_notes: "Available for linehaul" } },
  }),
]);
assert.ok(Date.parse(app["resume_expires_at"]) > Date.now() + 4 * 86400000);
assert.ok(Date.parse(app["resume_expires_at"]) <= Date.now() + 5 * 86400000);
const employer = { employer_name: "Example Freight", was_dot_regulated: true };
await Promise.all([
  saveEmployersByToken({ data: { token, employers: [employer] } }),
  saveEmployersByToken({ data: { token, employers: [employer] } }),
]);
const doc = {
  token,
  doc_type: "resume" as const,
  storage_path: "public-app/resume.pdf",
  file_name: "resume.pdf",
  mime_type: "application/pdf" as const,
  size_bytes: 123,
};
await Promise.all([recordDocumentByToken({ data: doc }), recordDocumentByToken({ data: doc })]);
let loaded = await getApplicationByToken({ data: { token } });
assert.deepEqual(loaded.application?.["schedule_availability"], ["Weekdays"]);
assert.equal(loaded.application?.["start_availability"], "Two weeks");
assert.equal(loaded.application?.["medical_card_status"], "current");
assert.equal(loaded.application?.["additional_notes"], "Available for linehaul");
assert.equal(loaded.employers?.length, 1);
assert.equal(loaded.documents?.length, 1);
assert.equal(loaded.application?.["resume_token_hash"], undefined);
await deleteDocumentByToken({
  data: { token: second.resume_token, id: loaded.documents![0]!["id"] },
});
assert.equal((await getApplicationByToken({ data: { token } })).documents?.length, 1);
await deleteDocumentByToken({ data: { token, id: loaded.documents![0]!["id"] } });
loaded = await getApplicationByToken({ data: { token } });
assert.equal(loaded.documents?.length, 0);

const submissions = await Promise.allSettled([
  submitApplicationByToken({ data: { token, signature_name: "Test Applicant" } }),
  submitApplicationByToken({ data: { token, signature_name: "Test Applicant" } }),
]);
assert.equal(submissions.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(
  table("applications").filter(
    (row) => row["reference_code"] === first.reference_code && row["status"] === "new",
  ).length,
  1,
);
assert.deepEqual(app["schedule_availability"], ["Weekdays"]);
assert.equal(app["start_availability"], "Two weeks");
assert.equal(app["medical_card_status"], "current");
assert.equal(app["signature_signed_at"], app["submitted_at"]);
for (const status of [
  "new",
  "ready_for_review",
  "hired",
  "rejected",
  "archived",
  "unknown_status",
]) {
  app["status"] = status;
  const summary = await getApplicationByToken({ data: { token } });
  assert.deepEqual(summary, {
    reference: first.reference_code,
    position: null,
    submitted_at: app["submitted_at"],
    label: "Application received",
  });
  assert.equal("status" in summary, false);
}
await assert.rejects(
  saveApplicationDraftByToken({ data: { token, values: { first_name: "Changed" } } }),
  /locked/,
);

const secondHash = await hashToken(second.resume_token);
const expired = table("applications").find((row) => row["resume_token_hash"] === secondHash)!;
expired["resume_expires_at"] = new Date(Date.now() - 1).toISOString();
const failure = async (value: string) => {
  try {
    await getApplicationByToken({ data: { token: value } });
    assert.fail("Expected invalid token");
  } catch (error) {
    return (error as Error).message;
  }
};
const expiredError = await failure(second.resume_token);
assert.match(expiredError, /invalid or expired/i);
assert.equal(await failure("wrong-token"), expiredError);
const json = JSON.stringify(getDb());
for (const value of [demoToken, first.resume_token, second.resume_token])
  assert.equal(json.includes(value), false);

await Promise.all(Array.from({ length: 25 }, (_, i) => failure(`wrong-${i}`)));
assert.equal(await failure(token), expiredError);

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
resetDb();
const recruiterId = DEMO_USERS.find((user) => user.roles.includes("recruiter"))!.id;
const contentManagerId = DEMO_USERS.find((user) => user.roles.includes("content_manager"))!.id;
setDemoUserId(recruiterId);
const reviewApplicationId = "a0000000-0000-4000-a000-000000000005";
await assignApplicationRecruiter({
  data: { id: reviewApplicationId, assigned_recruiter_id: recruiterId },
});
const assignedApplication = table("applications").find((row) => row["id"] === reviewApplicationId)!;
assert.equal(assignedApplication["assigned_recruiter_id"], recruiterId);
const assignmentEvent = table("application_events").find(
  (event) =>
    event["application_id"] === reviewApplicationId &&
    event["event_type"] === "recruiter_assignment",
)!;
assert.equal(assignmentEvent["description"], "Recruiter assignment updated");
assert.ok(assignmentEvent["created_at"]);
assert.deepEqual(assignmentEvent["metadata"], { from: null, to: recruiterId });
const exported = await exportRecruitingApplications({
  data: { application_ids: [reviewApplicationId] },
});
const csvRows = exported.csv.split("\r\n").map((line) => line.split(","));
const csvHeader = csvRows[0]!.map((cell) => cell.slice(1, -1));
assert.deepEqual(csvHeader, [
  "reference",
  "applicant name",
  "opening",
  "status label",
  "submitted date",
  "assigned recruiter",
]);
assert.equal(csvRows[1]!.length, csvHeader.length);
assert.equal(exported.csv.includes("example.com"), false);
assert.equal(exported.row_count, 1);
const exportAudit = table("audit_logs").find(
  (entry) => entry["action"] === "recruiting_applications_exported",
)!;
assert.equal(exportAudit["actor_id"], recruiterId);
assert.ok(exportAudit["created_at"]);
assert.equal(exportAudit["metadata"]["row_count"], 1);
const handoff = {
  application_id: reviewApplicationId,
  invitation_date: "2026-01-12",
  responsible_recruiter_id: recruiterId,
  external_case_id: "CASE-4821",
  next_check_date: "2026-01-19",
  operational_note: "Follow up with candidate",
  checklist: {
    reviewed_application: true,
    opened_employer_portal: true,
    created_candidate_invitation: true,
    recorded_handoff_details: true,
    updated_application_status: false,
  },
};
const existingStatus = table("applications").find((row) => row["id"] === reviewApplicationId)![
  "status"
];
await saveFirstAdvantageHandoff({ data: handoff });
const handoffEvent = table("application_events").find(
  (event) =>
    event["application_id"] === reviewApplicationId &&
    event["event_type"] === "first_advantage_handoff_update",
)!;
assert.equal(handoffEvent["actor_id"], recruiterId);
assert.equal(handoffEvent["description"], "First Advantage handoff updated");
assert.equal(
  handoffEvent["metadata"]["checklist"]["recorded_handoff_details"]["done_by"],
  recruiterId,
);
assert.equal(
  table("applications").find((row) => row["id"] === reviewApplicationId)!["status"],
  existingStatus,
);
await assert.rejects(saveFirstAdvantageHandoff({ data: { ...handoff, status: "clear" } as never }));
setDemoUserId(contentManagerId);
await assert.rejects(getApplicationDetail({ data: { id: reviewApplicationId } }), /Forbidden/);
await assert.rejects(saveFirstAdvantageHandoff({ data: handoff }), /Forbidden/);
await assert.rejects(
  exportRecruitingApplications({ data: { application_ids: [reviewApplicationId] } }),
  /Forbidden/,
);
setDemoUserId(recruiterId);
const esign = {
  application_id: reviewApplicationId,
  document_type: "Employment forms" as const,
  sent_date: "2026-01-12",
  sender_id: recruiterId,
  external_reference_id: "DS-492",
  completion_date: null,
  status: "sent" as const,
  notes: "Awaiting signature",
};
await saveEsignRecord({ data: esign });
let esignRecord = table("esign_records").find(
  (record) =>
    record["application_id"] === reviewApplicationId &&
    record["document_name"] === esign.document_type,
)!;
assert.equal(esignRecord["status"], "sent");
await assert.rejects(saveEsignRecord({ data: { ...esign, completion_date: "2026-01-11" } }));
await saveEsignRecord({
  data: { ...esign, id: esignRecord["id"], status: "completed", notes: "Signed" },
});
esignRecord = table("esign_records").find((record) => record["id"] === esignRecord["id"])!;
assert.equal(esignRecord["status"], "completed");
assert.equal(esignRecord["notes"], "Signed");
await deleteEsignRecord({ data: { id: esignRecord["id"], application_id: reviewApplicationId } });
assert.equal(
  table("esign_records").some((record) => record["id"] === esignRecord["id"]),
  false,
);
setDemoUserId(contentManagerId);
for (const resource of ["jobs", "handbook_sections", "required_systems", "lms_courses"] as const) {
  const existing = table(resource)[0]!;
  const other = table(resource)[1]!;
  const slug = existing["slug"] as string;
  await assert.rejects(
    saveResource({ data: { resource, values: { slug } } }),
    /That slug is already used/,
  );
  await assert.rejects(
    saveResource({ data: { resource, id: other["id"], values: { slug } } }),
    /That slug is already used/,
  );
  for (const invalid of ["Bad-Slug", "bad slug", "bad_slug", ""]) {
    await assert.rejects(
      saveResource({ data: { resource, values: { slug: invalid } } }),
      /Slug must contain only lowercase letters, digits and hyphens/,
    );
    await assert.rejects(
      saveResource({ data: { resource, id: existing["id"], values: { slug: invalid } } }),
      /Slug must contain only lowercase letters, digits and hyphens/,
    );
  }
  await saveResource({ data: { resource, id: existing["id"], values: { slug } } });
  const originalNow = Date.now;
  Date.now = () => 123456789;
  try {
    const duplicate = await duplicateResource({ data: { resource, id: existing["id"] } });
    assert.equal(table(resource).find((row) => row["id"] === duplicate.id)?.["slug"], `${slug}-copy-${(123456789).toString(36)}`);
    await assert.rejects(
      duplicateResource({ data: { resource, id: existing["id"] } }),
      /That slug is already used/,
    );
  } finally {
    Date.now = originalNow;
  }
}

for (const resource of ["jobs", "lms_courses"] as const) {
  const row = table(resource)[0]!;
  const slug = row["slug"] as string;
  await archiveResource({ data: { resource, id: row["id"] } });
  assert.ok(row["archived_at"]);
  assert.equal(row["published"], false);
  const created = await saveResource({ data: { resource, values: { slug } } });
  await assert.rejects(
    archiveResource({ data: { resource, id: row["id"], restore: true } }),
    /That slug is already used/,
  );
  await archiveResource({ data: { resource, id: created.id! } });
  await archiveResource({ data: { resource, id: row["id"], restore: true } });
  assert.equal(row["archived_at"], null);
  assert.equal(row["published"], false);
}

for (const resource of ["handbook_versions", "safety_resources"] as const) {
  if (resource === "handbook_versions") {
    assert.equal(table(resource)[0]?.["approval_state"], "approved");
  } else {
    assert.ok(table(resource).every((row) => row["approval_state"] === "draft"));
  }
  const created = await saveResource({ data: { resource, values: { title: "New item" } } });
  assert.equal(table(resource).find((row) => row["id"] === created.id)?.["approval_state"], "draft");
  await assert.rejects(saveResource({ data: { resource, id: created.id!, values: { approval_state: "invalid" } } }));
  await saveResource({ data: { resource, id: created.id!, values: { approval_state: "under_review" } } });
  assert.equal(table(resource).find((row) => row["id"] === created.id)?.["approval_state"], "under_review");
}
console.log("Public application, handoff, and management tests passed.");
