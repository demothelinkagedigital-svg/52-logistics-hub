import assert from "node:assert/strict";
import * as academy from "../src/lib/lms.functions";
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

resetDb();
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
const moduleFor = (number: number) =>
  table("lms_modules").find((row) => row["course_id"] === courseId(number))!;
const quizFor = (number: number) =>
  table("lms_quizzes").find((row) => row["course_id"] === courseId(number))!;
const currentSignature = table("handbook_versions")[0]!;

assert.equal(courses.length, 6, "seed has six Academy modules");
assert.equal(table("lms_lesson_progress").length, 0);
assert.equal(table("lms_quiz_attempts").length, 0);
assert.equal("setLessonComplete" in academy, false, "there is no setLessonComplete API");
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
  "the server API has no direct lesson-completion setter",
);

// A course is locked until its prerequisite completes, including direct action calls.
await assert.rejects(academy.startCourse({ data: { course_id: courseId(2) } }), /prerequisite/i);
await assert.rejects(
  academy.openLesson({ data: { lesson_id: lessonsFor(2)[0]!["id"] } }),
  /prerequisite/i,
);
await assert.rejects(academy.driverCertify({ data: {} }), /modules 1 through 5/i);
setDemoUserId(adminId);
await assert.rejects(
  academy.verifyOnboarding({ data: { user_id: driverId } }),
  /modules 1 through 5/i,
);
setDemoUserId(driverId);

const openAndCompleteLessons = async (number: number) => {
  for (const lesson of lessonsFor(number)) {
    const id = String(lesson["id"]);
    await academy.openLesson({ data: { lesson_id: id } });
    const opened = table("lms_lesson_opens").find(
      (row) =>
        row["user_id"] === driverId && row["lesson_id"] === id && row["superseded_at"] == null,
    )!;
    opened["opened_at"] = new Date(
      Date.now() - (Number(lesson["min_view_seconds"]) + 2) * 1000,
    ).toISOString();
    await academy.completeLesson({ data: { lesson_id: id } });
  }
};
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

// Timed lesson completion cannot be forged by including a completed flag.
const firstLesson = lessonsFor(1)[0]!;
firstLesson["min_view_seconds"] = 30;
await academy.openLesson({ data: { lesson_id: String(firstLesson["id"]) } });
const firstOpen = table("lms_lesson_opens").find(
  (row) => row["user_id"] === driverId && row["lesson_id"] === firstLesson["id"],
)!;
await assert.rejects(
  academy.completeLesson({ data: { lesson_id: String(firstLesson["id"]), completed: true } }),
  /at least 30 seconds/i,
);
assert.equal(
  table("lms_lesson_progress").some(
    (row) => row["user_id"] === driverId && row["lesson_id"] === firstLesson["id"],
  ),
  false,
  "a failed timing check records no completion evidence",
);
firstOpen["opened_at"] = new Date(Date.now() - 31_000).toISOString();
await academy.completeLesson({ data: { lesson_id: String(firstLesson["id"]) } });
assert.equal(
  table("lms_lesson_progress").find(
    (row) => row["lesson_id"] === firstLesson["id"] && row["user_id"] === driverId,
  )?.["completed"],
  true,
  "lesson completion succeeds after the minimum review time",
);
await assert.rejects(submitQuiz(1, true), /every lesson/i);
await openAndCompleteLessons(1);
const failedAttempt = await submitQuiz(1, false);
assert.equal(failedAttempt.passed, false);
let evaluation = await academy.evaluateModule({ data: { course_id: courseId(1) } });
assert.equal(evaluation.completed, false, "a failing quiz prevents course completion");
assert.ok(evaluation.missing_requirements.includes("quiz"));
const passedAttempt = await submitQuiz(1, true);
assert.equal(passedAttempt.passed, true);
evaluation = await academy.evaluateModule({ data: { course_id: courseId(1) } });
assert.equal(evaluation.completed, true, "all lessons plus a passing quiz completes module 1");

// Module 2 requires both the current handbook signature and its specific acknowledgement.
await academy.startCourse({ data: { course_id: courseId(2) } });
await openAndCompleteLessons(2);
await assert.rejects(
  academy.acknowledgeModule({ data: { module_id: String(moduleFor(2)["id"]) } }),
  /other course requirements|sign the current handbook/i,
);
evaluation = await academy.evaluateModule({ data: { course_id: courseId(2) } });
assert.equal(evaluation.completed, false);
assert.ok(evaluation.missing_requirements.includes("current_handbook_signature"));
assert.ok(evaluation.missing_requirements.includes("module_acknowledgement"));
table("handbook_acknowledgements").push({
  id: "bbbbbbbb-0000-4000-a000-000000000001",
  user_id: driverId,
  handbook_version_id: currentSignature["id"],
  signed_at: new Date().toISOString(),
});
await academy.acknowledgeModule({ data: { module_id: String(moduleFor(2)["id"]) } });
evaluation = await academy.evaluateModule({ data: { course_id: courseId(2) } });
assert.equal(
  evaluation.completed,
  true,
  "module 2 completes through its 6A handbook acknowledgement after signing",
);

// Module 3's external link cannot bypass lesson and quiz requirements or complete a course alone.
await academy.startCourse({ data: { course_id: courseId(3) } });
const system = table("required_systems").find((row) => row["published"] === true)!;
await assert.rejects(
  academy.logExternalLinkOpened({
    data: { course_id: courseId(3), item_id: String(system["id"]) },
  }),
  /other course requirements/i,
);
assert.equal((await academy.evaluateModule({ data: { course_id: courseId(3) } })).completed, false);
await openAndCompleteLessons(3);
assert.equal((await submitQuiz(3, true)).passed, true);
evaluation = await academy.evaluateModule({ data: { course_id: courseId(3) } });
assert.equal(
  evaluation.completed,
  false,
  "module 3 remains incomplete until its external link is opened",
);
assert.ok(evaluation.missing_requirements.includes("external_link_open"));
await academy.logExternalLinkOpened({
  data: { course_id: courseId(3), item_id: String(system["id"]) },
});
assert.equal((await academy.evaluateModule({ data: { course_id: courseId(3) } })).completed, true);

// Module 4 requires confirmation after lesson and quiz evidence.
await academy.startCourse({ data: { course_id: courseId(4) } });
await assert.rejects(
  academy.confirmItem({ data: { course_id: courseId(4), item_id: String(moduleFor(4)["id"]) } }),
  /other course requirements/i,
);
await openAndCompleteLessons(4);
assert.equal((await submitQuiz(4, true)).passed, true);
evaluation = await academy.evaluateModule({ data: { course_id: courseId(4) } });
assert.equal(evaluation.completed, false);
assert.ok(evaluation.missing_requirements.includes("item_confirmation"));
await academy.confirmItem({
  data: { course_id: courseId(4), item_id: String(moduleFor(4)["id"]) },
});
assert.equal((await academy.evaluateModule({ data: { course_id: courseId(4) } })).completed, true);

// Module 5 requires its acknowledgement; certification and verification are gated on modules 1-5.
await academy.startCourse({ data: { course_id: courseId(5) } });
await assert.rejects(
  academy.acknowledgeModule({ data: { module_id: String(moduleFor(5)["id"]) } }),
  /other course requirements/i,
);
await openAndCompleteLessons(5);
assert.equal((await submitQuiz(5, true)).passed, true);
evaluation = await academy.evaluateModule({ data: { course_id: courseId(5) } });
assert.equal(evaluation.completed, false);
assert.ok(evaluation.missing_requirements.includes("module_acknowledgement"));
await academy.acknowledgeModule({ data: { module_id: String(moduleFor(5)["id"]) } });
assert.equal((await academy.evaluateModule({ data: { course_id: courseId(5) } })).completed, true);
const certification = await academy.driverCertify({ data: {} });
assert.deepEqual(certification["course_ids"], courseIds.slice(0, 5));
setDemoUserId(adminId);
const verification = await academy.verifyOnboarding({ data: { user_id: driverId } });
assert.equal(verification["verified_by"], adminId);
assert.deepEqual(verification["course_ids"], courseIds.slice(0, 5));

// Recruiters/content managers cannot read or mutate Academy records; drivers only see their own.
const targetRecordSnapshot = () =>
  JSON.stringify({
    progress: table("lms_lesson_progress").filter((row) => row["user_id"] === driverId),
    starts: table("lms_course_starts").filter((row) => row["user_id"] === driverId),
    opens: table("lms_lesson_opens").filter((row) => row["user_id"] === driverId),
    audits: table("lms_audit_logs"),
    enrollments: table("lms_enrollments").filter((row) => row["user_id"] === driverId),
    certifications: table("lms_driver_certifications").filter((row) => row["user_id"] === driverId),
    verifications: table("lms_onboarding_verifications").filter(
      (row) => row["user_id"] === driverId,
    ),
    externalLinks: table("lms_external_link_opens").filter((row) => row["user_id"] === driverId),
    itemConfirmations: table("lms_item_confirmations").filter((row) => row["user_id"] === driverId),
    moduleAcknowledgements: table("lms_module_acknowledgements").filter(
      (row) => row["user_id"] === driverId,
    ),
  });
const evidenceBeforeAccessChecks = targetRecordSnapshot();
for (const userId of [recruiterId, contentManagerId]) {
  setDemoUserId(userId);
  await assert.rejects(academy.getAcademyOverview(), /permission/i);
  await assert.rejects(academy.getCourse({ data: { slug: "welcome" } }), /permission/i);
  await assert.rejects(academy.evaluateModule({ data: { course_id: courseId(1) } }), /permission/i);
  await assert.rejects(
    academy.resetModule({
      data: { user_id: driverId, course_id: courseId(1), reason: "Unauthorized reset" },
    }),
    /permission/i,
  );
  await assert.rejects(academy.verifyOnboarding({ data: { user_id: driverId } }), /permission/i);
}
setDemoUserId(otherDriverId);
const otherDriverCourse = await academy.getCourse({ data: { slug: "welcome" } });
assert.deepEqual(
  otherDriverCourse.progress,
  [],
  "another driver's course view contains no target lesson evidence",
);
assert.equal(otherDriverCourse.enrollment?.["user_id"], otherDriverId);
assert.equal(otherDriverCourse.enrollment?.["status"], "not_started");
assert.deepEqual(otherDriverCourse.attempts, []);
await assert.rejects(
  academy.resetModule({
    data: { user_id: driverId, course_id: courseId(1), reason: "Try resetting target" },
  }),
  /administrator/i,
);
setDemoUserId(adminId);
await assert.rejects(
  academy.verifyOnboarding({ data: { user_id: recruiterId } }),
  /only available for drivers/i,
);
assert.equal(
  targetRecordSnapshot(),
  evidenceBeforeAccessChecks,
  "failed access attempts did not change target records",
);

// Admin reset supersedes rather than deletes evidence, and records its reason in the audit trail.
const evidenceCountBeforeReset = table("lms_lesson_progress").filter(
  (row) => row["user_id"] === driverId,
).length;
const resetReason = "Manager requested retraining";
await assert.rejects(
  academy.resetModule({ data: { user_id: driverId, course_id: courseId(2), reason: "bad" } }),
);
const resetResult = await academy.resetModule({
  data: { user_id: driverId, course_id: courseId(2), reason: resetReason },
});
assert.deepEqual(resetResult.affected_course_ids, courseIds.slice(1));
assert.equal(
  table("lms_lesson_progress").filter((row) => row["user_id"] === driverId).length,
  evidenceCountBeforeReset,
  "reset preserves evidence rows for audit/history",
);
assert.ok(
  table("lms_lesson_progress")
    .filter((row) => row["user_id"] === driverId && row["course_id"] !== courseId(1))
    .every((row) => typeof row["superseded_at"] === "string"),
  "reset supersedes affected lesson evidence",
);
assert.equal(
  table("lms_driver_certifications").find((row) => row["user_id"] === driverId)?.[
    "superseded_at"
  ] != null,
  true,
);
assert.equal(
  table("lms_onboarding_verifications").find((row) => row["user_id"] === driverId)?.[
    "superseded_at"
  ] != null,
  true,
);
const resetAudit = table("lms_audit_logs").find((row) => row["action"] === "academy_module_reset")!;
assert.equal(resetAudit["actor_id"], adminId);
assert.equal(resetAudit["target_id"], courseId(2));
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
