/* -------------------------------------------------------------------------- */
/*  Demo data store                                                            */
/*                                                                            */
/*  The whole platform runs on this in-memory dataset instead of a database.   */
/*  In the browser it is persisted to localStorage so edits survive a reload;  */
/*  on the server it is a fresh copy of the seed data for each render.         */
/* -------------------------------------------------------------------------- */

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

const STORAGE_KEY = "52logistics-demo-db-v2";

let seeding = true;
let counter = 0;

/** Deterministic while seeding so server and browser render identical ids. */
export function uid(_prefix = "row"): string {
  counter += 1;
  const n = counter.toString(16).padStart(12, "0");
  const salt = seeding ? "000000000000" : Date.now().toString(16).padStart(12, "0").slice(-12);
  return `${n.slice(0, 8)}-${n.slice(8, 12)}-4d00-a000-${salt}`;
}

const nowIso = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

/* --------------------------------- users --------------------------------- */

export const DEMO_USERS = [
  {
    id: "11111111-1111-4111-a111-111111111111",
    email: "admin@52logistics.demo",
    full_name: "Dana Reyes",
    title: "Director of Operations",
    roles: ["administrator"],
    label: "Administrator",
    blurb: "Full access: users, roles, content, recruiting and audit trail.",
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    email: "recruiter@52logistics.demo",
    full_name: "Marcus Hill",
    title: "Senior Recruiter",
    roles: ["recruiter"],
    label: "Recruiter",
    blurb: "Application pipeline, documents, screening and e-sign tracking.",
  },
  {
    id: "33333333-3333-4333-a333-333333333333",
    email: "driver@52logistics.demo",
    full_name: "Alicia Grant",
    title: "Company Driver",
    roles: ["driver"],
    label: "Driver",
    blurb: "Driver hub, Academy courses, handbook and safety center.",
  },
  {
    id: "44444444-4444-4444-a444-444444444444",
    email: "applicant@52logistics.demo",
    full_name: "Tyrone Baker",
    title: "Applicant",
    roles: ["applicant"],
    label: "Applicant",
    blurb: "The six-step driver application with save and resume.",
  },
  {
    id: "55555555-5555-4555-a555-555555555555",
    email: "content@52logistics.demo",
    full_name: "Priya Nair",
    title: "Content Manager",
    roles: ["content_manager"],
    label: "Content Manager",
    blurb: "Jobs, announcements, FAQs, handbook and Academy content.",
  },
] as const;

export type DemoUserId = (typeof DEMO_USERS)[number]["id"];

/* --------------------------------- seed ---------------------------------- */

const COURSE = {
  orientation: "c1000000-0000-4000-a000-000000000001",
  handbook: "c1000000-0000-4000-a000-000000000002",
  systems: "c1000000-0000-4000-a000-000000000003",
  safety: "c1000000-0000-4000-a000-000000000004",
  yard: "c1000000-0000-4000-a000-000000000005",
  hos: "c1000000-0000-4000-a000-000000000006",
};

function courseSeed(
  id: string,
  slug: string,
  title: string,
  summary: string,
  category: string,
  minutes: number,
  required: boolean,
  sort: number,
) {
  return {
    id,
    slug,
    title,
    summary,
    description: `${summary} This course is part of the 52 Logistics Driver Academy and combines short lessons with a knowledge check.`,
    category,
    image_url: null,
    difficulty: sort <= 2 ? "beginner" : "intermediate",
    estimated_minutes: minutes,
    objectives: [
      "Understand the standards 52 Logistics expects on every run",
      "Know where to find the policy and who to contact",
      "Pass the knowledge check with 80% or better",
    ],
    owner_label: "Safety & Compliance",
    is_required: required,
    published: true,
    sort_order: sort,
    archived_at: null,
    created_at: daysAgo(120),
    updated_at: daysAgo(10),
  };
}

function lessonsFor(courseId: string, moduleId: string, titles: string[], startSort = 1) {
  return titles.map((title, i) => ({
    id: `${courseId.slice(0, 28)}${(startSort + i).toString().padStart(2, "0")}l${i}`.slice(0, 36),
    course_id: courseId,
    module_id: moduleId,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    lesson_type: "text",
    body: `## ${title}\n\nThis is demo learning content for the 52 Logistics Driver Academy. In a live deployment this section holds the written policy, supporting photos and a short video walkthrough.\n\n- Review the standard before your next dispatch\n- Ask your fleet manager if anything is unclear\n- Complete the knowledge check at the end of the course`,
    media_url: null,
    duration_minutes: 6,
    sort_order: startSort + i,
    published: true,
    created_at: daysAgo(120),
    updated_at: daysAgo(20),
  }));
}

function buildCourseContent() {
  const modules: Row[] = [];
  const lessons: Row[] = [];
  const quizzes: Row[] = [];
  const questions: Row[] = [];

  const plan: Array<[string, string, string[][]]> = [
    [COURSE.orientation, "Welcome to 52 Logistics", [["Who we are and how we dispatch", "Your first week", "Pay, settlements and support"]]],
    [COURSE.handbook, "Driver Handbook Essentials", [["Attendance and communication", "Uniform, conduct and customer sites", "Time off and payroll basics"]]],
    [COURSE.systems, "Systems & Apps", [["ELD setup and daily use", "Dispatch messaging", "Document capture and scanning"]]],
    [COURSE.safety, "Safety Fundamentals", [["Pre-trip and post-trip inspection", "Defensive driving and following distance", "Incident and accident reporting"]]],
    [COURSE.yard, "Yard & Dock Operations", [["Yard entry and check-in", "Backing, spotting and coupling", "Dock etiquette and detention"]]],
    [COURSE.hos, "Hours of Service", [["The 11 and 14 hour rules", "Breaks, sleeper berth and restarts", "Logging exceptions correctly"]]],
  ];

  plan.forEach(([courseId, moduleTitle, groups], ci) => {
    const moduleId = `m${courseId.slice(1)}`;
    modules.push({
      id: moduleId,
      course_id: courseId,
      title: moduleTitle,
      summary: `Core lessons for ${moduleTitle.toLowerCase()}.`,
      sort_order: 1,
      published: true,
      created_at: daysAgo(120),
      updated_at: daysAgo(20),
    });
    groups.forEach((titles) => lessons.push(...lessonsFor(courseId, moduleId, titles)));

    const quizId = `q${courseId.slice(1)}`;
    quizzes.push({
      id: quizId,
      course_id: courseId,
      title: "Knowledge check",
      description: "Answer each question. You need 80% to pass.",
      passing_score: 80,
      max_attempts: 3,
      published: true,
      created_at: daysAgo(120),
      updated_at: daysAgo(20),
    });

    const qBank = [
      {
        prompt: "Who do you contact first when a load is running late?",
        options: ["Your dispatcher", "The customer", "Nobody, just keep driving", "Payroll"],
        correct: ["Your dispatcher"],
        explanation: "Dispatch owns customer communication and will update the receiver.",
      },
      {
        prompt: "How soon must an incident be reported?",
        options: ["Immediately", "Within a week", "At your next home time", "Only if there is damage"],
        correct: ["Immediately"],
        explanation: "Every incident is reported immediately, regardless of severity.",
      },
      {
        prompt: "What is the minimum passing score for this course?",
        options: ["80%", "50%", "65%", "100%"],
        correct: ["80%"],
        explanation: "All Academy knowledge checks require 80% or better.",
      },
    ];
    qBank.forEach((q, qi) => {
      questions.push({
        id: `${quizId.slice(0, 34)}${ci}${qi}`,
        quiz_id: quizId,
        prompt: q.prompt,
        question_type: "single_choice",
        options: q.options,
        correct_answers: q.correct,
        explanation: q.explanation,
        sort_order: qi + 1,
        created_at: daysAgo(120),
      });
    });
  });

  return { modules, lessons, quizzes, questions };
}

function seed(): Tables {
  const lms = buildCourseContent();
  const applicantId = DEMO_USERS[3].id;
  const driverId = DEMO_USERS[2].id;
  const recruiterId = DEMO_USERS[1].id;
  const adminId = DEMO_USERS[0].id;

  const openingSummary =
    "Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. 'Until finished' does not promise a fixed end time.";

  const jobs = [
    ["Linehaul URR", "linehaul-urr-sun-thu", "Sunday–Thursday", "9:30 AM until finished", "linehaul"],
    ["Linehaul URR", "linehaul-urr-tue-sat", "Tuesday–Saturday", "9:30 AM until finished", "linehaul"],
    ["P&D URR", "pd-urr-mon-fri", "Monday–Friday", "9:30 AM until finished", "p&d"],
    ["Hybrid URR", "hybrid-urr-mon-fri-day", "Monday–Friday", "2:00 PM–1:00 AM", "hybrid"],
    ["Hybrid URR", "hybrid-urr-mon-fri-evening", "Monday–Friday", "4:00 PM–11:00 PM", "hybrid"],
    ["Spare URR", "spare-urr-fri-mon", "Friday–Monday", "Times TBD", "spare"],
  ].map(([position, slug, days, schedule, work_category], i) => ({
    id: `j0000000-0000-4000-a000-00000000000${i + 1}`,
    position,
    slug,
    days,
    schedule,
    location: "Harrisburg, PA",
    summary: openingSummary,
    requirements: [],
    responsibilities: [],
    experience_notes: null,
    pay_notes: null,
    benefits_notes: null,
    equipment_notes: null,
    employment_type: "",
    work_category,
    application_deadline: null,
    status: "open",
    published: true,
    sort_order: i + 1,
    archived_at: null,
    created_at: daysAgo(60 - i),
    updated_at: daysAgo(5),
  }));

  const applications = [
    { first: "Tyrone", last: "Baker", user_id: applicantId, status: "draft", step: 3, ref: "52L-1001" },
    { first: "Sandra", last: "Willis", user_id: uid(), status: "submitted", step: 6, ref: "52L-1002" },
    { first: "Kevin", last: "Ortiz", user_id: uid(), status: "under_review", step: 6, ref: "52L-1003" },
    { first: "Denise", last: "Coleman", user_id: uid(), status: "corrections_requested", step: 6, ref: "52L-1004" },
    { first: "Raymond", last: "Fields", user_id: uid(), status: "conditional_offer", step: 6, ref: "52L-1005" },
    { first: "Latoya", last: "Simms", user_id: uid(), status: "hired", step: 6, ref: "52L-1006" },
    { first: "Brian", last: "McCoy", user_id: uid(), status: "rejected", step: 6, ref: "52L-1007" },
  ].map((a, i) => ({
    id: `a0000000-0000-4000-a000-00000000000${i + 1}`,
    user_id: a.user_id,
    job_id: jobs[i % jobs.length]!.id,
    reference_code: a.ref,
    first_name: a.first,
    last_name: a.last,
    preferred_name: a.first,
    email: `${a.first.toLowerCase()}.${a.last.toLowerCase()}@example.com`,
    phone: `717-555-01${(10 + i).toString()}`,
    preferred_contact_method: i % 2 ? "email" : "phone",
    city: "Harrisburg",
    state: "PA",
    postal_code: "17101",
    is_18_or_older: true,
    position_title: jobs[i % jobs.length]!.position,
    cdl_status: "valid_cdl",
    cdl_class: "A",
    cdl_state: "PA",
    endorsements: i % 2 ? ["Tanker"] : ["Doubles/Triples"],
    commercial_experience_years: 2 + i,
    tractor_trailer_experience: true,
    linehaul_pd_experience: true,
    schedule_availability: [jobs[i % jobs.length]!.days],
    start_availability: "Two weeks notice",
    medical_card_status: "current",
    medical_card_expiration_month: 1,
    medical_card_expiration_year: 2027,
    authorized_to_work: true,
    can_perform_duties_with_or_without_accommodation: true,
    agrees_to_comply: a.status !== "draft",
    consent_electronic_records: a.status !== "draft",
    how_did_you_hear: "Indeed",
    signature_name: a.status === "draft" ? null : `${a.first} ${a.last}`,
    signature_signed_at: a.status === "draft" ? null : daysAgo(14 - i),
    certified: a.status !== "draft",
    correction_notes: a.status === "corrections_requested" ? "Your medical card upload is unreadable — please re-upload a clear photo." : null,
    status: a.status,
    current_step: a.step,
    submitted_at: a.status === "draft" ? null : daysAgo(14 - i),
    created_at: daysAgo(20 - i),
    updated_at: daysAgo(3),
  }));

  const documents = applications.slice(1, 5).flatMap((app, i) => [
    {
      id: `d0000000-0000-4000-a000-0000000000${(i * 2 + 1).toString().padStart(2, "0")}`,
      application_id: app.id,
      user_id: app.user_id,
      doc_type: "resume",
      storage_path: `${app.user_id}/resume.pdf`,
      file_name: "resume.pdf",
      mime_type: "application/pdf",
      size_bytes: 482113,
      verification_status: i === 0 ? "approved" : "pending",
      rejection_reason: null,
      verified_by: i === 0 ? recruiterId : null,
      verified_at: i === 0 ? daysAgo(6) : null,
      created_at: daysAgo(12 - i),
    },
    {
      id: `d0000000-0000-4000-a000-0000000000${(i * 2 + 2).toString().padStart(2, "0")}`,
      application_id: app.id,
      user_id: app.user_id,
      doc_type: "medical_card",
      storage_path: `${app.user_id}/medical.jpg`,
      file_name: "medical-card.jpg",
      mime_type: "image/jpeg",
      size_bytes: 331002,
      verification_status: i === 2 ? "rejected" : "pending",
      rejection_reason: i === 2 ? "Image is blurry and the expiration date is unreadable." : null,
      verified_by: i === 2 ? recruiterId : null,
      verified_at: i === 2 ? daysAgo(4) : null,
      created_at: daysAgo(12 - i),
    },
  ]);

  return {
    profiles: DEMO_USERS.map((u, i) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: `717-555-02${(10 + i).toString()}`,
      title: u.title,
      status: "active",
      created_at: daysAgo(200 - i * 10),
      updated_at: daysAgo(4),
    })),
    user_roles: DEMO_USERS.flatMap((u) =>
      u.roles.map((role) => ({ id: uid(), user_id: u.id, role, granted_by: adminId, created_at: daysAgo(150) })),
    ),
    drivers: [
      {
        id: uid(),
        user_id: driverId,
        driver_code: "52L-114",
        status: "active",
        truck_number: "1147",
        hire_date: daysAgo(400).slice(0, 10),
        position_title: "Company Driver",
        created_at: daysAgo(400),
        updated_at: daysAgo(10),
      },
    ],
    jobs,
    applications,
    application_employers: applications.slice(1, 4).map((app, i) => ({
      id: uid(),
      application_id: app.id,
      employer_name: ["Keystone Freight", "Valley Transport", "Ridge Carriers"][i],
      position_held: "Class A Driver",
      city: "Harrisburg",
      state: "PA",
      phone: "717-555-0300",
      start_date: "2020-03-01",
      end_date: "2023-09-15",
      reason_for_leaving: "Better home time",
      was_dot_regulated: true,
      current_employer: false,
      commercial_driving_relevant: true,
      permission_to_contact: true,
      equipment_operated: "Dry van, 53'",
      sort_order: 0,
      created_at: daysAgo(12),
    })),
    application_documents: documents,
    application_notes: [
      {
        id: uid(),
        application_id: applications[2]!.id,
        author_id: recruiterId,
        body: "Phone screen completed — interested in linehaul work and schedule options.",
        created_at: daysAgo(5),
      },
    ],
    application_events: applications.slice(1).flatMap((app) => [
      {
        id: uid(),
        application_id: app.id,
        actor_id: app.user_id,
        event_type: "submitted",
        description: "Application submitted",
        metadata: {},
        created_at: app.submitted_at ?? daysAgo(10),
      },
      {
        id: uid(),
        application_id: app.id,
        actor_id: recruiterId,
        event_type: "status_change",
        description: `Status set to ${app.status}`,
        metadata: { status: app.status },
        created_at: daysAgo(3),
      },
    ]),
    screening_records: [
      {
        id: uid(),
        application_id: applications[4]!.id,
        status: "in_progress",
        reference_number: "FA-88231",
        initiated_at: daysAgo(4),
        status_updated_at: daysAgo(2),
        notes: "Screening in progress.",
        updated_by: recruiterId,
        created_at: daysAgo(4),
      },
    ],
    esign_records: [
      {
        id: uid(),
        application_id: applications[4]!.id,
        document_name: "Conditional offer letter",
        status: "sent",
        envelope_reference: "DS-4410",
        sent_at: daysAgo(2),
        completed_at: null,
        notes: null,
        updated_by: recruiterId,
        created_at: daysAgo(2),
      },
    ],
    site_settings: [
      { key: "recruiting_email", value: "recruiting@52logisticsinc.com", label: "Recruiting email", group_name: "contact", is_public: true, needs_verification: false, updated_at: daysAgo(30) },
      { key: "company_email", value: "office@52logisticsinc.com", label: "General email", group_name: "contact", is_public: true, needs_verification: false, updated_at: daysAgo(30) },
      { key: "address_line1", value: "510 Industrial Dr.", label: "Address line 1", group_name: "contact", is_public: true, needs_verification: true, updated_at: daysAgo(30) },
      { key: "address_city", value: "Harrisburg", label: "City", group_name: "contact", is_public: true, needs_verification: true, updated_at: daysAgo(30) },
      { key: "address_state", value: "PA", label: "State", group_name: "contact", is_public: true, needs_verification: true, updated_at: daysAgo(30) },
      { key: "address_postal", value: "17339", label: "ZIP", group_name: "contact", is_public: true, needs_verification: true, updated_at: daysAgo(30) },
      { key: "office_hours", value: "Monday–Friday, 7:00 AM – 6:00 PM ET", label: "Office hours", group_name: "contact", is_public: true, needs_verification: false, updated_at: daysAgo(30) },
      { key: "brand_qualifier", value: "52 Logistics, Inc. is an independent contracted service provider. FedEx names and marks remain the property of their respective owner.", label: "Brand qualifier", group_name: "legal", is_public: true, needs_verification: false, updated_at: daysAgo(30) },
    ],
    social_links: [],
    faqs: [
      ["Where is 52 Logistics based?", "52 Logistics, Inc. operates from the Harrisburg, Pennsylvania area, working out of FedEx Terminal 170. Harrisburg is our only operating location."],
      ["How do I apply?", "Review the current openings on the Careers page and choose Apply for This Position. The Apply page preselects that opening, and you can change the selection before emailing recruiting."],
      ["Does applying guarantee employment?", "No. Submitting an application does not guarantee employment, an interview, or any specific outcome. Every application is reviewed by a person."],
      ["What happens after I apply?", "Your inquiry goes to recruiting. A recruiter may contact you about a current opening and any next steps, including screening through First Advantage where applicable."],
      ["Should I send sensitive documents by email?", "No. Never email Social Security numbers, driver license images, background-check documents, drug-testing records, medical details, passwords, or gate-access information. Use the secure application workflow only."],
      ["Can I apply from my phone?", "Yes. You can review openings, select a position, and email recruiting from your phone."],
    ].map(([question, answer], i) => ({ id: uid(), question, answer, sort_order: i + 1, published: true })),
    page_content: [
      { id: uid(), page_key: "home", section_key: "hero", heading: "Freight that moves on time, drivers who stay.", body: "Regional and dedicated freight out of Harrisburg, PA.", approval_status: "approved", published: true, sort_order: 1 },
    ],
    audit_logs: [
      { id: uid(), actor_id: adminId, actor_email: DEMO_USERS[0].email, action: "role_granted", target_type: "user", target_id: recruiterId, metadata: { role: "recruiter" }, created_at: daysAgo(30) },
      { id: uid(), actor_id: recruiterId, actor_email: DEMO_USERS[1].email, action: "document_approved", target_type: "document", target_id: documents[0]?.id ?? null, metadata: {}, created_at: daysAgo(6) },
      { id: uid(), actor_id: adminId, actor_email: DEMO_USERS[0].email, action: "jobs_updated", target_type: "jobs", target_id: jobs[0]!.id, metadata: { fields: ["summary"] }, created_at: daysAgo(5) },
    ],
    announcements: [
      { id: uid(), title: "Winter driving advisory", body: "Chain laws are in effect on I-80 west of Bellefonte. Slow down and report any delays to dispatch.", audience: "drivers", priority: "high", status: "published", publish_at: daysAgo(2), expires_at: daysAhead(20), attachment_url: null, requires_acknowledgement: true, pinned: true, published: true, created_at: daysAgo(2) },
      { id: uid(), title: "New settlement portal", body: "Weekly settlements are now posted every Tuesday by 5 PM in the driver portal.", audience: "drivers", priority: "normal", status: "published", publish_at: daysAgo(9), expires_at: null, attachment_url: null, requires_acknowledgement: false, pinned: false, published: true, created_at: daysAgo(9) },
    ],
    academy_modules: [
      { id: uid(), title: "Orientation overview", slug: "orientation-overview", summary: "What to expect during your first week.", body: "Demo content.", published: true, sort_order: 1 },
      { id: uid(), title: "Safety refresher", slug: "safety-refresher", summary: "Annual safety refresher material.", body: "Demo content.", published: true, sort_order: 2 },
    ],
    academy_progress: [],
    handbook_sections: [
      ["Attendance & communication", "conduct", "Call dispatch at least two hours before your start time if you cannot make a shift."],
      ["Uniform & appearance", "conduct", "Company shirt, closed-toe boots and a high-visibility vest on all customer sites."],
      ["Pay & settlements", "payroll", "Settlements post weekly on Tuesday. Questions go to payroll within 10 days."],
      ["Time off requests", "payroll", "Submit time off at least 14 days ahead through your fleet manager."],
      ["Accident procedure", "safety", "Secure the scene, call 911 if needed, then call the safety line immediately."],
    ].map(([title, category, body], i) => ({
      id: uid(),
      slug: String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title,
      category,
      body,
      published: true,
      sort_order: i + 1,
    })),
    handbook_versions: [
      { id: uid(), version_label: "2026.1", title: "Driver Handbook", description: "Current handbook effective January 2026.", document_url: null, storage_path: null, effective_date: daysAgo(60).slice(0, 10), requires_signature: true, published: true, archived_at: null },
    ],
    safety_resources: [
      ["Pre-trip inspection checklist", "inspection", "Walk the full circle check before every departure."],
      ["Winter operations guide", "weather", "Reduce speed, increase following distance and chain up when required."],
      ["Accident reporting packet", "incident", "Keep the packet in the cab and use it at the scene."],
    ].map(([title, category, summary], i) => ({
      id: uid(),
      title,
      summary,
      body: `${summary} This demo resource stands in for the full policy document.`,
      category,
      requires_acknowledgement: i === 2,
      published: true,
      sort_order: i + 1,
    })),
    safety_acknowledgements: [],
    safety_meetings: [
      { id: uid(), title: "Q1 safety meeting", description: "Winter operations and hours of service review.", meeting_date: daysAhead(12), mode: "virtual", audience: "drivers", instructions: "Join from the link sent to your company email.", materials_url: null, acknowledgement_deadline: daysAhead(19), status: "scheduled" },
    ],
    notifications: [
      { id: uid(), user_id: applicantId, title: "Finish your application", body: "You are on step 3 of 6. Pick up where you left off.", category: "application", link: "/portal/application", read_at: null, created_at: daysAgo(1) },
      { id: uid(), user_id: driverId, title: "New announcement", body: "Winter driving advisory posted.", category: "announcement", link: "/portal/driver", read_at: null, created_at: daysAgo(2) },
      { id: uid(), user_id: recruiterId, title: "New application received", body: "Sandra Willis applied for Linehaul URR.", category: "recruiting", link: "/portal/recruiting", read_at: daysAgo(1), created_at: daysAgo(3) },
    ],
    email_templates: [
      { id: uid(), template_key: "application_received", name: "Application received", subject: "We received your application", body: "Hi {{first_name}},\n\nThanks for applying to 52 Logistics. A recruiter will contact you within one business day.", description: "Sent automatically after submission.", variables: ["first_name"], is_active: true },
      { id: uid(), template_key: "corrections_requested", name: "Corrections requested", subject: "We need a small update to your application", body: "Hi {{first_name}},\n\n{{notes}}", description: "Sent when a recruiter requests corrections.", variables: ["first_name", "notes"], is_active: true },
    ],
    required_systems: [
      { id: uid(), name: "Samsara ELD", slug: "samsara-eld", description: "Electronic logging and vehicle inspection.", purpose: "Hours of service", official_url: "https://www.samsara.com/", ios_url: null, android_url: null, phone: null, setup_instructions: "Log in with the credentials issued at orientation.", support_info: "Safety desk, ext. 210", audience: "drivers", published: true, sort_order: 1 },
      { id: uid(), name: "TruckerPath", slug: "truckerpath", description: "Parking and fuel stop planning.", purpose: "Trip planning", official_url: "https://truckerpath.com/", ios_url: null, android_url: null, phone: null, setup_instructions: "Free account, no company login required.", support_info: null, audience: "drivers", published: true, sort_order: 2 },
    ],
    media_assets: [
      { id: uid(), title: "Fleet tractor", alt_text: "Class 8 tractor at the Harrisburg terminal", category: "fleet", storage_path: null, public_url: "/src/assets/fleet-tractor.jpg", content_type: "image/jpeg", width: 1600, height: 900, size_bytes: 240000, tags: ["fleet"], usage_notes: "Homepage hero", archived_at: null, created_at: daysAgo(20) },
    ],
    lms_courses: [
      courseSeed(COURSE.orientation, "orientation", "New Driver Orientation", "Everything you need for a smooth first week at 52 Logistics.", "onboarding", 45, true, 1),
      courseSeed(COURSE.handbook, "driver-handbook", "Driver Handbook", "The policies every 52 Logistics driver agrees to follow.", "policy", 40, true, 2),
      courseSeed(COURSE.systems, "systems-and-apps", "Systems & Apps", "ELD, dispatch messaging and document capture, step by step.", "systems", 30, true, 3),
      courseSeed(COURSE.safety, "safety-fundamentals", "Safety Fundamentals", "Inspection, defensive driving and incident reporting standards.", "safety", 50, true, 4),
      courseSeed(COURSE.yard, "yard-and-dock", "Yard & Dock Operations", "How to move safely through customer yards and docks.", "operations", 35, false, 5),
      courseSeed(COURSE.hos, "hours-of-service", "Hours of Service", "Stay compliant and log every exception the right way.", "compliance", 40, true, 6),
    ],
    lms_modules: lms.modules,
    lms_lessons: lms.lessons,
    lms_quizzes: lms.quizzes,
    lms_quiz_questions: lms.questions,
    lms_enrollments: [],
    lms_lesson_progress: [],
    lms_quiz_attempts: [],
  };
}

/* ------------------------------ persistence ------------------------------- */

let cache: Tables | null = null;

function refreshStoredDemoData(parsed: Tables, fresh: Tables) {
  const defaults = new Map(fresh.site_settings!.map((row) => [row.key, row]));
  const aliases: Record<string, string> = {
    email_recruiting: "recruiting_email",
    email_office: "company_email",
    office_email: "company_email",
  };
  const removed = new Set(["company_phone", "recruiting_phone", "dot_number", "mc_number"]);
  const oldValues: Record<string, string> = {
    recruiting_email: "recruiting@52logistics.demo",
    company_email: "info@52logistics.demo",
    address_line1: "4400 Industrial Park Road",
    address_postal: "17111",
  };
  const settings = parsed.site_settings ?? [];
  const present = new Set(settings.filter((row) => !aliases[row.key]).map((row) => row.key));
  const updated = settings.flatMap((row) => {
    if (removed.has(row.key) || aliases[row.key]) return [];
    const replacement = defaults.get(row.key);
    if (replacement && oldValues[row.key] === row.value) return [replacement];
    if (row.key.startsWith("address_")) return [{ ...row, needs_verification: true }];
    return [row];
  });
  for (const key of Object.values(aliases)) {
    if (settings.some((row) => aliases[row.key] === key) && !present.has(key)) {
      const replacement = defaults.get(key);
      if (replacement) updated.push(replacement);
    }
  }
  if (!present.has("brand_qualifier")) {
    const qualifier = defaults.get("brand_qualifier");
    if (qualifier) updated.push(qualifier);
  }
  parsed.site_settings = updated;
  parsed.social_links = (parsed.social_links ?? []).filter((row) => {
    if (typeof row.url !== "string") return true;
    try {
      const url = new URL(row.url);
      const host = url.hostname.replace(/^www\./, "");
      return !(url.pathname === "/" && ["facebook.com", "linkedin.com", "indeed.com"].includes(host));
    } catch {
      return true;
    }
  });

  const previousJobSlugs = new Set([
    "regional-class-a-driver",
    "dedicated-account-driver",
    "yard-jockey-spotter",
    "local-pd-driver",
    "weekend-shuttle-driver",
    "diesel-technician",
  ]);
  if (parsed.jobs?.some((job) => previousJobSlugs.has(job.slug))) parsed.jobs = fresh.jobs;

  const previousFaqs = new Set([
    "How long does the application take?",
    "What experience do I need?",
    "Do you run background checks?",
    "When will I hear back?",
    "Is the freight home daily?",
    "What equipment do you run?",
  ]);
  if (parsed.faqs?.some((faq) => previousFaqs.has(faq.question))) parsed.faqs = fresh.faqs;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDb(): Tables {
  if (cache) return cache;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Tables;
        const fresh = seed();
        seeding = false;
        // Merge in any tables added since the snapshot was written.
        for (const key of Object.keys(fresh)) if (!parsed[key]) parsed[key] = fresh[key]!;
        refreshStoredDemoData(parsed, fresh);
        cache = parsed;
        persist();
        return cache;
      }
    } catch {
      /* fall through to a fresh seed */
    }
  }
  cache = seed();
  seeding = false;
  persist();
  return cache;
}

export function persist() {
  if (!isBrowser() || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — demo keeps running in memory */
  }
}

export function resetDb() {
  counter = 0;
  seeding = true;
  cache = seed();
  seeding = false;
  if (isBrowser()) window.localStorage.removeItem(STORAGE_KEY);
  persist();
}

export function table(name: string): Row[] {
  const db = getDb();
  if (!db[name]) db[name] = [];
  return db[name]!;
}

export const demoTimestamps = { nowIso, daysAgo, daysAhead };
