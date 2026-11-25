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
    course_version: "1.0",
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
    id: `d2000000-0000-4000-a000-${String(Number(courseId.slice(-3)) * 100 + i + 1).padStart(12, "0")}`,
    course_id: courseId,
    module_id: moduleId,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    lesson_type: "text",
    body: "Draft content, pending owner approval",
    media_url: null,
    duration_minutes: 1,
    min_view_seconds: 20,
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

  const plan: Array<{
    courseId: string;
    title: string;
    lessonTitles: string[];
    quiz: boolean;
  }> = [
    {
      courseId: COURSE.orientation,
      title: "Welcome",
      lessonTitles: ["Welcome to 52 Logistics", "Your first steps"],
      quiz: true,
    },
    {
      courseId: COURSE.handbook,
      title: "Handbook",
      lessonTitles: ["Handbook overview", "Current handbook requirements"],
      quiz: false,
    },
    {
      courseId: COURSE.systems,
      title: "Apps & Systems",
      lessonTitles: ["Required apps", "Using company systems"],
      quiz: true,
    },
    {
      courseId: COURSE.safety,
      title: "Safety Fundamentals",
      lessonTitles: ["Core safety standards", "Incident response"],
      quiz: true,
    },
    {
      courseId: COURSE.yard,
      title: "Terminal Operating Procedures",
      lessonTitles: ["Terminal arrival and movement", "Dock and yard procedures"],
      quiz: true,
    },
    {
      courseId: COURSE.hos,
      title: "Completion Verification",
      lessonTitles: ["Completion records", "Manager verification"],
      quiz: false,
    },
  ];

  plan.forEach(({ courseId, title, lessonTitles, quiz }, ci) => {
    const courseNumber = Number(courseId.slice(-3));
    const moduleId = `d1000000-0000-4000-a000-${String(courseNumber).padStart(12, "0")}`;
    modules.push({
      id: moduleId,
      course_id: courseId,
      title,
      summary: `Core lessons for ${title.toLowerCase()}.`,
      sort_order: 1,
      published: true,
      created_at: daysAgo(120),
      updated_at: daysAgo(20),
    });
    lessons.push(...lessonsFor(courseId, moduleId, lessonTitles));
    if (!quiz) return;

    const quizId = `e1000000-0000-4000-a000-${String(courseNumber).padStart(12, "0")}`;
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
        correct: "Your dispatcher",
      },
      {
        prompt: "How soon must an incident be reported?",
        options: [
          "Immediately",
          "Within a week",
          "At your next home time",
          "Only if there is damage",
        ],
        correct: "Immediately",
      },
      {
        prompt: "What is the minimum passing score for this course?",
        options: ["80%", "50%", "65%", "100%"],
        correct: "80%",
      },
    ];
    qBank.forEach((q, qi) =>
      questions.push({
        id: `f1000000-0000-4000-a000-${String(courseNumber * 100 + qi + 1).padStart(12, "0")}`,
        quiz_id: quizId,
        prompt: q.prompt,
        question_type: "single_choice",
        options: q.options,
        correct_answers: [q.correct],
        explanation: "Review the approved course content and follow current company policy.",
        sort_order: qi + 1,
        created_at: daysAgo(120),
      }),
    );
  });
  return { modules, lessons, quizzes, questions };
}

function seed(): Tables {
  const lms = buildCourseContent();
  const driverId = DEMO_USERS[2].id;
  const recruiterId = DEMO_USERS[1].id;
  const adminId = DEMO_USERS[0].id;

  const openingSummary =
    "Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. 'Until finished' does not promise a fixed end time.";

  const jobs = [
    [
      "Linehaul URR",
      "linehaul-urr-sun-thu",
      "Sunday–Thursday",
      "9:30 AM until finished",
      "linehaul",
    ],
    [
      "Linehaul URR",
      "linehaul-urr-tue-sat",
      "Tuesday–Saturday",
      "9:30 AM until finished",
      "linehaul",
    ],
    ["P&D URR", "pd-urr-mon-fri", "Monday–Friday", "9:30 AM until finished", "p&d"],
    ["Hybrid URR", "hybrid-urr-mon-fri-day", "Monday–Friday", "2:00 PM–1:00 AM", "hybrid"],
    ["Hybrid URR", "hybrid-urr-mon-fri-evening", "Monday–Friday", "4:00 PM–11:00 PM", "hybrid"],
    ["Spare URR", "spare-urr-fri-mon", "Friday–Monday", "Times TBD", "spare"],
  ].map(([position, slug, days, schedule, work_category], i) => ({
    id: `b0000000-0000-4000-a000-0000000000${String(i + 1).padStart(2, "0")}`,
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
    {
      first: "Tyrone",
      last: "Baker",
      status: "draft",
      step: 3,
      ref: "52L-1001",
    },
    {
      first: "Sandra",
      last: "Willis",
      status: "new",
      step: 6,
      ref: "52L-1002",
    },
    {
      first: "Kevin",
      last: "Ortiz",
      status: "ready_for_review",
      step: 6,
      ref: "52L-1003",
    },
    {
      first: "Denise",
      last: "Coleman",
      status: "corrections_requested",
      step: 6,
      ref: "52L-1004",
    },
    {
      first: "Raymond",
      last: "Fields",
      status: "screening_complete_review",
      step: 6,
      ref: "52L-1005",
    },
    { first: "Latoya", last: "Simms", status: "hired", step: 6, ref: "52L-1006" },
    { first: "Brian", last: "McCoy", status: "rejected", step: 6, ref: "52L-1007" },
  ].map((a, i) => ({
    id: `a0000000-0000-4000-a000-00000000000${i + 1}`,
    user_id: null,
    assigned_recruiter_id: i === 1 || i === 3 ? recruiterId : null,
    resume_token_hash:
      i === 0 ? "35a8b2102bb067e1ec0bebef45ac4e3ca920473d36e15199248e9557b27e4660" : null,
    resume_expires_at: i === 0 ? daysAhead(30) : null,
    source: "web",
    last_saved_at: daysAgo(3),
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
    correction_notes:
      a.status === "corrections_requested"
        ? "Your medical card upload is unreadable — please re-upload a clear photo."
        : null,
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
      storage_path: `${app.id}/resume.pdf`,
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
      storage_path: `${app.id}/medical.jpg`,
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
      u.roles.map((role) => ({
        id: uid(),
        user_id: u.id,
        role,
        granted_by: adminId,
        created_at: daysAgo(150),
      })),
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
      user_id: null,
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
    application_events: [
      ...applications.slice(1).flatMap((app) => [
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
          metadata: { from: "new", to: app.status },
          created_at: daysAgo(3),
        },
      ]),
      {
        id: uid(),
        application_id: applications[4]!.id,
        actor_id: recruiterId,
        event_type: "first_advantage_handoff_update",
        description: "First Advantage handoff updated",
        metadata: {
          invitation_date: daysAgo(4).slice(0, 10),
          responsible_recruiter_id: recruiterId,
          external_case_id: "FA-88231",
          next_check_date: daysAgo(2).slice(0, 10),
          operational_note: "",
          checklist: {
            reviewed_application: { done_at: daysAgo(5), done_by: recruiterId },
            opened_employer_portal: { done_at: daysAgo(4), done_by: recruiterId },
            created_candidate_invitation: { done_at: daysAgo(4), done_by: recruiterId },
            recorded_handoff_details: { done_at: daysAgo(4), done_by: recruiterId },
            updated_application_status: { done_at: daysAgo(3), done_by: recruiterId },
          },
        },
        created_at: daysAgo(4),
      },
    ],
    esign_records: [
      {
        id: uid(),
        application_id: applications[4]!.id,
        document_name: "Offer letter",
        status: "sent",
        envelope_reference: "DS-4410",
        sent_at: daysAgo(2).slice(0, 10),
        completed_at: null,
        notes: null,
        updated_by: recruiterId,
        created_at: daysAgo(2),
      },
    ],
    site_settings: [
      {
        key: "application_resume_days",
        value: "30",
        label: "Application resume days",
        group_name: "recruiting",
        is_public: false,
        needs_verification: false,
        updated_at: daysAgo(30),
      },
      {
        key: "recruiting_email",
        value: "recruiting@52logisticsinc.com",
        label: "Recruiting email",
        group_name: "contact",
        is_public: true,
        needs_verification: false,
        updated_at: daysAgo(30),
      },
      {
        key: "company_email",
        value: "office@52logisticsinc.com",
        label: "General email",
        group_name: "contact",
        is_public: true,
        needs_verification: false,
        updated_at: daysAgo(30),
      },
      {
        key: "address_line1",
        value: "510 Industrial Dr.",
        label: "Address line 1",
        group_name: "contact",
        is_public: true,
        needs_verification: true,
        updated_at: daysAgo(30),
      },
      {
        key: "address_city",
        value: "Harrisburg",
        label: "City",
        group_name: "contact",
        is_public: true,
        needs_verification: true,
        updated_at: daysAgo(30),
      },
      {
        key: "address_state",
        value: "PA",
        label: "State",
        group_name: "contact",
        is_public: true,
        needs_verification: true,
        updated_at: daysAgo(30),
      },
      {
        key: "address_postal",
        value: "17339",
        label: "ZIP",
        group_name: "contact",
        is_public: true,
        needs_verification: true,
        updated_at: daysAgo(30),
      },
      {
        key: "office_hours",
        value: "Monday–Friday, 7:00 AM – 6:00 PM ET",
        label: "Office hours",
        group_name: "contact",
        is_public: true,
        needs_verification: false,
        updated_at: daysAgo(30),
      },
      {
        key: "brand_qualifier",
        value:
          "52 Logistics, Inc. is an independent contracted service provider. FedEx names and marks remain the property of their respective owner.",
        label: "Brand qualifier",
        group_name: "legal",
        is_public: true,
        needs_verification: false,
        updated_at: daysAgo(30),
      },
    ],
    social_links: [],
    faqs: [
      [
        "Where is 52 Logistics based?",
        "52 Logistics, Inc. operates from the Harrisburg, Pennsylvania area, working out of FedEx Terminal 170. Harrisburg is our only operating location.",
      ],
      [
        "How do I apply?",
        "Choose an opening on the Careers page and complete the secure application. You may save and return using your private resume link.",
      ],
      [
        "Does applying guarantee employment?",
        "No. Submitting an application does not guarantee employment, an interview, or any specific outcome. Every application is reviewed by a person.",
      ],
      [
        "What happens after I apply?",
        "Recruiting reviews your application. If you advance, 52 Logistics may initiate a separate screening process through First Advantage, which will contact you through its secure candidate experience.",
      ],
      [
        "Should I send sensitive documents by email?",
        "No. Never email Social Security numbers, driver license images, background-check documents, drug-testing records, medical details, passwords, or gate-access information. Use the secure application workflow only.",
      ],
      [
        "Can I apply from my phone?",
        "Yes. The complete application, signature, save/resume, and approved uploads must work on current iPhone and Android browsers.",
      ],
    ].map(([question, answer], i) => ({
      id: uid(),
      question,
      answer,
      sort_order: i + 1,
      published: true,
    })),
    page_content: [
      {
        id: uid(),
        page_key: "home",
        section_key: "hero",
        heading: "Freight that moves on time, drivers who stay.",
        body: "Regional and dedicated freight out of Harrisburg, PA.",
        approval_status: "approved",
        published: true,
        sort_order: 1,
      },
    ],
    audit_logs: [
      {
        id: uid(),
        actor_id: adminId,
        actor_email: DEMO_USERS[0].email,
        action: "role_granted",
        target_type: "user",
        target_id: recruiterId,
        metadata: { role: "recruiter" },
        created_at: daysAgo(30),
      },
      {
        id: uid(),
        actor_id: recruiterId,
        actor_email: DEMO_USERS[1].email,
        action: "document_approved",
        target_type: "document",
        target_id: documents[0]?.id ?? null,
        metadata: {},
        created_at: daysAgo(6),
      },
      {
        id: uid(),
        actor_id: adminId,
        actor_email: DEMO_USERS[0].email,
        action: "jobs_updated",
        target_type: "jobs",
        target_id: jobs[0]!.id,
        metadata: { fields: ["summary"] },
        created_at: daysAgo(5),
      },
    ],
    announcements: [
      {
        id: uid(),
        title: "Winter driving advisory",
        body: "Chain laws are in effect on I-80 west of Bellefonte. Slow down and report any delays to dispatch.",
        audience: "drivers",
        priority: "high",
        status: "published",
        publish_at: daysAgo(2),
        expires_at: daysAhead(20),
        attachment_url: null,
        requires_acknowledgement: true,
        pinned: true,
        published: true,
        created_at: daysAgo(2),
      },
      {
        id: uid(),
        title: "New settlement portal",
        body: "Weekly settlements are now posted every Tuesday by 5 PM in the driver portal.",
        audience: "drivers",
        priority: "normal",
        status: "published",
        publish_at: daysAgo(9),
        expires_at: null,
        attachment_url: null,
        requires_acknowledgement: false,
        pinned: false,
        published: true,
        created_at: daysAgo(9),
      },
    ],
    academy_modules: [
      {
        id: uid(),
        title: "Orientation overview",
        slug: "orientation-overview",
        summary: "What to expect during your first week.",
        body: "Demo content.",
        published: true,
        sort_order: 1,
      },
      {
        id: uid(),
        title: "Safety refresher",
        slug: "safety-refresher",
        summary: "Annual safety refresher material.",
        body: "Demo content.",
        published: true,
        sort_order: 2,
      },
    ],
    academy_progress: [],
    handbook_sections: [
      [
        "Attendance & communication",
        "conduct",
        "Call dispatch at least two hours before your start time if you cannot make a shift.",
      ],
      [
        "Uniform & appearance",
        "conduct",
        "Company shirt, closed-toe boots and a high-visibility vest on all customer sites.",
      ],
      [
        "Pay & settlements",
        "payroll",
        "Settlements post weekly on Tuesday. Questions go to payroll within 10 days.",
      ],
      [
        "Time off requests",
        "payroll",
        "Submit time off at least 14 days ahead through your fleet manager.",
      ],
      [
        "Accident procedure",
        "safety",
        "Secure the scene, call 911 if needed, then call the safety line immediately.",
      ],
    ].map(([title, category, body], i) => ({
      id: uid(),
      slug: String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
      title,
      category,
      body,
      published: true,
      sort_order: i + 1,
    })),
    handbook_versions: [
      {
        id: uid(),
        version_label: "2026.1",
        title: "Driver Handbook (sample content)",
        approval_state: "approved",
        description: "Sample handbook for demonstration only; verify all policies before use.",
        change_summary: "Initial sample handbook release.",
        document_url: null,
        storage_path: null,
        effective_date: daysAgo(60).slice(0, 10),
        requires_signature: true,
        published: true,
        archived_at: null,
      },
    ],
    handbook_acknowledgements: [],
    demo_migrations: [{ id: "handbook-sample-approved-v1" }],
    safety_resources: [
      [
        "Pre-trip inspection checklist",
        "inspection",
        "Walk the full circle check before every departure.",
      ],
      [
        "Winter operations guide",
        "weather",
        "Reduce speed, increase following distance and chain up when required.",
      ],
      [
        "Accident reporting packet",
        "incident",
        "Keep the packet in the cab and use it at the scene.",
      ],
    ].map(([title, category, summary], i) => ({
      id: uid(),
      title,
      summary,
      body: `${summary} This demo resource stands in for the full policy document.`,
      approval_state: "draft",
      category,
      requires_acknowledgement: i === 2,
      published: true,
      sort_order: i + 1,
    })),
    safety_acknowledgements: [],
    safety_meetings: [
      {
        id: uid(),
        title: "Q1 safety meeting",
        description: "Winter operations and hours of service review.",
        meeting_date: daysAhead(12),
        mode: "virtual",
        audience: "drivers",
        instructions: "Join from the link sent to your company email.",
        materials_url: null,
        acknowledgement_deadline: daysAhead(19),
        status: "scheduled",
      },
    ],
    notifications: [
      {
        id: uid(),
        user_id: driverId,
        title: "New announcement",
        body: "Winter driving advisory posted.",
        category: "announcement",
        link: "/portal/driver",
        read_at: null,
        created_at: daysAgo(2),
      },
      {
        id: uid(),
        user_id: recruiterId,
        title: "New application received",
        body: "Sandra Willis applied for Linehaul URR.",
        category: "recruiting",
        link: "/portal/recruiting",
        read_at: daysAgo(1),
        created_at: daysAgo(3),
      },
    ],
    email_templates: [
      {
        id: uid(),
        template_key: "application_received",
        name: "Application received",
        subject: "We received your application",
        body: "Hi {{first_name}},\n\nThanks for applying to 52 Logistics. A recruiter will contact you within one business day.",
        description: "Sent automatically after submission.",
        variables: ["first_name"],
        is_active: true,
      },
      {
        id: uid(),
        template_key: "corrections_requested",
        name: "Corrections requested",
        subject: "We need a small update to your application",
        body: "Hi {{first_name}},\n\n{{notes}}",
        description: "Sent when a recruiter requests corrections.",
        variables: ["first_name", "notes"],
        is_active: true,
      },
    ],
    required_systems: [
      {
        id: uid(),
        name: "Samsara ELD",
        slug: "samsara-eld",
        description: "Electronic logging and vehicle inspection.",
        purpose: "Hours of service",
        official_url: "https://www.samsara.com/",
        ios_url: null,
        android_url: null,
        phone: null,
        setup_instructions: "Log in with the credentials issued at orientation.",
        support_info: "Safety desk, ext. 210",
        audience: "drivers",
        published: true,
        sort_order: 1,
      },
      {
        id: uid(),
        name: "TruckerPath",
        slug: "truckerpath",
        description: "Parking and fuel stop planning.",
        purpose: "Trip planning",
        official_url: "https://truckerpath.com/",
        ios_url: null,
        android_url: null,
        phone: null,
        setup_instructions: "Free account, no company login required.",
        support_info: null,
        audience: "drivers",
        published: true,
        sort_order: 2,
      },
    ],
    media_assets: [
      {
        id: uid(),
        title: "Fleet tractor",
        alt_text: "Class 8 tractor at the Harrisburg terminal",
        category: "fleet",
        storage_path: null,
        public_url: "/src/assets/fleet-tractor.jpg",
        content_type: "image/jpeg",
        width: 1600,
        height: 900,
        size_bytes: 240000,
        tags: ["fleet"],
        usage_notes: "Homepage hero",
        archived_at: null,
        created_at: daysAgo(20),
      },
    ],
    lms_courses: [
      {
        ...courseSeed(
          COURSE.orientation,
          "welcome",
          "Welcome to 52 Logistics",
          "Welcome to the 52 Logistics Driver Academy.",
          "onboarding",
          20,
          true,
          1,
        ),
        completion_rules: { lessons: true, quiz: true, acknowledgement: true },
      },
      {
        ...courseSeed(
          COURSE.handbook,
          "handbook",
          "Handbook",
          "Review the current driver handbook and acknowledge its requirements.",
          "policy",
          20,
          true,
          2,
        ),
        completion_rules: { derived: "handbook_signed" },
      },
      {
        ...courseSeed(
          COURSE.systems,
          "apps-systems",
          "Required Apps & Systems",
          "Required applications and company systems.",
          "systems",
          20,
          true,
          3,
        ),
        completion_rules: {
          lessons: true,
          confirmations: [
            "Motive installed or access confirmed",
            "Whip Around installed or access confirmed",
            "MyFleetAI / Linehaul Central access confirmed",
          ],
          quiz: true,
        },
      },
      {
        ...courseSeed(
          COURSE.safety,
          "safety-fundamentals",
          "Safety Fundamentals",
          "Core safety standards and incident response.",
          "safety",
          20,
          true,
          4,
        ),
        completion_rules: { lessons: true, quiz: true, acknowledgement: true },
      },
      {
        ...courseSeed(
          COURSE.yard,
          "terminal-operating-procedures",
          "Terminal & Operating Procedures",
          "Safe terminal, yard and dock operations.",
          "operations",
          20,
          true,
          5,
        ),
        completion_rules: { lessons: true, quiz: true, acknowledgement: true },
      },
      {
        ...courseSeed(
          COURSE.hos,
          "completion-verification",
          "Completion & Management Verification",
          "Review completion records and manager verification.",
          "onboarding",
          20,
          true,
          6,
        ),
        completion_rules: { certification: true, management_verification: true },
      },
    ],
    lms_modules: lms.modules,
    lms_lessons: lms.lessons,
    lms_quizzes: lms.quizzes,
    lms_quiz_questions: lms.questions,
    lms_enrollments: [],
    lms_lesson_progress: [],
    lms_quiz_attempts: [],
    lms_course_starts: [],
    lms_lesson_opens: [],
    lms_external_link_opens: [],
    lms_item_confirmations: [],
    lms_course_acknowledgements: [],
    lms_module_acknowledgements: [],
    lms_driver_certifications: [],
    lms_onboarding_verifications: [],
    lms_audit_logs: [],
  };
}

/* ------------------------------ persistence ------------------------------- */

let cache: Tables | null = null;

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
        // Only upgrade the untouched legacy sample, never a user-edited release.
        const migrations = parsed["demo_migrations"] ?? [];
        if (!migrations.some((row) => row["id"] === "handbook-sample-approved-v1")) {
          const sampleId = fresh["handbook_versions"]![0]!["id"];
          const sample = (parsed["handbook_versions"] ?? []).find(
            (row) =>
              row["id"] === sampleId &&
              row["version_label"] === "2026.1" &&
              row["title"] === "Driver Handbook" &&
              row["description"] === "Current handbook effective January 2026." &&
              (row["approval_state"] === "draft" || row["approval_state"] == null) &&
              row["published"] === true &&
              row["archived_at"] == null &&
              row["document_url"] == null &&
              row["storage_path"] == null &&
              row["requires_signature"] === true &&
              row["updated_at"] == null,
          );
          if (sample) {
            sample["title"] = "Driver Handbook (sample content)";
            sample["approval_state"] = "approved";
            sample["description"] =
              "Sample handbook for demonstration only; verify all policies before use.";
            sample["change_summary"] = "Initial sample handbook release.";
          }
          migrations.push({ id: "handbook-sample-approved-v1" });
          parsed["demo_migrations"] = migrations;
        }
        // Merge in any tables added since the snapshot was written.
        for (const key of Object.keys(fresh)) if (!parsed[key]) parsed[key] = fresh[key]!;
        const academyMigration = "academy-exact-rules-v2";
        if (!(parsed["demo_migrations"] ?? []).some((row) => row["id"] === academyMigration)) {
          const supersededAt = nowIso();
          for (const name of [
            "lms_course_starts",
            "lms_lesson_opens",
            "lms_lesson_progress",
            "lms_quiz_attempts",
            "lms_external_link_opens",
            "lms_item_confirmations",
            "lms_course_acknowledgements",
            "lms_module_acknowledgements",
            "lms_enrollments",
            "lms_driver_certifications",
            "lms_onboarding_verifications",
          ]) {
            for (const row of parsed[name] ?? []) row["superseded_at"] ??= supersededAt;
          }
          for (const name of [
            "lms_courses",
            "lms_modules",
            "lms_lessons",
            "lms_quizzes",
            "lms_quiz_questions",
          ])
            parsed[name] = fresh[name]!;
          for (const name of [
            "lms_course_starts",
            "lms_lesson_opens",
            "lms_lesson_progress",
            "lms_quiz_attempts",
            "lms_external_link_opens",
            "lms_item_confirmations",
            "lms_course_acknowledgements",
            "lms_module_acknowledgements",
            "lms_driver_certifications",
            "lms_onboarding_verifications",
            "lms_audit_logs",
          ])
            parsed[name] ??= fresh[name]!;
          parsed["demo_migrations"]!.push({ id: academyMigration });
        }
        for (const name of ["handbook_versions", "safety_resources"]) {
          for (const row of parsed[name] ?? []) row["approval_state"] ??= "draft";
        }
        const legacyStatuses: Record<string, string> = {
          submitted: "new",
          under_review: "ready_for_review",
          screening: "fadv_in_progress",
          background_check: "fadv_in_progress",
          interview: "screening_complete_review",
          conditional_offer: "screening_complete_review",
          onboarding: "screening_complete_review",
          withdrawn: "archived",
        };
        for (const app of parsed["applications"] ?? []) {
          if (legacyStatuses[app["status"]]) app["status"] = legacyStatuses[app["status"]];
          if (app["user_id"] === undefined) app["user_id"] = null;
          if (app["assigned_recruiter_id"] === undefined) app["assigned_recruiter_id"] = null;
          const demoDraft =
            app["id"] === "a0000000-0000-4000-a000-000000000001" && app["status"] === "draft";
          if (app["resume_token_hash"] === undefined || (demoDraft && !app["resume_token_hash"])) {
            app["resume_token_hash"] = demoDraft
              ? fresh["applications"]![0]!["resume_token_hash"]
              : null;
          }
          if (app["resume_expires_at"] === undefined || (demoDraft && !app["resume_expires_at"])) {
            app["resume_expires_at"] = demoDraft
              ? fresh["applications"]![0]!["resume_expires_at"]
              : null;
          }
          if (app["source"] === undefined) app["source"] = "web";
          if (app["last_saved_at"] === undefined) app["last_saved_at"] = app["updated_at"] ?? null;
        }
        for (const name of ["application_employers", "application_documents"]) {
          for (const row of parsed[name] ?? [])
            if (row["user_id"] === undefined) row["user_id"] = null;
        }
        if (!parsed["site_settings"]!.some((row) => row["key"] === "application_resume_days")) {
          parsed["site_settings"]!.push(
            fresh["site_settings"]!.find((row) => row["key"] === "application_resume_days")!,
          );
        }
        const faqAnswers: Record<string, string> = {
          "How do I apply?":
            "Choose an opening on the Careers page and complete the secure application. You may save and return using your private resume link.",
          "What happens after I apply?":
            "Recruiting reviews your application. If you advance, 52 Logistics may initiate a separate screening process through First Advantage, which will contact you through its secure candidate experience.",
          "Can I apply from my phone?":
            "Yes. The complete application, signature, save/resume, and approved uploads must work on current iPhone and Android browsers.",
        };
        for (const faq of parsed["faqs"] ?? [])
          if (faqAnswers[faq["question"]]) faq["answer"] = faqAnswers[faq["question"]];
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
