import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import * as academy from "../src/lib/lms.functions";
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
  value: { userAgent: "academy-test/1.0" },
});
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
}

resetDb();
assert.deepEqual(
  table("handbook_acknowledgements"),
  [],
  "seed must not contain handbook signatures",
);
const driverId = DEMO_USERS.find((user) => user.roles.includes("driver"))!.id;
const adminId = DEMO_USERS.find((user) => user.roles.includes("administrator"))!.id;
const recruiterId = DEMO_USERS.find((user) => user.roles.includes("recruiter"))!.id;
const contentManagerId = DEMO_USERS.find((user) => user.roles.includes("content_manager"))!.id;
const otherDriverId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
table("user_roles").push({ user_id: otherDriverId, role: "driver" });
setDemoUserId(driverId);

const courses = table("lms_courses").sort(
  (a, b) => Number(a["sort_order"]) - Number(b["sort_order"]),
);
const courseIds = courses.slice(0, 6).map((row) => String(row["id"]));
const courseId = (number: number) => courseIds[number - 1]!;
const lessonsFor = (number: number) =>
  table("lms_lessons").filter((row) => row["course_id"] === courseId(number));
const quizFor = (number: number) =>
  table("lms_quizzes").find((row) => row["course_id"] === courseId(number))!;
const requiredConfirmations = [
  "Motive installed or access confirmed",
  "Whip Around installed or access confirmed",
  "MyFleetAI / Linehaul Central access confirmed",
];
const currentHandbook = table("handbook_versions")[0]!;
currentHandbook["version_label"] = "6A";

assert.equal(courses.length, 6, "seed has six Academy courses");
assert.deepEqual(
  courses.map((row) => row["completion_rules"]),
  [
    { lessons: true, quiz: true, acknowledgement: true },
    { derived: "handbook_signed" },
    { lessons: true, confirmations: requiredConfirmations, quiz: true },
    { lessons: true, quiz: true, acknowledgement: true },
    { lessons: true, quiz: true, acknowledgement: true },
    { certification: true, management_verification: true },
  ],
);
assert.equal("setLessonComplete" in academy, false, "there is no direct lesson-completion API");
assert.deepEqual(
  Object.keys(academy).sort(),
  [
    "acknowledgeModule",
    "completeLesson",
    "confirmItem",
    "driverCertify",
    "evaluateModule",
    "getAcademyOverview",
    "getCourse",
    "listDriverOnboarding",
    "logExternalLinkOpened",
    "openLesson",
    "resetModule",
    "startCourse",
    "submitQuiz",
    "verifyOnboarding",
  ].sort(),
);

const answersFor = (number: number, correct: boolean) => {
  const quiz = quizFor(number);
  const questions = table("lms_quiz_questions").filter((row) => row["quiz_id"] === quiz["id"]);
  return Object.fromEntries(
    questions.map((question) => {
      const options = question["options"] as string[];
      const correctAnswer = (question["correct_answers"] as string[])[0]!;
      return [
        question["id"],
        correct ? correctAnswer : options.find((option) => option !== correctAnswer)!,
      ];
    }),
  );
};
const submitQuiz = (number: number, correct: boolean) =>
  academy.submitQuiz({
    data: { quiz_id: String(quizFor(number)["id"]), answers: answersFor(number, correct) },
  });
const evaluation = (number: number) => academy.evaluateModule(driverId, courseId(number));
const openAndCompleteLessons = async (number: number) => {
  for (const lesson of lessonsFor(number)) {
    const lessonId = String(lesson["id"]);
    if (
      table("lms_lesson_progress").some(
        (row) =>
          row["user_id"] === driverId &&
          row["lesson_id"] === lessonId &&
          row["completed"] === true &&
          row["superseded_at"] == null,
      )
    )
      continue;
    await academy.openLesson({ data: { lesson_id: lessonId } });
    const opened = table("lms_lesson_opens").find(
      (row) =>
        row["user_id"] === driverId &&
        row["lesson_id"] === lessonId &&
        row["superseded_at"] == null,
    )!;
    opened["opened_at"] = new Date(
      Date.now() - (Number(lesson["min_view_seconds"]) + 2) * 1000,
    ).toISOString();
    await academy.completeLesson({ data: { lesson_id: lessonId } });
  }
};
const signCourseAcknowledgement = (number: number) =>
  academy.acknowledgeModule({
    data: { course_id: courseId(number), signature_name: "Alicia Grant" },
  });

// Locked course actions must all reject before writing evidence.
const lockedLesson = lessonsFor(3)[0]!;
const lockedLink = table("required_systems").find((row) => row["published"] === true)!;
const lockedLessonOpens = table("lms_lesson_opens").length;
const lockedProgress = table("lms_lesson_progress").length;
const lockedAttempts = table("lms_quiz_attempts").length;
const lockedConfirmations = table("lms_item_confirmations").length;
const lockedAcknowledgements = table("lms_course_acknowledgements").length;
const lockedExternalOpens = table("lms_external_link_opens").length;
await assert.rejects(
  academy.startCourse({ data: { course_id: courseId(3) } }),
  /previous Academy course/i,
);
await assert.rejects(
  academy.openLesson({ data: { lesson_id: String(lockedLesson["id"]) } }),
  /previous Academy course/i,
);
await assert.rejects(
  academy.completeLesson({ data: { lesson_id: String(lockedLesson["id"]) } }),
  /previous Academy course/i,
);
await assert.rejects(submitQuiz(3, true), /previous Academy course/i);
await assert.rejects(
  academy.confirmItem({ data: { course_id: courseId(3), item_key: requiredConfirmations[0]! } }),
  /previous Academy course/i,
);
await assert.rejects(signCourseAcknowledgement(4), /previous Academy course/i);
await assert.rejects(
  academy.logExternalLinkOpened({
    data: { course_id: courseId(3), link_key: String(lockedLink["slug"]) },
  }),
  /previous Academy course/i,
);
assert.equal(table("lms_lesson_opens").length, lockedLessonOpens);
assert.equal(table("lms_lesson_progress").length, lockedProgress);
assert.equal(table("lms_quiz_attempts").length, lockedAttempts);
assert.equal(table("lms_item_confirmations").length, lockedConfirmations);
assert.equal(table("lms_course_acknowledgements").length, lockedAcknowledgements);
assert.equal(table("lms_external_link_opens").length, lockedExternalOpens);
await assert.rejects(
  academy.driverCertify({ data: { signature_name: "Alicia Grant" } }),
  /modules 1 through 5/i,
);
setDemoUserId(adminId);
await assert.rejects(
  academy.verifyOnboarding({
    data: { driver_id: driverId, note: "Verification before requirements" },
  }),
  /modules 1 through 5/i,
);
setDemoUserId(driverId);

// Strict lesson input and the server-enforced minimum review duration.
const firstLesson = lessonsFor(1)[0]!;
await academy.openLesson({ data: { lesson_id: String(firstLesson["id"]) } });
const firstOpen = table("lms_lesson_opens").find(
  (row) => row["user_id"] === driverId && row["lesson_id"] === firstLesson["id"],
)!;
await assert.rejects(
  academy.completeLesson({ data: { lesson_id: String(firstLesson["id"]), completed: true } }),
  /Unrecognized key/i,
  "completeLesson strictly rejects a caller-supplied completed flag",
);
await assert.rejects(
  academy.completeLesson({ data: { lesson_id: String(firstLesson["id"]) } }),
  { message: "Please finish reviewing this lesson" },
  "completing before the default 20 seconds fails with the current server error",
);
assert.equal(table("lms_lesson_progress").length, 0);
firstOpen["opened_at"] = new Date(Date.now() - 21_000).toISOString();
await academy.completeLesson({ data: { lesson_id: String(firstLesson["id"]) } });
assert.equal(
  table("lms_lesson_progress").find(
    (row) => row["user_id"] === driverId && row["lesson_id"] === firstLesson["id"],
  )?.["completed"],
  true,
  "lesson completion succeeds after the required review time",
);
await assert.rejects(submitQuiz(1, true), /Complete every lesson/i);
await openAndCompleteLessons(1);
const failedQuiz = await submitQuiz(1, false);
assert.equal(failedQuiz.passed, false);
let result = await evaluation(1);
assert.equal(result.complete, false, "a failing quiz prevents course completion");
assert.ok(result.missing.includes("quiz"));
assert.ok(result.missing.includes("acknowledgement"));
await assert.rejects(signCourseAcknowledgement(1), /lessons and quiz/i);
const passedQuiz = await submitQuiz(1, true);
assert.equal(passedQuiz.passed, true);
result = await evaluation(1);
assert.equal(result.complete, false, "module 1 still requires its signed course acknowledgement");
assert.deepEqual(result.missing, ["acknowledgement"]);
const courseOneAck = await signCourseAcknowledgement(1);
assert.equal(courseOneAck["signature_name"], "Alicia Grant");
result = await evaluation(1);
assert.equal(
  result.complete,
  true,
  "module 1 completes after lessons, passing quiz, and acknowledgement",
);

// Module 2 derives completion only from the effective current 6A handbook signature.
table("lms_course_acknowledgements").push({
  id: "bbbbbbbb-0000-4000-a000-000000000001",
  user_id: driverId,
  course_id: courseId(2),
  signature_name: "Not a handbook signature",
  created_at: new Date().toISOString(),
});
result = await evaluation(2);
assert.equal(result.complete, false);
assert.deepEqual(
  result.missing,
  ["handbook_signed"],
  "a course acknowledgement cannot satisfy derived handbook evidence",
);
const handbookView = await handbook.getHandbook();
assert.equal(handbookView.version?.["version_label"], "6A");
const handbookReceipt = await handbook.signHandbook({
  data: {
    version_id: String(handbookView.version?.["id"]),
    signature_name: "Alicia Grant",
    agreed: true,
  },
});
assert.equal(handbookReceipt["version_label"], "6A");
result = await evaluation(2);
assert.equal(
  result.complete,
  true,
  "module 2 completes from the current 6A handbook acknowledgement alone",
);
assert.deepEqual(result.missing, []);

// Module 3 only completes after lessons, a passing quiz, and all three configured confirmations.
await academy.startCourse({ data: { course_id: courseId(3) } });
await academy.logExternalLinkOpened({
  data: { course_id: courseId(3), link_key: String(lockedLink["slug"]) },
});
result = await evaluation(3);
assert.equal(result.complete, false, "opening an external link never completes a module");
assert.ok(result.missing.includes("lessons"));
assert.ok(result.missing.includes("quiz"));
assert.deepEqual(
  result.missing.filter((item) => requiredConfirmations.includes(item)),
  requiredConfirmations,
);
assert.equal(
  result.missing.includes("external_link_open"),
  false,
  "external-link events are not completion evidence",
);
await assert.rejects(
  academy.confirmItem({ data: { course_id: courseId(3), item_key: "Unconfigured confirmation" } }),
  /not configured/i,
  "only the exact seeded confirmation keys are accepted",
);
await openAndCompleteLessons(3);
await assert.rejects(
  academy.confirmItem({ data: { course_id: courseId(3), item_key: requiredConfirmations[0]! } }),
  /lessons and quiz/i,
  "confirmation cannot bypass a missing quiz",
);
assert.equal((await submitQuiz(3, true)).passed, true);
result = await evaluation(3);
assert.equal(result.complete, false);
assert.deepEqual(result.missing, requiredConfirmations);
for (const itemKey of requiredConfirmations) {
  await academy.confirmItem({ data: { course_id: courseId(3), item_key: itemKey } });
}
result = await evaluation(3);
assert.equal(
  result.complete,
  true,
  "all configured confirmations plus lessons and quiz complete module 3",
);
assert.deepEqual(result.missing, []);
assert.equal(
  table("lms_external_link_opens").some(
    (row) => row["user_id"] === driverId && row["course_id"] === courseId(3),
  ),
  true,
  "module 3 completed despite external-link activity being non-evidence",
);

// Modules 4 and 5 each need lessons, a passing quiz, and a signed acknowledgement.
for (const number of [4, 5]) {
  await academy.startCourse({ data: { course_id: courseId(number) } });
  await assert.rejects(signCourseAcknowledgement(number), /lessons and quiz/i);
  await openAndCompleteLessons(number);
  assert.equal((await submitQuiz(number, true)).passed, true);
  result = await evaluation(number);
  assert.equal(result.complete, false);
  assert.deepEqual(result.missing, ["acknowledgement"]);
  await signCourseAcknowledgement(number);
  result = await evaluation(number);
  assert.equal(
    result.complete,
    true,
    `module ${number} completes with lessons, quiz, and acknowledgement`,
  );
}

// Course 6 requires modules 1-5, driver certification, then an admin verification with a note.
result = await evaluation(6);
assert.equal(result.complete, false);
assert.deepEqual(result.missing, ["certification", "management_verification"]);
setDemoUserId(adminId);
await assert.rejects(
  academy.verifyOnboarding({ data: { driver_id: driverId, note: "Missing certification" } }),
  /certify Academy completion first/i,
);
setDemoUserId(driverId);
const certification = await academy.driverCertify({ data: { signature_name: "Alicia Grant" } });
assert.deepEqual(certification["course_ids"], courseIds.slice(0, 5));
assert.equal(certification["signature_name"], "Alicia Grant");
assert.match(String(certification["statement"]), /modules 1 through 5/i);
result = await evaluation(6);
assert.equal(
  result.complete,
  false,
  "driver certification alone does not satisfy management verification",
);
assert.deepEqual(result.missing, ["management_verification"]);
setDemoUserId(adminId);
const verificationNote = "Reviewed module completions and driver certification.";
const verification = await academy.verifyOnboarding({
  data: { driver_id: driverId, note: verificationNote },
});
assert.equal(verification["driver_id"], driverId);
assert.equal(verification["verified_by"], adminId);
assert.equal(verification["note"], verificationNote);
assert.deepEqual(verification["course_ids"], courseIds.slice(0, 5));
assert.equal((await academy.evaluateModule(driverId, courseId(6))).complete, true);

// Role and target isolation: non-admin roles cannot read/manage, and another driver cannot access this driver's records.
const targetRecordSnapshot = () =>
  JSON.stringify({
    progress: table("lms_lesson_progress").filter((row) => row["user_id"] === driverId),
    starts: table("lms_course_starts").filter((row) => row["user_id"] === driverId),
    opens: table("lms_lesson_opens").filter((row) => row["user_id"] === driverId),
    attempts: table("lms_quiz_attempts").filter((row) => row["user_id"] === driverId),
    confirmations: table("lms_item_confirmations").filter((row) => row["user_id"] === driverId),
    acknowledgements: table("lms_course_acknowledgements").filter(
      (row) => row["user_id"] === driverId,
    ),
    externalLinks: table("lms_external_link_opens").filter((row) => row["user_id"] === driverId),
    enrollments: table("lms_enrollments").filter((row) => row["user_id"] === driverId),
    certifications: table("lms_driver_certifications").filter((row) => row["user_id"] === driverId),
    verifications: table("lms_onboarding_verifications").filter(
      (row) => row["driver_id"] === driverId,
    ),
    audits: table("lms_audit_logs"),
  });
const beforeAccessChecks = targetRecordSnapshot();
for (const userId of [recruiterId, contentManagerId]) {
  setDemoUserId(userId);
  await assert.rejects(academy.getAcademyOverview(), /permission/i);
  await assert.rejects(academy.getCourse({ data: { slug: "welcome" } }), /permission/i);
  assert.throws(() => academy.evaluateModule(driverId, courseId(1)), /permission/i);
  await assert.rejects(academy.listDriverOnboarding(), /permission/i);
  await assert.rejects(
    academy.resetModule({
      data: { user_id: driverId, course_id: courseId(1), reason: "Unauthorized reset" },
    }),
    /permission/i,
  );
  await assert.rejects(
    academy.verifyOnboarding({ data: { driver_id: driverId, note: "Unauthorized verification" } }),
    /permission/i,
  );
}
setDemoUserId(otherDriverId);
const otherDriverCourse = await academy.getCourse({ data: { slug: "welcome" } });
assert.deepEqual(otherDriverCourse.progress, [], "other driver cannot read target lesson progress");
assert.deepEqual(otherDriverCourse.attempts, [], "other driver cannot read target quiz attempts");
assert.equal(
  otherDriverCourse.enrollment?.["user_id"],
  otherDriverId,
  "course detail exposes only the current driver's enrollment",
);
assert.equal(otherDriverCourse.enrollment?.["status"], "not_started");
assert.throws(
  () => academy.evaluateModule(driverId, courseId(1)),
  /another driver's Academy records/i,
);
await assert.rejects(
  academy.resetModule({
    data: { user_id: driverId, course_id: courseId(1), reason: "Try resetting target" },
  }),
  /administrator/i,
);
setDemoUserId(driverId);
await assert.rejects(
  academy.resetModule({
    data: { user_id: otherDriverId, course_id: courseId(1), reason: "Reset another driver" },
  }),
  /administrator/i,
);
setDemoUserId(adminId);
await assert.rejects(
  academy.verifyOnboarding({ data: { driver_id: recruiterId, note: "Not a driver" } }),
  /only available for drivers/i,
);
assert.equal(
  targetRecordSnapshot(),
  beforeAccessChecks,
  "failed access attempts did not alter target records",
);

// Admin reset preserves evidence history, supersedes affected events, requires a reason, and is audited.
const evidenceTables = [
  "lms_course_starts",
  "lms_lesson_opens",
  "lms_lesson_progress",
  "lms_quiz_attempts",
  "lms_external_link_opens",
  "lms_item_confirmations",
  "lms_course_acknowledgements",
];
const affectedBefore = Object.fromEntries(
  evidenceTables.map((name) => [
    name,
    table(name).filter((row) => row["user_id"] === driverId && row["course_id"] === courseId(3))
      .length,
  ]),
);
await assert.rejects(
  academy.resetModule({ data: { user_id: driverId, course_id: courseId(3), reason: "bad" } }),
);
const resetReason = "Manager requested retraining";
const reset = await academy.resetModule({
  data: { user_id: driverId, course_id: courseId(3), reason: resetReason },
});
assert.deepEqual(reset.affected_course_ids, [courseId(3)]);
for (const name of evidenceTables) {
  const rows = table(name).filter(
    (row) => row["user_id"] === driverId && row["course_id"] === courseId(3),
  );
  assert.equal(rows.length, affectedBefore[name], `${name} evidence history remains after reset`);
  assert.ok(
    rows.every((row) => typeof row["superseded_at"] === "string"),
    `${name} evidence is superseded, not deleted`,
  );
}
assert.equal(
  table("lms_driver_certifications").find((row) => row["user_id"] === driverId)?.[
    "superseded_at"
  ] != null,
  true,
  "reset supersedes certification history",
);
assert.equal(
  table("lms_onboarding_verifications").find((row) => row["driver_id"] === driverId)?.[
    "superseded_at"
  ] != null,
  true,
  "reset supersedes verification history",
);
const resetAudit = table("lms_audit_logs").find((row) => row["action"] === "academy_module_reset")!;
assert.equal(resetAudit["actor_id"], adminId);
assert.equal(resetAudit["target_id"], courseId(3));
assert.equal((resetAudit["metadata"] as Record<string, unknown>)["user_id"], driverId);
assert.equal((resetAudit["metadata"] as Record<string, unknown>)["reason"], resetReason);
assert.equal(
  table("audit_logs").some(
    (row) => row["action"] === "academy_module_reset" && row["actor_id"] === adminId,
  ),
  true,
  "reset is also written to the shared audit log",
);

console.log("Academy tests passed.");
