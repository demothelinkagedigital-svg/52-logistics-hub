# Work Context

This document records the work completed across the cleanup and content-update prompts.

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

## Files changed across these prompts

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

## 5. Recruiter applicant row navigation

- Made each applicant row in the recruiter pipeline navigate to its application when clicked anywhere in the row; retained the applicant-name link.
- Updated `src/routes/_authenticated/portal.recruiting.index.tsx`.
- `npm run build` passed. Typecheck still reports the existing `src/routes/__root.tsx` error. The preview redirected to the demo sign-in page, so row interaction could not be tested in the browser.
