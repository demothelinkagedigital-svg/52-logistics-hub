# Phase 1B server contract and production blockers

Status: design documentation for the unapplied Phase 1B SQL proposal. No production server adapter is implemented by this document. The existing public application functions use the mock runtime, and the existing Academy functions write directly to tables whose client writes the draft intentionally blocks.

## Applicant endpoint protection

The four applicant-facing database RPCs (`start_public_application`, `resume_application`, `save_application_draft`, and `save_application_employers`) are `service_role`-only. The website must call a trusted server/API endpoint; the browser must never call these RPCs directly or receive the service-role credential.

The server endpoint must use a shared, atomic rate-limit store rather than process memory. Separate limit buckets are required:

| Operation | Proposed limit key | Proposed ceiling |
| --- | --- | --- |
| Application creation | normalized source IP | 5 starts/hour and 20/day |
| Invalid/guessing token validation | source IP | 10 invalid attempts/10 minutes; apply a short cooldown after the limit |
| Valid applicant activity | keyed HMAC of token plus source IP | 30 requests/minute, shared across resume, save, employer, submit, and document-intent endpoints |

These are starting operational limits and must be tuned from observed traffic before launch. Enforce a separate global ceiling and request-body limit. A successful token validation must not reset the token-guessing bucket. Do not key rate limits by raw token or email.

For start, accept only the selected published/open job ID, call the start RPC, and return the resume token once. Do not provide email- or reference-code lookup. For resume, save, employer, submit, and upload-intent failures, return the same generic public error for invalid, unknown, expired, revoked, consumed, and otherwise unusable tokens; do not reveal whether an email, reference, or application exists. Apply the same response shape and status to those cases and avoid token-dependent error text.

Never log raw resume tokens, request URLs containing them, or full applicant payloads. Redact tokens from tracing, error reporting, analytics, proxy/access logs, and support tooling; use a separately keyed, non-reversible correlation identifier only if operationally necessary. Resume pages and responses must be `Cache-Control: no-store`; set a restrictive referrer policy and avoid third-party scripts on token-bearing routes. API-level integration tests must exercise rate-limit sharing across instances, bucket separation, generic error equivalence, and log redaction. The SQL test file does not prove these controls.

## Application form to RPC mapping

`src/lib/public-application.functions.ts` currently imports the mock server-function runtime and in-memory mock DB. There is no production adapter to the Phase 1B RPCs. Keep the current demo runtime active until a separately reviewed server adapter, auth/service boundary, and end-to-end test suite are ready.

| Current form/request field | Draft RPC destination | Adapter rule |
| --- | --- | --- |
| `job_id` | `start_public_application(_job_id)` or draft patch `job_id` | Accept only a published/open job. On draft saves, let the SQL function derive the position title from this ID. |
| `position_title` | None | The form derives/sends this for display, but the RPC must ignore/reject client-supplied titles. Never persist a title that does not match the selected published job. |
| Applicant identity/contact, eligibility/CDL, experience, availability, medical-card status/expiry, consent, and `how_did_you_hear` | `save_application_draft(_token, _patch)` | Map only SQL allowlisted columns; normalize empty optional values consistently and preserve explicit false/zero values. Do not send table IDs, owner IDs, recruiter fields, status, token material, or legacy sensitive fields. |
| `additional_notes` | None | Present in the schema but not rendered by the current application form. It is excluded from applicant RPCs because uncontrolled free text is not a reviewed SRS field and could collect prohibited sensitive data. Resolve its product/privacy status before exposing it; do not silently add it to the RPC allowlist. |
| `signature_name` | `submit_application_draft(_token, _signature_name)` | Send only at final submission. SQL validates a legal-name match and sets the signature timestamp and certification state. It is not a draft-patch field. |
| `signature_signed_at`, `certified` | Server-derived on submit | Never accept client values. SQL records timestamp and certification only after successful final validation. |
| `qualification_gap`, `qualification_gap_reasons` | Server-derived on submit | The current form computes these client-side, but the adapter must omit them. The SQL submission function recomputes the flag/reasons from stored answers. |
| Employer array | `save_application_employers(_token, _employers)` | Send the approved employer fields only: name, position, location, phone, dates, leaving reason, DOT status, current-employer, commercial relevance, contact permission, and equipment operated. Strip employer IDs, application/user IDs, sort order, audit fields, and other unknown keys. Preserve input order. |
| Document metadata | No applicant RPC in the form | Use the upload proxy contract below; do not accept a browser-supplied storage path as proof of ownership. |

The schema also contains fields not currently rendered or hydrated by the form, including `middle_name`, employer phone/equipment, and `additional_notes`. Verify intended SRS use and UI ownership before mapping them. Preserve any approved required field explicitly; do not spread the entire Zod object into SQL. `position_title`, certification, signature timestamp, and qualification-gap values are examples of form/client values that are derived or server-controlled rather than trusted inputs.

The start page currently requires the applicant to select an opening and sends its UUID. The RPC requires a published/open job. The draft save RPC updates the selected job and derives `position_title`; the adapter should pass both operations only when the selected job is still valid. Invalid/unavailable job failures must not disclose private application records.

## Private applicant document upload/download

The bucket must remain private. Client storage policies and client execution of upload/record/delete RPCs stay revoked. The trusted upload proxy must:

1. Accept a resume token and document category, then validate the token through the server-only RPC and confirm it is active, unexpired, unrevoked, unconsumed, and still a draft.
2. Enforce the category allowlist (`resume`, `medical_card`), configured byte-size limit (10 MiB), and MIME/extension allowlist. Inspect file bytes/magic signatures and run malware scanning; browser MIME headers and object metadata alone are insufficient. Reject malformed or mismatched content.
3. Call `create_application_upload_target` server-side. Keep the returned intent ID and opaque random object path on the server; do not expose service credentials or allow caller-selected paths.
4. Stream the bytes to the private `applicant-documents` bucket with overwrite/upsert disabled and no public URL. Apply no-store caching and avoid token-bearing storage metadata.
5. Verify uploaded object size and server-controlled metadata, then call `record_application_document(token, intent_id)`. This RPC must bind the intent and document to the application found by that same token. If upload or registration fails, remove the unregistered object/intent through a trusted cleanup path.
6. For reads/deletes, accept a document ID, resolve its application and storage path server-side, then authorize the matching applicant token or an authorized recruiter. Never accept an arbitrary path. Proxy bytes or issue a narrowly scoped, short-lived URL only after authorization. Delete the object first and complete metadata cleanup second; audit both outcomes.

No upload/download proxy, file-byte validation, malware scanner, or API rate limiter exists in the current application code. These are production blockers, not controls proven by the SQL proposal. SQL synthetic tests can verify RPC grants, intent-to-application association, private bucket configuration, and cross-application denial; they cannot prove proxy authorization, byte inspection, malware scanning, caching, or log redaction.

## Academy progress and completion operations

The existing Academy functions use the `lms_*` tables. The Phase 1B draft leaves client access read-only for progress/enrollment/quiz attempts, blocks direct acknowledgement/signature writes, withholds quiz answer keys, and grants no direct client progress writes. The current `src/lib/lms.functions.ts` therefore cannot continue its direct `upsert`/`insert` mutations unchanged after this draft is applied.

A separate Academy server-RPC implementation is required. RPCs should be `SECURITY DEFINER` with fixed `search_path`, derive the actor from `auth.uid()`, require an active driver row and the relevant published content, and be executable by `authenticated` only where identity-bound. Do not create a generic `completed = true` operation.

Required operation contracts:

- **Lesson/module progress:** record server-observed evidence events (for example, eligible lesson view/ack events with content ID and timestamps generated on the server). Derive module and course progress from eligible required lessons; do not accept caller-calculated percentages, completion timestamps, or completion booleans. No separate module-progress table exists in the current LMS schema, so module completion should be derived unless a reviewed schema addition is approved.
- **Quiz completion/results:** accept quiz ID and bounded answers only; load answer keys server-side, validate enrollment and attempt limits, score server-side, and append an immutable attempt with score/pass state. Never return answer keys or trust client score/pass/attempt number.
- **Handbook/resource acknowledgements:** require a currently published version/resource and, when required, a signature name. Derive user and signed/acknowledged time from the authenticated request; preserve the exact content/version identifier and append evidence once per policy.
- **Manager verification:** require an active administrator or explicitly authorized manager/recruiter role and the correct driver/course assignment. Store verifier identity, decision, timestamp, and bounded reason; audit every decision.
- **Progress reset:** require authorized manager/admin, a non-empty reason, and a specific driver/course scope. Record an append-only reset/audit event and preserve historical attempts and acknowledgements rather than silently deleting evidence. Recompute current progress from post-reset evidence.

Required Academy operations, scoring logic, manager verification, reset audit schema, and end-to-end tests are not implemented in Phase 1B and must be completed before connecting the existing Academy workflow to production tables.

## Temporary developer access

The developer role row is not an authorization source in the draft: `has_role(..., 'developer')` is always false, self-service role reads hide the developer marker and other roles for a user carrying that marker, and the `has_temporary_developer_scope` helper checks the grant expiry/revocation and exact `public_content` scope. The app session helper also filters the marker from permission checks, and the admin role editor cannot assign it; role changes use the audited RPC. New temporary grants do not insert a permanent role row. Other grants are refused while a developer marker remains. Browser/UI behavior still requires end-to-end verification.

Administrators revoke grants with `revoke_temporary_developer_access`. The server-side `cleanup_expired_temporary_developer_access` function marks expired grant rows revoked and appends audit events; it removes a stale developer marker only when no conflicting role remains. If mixed legacy roles exist, it keeps the marker fail-closed and emits a review-required audit event until an administrator explicitly reconciles the conflicting role. The cleanup function is executable only by `service_role`. Production must schedule and monitor this cleanup. Expiry authorization is enforced immediately by the scope helper even if cleanup is delayed; cleanup is required for stale-row hygiene. Existing legacy developer rows must be reviewed and cleaned before rollout. Developer access never includes applications, applicant documents, screening data, role administration, security settings, or production secrets.

## Data and verification boundaries

The draft does not add storage for SSN, date of birth, license images, MVR/Clearinghouse/drug/background results, or First Advantage credentials/passwords. The minimal FADV record is limited to invitation date, responsible recruiter, external case/reference ID, next-check date, and audit metadata. Existing legacy columns and rows are not deleted; access revocation is not a data-removal or retention policy.

The synthetic SQL suite tests database privileges, RLS helpers, token RPC outcomes under `service_role`, role boundaries, status protections, immutable response/employer snapshots, cross-application document association, notifications, FADV metadata, developer expiry/revocation, driver isolation, Academy write grants, private storage guards, and audit visibility. The suite is transactional and ends in `ROLLBACK`.

The SQL suite does **not** test API rate limiting, endpoint response equivalence, email delivery, raw-token log redaction, browser cache/referrer behavior, proxy authentication, upload byte validation, malware scanning, or production workflow integration. No SQL suite or static check makes this draft production-ready. The migration must remain unapplied until PostgreSQL/Supabase validation, security review, trusted server implementations, and end-to-end tests are complete.
