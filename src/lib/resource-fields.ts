import type { ResourceKey } from "@/lib/ops.functions";

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "list";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  help?: string;
  required?: boolean;
  /** Show this column in the table view. */
  column?: boolean;
  /** Width hint for the table column. */
  wide?: boolean;
};

export type ResourceView = {
  title: string;
  blurb: string;
  eyebrow: string;
  /** Field rendered as the row's primary label. */
  primary: string;
  /** Optional status field used for the row status chip. */
  statusField?: string;
  fields: readonly FieldDef[];
  orderable?: boolean;
  duplicable?: boolean;
  archivable?: boolean;
  /** Records cannot be created from the UI (fixed key sets). */
  createDisabled?: boolean;
};

const PUBLISH_STATUS = ["draft", "published", "paused", "closed", "archived"] as const;
const APPROVAL_STATES = ["draft", "under_review", "approved", "retired"] as const;

export const RESOURCE_VIEWS: Record<ResourceKey, ResourceView> = {
  jobs: {
    eyebrow: "Recruiting",
    title: "Job openings",
    blurb: "Create, publish, pause and archive the openings shown on the public Careers page.",
    primary: "position",
    statusField: "status",
    orderable: true,
    duplicable: true,
    archivable: true,
    fields: [
      { name: "position", label: "Position", type: "text", required: true, column: true },
      { name: "slug", label: "Slug", type: "text", required: true, help: "Used in the public URL anchor." },
      { name: "work_category", label: "Work category", type: "select", options: ["Linehaul", "P&D", "Hybrid", "Spare"], column: true },
      { name: "employment_type", label: "Employment type", type: "select", options: ["Full-time", "Part-time", "Casual / Spare"], column: true },
      { name: "days", label: "Days", type: "text", column: true },
      { name: "schedule", label: "Schedule", type: "text", column: true, wide: true },
      { name: "location", label: "Operation", type: "text", help: "Harrisburg, PA — Terminal 170." },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "requirements", label: "Qualification requirements", type: "list" },
      { name: "responsibilities", label: "Responsibilities", type: "list" },
      { name: "experience_notes", label: "Experience expectations", type: "textarea" },
      { name: "pay_notes", label: "Pay notes", type: "textarea", help: "Administrator-controlled. Leave blank rather than estimating." },
      { name: "benefits_notes", label: "Benefits notes", type: "textarea" },
      { name: "equipment_notes", label: "Equipment notes", type: "textarea" },
      { name: "application_deadline", label: "Application deadline", type: "date" },
      { name: "status", label: "Status", type: "select", options: PUBLISH_STATUS },
      { name: "published", label: "Visible on the public site", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  announcements: {
    eyebrow: "Communications",
    title: "Announcements",
    blurb: "Company, driver, safety and FedEx communications with audience targeting and acknowledgement tracking.",
    primary: "title",
    statusField: "status",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "body", label: "Body", type: "richtext", required: true },
      { name: "audience", label: "Audience", type: "select", options: ["all", "drivers", "applicants", "staff"], column: true },
      { name: "priority", label: "Priority", type: "select", options: ["normal", "high", "urgent"], column: true },
      { name: "status", label: "Status", type: "select", options: ["draft", "scheduled", "published", "expired", "archived"] },
      { name: "publish_at", label: "Publish at", type: "datetime" },
      { name: "expires_at", label: "Expires at", type: "datetime" },
      { name: "attachment_url", label: "Attachment link", type: "text" },
      { name: "requires_acknowledgement", label: "Requires acknowledgement", type: "boolean", column: true },
      { name: "pinned", label: "Pinned", type: "boolean" },
      { name: "published", label: "Visible to the audience", type: "boolean", column: true },
    ],
  },
  safety_meetings: {
    eyebrow: "Safety",
    title: "Safety meetings",
    blurb: "Schedule meetings, attach approved materials and track attendance and acknowledgement.",
    primary: "title",
    statusField: "status",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "meeting_date", label: "Meeting date", type: "datetime", column: true },
      { name: "mode", label: "Mode", type: "select", options: ["in_person", "virtual", "self_paced"], column: true },
      { name: "audience", label: "Audience", type: "select", options: ["all_drivers", "linehaul", "p_and_d", "hybrid", "spare"], column: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "instructions", label: "Instructions", type: "textarea" },
      { name: "materials_url", label: "Approved materials link", type: "text" },
      { name: "acknowledgement_deadline", label: "Acknowledgement deadline", type: "datetime" },
      { name: "status", label: "Status", type: "select", options: ["draft", "published", "completed", "archived"] },
    ],
  },
  safety_resources: {
    eyebrow: "Safety",
    title: "Safety Center content",
    blurb: "Versioned safety topics, with acknowledgement requirements and publish control.",
    primary: "title",
    statusField: "approval_state",
    orderable: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "category", label: "Category", type: "text", column: true },
      { name: "approval_state", label: "Approval state", type: "select", options: APPROVAL_STATES, required: true },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "body", label: "Body", type: "richtext" },
      { name: "requires_acknowledgement", label: "Requires acknowledgement", type: "boolean", column: true },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  handbook_versions: {
    eyebrow: "Policy",
    title: "Handbook versions",
    blurb: "Version-controlled handbook releases. Drivers sign electronically before download.",
    primary: "version_label",
    statusField: "approval_state",
    archivable: true,
    fields: [
      { name: "version_label", label: "Version", type: "text", required: true, column: true },
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "approval_state", label: "Approval state", type: "select", options: APPROVAL_STATES, required: true },
      { name: "effective_date", label: "Effective date", type: "date", column: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "change_summary", label: "Change summary", type: "textarea" },
      { name: "document_url", label: "Document link", type: "text" },
      { name: "requires_signature", label: "Requires signature", type: "boolean", column: true },
      { name: "published", label: "Published", type: "boolean", column: true },
    ],
  },
  handbook_sections: {
    eyebrow: "Policy",
    title: "Handbook sections",
    blurb: "The searchable handbook content drivers read inside the portal.",
    primary: "title",
    orderable: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "category", label: "Category", type: "text", column: true },
      { name: "body", label: "Body", type: "richtext" },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  required_systems: {
    eyebrow: "Operations",
    title: "Required apps & systems",
    blurb: "Approved external systems. Never publish credentials, PINs or gate codes here.",
    primary: "name",
    orderable: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", column: true, wide: true },
      { name: "purpose", label: "Purpose", type: "textarea" },
      { name: "official_url", label: "Official URL", type: "text" },
      { name: "ios_url", label: "iOS link", type: "text" },
      { name: "android_url", label: "Android link", type: "text" },
      { name: "phone", label: "Telephone", type: "text" },
      { name: "setup_instructions", label: "Setup instructions", type: "textarea" },
      { name: "support_info", label: "Support information", type: "textarea" },
      { name: "audience", label: "Audience", type: "select", options: ["drivers", "staff", "all"] },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  lms_courses: {
    eyebrow: "Academy",
    title: "Academy courses",
    blurb: "Course catalog, objectives, duration and publish state. Lessons and quizzes live inside each course.",
    primary: "title",
    orderable: true,
    duplicable: true,
    archivable: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "category", label: "Category", type: "text", column: true },
      { name: "difficulty", label: "Difficulty", type: "select", options: ["foundational", "intermediate", "advanced"], column: true },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "objectives", label: "Learning objectives", type: "list" },
      { name: "estimated_minutes", label: "Estimated minutes", type: "number", column: true },
      { name: "image_url", label: "Cover image URL", type: "text" },
      { name: "owner_label", label: "Content owner", type: "text" },
      { name: "is_required", label: "Required", type: "boolean", column: true },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  media_assets: {
    eyebrow: "Content",
    title: "Media library",
    blurb: "Owner-supplied imagery with alt text and usage notes. Candidate documents are never stored here.",
    primary: "title",
    archivable: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, column: true },
      { name: "public_url", label: "Public URL", type: "text", column: true, wide: true },
      { name: "alt_text", label: "Alt text", type: "text", help: "Required for accessibility." },
      { name: "category", label: "Category", type: "select", options: ["fleet", "terminal", "team", "brand", "general"], column: true },
      { name: "tags", label: "Tags", type: "list" },
      { name: "usage_notes", label: "Usage notes", type: "textarea" },
      { name: "content_type", label: "Content type", type: "text" },
      { name: "width", label: "Width", type: "number" },
      { name: "height", label: "Height", type: "number" },
    ],
  },
  faqs: {
    eyebrow: "Content",
    title: "FAQ",
    blurb: "Public frequently asked questions.",
    primary: "question",
    orderable: true,
    fields: [
      { name: "question", label: "Question", type: "text", required: true, column: true, wide: true },
      { name: "answer", label: "Answer", type: "richtext", required: true },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  page_content: {
    eyebrow: "Content",
    title: "Page content",
    blurb: "Editable copy blocks used across the public site, with an approval state.",
    primary: "section_key",
    statusField: "approval_status",
    fields: [
      { name: "page_key", label: "Page", type: "text", required: true, column: true },
      { name: "section_key", label: "Section", type: "text", required: true, column: true },
      { name: "heading", label: "Heading", type: "text", column: true, wide: true },
      { name: "body", label: "Body", type: "richtext" },
      { name: "approval_status", label: "Approval", type: "select", options: ["draft", "pending", "approved"] },
      { name: "published", label: "Published", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  social_links: {
    eyebrow: "Settings",
    title: "Social & Indeed links",
    blurb: "Only owner-approved official destinations. Never publish personal profiles.",
    primary: "platform",
    orderable: true,
    fields: [
      { name: "platform", label: "Platform", type: "text", required: true, column: true },
      { name: "url", label: "URL", type: "text", column: true, wide: true },
      { name: "is_active", label: "Active", type: "boolean", column: true },
      { name: "sort_order", label: "Order", type: "number" },
    ],
  },
  email_templates: {
    eyebrow: "Communications",
    title: "Email templates",
    blurb: "Editable subject and body for every system message. Never place restricted information in email.",
    primary: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, column: true },
      { name: "template_key", label: "Key", type: "text", required: true, column: true },
      { name: "subject", label: "Subject", type: "text", required: true, column: true, wide: true },
      { name: "body", label: "Body", type: "richtext", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "variables", label: "Available variables", type: "list" },
      { name: "is_active", label: "Active", type: "boolean", column: true },
    ],
  },
  site_settings: {
    eyebrow: "Settings",
    title: "Site settings",
    blurb: "Company information, contact details and public configuration. Secrets are never stored here.",
    primary: "key",
    createDisabled: true,
    fields: [
      { name: "key", label: "Key", type: "text", column: true },
      { name: "label", label: "Label", type: "text", column: true },
      { name: "value", label: "Value", type: "textarea", column: true, wide: true },
      { name: "group_name", label: "Group", type: "text", column: true },
      { name: "is_public", label: "Public", type: "boolean", column: true },
      { name: "needs_verification", label: "Needs verification", type: "boolean" },
    ],
  },
};

/** Grouped navigation for the management console. */
export const MANAGE_GROUPS: ReadonlyArray<{
  group: string;
  items: ReadonlyArray<{ resource: ResourceKey; label: string }>;
}> = [
  {
    group: "Recruiting",
    items: [{ resource: "jobs", label: "Job openings" }],
  },
  {
    group: "Learning & policy",
    items: [
      { resource: "lms_courses", label: "Academy courses" },
      { resource: "handbook_versions", label: "Handbook versions" },
      { resource: "handbook_sections", label: "Handbook sections" },
    ],
  },
  {
    group: "Safety",
    items: [
      { resource: "safety_meetings", label: "Safety meetings" },
      { resource: "safety_resources", label: "Safety Center" },
    ],
  },
  {
    group: "Communications",
    items: [
      { resource: "announcements", label: "Announcements" },
      { resource: "email_templates", label: "Email templates" },
    ],
  },
  {
    group: "Content",
    items: [
      { resource: "page_content", label: "Page content" },
      { resource: "faqs", label: "FAQ" },
      { resource: "media_assets", label: "Media library" },
      { resource: "required_systems", label: "Apps & systems" },
    ],
  },
  {
    group: "Settings",
    items: [
      { resource: "social_links", label: "Social & Indeed" },
      { resource: "site_settings", label: "Site settings" },
    ],
  },
];
