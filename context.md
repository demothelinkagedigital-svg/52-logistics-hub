# Work Context

This document records work completed across the earlier project prompts and the subsequent application and portal prompts in this session.

## 1. Project documentation and package cleanup

- Replaced the outdated Next.js build brief in `README.md` with the actual stack: TanStack Start, React 19, TypeScript, and Tailwind CSS v4.
- Documented the demo data layer in `src/lib/mock`, browser `localStorage` persistence, and Supabase as the planned real backend.
- Renamed the package from `tanstack_start_ts` to `52-logistics-hub` and synchronized the npm and Bun lockfiles.
- Removed the unused `@lovable.dev/cloud-auth-js` dependency and unreferenced `src/integrations/lovable/index.ts` wrapper.
- Left `vite.config.ts` and `@lovable.dev/vite-tanstack-config` unchanged.
- `npm run build` passed.

## 2. Site settings, contact, footer, and social links

- Updated the mock site settings with the approved recruiting and office email addresses and Harrisburg address, marking every address row as needing verification.
- Removed seeded phone, DOT, and MC values and cleared the seeded social links.
- Added the editable `brand_qualifier` setting and displayed it in small text in the footer and About page.
- Standardized public email reads on `recruiting_email` and `company_email`; made email links conditional and corrected postal address formatting.
- Made the footer display only active social links with valid HTTP(S) URLs, and omit social-link UI when none qualify.
- Confirmed the existing portal controls still provide social-link creation, editing, reordering, and active toggling.
- Updated stored demo data handling so old localStorage values and placeholder social links are refreshed.
- Updated the migration seed email keys and brand qualifier.
- `npm run build` passed; the contact and About pages were checked in the browser.

## 3. Openings, application selection, and FAQ content

- Replaced the mock job seed with exactly six openings, in order: Linehaul URR (Sunday–Thursday), Linehaul URR (Tuesday–Saturday), P&D URR, Hybrid URR (2 PM–1 AM), Hybrid URR (4 PM–11 PM), and Spare URR.
- Set each opening to `Harrisburg, PA`, `open`, and published, with the requested schedule and slug.
- Cleared requirements, responsibilities, experience notes, pay, benefits, and equipment details. Empty optional sections and employment type are hidden on job details and cards; the Careers page no longer shows unapproved qualification claims.
- Added the requested standard schedule disclaimer as the summary shown on every opening card.
- Added an “Apply for This Position” button to homepage and Careers cards. The Apply page preselects the chosen opening, allows the applicant to change it, and includes the current selection in the recruiting email.
- Replaced the seeded FAQ with the six requested topics and updated answers to avoid unsupported employment, schedule, and equipment claims.
- Updated the SQL seed migrations to match the approved job list and FAQ, and to leave employment type blank for these openings.
- Updated stored demo data handling so old seeded jobs and FAQs are replaced for existing localStorage sessions.
- `npm run build` passed. The homepage, Careers page, job detail, Apply page, and FAQ page were checked in the browser.

## 4. Public copy, portal navigation, and legal-page notices

- Replaced the homepage “Why drive with us” introduction, six benefit points, and closing call to action with the requested copy.
- Replaced the About-page content with the four approved paragraphs and removed the prior unsupported operational claims and sidebar details.
- Added recruiting and general-contact guidance plus a warning not to email sensitive information. The displayed email addresses and mailto links use the editable `recruiting_email` and `company_email` settings.
- Added a keyboard-focusable “Home” link to `/portal` and a separate “Public site” link to `/` in the shared portal navigation; retained the logo link to `/`.
- Added the exact draft-review notice to Privacy, Terms, Applicant Notice, and Accessibility pages.
- `npm run build` passed. Changed public pages were checked in the browser at desktop and mobile widths. The portal preview showed the unauthenticated demo account chooser, so authenticated navigation was verified in source rather than visually after login.

## Files changed across the earlier project prompts

- `README.md`
- `package.json`
- `package-lock.json`
- `bun.lock`
- `src/integrations/lovable/index.ts` (deleted)
- `src/lib/mock/db.ts`
- `src/components/site/SiteFooter.tsx`
- `src/components/portal/PortalShell.tsx`
- `src/lib/brand.ts`
- `src/lib/public-content.functions.ts`
- `src/routes/_site/about.tsx`
- `src/routes/_site/contact.tsx`
- `src/routes/_site/privacy.tsx`
- `src/routes/_site/terms.tsx`
- `src/routes/_site/applicant-notice.tsx`
- `src/routes/_site/accessibility.tsx`
- `src/routes/_site/index.tsx`
- `src/routes/_site/careers.index.tsx`
- `src/routes/_site/careers.$slug.tsx`
- `src/routes/_site/apply.tsx`
- `supabase/migrations/20260807230540_fa2b14a3-d2e3-4827-b9ca-c91920c81442.sql`
- `supabase/migrations/20260808002657_5dc79762-a883-49d7-aade-0444132a46fb.sql`

The migration files were edited as source files; no Supabase migration execution is recorded in this conversation.

## 5. Application data model and consumers

- Replaced the legacy application fields with the requested optional draft schema, retaining job/application identity and core contact data while adding preferred contact method, age and work-authorization confirmations, CDL status/class/state and endorsements, commercial-driving experience, schedule/start availability, accommodation response, DOT medical-card status/expiration, compliance agreement, electronic-record consent, signature, and qualification-gap flags/reasons.
- Updated employer history to capture employer, role, location, dates, current-employer status, commercial-driving relevance, permission to contact, and reason for leaving. Limited optional documents to DOT medical card and resume, accepting PDF/JPG/PNG up to 10 MiB. Kept reference codes in the `52L-####` format and updated demo data for the new schema, UUID job IDs, and `52logistics-demo-db-v2` storage key.
- Updated the portal save/submit handlers and recruiter list/detail consumers to use the revised fields. Qualification gaps are exposed for human review, not automatic rejection.
- No `supabase/` files were changed for this application-model work.
- Updated `src/lib/application-schema.ts`, `src/lib/mock/db.ts`, `src/lib/portal.functions.ts`, `src/lib/recruiting.functions.ts`, and `src/routes/_authenticated/portal.recruiting.$id.tsx`.

## 6. Typecheck cleanup

- Removed the obsolete demo `refreshStoredDemoData` localStorage patch-up function and its caller.
- Added the `typecheck` package script and fixed the identified type errors in the demo database and application-related files.
- `npm run build` passed. `npm run typecheck` reports only the previously allowed `src/routes/__root.tsx` error: TanStack supplies `error: unknown` while the root error component expects `Error`.

## 7. Six-step application form

- Rebuilt the applicant workflow in this order: Position & identity; Eligibility & CDL; Safety & availability; Employment history; Documents; Certification. Steps cover opening/contact details; work authorization/CDL/endorsements/experience; schedules/start date/accommodation/medical card/compliance; up to five employer records; optional private uploads; and read-only answer review with certification and signature.
- Added inline validation for each step, draft autosave and resume, 320px-friendly layouts and touch targets, optional private document uploads with upload guidance, and Privacy and Applicant Notice links.
- Added non-blocking qualification-gap flags and reasons for human review (no automated rejection), a server-set signature timestamp, and a submission confirmation showing the reference, position, submitted time, and recruiting follow-up notice.
- At this stage, the six-step form was in `/portal/application` and `/apply` remained an inquiry page. This was superseded by the public application workflow described in section 11.
- Updated `src/routes/_authenticated/portal.application.tsx`, `src/lib/application-schema.ts`, and `src/lib/portal.functions.ts`. Production build passed. The requested end-to-end form interaction and save-refresh-resume checks were not completed in the browser preview.

## 8. Browser runtime error and hidden public-page content

- Diagnosed the hidden content below site heroes as a client runtime failure, not a missing network response. Reveal-animated sections remained hidden when hydration failed.
- Replaced TanStack's built-in CSRF helper import, which pulled Node `AsyncLocalStorage` into the browser dependency graph, with a local request middleware that preserves the CSRF checks without that client-side dependency.
- Updated `src/start.ts` and added `src/lib/csrf-middleware.ts`. The production build passed, and the `/about` preview displayed its content after Vite rebuilt the client without a new `AsyncLocalStorage` runtime exception.

## 9. Application step navigation

- Removed persistence from the critical path of step navigation so Next and Previous change steps without waiting for a save request. Forward navigation still runs validation, and the existing debounced autosave remains responsible for saving progress.
- Updated `src/routes/_authenticated/portal.application.tsx`. Production build passed. The portal redirected to demo sign-in in the preview, so form controls could not be click-tested. Typecheck remains limited to the existing root error described above.

## 10. Recruiter applicant row navigation

- Made each applicant row in the recruiter pipeline navigate to its application when clicked anywhere in the row; retained the applicant-name link.
- Updated `src/routes/_authenticated/portal.recruiting.index.tsx`. Production build passed. Typecheck still reports only the existing `src/routes/__root.tsx` error. The preview redirected to demo sign-in, so row interaction could not be tested in the browser.

## 11. Public application and private resume links

- Moved the six-step application to the public `/apply` flow. Applicants select an opening, start without an account, and receive a private link at `/apply/resume/$token` to return to their saved application.
- Improved application resumption and submission validation, including a helpful invalid-or-expired-link state. Resume pages are marked `noindex` and use a `no-referrer` policy.
- Kept internal application status private in applicant confirmations. Updated the public application tests and added `tsx` for running the TypeScript test script.
- Changed the application form, public application server functions, mock data, public Apply routes, and related portal navigation and routing. This supersedes the earlier `/portal/application` workflow described in section 7.

## 12. Application status model

- Aligned the application workflow to ten ordered staff-facing statuses: New, Incomplete, Ready for Review, Ready to Invite to First Advantage, First Advantage Invitation Sent, Candidate Completing First Advantage, Screening Complete – Management Review, Hired, Rejected, and Archived.
- Updated public submission behavior, demo data, recruiter and administrator screens, portal counters, status events, and role authorization. Applicant-editable states remain supported, and qualification gaps remain for human review rather than automatic decisions.
- Extended `scripts/test-public-application.ts` to cover the status and submission behavior. No Supabase files were changed for this work.

## 13. First Advantage and DocuSign tracking

- Replaced the screening-result model and UI with a manual First Advantage handoff checklist and event metadata. The handoff can suggest a status, but saving it does not automatically change application status.
- Added manual DocuSign record tracking, including the offer-letter demo record. Recruiter and administrator authorization is enforced in the server functions, and event descriptions remain generic.
- Extended the public application test script to cover handoff and DocuSign behavior. No Supabase migration or real Supabase project changes were made for this work.

## 14. Recruiter list and application detail polish

- Added nullable `assigned_recruiter_id` to the demo application data and schema, seeded both assigned and unassigned applications, and initialized new applications as unassigned. Assignment changes are recorded in `application_events` with a generic description and the old/new IDs in metadata.
- Added recruiter-list filters for opening, assigned recruiter or Unassigned, submitted-date range, and missing-items requests, plus Clear filters. Search continues to include reference codes, and assignments appear in the list and detail actions.
- Restricted Hired, Rejected, and Archived status choices to administrators; recruiter controls show a “Management only” hint. Replaced the qualification flag with a read-only CDL, experience, medical-card, schedule, and gaps summary carrying the disclaimer “For human review. No automatic decisions.”
- Added an audited CSV export of the filtered list, limited to reference, applicant name, opening, status label, submitted date, and assigned recruiter. The server denies content managers and records the export actor, time, and row count.
- Added validation preventing a DocuSign completion date earlier than its sent date. Extended tests for assignment persistence and events, export columns and privacy, export auditing, content-manager denial, and the date rule.
- Assignment storage uses the demo mock store only. No Supabase migration tool was used, no real Supabase project was changed, and no `supabase/` files were touched for this work.
- At completion, `npm run build` and `npx tsx scripts/test-public-application.ts` passed. Typecheck reported only the previously noted `src/routes/__root.tsx` error. The recruiter preview displayed the demo account chooser, so authenticated UI interaction was not verified.
