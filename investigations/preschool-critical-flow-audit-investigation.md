# Investigation: Preschool Critical Flow Audit

## Hand-off Brief

1. **What happened.** Preschool Chain implementation is complete but Real DB/UI evidence is incomplete; the next task is to audit other Preschool critical flows without reopening Chain code.
2. **Where the case stands.** Active; flow audit begins at Student / Admission with explicit criteria for a true GAP.
3. **What's needed next.** Trace each critical flow from UI to API, contract, DB, downstream effect, read-back, tenant/auth, then only fix confirmed critical GAPs.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-06 |
| Status | Active |
| System | BELLA SPA ERP worktree `preschool-chain-audit`; Windows/PowerShell |
| Evidence sources | Source code, tests, migrations, architecture gates, local command output |

## Problem Statement

Audit Preschool critical business flows after Chain implementation. Do not continue Chain coding. Classify each flow as `PASS`, `PARTIAL`, `NOT_PROVEN`, or `BLOCKED`; only implement minimal fixes for confirmed, business-critical gaps.

## True GAP Criteria

A finding is a **GAP** only when all of these are true:

1. The missing or incorrect behavior is required by the Preschool business flow or by an existing Bella contract/pattern.
2. The failure is on the current canonical path, not just a legacy, demo, static, or alternate path.
3. The flow has a concrete break in one or more required links: UI, API, contract, business logic, DB persistence, downstream effect, read-back, tenant isolation, or authorization.
4. Existing code/tests/evidence cannot already prove the behavior.
5. A minimal fix is possible inside the authorized product/API/UI layer without modifying frozen Education Kernel or Platform ownership.

Use these non-GAP labels:

- `PASS`: direct evidence proves every critical link for the audited flow.
- `PARTIAL`: core runtime exists, but one or more non-blocking proof/surface links are incomplete.
- `NOT_PROVEN`: code may exist, but evidence is missing or mock-only.
- `BLOCKED`: required proof or fix needs unavailable environment, credentials, authority, or frozen-core/platform change.
- `N/A`: the flow/link is not required by the business contract.

Do not classify as GAP:

- Real DB proof missing solely because Real DB env is unavailable.
- UI E2E missing when unit/static proof exists and no user-facing break is found.
- Pre-existing architecture debt unrelated to the audited flow.
- Opportunity to improve UX, naming, refactor, abstraction, or reuse.
- Legacy/parallel code path that is not invoked by the canonical runtime.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Preschool Chain implementation | Available | Current worktree contains product-layer chain implementation; Real DB remains blocked/not proven. |
| Preschool Student / Admission source | Available | UI/API/contract/DB path traced. Mutation path is canonical; registry read-back was static-only before fix. |
| Focused local verification | Available | Enrollment/branch/chain Jest tests, changed-file typecheck, targeted lint, no-new-debt gate, diff check. |
| Real DB environment | Missing | Worktree has no `.env.local`; process env lacks Supabase URL/service role. Do not claim Real DB PASS. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Student / Admission | High | Fixed / PARTIAL | Canonical mutation path exists; fixed registry read-back UI/API. Real DB and browser UI E2E remain not proven. |
| 2 | Branch / Chain assignment | High | Done | Implementation complete; evidence incomplete. Do not reopen unless dependency evidence is needed. |
| 3 | Class | High | Fixed / PARTIAL | Fixed canonical `edu_courses` read-back/list source and canonical write failure handling. Real DB/UI E2E not proven. |
| 4 | Enrollment | High | PASS / NOT_PROVEN Real DB | Contract/service/engine path proven locally; Real DB not run in this environment. |
| 5 | Attendance | High | In Progress | Audit daily attendance path next. |
| 6 | Tuition / Payment | High | Open | Audit finance path. |
| 7 | Parent / Guardian | Medium | Open | Audit guardian authorization and parent surfaces. |
| 8 | Reporting | Medium | Open | Audit reporting/read models. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-10-06 | Preschool Chain code stopped at implementation complete / evidence incomplete. | Conversation + worktree | Confirmed |
| 2026-10-06 | Student / Admission trace found POST path creates canonical Party-backed Student, guardian authorization, `edu_enrollments`, and contract read-back. | `src/app/api/education/enrollments/route.ts`, route test, operational integration test source | Confirmed |
| 2026-10-06 | Student registry UI was initialized from static demo data and had no `GET /api/education/enrollments` canonical read-back after reload. | `src/app/dashboard/education/enrollments/page.tsx` before fix | Confirmed |
| 2026-10-06 | Minimal fix added tenant-scoped registry GET read model and changed UI to load/refresh from canonical API. | Current diff | Confirmed |
| 2026-10-06 | Verification passed: targeted Jest 3 suites / 12 tests; `typecheck:changed` full scope zero diagnostics; targeted ESLint 0 errors; `gate:education-no-new-debt` PASS; `git diff --check` PASS. | Local command output | Confirmed |
| 2026-10-06 | `education:architecture` still fails with 221 pre-existing product-layer Law 3 violations; no new changed app-route/UI files are listed. | Local command output | Confirmed |
| 2026-10-06 | Class flow trace found `GET /api/education/courses` listed projection table `courses` while admission/enrollment runtime verifies canonical `edu_courses`. | `src/app/api/education/courses/route.ts` before fix | Confirmed |
| 2026-10-06 | Minimal Class fix changed classroom list/admission options to source canonical `edu_courses`, merge `courses` projection for display metadata, and reject creation if `edu_courses` write fails. | Current diff + focused course route test | Confirmed |
| 2026-10-06 | Class verification passed: focused course route Jest 2/2; combined focused Jest 4 suites / 14 tests; changed typecheck zero diagnostics; targeted ESLint 0 errors; no-new-debt PASS; CI architecture wrapper PASS. | Local command output | Confirmed |
| 2026-10-06 | Enrollment trace confirmed Product -> public Enrollment contract -> Education engine -> RPC transaction -> `edu_enrollments` -> read-back -> event-after-persistence. | Enrollment service, contract impl, Education engine, repository source | Confirmed |
| 2026-10-06 | Enrollment focused conformance passed 7/7 with mocked public contracts; engine integration source covers idempotency/event behavior but Real DB suite was not run due missing env. | Local command output + source | Confirmed |

## Confirmed Findings

### Finding 1: Student / Admission mutation uses canonical Education path

**Status:** PASS for local code/test proof; Real DB remains not proven.

Trace:

```text
UI admission submit
-> POST /api/education/enrollments
-> StudentContractImpl.registerStudent
-> EnrollmentProductService.enrollStudent
-> EnrollmentContractImpl / EducationEngineService
-> party_parties + students + edu_enrollments
-> student/enrollment read-back before 201
-> guardian authorization persistence
```

Evidence:

- Route code creates canonical student Party, validates active `edu_courses`, registers Student through Education contract, enrolls through product service + Education contract, and reads back Student/Enrollment before success.
- Focused route tests cover canonical Party insert, contract calls, guardian authorization dependency, enrollment read-back failure, and no legacy `persons` / `identity_migration_mapping` access.
- Existing operational integration test source proves the intended Real DB chain when credentials are available, but it was not run in this environment.

### Finding 2: Student registry read-back UI was static-only

**Status:** GAP fixed locally; final proof is PARTIAL because Real DB/UI E2E are unavailable.

Root cause:

- The student registry page initialized from `STUDENTS_LIST` demo rows.
- Admission submit prepended the POST response locally, so the new student appeared only in client state.
- There was no `GET /api/education/enrollments` endpoint for reload/read-back from canonical persisted rows.

Minimal fix:

- Added `GET /api/education/enrollments` tenant-scoped read model.
- Read model joins canonical `edu_enrollments`, `students`, `party_parties`, `edu_courses`, and existing guardian authorization service.
- Updated registry UI to load from the API on page load and refresh from the same read-back API after admission submit.
- Removed demo rows from the canonical registry initial state.

### Finding 3: Optional nickname / medical note persistence remains not proven

**Status:** NOT_PROVEN / authority-boundary note, not fixed in this pass.

Evidence:

- UI collects `nickname` and `medicalNote`.
- POST response echoes those request values, but the current Education `RegisterStudentInput` does not include metadata and the route does not persist them through an authorized contract.
- The new registry GET can read `students.metadata.nickname` and `students.metadata.medicalNote` if present, but this audit did not create a new persistence contract or mutate frozen Education Kernel.

Classification:

- Not a blocker for canonical Student/Admission identity + enrollment persistence.
- Remaining product profile detail gap if the business contract requires nickname/medical-note durability.

### Finding 4: Class list used projection table instead of canonical enrollment course source

**Status:** GAP fixed locally; final proof is PARTIAL because Real DB/UI E2E are unavailable.

Root cause:

- `POST /api/education/courses` created both `courses` projection and `edu_courses`, but did not fail if canonical `edu_courses` persistence failed.
- `GET /api/education/courses` sourced class/admission options from `courses`.
- Enrollment runtime validates `courseId` against `edu_courses`, so the UI could list a class that is not enrollment-compatible.

Minimal fix:

- `GET /api/education/courses` now lists canonical `edu_courses` first.
- Legacy `courses` rows are used only as a display projection for room/grade/name metadata.
- Course creation now returns failure and rolls back the projection row when canonical `edu_courses` insert fails.

### Finding 5: Enrollment runtime path is canonical locally

**Status:** PASS for local code/test proof; Real DB remains NOT_PROVEN.

Trace:

```text
POST /api/education/enrollments
-> EnrollmentProductService.enrollStudent
-> IEducationEnrollmentContract
-> EnrollmentContractImpl
-> EducationEngineService
-> SupabaseEducationRepository.executeEnrollStudentTransaction
-> RPC edu_enroll_student_v3
-> edu_enrollments
-> getEnrollment read-back
-> edu.enrollment.created.v1 event after persistence
```

Evidence:

- Product service validates manifest capability/workflow and tenant/student/course boundaries.
- Engine requires `requestId`, validates student/course tenant scope, performs RPC transaction, reads back persisted enrollment, then publishes event only for non-duplicate creation.
- Existing engine test source covers DB persistence, event-after-persistence, idempotent duplicate replay, and tenant isolation.
- Product conformance test passed locally with public contract mocks.

## Deduced Conclusions

Student / Admission and Class are `PARTIAL`: critical local gaps were fixed, but Real DB E2E and browser UI E2E remain `NOT_PROVEN`. Enrollment runtime is `PASS` locally at code/test level, with Real DB proof still unavailable.

## Hypothesized Paths

### Hypothesis 1: Other Preschool flows may have Chain-like canonical path gaps

**Status:** Confirmed for Student / Admission registry read-back; still open for later flows.

**Theory:** Because Branch/Chain assignment lacked full product UI/runtime evidence, adjacent Preschool flows may also have split legacy/canonical paths.

**Supporting indicators:** Chain audit found product UI missing branch assignment before fix.

**Would confirm:** A critical flow uses legacy/static/mock data on its canonical user path while claiming runtime readiness.

**Would refute:** Each critical flow traces cleanly through canonical UI/API/contracts/DB/read-back/tenant/auth.

**Resolution:** First confirmed GAP fixed. Continue with Class flow only after accepting Student / Admission as PARTIAL pending environment proof.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Real DB environment | Cannot prove Real DB E2E or Go-Live readiness. | Provide Supabase URL/service role and apply migrations in controlled env. |
| Browser UI E2E | Cannot prove human-visible Admission -> registry/class read-back. | Run Playwright against a seeded/test tenant with authenticated user and DB. |
| Optional preschool profile metadata persistence | Cannot prove nickname/medical-note durability. | Confirm business authority/contract for Preschool profile details; then wire through authorized product/contract path only. |

## Source Code Trace

Student / Admission:

```text
src/app/dashboard/education/enrollments/page.tsx
-> GET /api/education/enrollments for registry read-back
-> POST /api/education/enrollments for admission
-> src/products/bella-education/services/enrollment.service.ts
-> src/platform/education/contracts/student.contract.impl.ts
-> src/platform/education/contracts/enrollment.contract.impl.ts
-> src/platform/education/education-engine.service.ts
-> src/platform/education/repositories/supabase-education.repository.ts
-> party_parties / students / edu_enrollments
-> route read-back and UI refresh from GET
```

Class:

```text
src/app/dashboard/education/courses/page.tsx
-> GET /api/education/courses
-> canonical edu_courses list
-> optional courses projection display metadata
-> TeacherAssignmentContractImpl for teacher display
-> edu_enrollments / edu_attendance_daily_state counts
-> UI read-back

POST /api/education/courses
-> courses projection insert
-> canonical edu_courses insert
-> TeacherAssignmentContractImpl optional lead assignment
-> UI refresh from GET
```

Enrollment:

```text
EnrollmentProductService
-> IEducationEnrollmentContract
-> EducationEngineService
-> SupabaseEducationRepository
-> edu_enroll_student_v3 RPC
-> edu_enrollments
-> contract getEnrollment read-back
-> domain event after persistence
```

## Conclusion

**Confidence:** Medium

Student / Admission and Class are locally repaired and classified `PARTIAL`; Enrollment is locally `PASS` with Real DB proof unavailable. Preschool should not be called Go-Live ready until Real DB E2E and browser UI E2E prove the same paths in a real tenant environment.

## Recommended Next Steps

### Diagnostic

Next sequential audit target: Attendance. Do not move into Tuition/Payment, Parent/Guardian, or Reporting until Attendance is classified.

## Reproduction Plan

1. Provide Real DB test environment with Supabase URL/service role and migrated schema.
2. Apply pending Preschool Chain migration if not already applied.
3. Seed authenticated tenant user, active course, branch/org unit, and user branch access.
4. Run POST admission with branchId.
5. Run GET `/api/education/enrollments` and verify the newly persisted student is returned from canonical rows.
6. Run browser UI E2E: open registry, submit admission, verify student appears after API read-back/reload.

---

## Continuation Findings - Attendance Through Reporting

### Attendance

**Status:** PASS for local route/service proof; Real DB remains NOT_PROVEN.

Trace:

```text
/dashboard/education/attendance
-> GET /api/education/attendance
-> AttendanceProductService
-> IEducationAttendanceContract
-> edu_enrollments + edu_attendance_daily_state read-back
-> guardian authorization + pickup handover read-back

POST /api/education/attendance
-> EducationSecurityGuardService role boundary
-> AttendanceProductService.setDailyAttendance
-> AttendanceContractImpl
-> edu_attendance_daily_state

POST /api/education/attendance/handover
-> EducationSecurityGuardService role boundary
-> PreschoolSafePickupHandoverService
-> edu_preschool_pickup_handover_events
```

True GAP fixed: Attendance and pickup handover mutation routes did not enforce the existing `EducationSecurityGuardService.assertCanModifyAttendanceRoster` boundary. Added minimal route-level role mapping and tests.

### Tuition / Payment

**Status:** PASS for local service/API proof; Real DB remains NOT_PROVEN.

Trace:

```text
/dashboard/education/finance
-> /api/education/finance
-> resolvePreschoolFinanceActor
-> TuitionBillingService / InvoiceIssuanceService / PaymentReconciliationService
-> PreschoolFinanceRepository
-> edu_fin_* tables
-> finance UI read-back
```

True GAP fixed: payment reconciliation compared legacy `studentId`; canonical finance allows `student_id = null` and uses `student_party_id`. Reconciliation now compares `payment.studentPartyId` to `invoice.studentPartyId`, with regression coverage.

### Parent / Guardian

**Status:** PASS for local route/service proof; Real DB remains NOT_PROVEN.

Trace:

```text
Admission guardian fields
-> PreschoolGuardianAuthorizationService
-> party_parties / party_identifiers / party_relationships / edu_preschool_pickup_authorizations
-> Parent Daily UI
-> /api/education/parent-daily
-> PreschoolParentDailyExperienceService
-> party_relationships guardian_of
-> edu_enrollments / edu_attendance_daily_state / edu_daily_care_* / handover events
```

True GAP fixed: parent daily and care digest routes authenticated a user but did not explicitly require `users.role = parent`. Added route-level role boundary and tests.

### Reporting

**Status:** PARTIAL. Critical tenant/auth and current KPI read-back gaps were fixed; full historical/trend report E2E remains NOT_PROVEN.

Trace:

```text
/dashboard/education/reports
-> /api/education/analytics
-> authenticated tenant from getCurrentUser()
-> PreschoolAnalyticsService
-> PreschoolAnalyticsRepository
-> edu_enrollments / edu_courses / edu_attendance_daily_state / edu_fin_* / edu_comm_* read-back
-> KPI cards and executive insight display current tenant metrics
```

True GAPs fixed:

- Analytics API accepted client-supplied/default tenant instead of server-authenticated tenant.
- Reporting UI showed current executive KPI claims from hard-coded constants.
- Analytics repository used non-canonical enrollment/class/attendance fallbacks before canonical `edu_*` paths.

Remaining NOT_PROVEN:

- Browser UI E2E for Reporting.
- Real DB analytics proof.
- Historical trend charts still depend on static historical placeholders because the current analytics DTO only supplies current snapshot metrics.
