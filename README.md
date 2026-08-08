# 52 Logistics Hub

# FULL PROJECT BUILD PROMPT — 52 LOGISTICS, INC.

Build a complete, production-ready **website + recruiting platform + authenticated Driver Operations Portal** for **52 Logistics, Inc.**

IMPORTANT: The original project brief references WordPress, but **DO NOT build this project in WordPress**. Recreate the complete functionality described in the brief using the following stack:

* **Next.js 14**
* **TypeScript**
* **Tailwind CSS**
* **Framer Motion**
* **21st.dev components/library where useful**
* **Supabase** for authentication, PostgreSQL database, Row Level Security, private storage, and persistent application data
* Next.js Server Components, Server Actions and Route Handlers where appropriate
* Use modern supporting libraries where they materially improve UX, accessibility, forms, validation, tables, charts, file handling, notifications, and security.

The result must be a **fully functional application**, not a static mockup.

---

# 1. CORE BUSINESS INFORMATION

## Company

**52 Logistics, Inc.**

## Business Model

52 Logistics, Inc. is an **independent contracted service provider supporting FedEx linehaul operations**.

The company operates from:

**FedEx – Harrisburg, Terminal 170**

Owner-supplied address:

**510 Industrial Dr., Harrisburg, PA 17339**

IMPORTANT:

The SRS states that the city/ZIP formatting of the supplied address must be verified before production. Do not silently change or invent the address.

The website must NOT present 52 Logistics as FedEx itself.

Use clear independent-contractor language where appropriate.

Final trademark/legal wording should remain editable so the owner/legal team can approve it.

## Contacts

Recruiting:

**[recruiting@52logisticsinc.com](mailto:recruiting@52logisticsinc.com)**

General office:

**[office@52logisticsinc.com](mailto:office@52logisticsinc.com)**

---

# 2. MAIN OBJECTIVE

Create three connected experiences:

### A. Public Recruiting Website

A premium, modern, high-conversion website that attracts qualified commercial drivers and directs them toward current openings and the application process.

### B. Recruiting / Management Platform

A secure internal system where authorized recruiters and administrators can:

* View applications
* Search applications
* Filter applications
* Review candidate information
* Review approved files
* Add internal notes
* Change application statuses
* Track First Advantage handoffs
* Track DocuSign documents
* Export approved information
* Manage jobs
* Manage drivers
* Manage Academy content
* Manage Safety Center content
* Manage announcements
* Manage meetings
* Manage acknowledgements
* Manage resources
* Manage handbook versions
* Manage email templates
* Manage social links
* Manage Indeed link
* View reports
* Review audit history

### C. Authenticated Driver Portal

A permanent authenticated portal for active drivers and onboarding drivers.

It must contain:

* Dashboard
* Profile
* Driver Academy
* Required Apps & Systems
* Handbook
* Safety Center
* Announcements
* Safety Meetings
* Acknowledgements
* Contacts
* Logout

This is NOT simply a login page with placeholder dashboard cards. Every major function must actually work with persistent data.

---

# 3. DESIGN DIRECTION

The design must feel:

* Premium
* Professional
* Modern
* Established
* Trustworthy
* Transportation-industry appropriate
* High-conversion
* Technically polished
* Visually memorable
* Responsive
* Fast
* Accessible

Do NOT create a generic transportation template.

Do not use excessive generic rounded cards.

Use a sophisticated design system with:

* Strong typography
* Structured grids
* Sharp visual hierarchy
* Layered sections
* Subtle borders
* Premium gradients where appropriate
* Controlled shadows
* Large editorial typography
* Modern statistics
* Interactive timeline elements
* Strong CTA treatments
* Subtle motion
* Professional imagery
* Distinctive section transitions
* Clean dashboard layouts
* Data visualization where useful

Use Framer Motion for meaningful interactions rather than excessive animations.

Animations should include:

* Page transitions where appropriate
* Hero entrance
* Scroll reveals
* Staggered content
* Timeline animations
* Progress indicators
* Dashboard interactions
* Modal transitions
* Toast notifications
* Accordion transitions
* Hover states
* Loading states

Avoid excessive bouncing, floating, or gimmicky animations.

---

# 4. BRAND / MEDIA

Use the supplied company logo and owner-provided truck photography when available.

Do NOT replace authentic company photography with generic stock transportation imagery when authentic assets are available.

Preserve original media assets and use optimized derivatives for the website.

Do not publish an exact fleet count.

Where fleet/unit identifiers are approved, use them naturally without implying that the company owns only those units.

The supplied SRS identifies approved fleet identifiers including:

* 529062
* 529063
* 529064
* 529065
* 338917

Do not invent additional fleet numbers.

If a required asset is not available during development, use a clearly structured media placeholder that can be replaced from the admin/media system.

Do not use the same image repeatedly throughout the site.

---

# 5. PUBLIC WEBSITE STRUCTURE

Create these public pages:

## `/`

### Homepage

Primary headline:

**Move Your Career Forward with 52 Logistics.**

Supporting message:

**Join a professional Harrisburg-based linehaul team built around safety, accountability, reliable equipment, and respect for the people behind every mile.**

Primary CTAs:

* View Open Positions
* Apply Now

Trust points:

* Harrisburg Terminal 170
* Professional Fleet
* Structured Onboarding
* Safety-First Operations

Homepage sections should include:

1. Premium hero
2. Current opportunities preview
3. Why Drive with 52 Logistics
4. Professional fleet / authentic photography
5. Safety-first culture
6. Structured onboarding
7. Driver Academy preview
8. Driver resources preview
9. Application CTA
10. Contact/recruiting CTA
11. Footer

Create a visually strong careers conversion path.

---

# 6. ABOUT PAGE

Route:

`/about`

Include professional company story.

Core messaging:

52 Logistics, Inc. is a Harrisburg-based transportation company and independent contracted service provider supporting FedEx linehaul operations from Terminal 170.

Focus on:

* Dependable service
* Safe operating practices
* Well-maintained equipment
* Disciplined communication
* Strong people
* Clear expectations
* Structured onboarding
* Centralized driver resources
* Direct communication between drivers and management

Do not make unsupported claims.

---

# 7. CAREERS PAGE

Route:

`/careers`

There must be **ONE Careers page** containing the approved openings.

Do NOT create separate public job-detail pages unless technically useful internally.

Display these exact six openings:

### 1. Linehaul URR

Sunday–Thursday

9:30 AM until finished

### 2. Linehaul URR

Tuesday–Saturday

9:30 AM until finished

### 3. P&D URR

Monday–Friday

9:30 AM until finished

### 4. Hybrid URR

Monday–Friday

2:00 PM–1:00 AM

### 5. Hybrid URR

Monday–Friday

4:00 PM–11:00 PM

### 6. Spare URR

Friday–Monday

Times TBD

Each opening should show:

* Position
* Days
* Schedule
* Location
* Summary
* Requirements
* Status
* Apply CTA

Include:

**Apply for This Position**

The selected opening must automatically carry into the application workflow.

Applicants may change their selected opening before final submission.

Opening disclaimer:

“Based at the Harrisburg operation. Schedule is subject to operational needs, weather, volume, terminal requirements, safety conditions, and management direction. ‘Until finished’ does not promise a fixed end time.”

Pay, benefits, route details, equipment assignment, and final qualifications should be editable from the admin panel rather than fabricated.

---

# 8. APPLICATION PAGE

Route:

`/apply`

Build a real multi-step employment application.

It must be mobile-first.

Use:

* Progress indicator
* Step navigation
* Previous/Next
* Save & Continue
* Validation
* Error recovery
* Persistent state
* Secure uploads
* Confirmation
* Unique reference number

## STEP 1 — POSITION & IDENTITY

Fields:

* Selected opening
* Legal name
* Preferred name
* Email
* Mobile phone
* City
* State
* ZIP
* Preferred contact method
* Age-18 confirmation

## STEP 2 — ELIGIBILITY & CDL

Fields:

* Authorized-to-work attestation
* CDL status
* CDL class
* CDL state
* Endorsements
* Commercial driving experience
* Tractor-trailer experience
* Linehaul/P&D experience

## STEP 3 — SAFETY & AVAILABILITY

Fields:

* Schedule availability
* Start availability
* Ability to meet job functions with or without reasonable accommodation
* DOT medical-card status
* Medical-card expiration month/year
* Willingness to comply with:

  * Safety requirements
  * Attendance requirements
  * Drug/alcohol requirements
  * Qualification requirements

## STEP 4 — EMPLOYMENT HISTORY

Include:

* Current/most recent employer
* Role
* Start/end dates
* Commercial-driving relevance
* Reason for leaving
* Permission to contact
* Additional employers sufficient for initial review

Allow additional employment history entries.

Do not request unnecessary regulated history that belongs in approved secure provider workflows.

## STEP 5 — DOCUMENTS

Allowed:

* DOT medical card when approved/necessary
* Optional resume

DO NOT collect/store:

* Driver license images
* SSN
* DOB
* MVR
* Clearinghouse result
* Drug-testing result
* Background-check result

Uploaded files must be private.

They must NOT appear in:

* Public media
* Sitemap
* Search
* REST/public API
* Analytics
* Public URLs
* Email attachments
* Public cache

Use Supabase Storage private buckets and authorization policies.

## STEP 6 — CERTIFICATION

Show applicant certification.

Include:

* Privacy/applicant notice
* Electronic records consent
* Truthful-information certification
* Typed legal name
* Signature
* Signature date/time
* Submit

Do not state that submitting guarantees employment.

---

# 9. APPLICATION SAVE / RESUME

Implement a secure save/resume system.

After saving:

* Generate a high-entropy resume token/link
* Make it expiring
* Do not expose predictable application IDs
* Allow applicant to resume from another supported device
* Preserve previously entered information
* Preserve files where technically supported
* Otherwise clearly instruct applicant to re-upload

Never expose another applicant's information.

---

# 10. APPLICATION CONFIRMATION

After successful submission:

Show:

* Confirmation message
* Unique application reference number
* Selected position
* Submission timestamp
* General next steps
* Recruiting contact
* Privacy reminder

Send confirmation email.

Do not promise employment or an interview.

---

# 11. RECRUITER PORTAL

Route:

`/recruiter`

Protected by authentication and role authorization.

Dashboard should include:

* Total applications
* New applications
* Incomplete
* Ready for review
* First Advantage pending
* Screening complete
* Hired
* Rejected
* Archived
* Missing-item alerts
* Recent applications
* Recent status changes

Create a polished operational dashboard rather than a generic admin template.

---

# 12. APPLICATION MANAGEMENT

Route:

`/recruiter/applications`

Features:

* Search
* Filter
* Sort
* Pagination
* Status filtering
* Opening filtering
* Date filtering
* Recruiter filtering
* Missing-item filtering

Application detail page:

`/recruiter/applications/[id]`

Show:

* Applicant information
* Selected opening
* Application responses
* Qualification summary
* Approved files
* Internal notes
* Status
* Status history
* Notification history
* First Advantage checklist
* DocuSign tracking
* Export controls

Internal notes must never be visible to applicants.

Every status transition must record:

* User
* Timestamp
* Previous status
* New status

---

# 13. APPLICATION STATUS PIPELINE

Implement these exact statuses:

1. New
2. Incomplete
3. Ready for Review
4. Ready to Invite to First Advantage
5. First Advantage Invitation Sent
6. Candidate Completing First Advantage
7. Screening Complete – Management Review
8. Hired
9. Rejected
10. Archived

Do NOT automatically hire or reject candidates based on form answers.

Qualification gaps should be flagged for human review.

---

# 14. FIRST ADVANTAGE WORKFLOW

This is a **manual external workflow**.

DO NOT build a fake First Advantage integration.

DO NOT store:

* First Advantage passwords
* Candidate passwords
* Screening results
* MVR results
* Background results
* Drug results
* Provider dashboard screenshots
* Provider progress information

Recruiter workflow:

1. Review application.
2. Mark candidate ready for First Advantage.
3. Open external First Advantage employer portal.
4. Recruiter performs invitation externally.
5. Return to platform.
6. Record:

   * Invitation date
   * Responsible recruiter
   * External case/reference ID when available
   * Next check date
7. Update status.
8. Record completion information needed for management review.
9. Management makes final human decision.

Create an internal First Advantage tracking panel.

---

# 15. DOCUSIGN TRACKING

Do NOT build a DocuSign API integration.

Create tracking functionality for:

* Document type
* Sent date
* Sender
* External envelope/reference ID
* Completion date
* Status
* Notes

Use statuses such as:

* Not Sent
* Sent
* In Progress
* Completed
* Cancelled

---

# 16. DRIVER PORTAL

Route:

`/portal`

This is a permanent authenticated portal.

Dashboard must show:

* Outstanding actions
* Academy progress
* New announcements
* Assigned safety meetings
* Required acknowledgements
* Quick links
* Company contacts
* Current handbook status

Every authenticated screen must have a clear Home control that returns to the Driver Portal dashboard.

---

# 17. DRIVER PROFILE

Route:

`/portal/profile`

Allow drivers to view/edit permitted information.

Never expose:

* Recruiter notes
* Screening information
* Other drivers
* Internal management records

Include controlled editing and validation.

---

# 18. DRIVER ACADEMY

Route:

`/portal/academy`

Build a real training system.

Modules:

### Module 1 — Welcome to 52 Logistics

Content:

* Company
* Harrisburg operation
* Expectations
* Contacts
* Portal tour

Completion:

* Required reading
* Short knowledge check
* Affirmative acknowledgement

### Module 2 — Handbook

Completion:

* Review
* Electronic signature
* Download unlock

### Module 3 — Required Apps & Systems

Cover:

* Motive
* Whip Around
* MyFleetAI / Linehaul Central
* Trip Buddy
* AVR
* Gate procedure

Completion:

* Open/review official resource
* Setup instructions
* Confirm installation/access
* Knowledge check

### Module 4 — Safety Fundamentals

Topics:

* Hours of Service
* ELD
* DVIR
* Fatigue
* Backing
* Weather
* Safe pull-off
* Defensive driving
* Drug/alcohol expectations

Completion:

* Required content/media
* Quiz
* Passing threshold
* Acknowledgement

### Module 5 — Terminal & Operating Procedures

Cover:

* Arrival
* Gate
* AVR
* Trip Buddy
* Communication
* Equipment care
* Escalation

Completion:

* Review approved restricted instructions
* Scenario questions
* Acknowledgement

### Module 6 — Completion & Management Verification

Show:

* Academy summary
* Completed modules
* Outstanding items
* Offline requirements
* Driver certification

Management must verify completion before operational release.

---

# 19. IMPORTANT ACADEMY RULE

Opening a module or clicking an external link must NEVER automatically mark the module complete.

Completion must be based on the configured completion rule.

Each module should have configurable:

* Content version
* Audience
* Due date
* Prerequisite
* Completion method
* Passing score
* Retry rules
* Acknowledgement requirement

Progress must persist across:

* Refresh
* Logout/login
* Different devices

Management may reset modules, but every reset must record:

* Who reset it
* When
* Reason

---

# 20. REQUIRED APPS & SYSTEMS

Create:

`/portal/apps`

Create professionally designed resource cards for:

### Motive Driver

Include:

* Purpose
* Who creates the account
* iOS download
* Android download
* First-login instructions
* Company configuration
* Support
* Privacy warning
* Last reviewed date

### Whip Around

Same structure.

### MyFleetAI / Linehaul Central

Include:

* Purpose
* Login path
* Support
* Training reference

### Trip Buddy

Keep configurable.

Do NOT invent or publish an unapproved Trip Buddy URL.

### AVR

Treat AVR as a telephone-based procedure, not an app.

Approved number from the brief:

**(888) 867-1142**

However, any sensitive PIN or restricted operating instructions must remain protected and never appear publicly.

Every resource must have an administrator-editable link/configuration.

---

# 21. HANDBOOK

Route:

`/portal/handbook`

Implement versioned handbook functionality.

Each handbook version should contain:

* Title
* Version
* Effective date
* Summary of changes
* Content/PDF
* Approval status
* Current flag

Driver workflow:

1. Open handbook.
2. Review content.
3. View acknowledgement statement.
4. Enter/type legal name.
5. Sign electronically.
6. System records:

   * User
   * Handbook version
   * Exact acknowledgement statement
   * Signature representation
   * Timestamp
7. Unlock Download button.
8. Generate/expose signed receipt/copy.

When a materially revised handbook is published:

* Previous history remains
* Driver receives a new acknowledgement task

If official handbook content has not yet been supplied, display:

**Draft / Pending Approval**

Never present draft material as final company policy.

---

# 22. SAFETY CENTER

Route:

`/portal/safety`

Create a structured Safety Center.

Topics:

* Hours of Service & ELD
* DVIR & vehicle condition
* Fatigue & fitness for duty
* Backing & yard safety
* Weather & winter operations
* Safe pull-off & breakdown
* Defensive driving
* Drug & alcohol expectations
* Terminal procedures
* Gate
* AVR
* Trip Buddy

Each safety resource should contain:

* Topic
* Source
* Owner
* Version
* Review date
* Audience
* Status
* Content
* External references
* Attachments
* Acknowledgement requirement

Statuses:

* Draft
* Under Review
* Approved
* Retired

External material should be summarized and linked rather than copied wholesale.

---

# 23. SAFETY MEETINGS

Create:

`/portal/safety-meetings`

Drivers should see:

* Assigned meetings
* Upcoming meetings
* Completed meetings
* Overdue meetings
* Acknowledgements

Management should be able to create meetings containing:

* Title
* Date/time
* Audience
* Delivery mode
* Agenda
* Materials
* Video
* Attendance method
* Acknowledgement statement
* Due date
* Owner

Track states separately:

* Assigned
* Viewed
* Attended
* Acknowledged
* Overdue
* Excused
* Not Applicable

A driver signature/acknowledgement must record the exact content/version and timestamp.

---

# 24. ANNOUNCEMENTS

Route:

`/portal/announcements`

Categories:

* Company
* Safety
* Terminal/FedEx Communication
* Operations
* Training
* Urgent

Each announcement supports:

* Audience
* Priority
* Publish date
* Expiration date
* Summary
* Full content
* Attachments/media
* Acknowledgement requirement
* Deadline
* Version

Critical notices should appear prominently on the Driver Dashboard.

Email notifications should contain only an appropriate summary and secure portal link.

Do not imply that the website is an official FedEx communication system.

---

# 25. ACKNOWLEDGEMENT SYSTEM

Build a reusable acknowledgement engine.

Record:

* User
* Object type
* Object ID
* Content version
* Exact acknowledgement statement
* Signature/affirmation
* Timestamp
* Source metadata
* Status

Allow administrators to see acknowledgement history.

---

# 26. MANAGEMENT / ADMIN PORTAL

Create a complete management dashboard.

Route:

`/admin`

Include sections for:

* Dashboard
* Pages
* Jobs
* Applications
* Drivers
* Academy
* Systems
* Handbook
* Safety
* Meetings
* Announcements
* Acknowledgements
* Forms
* Reports
* Media
* Email
* Social Links
* Indeed
* Users
* Settings
* Audit Logs

The admin dashboard must feel like a professional SaaS operations platform.

---

# 27. CONTENT MANAGEMENT

Management must be able to edit without touching code:

* Public website copy
* Careers
* Job openings
* App links
* App instructions
* Academy modules
* Videos
* Handbook
* Safety resources
* Meetings
* Announcements
* Contacts
* Email templates
* Social links
* Indeed URL
* Media metadata

Use structured database content rather than hardcoding everything into components.

---

# 28. SOCIAL MEDIA + INDEED

Create administrator-editable social settings.

Management must be able to:

* Add platform
* Remove platform
* Rename platform
* Reorder platform
* Activate/deactivate platform
* Update URL

Include official Indeed company/employer profile.

Do NOT invent URLs.

If URLs are not provided, show an admin configuration state rather than publishing fake links.

Links must be tested before production.

---

# 29. USER ROLES

Implement strict role-based access control.

Roles:

### Public

Can access:

* Public pages
* Careers
* Application start

Cannot access:

* Portal
* Applications
* Private files
* Recruiter data

### Applicant

Can access:

* Own application
* Save/resume
* Confirmation

Cannot access:

* Other applicants
* Recruiter notes
* Driver Portal
* Admin

### Recruiter

Can access:

* Applications
* Notes
* Statuses
* Handoffs
* Approved exports

Cannot access:

* Unassigned restricted management settings
* Driver-only restricted content unless specifically authorized

### Driver

Can access:

* Own profile
* Own portal
* Academy
* Safety resources
* Announcements
* Meetings
* Acknowledgements
* Required systems

Cannot access:

* Other drivers
* Recruiter data
* Admin
* Applicant records

### Content Manager

Can manage:

* Approved public/portal content
* Assignments
* Academy
* Resources
* Safety content
* Announcements

Cannot manage:

* Applicant sensitive records
* Roles
* Security configuration

### Administrator

Full authorized configuration and reporting access.

### Temporary Developer

Time-limited least-privilege access only.

---

# 30. AUTHENTICATION

Use secure authentication.

Support:

* Login
* Logout
* Password reset
* Email verification
* Protected routes
* Role-based authorization
* Session persistence
* Account deactivation

Driver invitations should use secure single-use setup links with expiration.

Administrators/recruiters should support MFA where possible.

Do not use shared administrator credentials.

Use server-side authorization for protected operations.

Do not rely only on client-side route guards.

Use Supabase RLS to enforce database-level authorization.

---

# 31. DATABASE ARCHITECTURE

Create a proper relational schema.

At minimum include tables/models for:

* profiles
* roles
* jobs
* applications
* application_answers
* application_files
* application_status_history
* recruiter_notes
* first_advantage_handoffs
* docusign_tracking
* drivers
* academy_modules
* academy_progress
* academy_attempts
* systems_resources
* handbook_versions
* handbook_acknowledgements
* safety_resources
* safety_meetings
* meeting_assignments
* announcements
* announcement_acknowledgements
* acknowledgements
* notifications
* email_templates
* social_links
* media_metadata
* audit_logs
* settings

Use UUIDs where appropriate.

Use timestamps.

Use foreign-key relationships.

Use soft-delete/archive patterns where needed.

Do not physically delete records when legal/audit history requires retention.

---

# 32. SECURITY

This is a sensitive application.

Implement:

* HTTPS-ready architecture
* Secure cookies
* Strong authentication
* Role-based authorization
* Supabase RLS
* Private storage buckets
* Rate limiting where appropriate
* Input validation
* Server-side validation
* File type validation
* File size limits
* Malware/sanitization controls where supported
* Audit logs
* Secure password handling
* Expiring tokens
* No public private-file URLs
* No credentials in source code
* No secrets in client-side code
* No sensitive data in analytics
* No sensitive information in email notifications

Applicant files must not be:

* Publicly enumerable
* Searchable
* Indexed
* Cached publicly
* Exposed through public REST endpoints
* Included in sitemap
* Included in analytics

---

# 33. PRIVATE DATA RULES

NEVER store in this application unless separately approved:

* Social Security numbers
* Driver license images
* Background-check results
* Drug/alcohol results
* MVR results
* Clearinghouse results
* Screening provider credentials
* Gate codes
* Private PINs
* Restricted operational credentials
* ELD/telematics data
* Driver location data
* Payroll data
* Dispatch data

The system should instead track the existence/status of external workflows where required.

---

# 34. NOTIFICATIONS

Implement administrator-editable email templates.

Required templates:

### Application Received

Show:

* Application received
* Position
* Reference number
* General next steps
* First Advantage explanation if applicable
* No employment promise

### Incomplete Application

Provide:

* Secure expiring resume link
* General missing categories
* Secure action path

Never attach sensitive information.

### Recruiter Alert

Show:

* New application
* Reference number
* Minimum identity/opening information
* Secure dashboard link

### Missing Item

Show:

* Requested item/category
* Secure action path

### Driver Portal Invitation

Include:

* Single-use setup link
* Expiration
* Support contact
* Credential warning

### Onboarding Assigned

Include:

* Required tasks
* Due date if applicable
* Secure portal link

### Acknowledgement Assigned

Include:

* Item/version
* Deadline
* Secure portal link

### Safety Meeting Assigned

Include:

* Meeting title
* Date/mode
* Deadline
* Secure link

### Completion

Show:

* Completion summary
* Remaining offline steps

All notification templates must be editable through admin.

---

# 35. REPORTING

Create admin/recruiter reports for:

* Application volume
* Application status distribution
* Openings
* Application completion
* Missing items
* First Advantage pipeline
* Hiring outcomes
* Academy completion
* Overdue Academy items
* Safety meeting completion
* Acknowledgement status
* Driver account status
* Announcement engagement

Provide filtering and export where appropriate.

Exports must contain only approved minimum data.

Never export restricted information unnecessarily.

---

# 36. AUDIT LOG

Create a robust audit log.

Track important actions such as:

* Login events where appropriate
* Role changes
* Status changes
* Application updates
* Notes
* File access events where appropriate
* First Advantage tracking updates
* DocuSign updates
* Academy resets
* Handbook publication
* Acknowledgements
* Meeting updates
* Announcement changes
* User deactivation
* Permission changes
* Settings changes

Audit records should contain:

* Actor
* Action
* Target
* Timestamp
* Relevant metadata

Do not expose sensitive data unnecessarily inside logs.

---

# 37. GLOBAL HOME CONTROL

A visible Home control must exist throughout the application.

Public pages:

Home → public homepage.

Driver Portal:

Home → Driver Dashboard.

Recruiter:

Home → Recruiter Dashboard.

Admin:

Home → Admin Dashboard.

The Home control must work on:

* Desktop
* Mobile
* Keyboard navigation

---

# 38. RESPONSIVE DESIGN

The entire platform must work on:

* iPhone Safari
* Android Chrome
* Desktop Chrome
* Safari
* Edge
* Firefox

Minimum target:

**320px CSS width**

No horizontal scrolling except where an accessible data-table alternative is provided.

Forms must be extremely usable on mobile.

Touch targets must be appropriately sized.

---

# 39. ACCESSIBILITY

Target:

**WCAG 2.2 AA**

Implement:

* Semantic HTML
* Correct heading hierarchy
* Keyboard navigation
* Visible focus states
* Accessible labels
* Accessible form errors
* High contrast
* Non-color-only status indicators
* Captions/transcripts where required
* Accessible dialogs
* Accessible tables
* Screen-reader-friendly status updates
* Reduced-motion support

Do not sacrifice accessibility for visual effects.

---

# 40. PERFORMANCE

Prioritize:

* Server Components
* Optimized images
* Responsive image derivatives
* Lazy loading below-the-fold media
* Minimal client JavaScript
* Code splitting
* Efficient database queries
* Pagination
* Caching where safe
* No autoplay video
* No unnecessary animation
* No public caching of authenticated pages
* No public caching of private files

---

# 41. SEO

Implement:

* Unique page titles
* Unique meta descriptions
* Canonicals
* Open Graph metadata
* Twitter/social metadata
* Sitemap
* Robots.txt
* Structured data where accurate
* Organization schema
* JobPosting schema only for accurate published jobs
* Proper heading hierarchy
* Alt text
* Accessible links

Noindex:

* Login
* Portal
* Admin
* Recruiter
* Private files
* Applicant save/resume pages where appropriate
* Staging environment

Do not create SEO pages for prohibited locations.

---

# 42. LOCATION INTEGRITY

The authoritative operation is:

**Harrisburg only**

Do NOT create content for:

* Metuchen
* Fairless Hills

Do not include those locations in:

* Navigation
* Service areas
* Jobs
* Routing
* SEO
* Schema
* Application choices
* Metadata
* Sitemap
* Cached content

---

# 43. LEGAL / TRUST CONTENT

Create public pages:

* Privacy
* Applicant Notice
* Terms
* Accessibility

Do not fabricate legal language as final legal advice.

Use editable draft/legal content that can be reviewed by the owner/legal counsel.

The application certification, privacy language, retention period, screening disclosures, EEO language, and adverse-action language must be clearly marked for owner/legal/HR approval before production.

---

# 44. CONTACT PAGE

Route:

`/contact`

Show:

Recruiting:

[recruiting@52logisticsinc.com](mailto:recruiting@52logisticsinc.com)

General:

[office@52logisticsinc.com](mailto:office@52logisticsinc.com)

Location:

Harrisburg operation / Terminal 170

Owner-supplied address:

510 Industrial Dr., Harrisburg, PA 17339

Clearly indicate address verification if the final verified address has not yet been supplied.

Include:

* Recruiting contact CTA
* General contact CTA
* Application CTA
* FAQ link
* Careers link

Warn applicants:

Do not email:

* Social Security numbers
* Driver license images
* Background-check documents
* Drug-testing records
* Medical details
* Passwords
* Gate-access information

---

# 45. FAQ PAGE

Include questions such as:

* Where is 52 Logistics based?
* How do I apply?
* Does applying guarantee employment?
* What happens after I apply?
* Should I send sensitive documents by email?
* Can I apply from my phone?
* What happens during onboarding?
* What is the Driver Academy?
* Where can drivers access required systems?
* How are safety acknowledgements handled?

Answers should follow the project brief and should not make unsupported claims.

---

# 46. FOOTER

Create a premium structured footer containing:

* Logo
* Company name
* Independent contracted service provider language
* Navigation
* Careers
* Apply
* Driver Portal
* Contact
* FAQ
* Privacy
* Applicant Notice
* Terms
* Accessibility
* Social links
* Indeed
* Copyright

Social links must come from administrator-configurable settings.

---

# 47. LOADING STATES

Create polished loading states throughout the application.

Include:

* Initial application preloader
* Page skeletons
* Dashboard skeletons
* Table skeletons
* Form submission states
* File upload progress
* Button loading states
* Authentication loading
* Portal loading
* Academy loading

Never leave the user staring at a blank screen.

---

# 48. ERROR HANDLING

Every important operation needs:

* Loading state
* Success state
* Error state
* Retry option
* Clear explanation
* Recovery action

Do not allow silent failures.

Examples:

* Failed application submission
* Failed upload
* Expired save/resume link
* Unauthorized portal access
* Expired invitation
* Failed email
* Failed external resource
* Database error
* Academy submission failure

---

# 49. THIRD-PARTY INTEGRATION BOUNDARIES

Do NOT fake direct API integrations.

Launch behavior:

### First Advantage

Manual external workflow + internal tracking.

### DocuSign

External workflow + internal tracking.

### MyFleetAI / Linehaul Central

Approved external link.

### Motive

Official external app links + instructions.

### Whip Around

Official external app links + instructions.

### Trip Buddy

Administrator-configurable approved link only.

### FedEx AVR

Telephone procedure.

### Gate

Restricted driver-only procedure.

Do not publish gate codes or private access credentials.

---

# 50. ADMIN CONTENT MANAGEMENT

The admin must not require a developer for routine changes.

Management must be able to:

* Add/edit/remove jobs
* Change job schedules
* Change job status
* Edit page content
* Upload media
* Update image metadata
* Create Academy modules
* Edit Academy rules
* Add safety resources
* Publish handbook versions
* Create meetings
* Create announcements
* Assign announcements
* Manage acknowledgement requirements
* Update contact information
* Update app links
* Manage social links
* Update Indeed
* Edit email templates
* View reports
* Manage users
* Disable accounts

---

# 51. MEDIA MANAGEMENT

Create a media management interface.

Allow administrators to:

* Upload media
* Edit title
* Edit description
* Edit alt text
* Edit metadata
* Categorize media
* Archive media
* Replace derivatives
* View original/derivative relationship

Preserve originals.

Do not publicly expose private operational files.

---

# 52. DATA PERSISTENCE

Nothing important should be hardcoded into React state only.

The following must persist in Supabase:

* Applications
* Jobs
* Users
* Roles
* Academy progress
* Safety acknowledgements
* Handbook signatures
* Announcements
* Meetings
* Driver profiles
* Notifications
* Status histories
* Notes
* External workflow tracking
* Admin settings
* Social links
* Resources
* Audit logs

Refresh, logout/login, and different devices must preserve the correct data.

---

# 53. COMPONENT DESIGN

Create reusable components for:

* Navbar
* Footer
* Hero
* CTA
* Job cards
* Application wizard
* Form fields
* Upload fields
* Dashboard cards
* Data tables
* Status badges
* Progress indicators
* Academy module cards
* Safety resource cards
* Announcement cards
* Meeting cards
* Acknowledgement controls
* Modals
* Confirm dialogs
* Toasts
* Empty states
* Error states
* Skeleton loaders
* Breadcrumbs
* Search/filter bars
* Pagination
* Admin navigation
* Portal navigation

Use 21st.dev components where they genuinely improve the interface, but maintain one consistent design system.

---

# 54. DO NOT USE GENERIC UI

Avoid:

* Generic rounded SaaS dashboards
* Plain Bootstrap-looking forms
* Huge collections of floating cards
* Excessive pill-shaped buttons
* Random gradients
* Excessive glassmorphism
* Unnecessary neon colors
* Template-looking job cards
* Generic transportation stock imagery
* Repetitive layouts

The site should look custom-designed specifically for a serious transportation company.

---

# 55. PUBLIC NAVIGATION

Suggested structure:

**Home**

**About**

**Careers**

**Driver Resources**

* Academy Preview
* Safety Center Preview
* Required Apps Preview

**FAQ**

**Contact**

Primary CTA:

**Apply Now**

Authenticated users should see:

**Driver Portal**

Recruiter/Admin links must only appear for authorized authenticated users.

---

# 56. DRIVER PORTAL NAVIGATION

Use a polished dashboard sidebar on desktop and mobile drawer/navigation on mobile.

Items:

* Dashboard
* Profile
* Academy
* Required Apps
* Handbook
* Safety Center
* Safety Meetings
* Announcements
* Acknowledgements
* Contacts
* Logout

Show notification/task counts where useful.

---

# 57. ADMIN NAVIGATION

Sections:

### Recruiting

* Applications
* Jobs
* First Advantage
* DocuSign

### Drivers

* Drivers
* Invitations
* Academy Progress
* Acknowledgements

### Content

* Pages
* Academy
* Systems
* Handbook
* Safety
* Meetings
* Announcements
* Media

### Communications

* Email Templates
* Notifications
* Social Links
* Indeed

### Reporting

* Application Reports
* Academy Reports
* Safety Reports
* Acknowledgement Reports

### System

* Users
* Roles
* Settings
* Audit Logs

---

# 58. DATABASE SECURITY

Use Supabase Row Level Security.

Examples:

Applicants:

* Can only read/write their own application/save-resume data.

Drivers:

* Can only read/write their own permitted profile and portal records.

Recruiters:

* Can access authorized recruiting records.

Content managers:

* Can only manage permitted content.

Administrators:

* Full authorized management access.

Private files:

* Never publicly accessible.

Make authorization decisions server-side and at database policy level.

---

# 59. ACCEPTANCE REQUIREMENT

The project is NOT complete when pages merely look correct.

It is complete only when:

* Navigation works
* Authentication works
* Roles work
* Applications persist
* Save/resume works
* Secure uploads work
* Reference numbers generate
* Recruiter dashboard works
* Status pipeline works
* Notes work
* First Advantage tracking works
* DocuSign tracking works
* Driver Portal works
* Academy progress persists
* Quizzes work
* Acknowledgements work
* Handbook signature unlock works
* Safety resources work
* Safety meetings work
* Announcements work
* Notifications work
* Admin content management works
* Reports work
* Exports work
* Audit logs work
* Private files remain private
* Unauthorized users cannot access restricted pages/data
* Mobile experience works
* Accessibility works
* Error states work
* Loading states work

---

# 60. END-TO-END TESTING

Before considering the project complete, test these scenarios:

### Applicant

1. Select job.
2. Start application.
3. Complete multiple steps.
4. Save.
5. Leave.
6. Resume using secure link.
7. Upload approved file.
8. Validate errors.
9. Sign.
10. Submit.
11. Receive reference number.
12. Verify recruiter can see the application.

### Recruiter

1. Login.
2. View dashboard.
3. Search application.
4. Open application.
5. Add note.
6. Change status.
7. Track First Advantage.
8. Track DocuSign.
9. Export approved data.

### Driver

1. Receive invitation.
2. Activate account.
3. Login.
4. View dashboard.
5. Complete Academy module.
6. Take quiz.
7. Submit acknowledgement.
8. View progress.
9. Review handbook.
10. Sign handbook.
11. Download unlocked handbook.
12. Review safety content.
13. Complete safety meeting acknowledgement.
14. View announcement.

### Administrator

1. Create job.
2. Edit job.
3. Publish job.
4. Create Academy module.
5. Assign module.
6. Create safety resource.
7. Publish announcement.
8. Create safety meeting.
9. Publish handbook.
10. Manage social link.
11. Update email template.
12. View reports.
13. Review audit log.
14. Disable a driver.
15. Confirm disabled driver loses access while records remain intact.

---

# 61. IMPORTANT SCOPE RULE

Do not reduce this project to:

* A brochure website
* A landing page
* A fake dashboard
* Static forms
* Hardcoded job cards
* Fake login
* Fake progress bars
* Fake uploads
* Fake reports
* Non-functional admin screens

Every functional requirement must be implemented with real persistent data and proper authorization.

The original brief explicitly states that a brochure site or clickable mockup does not satisfy the project. Treat this as a full application platform.

---

# 62. DEVELOPMENT APPROACH

Build in this order:

### Phase 1

Project architecture + design system + database architecture + authentication.

### Phase 2

Public website.

### Phase 3

Careers + employment application + save/resume + secure uploads.

### Phase 4

Recruiter workspace.

### Phase 5

Driver authentication + Driver Portal.

### Phase 6

Academy + completion engine.

### Phase 7

Handbook + signatures.

### Phase 8

Safety Center + Safety Meetings + Acknowledgements.

### Phase 9

Announcements + notifications.

### Phase 10

Management/Admin platform.

### Phase 11

Reports + audit logs + media management.

### Phase 12

Security + accessibility + performance + SEO + complete end-to-end testing.

---

# 63. FINAL IMPLEMENTATION RULE

Use the project brief as the authoritative functional specification.

Where the brief says WordPress, translate that functionality into the Next.js/Supabase architecture rather than omitting it.

Where the brief says an integration is manual/external, do not invent an API integration.

Where information is marked pending approval, create an editable draft/pending state rather than inventing content.

Where sensitive information is explicitly excluded, do not collect or store it.

Where a requirement is functional, make it genuinely functional.

The final result should feel like a **premium transportation company's recruiting website combined with a professional internal recruiting system and driver operations platform**, not like a website with a dashboard attached.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52bc2849-2597-4efe-958a-3c36c54f951c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
