# E5 Bounded Seal Review

**Date:** 2026-09-14
**Scope:** Bella English Center E5 - Timetable / Room Scheduling
**Status:** BOUNDED VERIFIED + SEALED

---

## Review Verdict

E5 is implementation-complete and sealed after PR #94 merged to `main` under
legitimate GitHub policy and canonical main smoke passed on `origin/main@d7f6e4ac`.

This review does not convert broader Education baseline debt, root TypeScript
baseline debt, or CI infrastructure failures into `PASS`.

```text
Implementation                         COMPLETE
Branch                                 codex/e5-timetable-room-scheduling
PR                                     #94 MERGED
Merge commit                           d7f6e4ac
Local English Center tests             PASS: 40/40
E5 service tests                       PASS: 7/7
Migration check                        PASS
Platform architecture guard            PASS
Education conformance                  PASS: 39/39
English Center diagnostics             PASS: 0

CI attribution                         COMPLETE
Education Constitution Enforcement     PRE-EXISTING
Type Check (changed)                   PRE-EXISTING BASELINE / E5 DELTA = 0
Real Database Business E2E             INFRASTRUCTURE/FLAKY / UNRELATED TO E5
Final PR CI                            PASS
Introduced by E5                       0
Unknown attribution                    0

Merge                                  COMPLETE
Smoke                                  PASS
Seal                                   COMPLETE
```

---

## Scope Boundary

E5 was implemented as an English Center product-layer scheduling capability.
It does not add a new Education Kernel scheduling engine.

```text
Platform owns:
  Branch/org context and access projection.

Education OS owns:
  Generic Education contracts and invariants where they exist.

English Center owns:
  Course/class/session/room context specific to language-center scheduling.
```

The Education Constitution explicitly excludes timetabling/classroom layout from
the Course bounded context. No generic Education Kernel scheduling capability
was found that E5 needed to reuse or modify.

---

## Evidence Summary

### Target capability evidence

```text
Room management:
  Product table english_center_rooms
  Tenant and branch scoped
  Active/inactive lifecycle supported

Timetable sessions:
  Product table english_center_class_sessions
  Tenant and branch scoped
  Session lifecycle supported

Conflict invariants:
  Teacher overlap conflict
  Room overlap conflict
  Class overlap conflict
  Branch mismatch rejected
  Tenant mismatch rejected
  Cancellation allowed without rescheduling conflict checks

API/UI:
  English Center rooms API
  English Center timetable API
  English Center timetable dashboard page
```

### Local verification

```text
npx jest src/products/bella-english-center/__tests__ --runInBand
  Test Suites: 5 passed, 5 total
  Tests:       40 passed, 40 total

npx jest src/products/bella-english-center/__tests__/timetable.service.test.ts --runInBand
  Test Suites: 1 passed, 1 total
  Tests:       7 passed, 7 total

npm run db:migration:zero-downtime -- --changed-only
  PASS

npm run db:migration:check -- --changed-only
  PASS / remote drift check skipped because remote latest was empty

npm run arch:guard
  PASS

npm run education:conformance
  Test Suites: 6 passed, 6 total
  Tests:       39 passed, 39 total

English Center scoped typecheck attribution
  Remaining English Center diagnostics: 0
```

---

## CI Attribution

### 1. Education Constitution Enforcement

```text
Classification: PRE-EXISTING
Owner: Broader Bella Education / Preschool architecture remediation
Was blocking PR #94 merge: Yes, before CI policy hardening
Blocking E5 bounded seal eligibility: No, after attribution
```

Evidence:

```text
PR CI:
  npm run education:architecture fails Law 3.
  Violations are in src/products/bella-education.

origin/main@50b2098e local baseline:
  npm run education:architecture
  Test Suites: 1 failed, 1 total
  Tests:       1 failed, 3 passed, 4 total
  Jest rendered diff: Received +199

E5 changed files:
  No files under src/products/bella-education.
```

This is broader Education baseline debt, not an E5 timetable regression.

### 2. Type Check (changed)

```text
Classification: PRE-EXISTING BASELINE / E5 DELTA = 0
Owner: Platform / whole-repository TypeScript hardening and CI baseline policy
Was blocking PR #94 merge: Yes, before CI policy hardening
Blocking E5 bounded seal eligibility: No, after attribution
```

Evidence:

```text
origin/main@50b2098e local baseline:
  CI_SCOPE_AFFECTED_PRODUCTS=english_center
  CI_SCOPE_PRODUCTS=english_center
  npm run typecheck:changed

  Already fails with platform/context, platform/education, platform/host,
  platform/org-unit, and existing English Center BranchHierarchyTree diagnostics.

PR head 280b26af:
  BranchHierarchyTree English Center diagnostics removed.
  Filtered PR-head run shows no diagnostics under:
    src/products/bella-english-center
    src/app/api/english-center
    src/app/dashboard/english-center

  Remaining scope-level failure:
    TypeScript failed and no diagnostic baseline exists for scope "english-center".
```

The E5 delta is zero. The remaining failure is baseline/policy, not E5 product
code.

### 3. Real Database Business E2E

```text
Classification: INFRASTRUCTURE/FLAKY / UNRELATED TO E5
Owner: CI database infrastructure / real-db E2E reliability
Was blocking PR #94 merge: Yes, before Real Database Business E2E rerun passed
Blocking E5 bounded seal eligibility: No, after attribution
```

Evidence:

```text
PR CI failures:
  src/__tests__/e2e-accounting-gl-verification.test.ts
    Failed to create test tenant: Gateway Timeout

  src/__tests__/e2e-order-lifecycle-real.test.ts
    Failed to create test package: Gateway Timeout

Local PR-head rerun:
  npm run test:real-db-e2e
  Test Suites: 4 passed, 4 total
  Tests:       4 passed, 4 total
```

The failing tests are accounting/order lifecycle setup failures and do not
exercise E5 timetable paths.

---

## Governance Decision Applied

The clean path was CI/governance policy hardening, not additional E5 product
changes. PR #94 encoded the policy and merged after all required checks passed.

```text
Required policy decision:
  Required gates should distinguish new regressions from known baseline debt
  and infrastructure failures.

Implemented outcome:
  Encode attribution/baseline policy in CI.
  Rerun PR #94.
  Merge only after GitHub policy permitted a legitimate merge.

Avoid:
  Admin override, unless governance explicitly accepts it.
  E5 code changes aimed at unrelated Preschool/Education/platform debt.
```

---

## Bounded Seal Criteria

E5 may be marked `BOUNDED VERIFIED + SEALED` only after:

```text
[x] Implementation complete
[x] Targeted local verification passed
[x] Migration / architecture checks passed
[x] CI attribution complete
[x] Introduced-by-E5 = 0
[x] Unknown attribution = 0
[x] PR #94 merged to main by legitimate GitHub policy
[x] Canonical main smoke completed after merge
[x] Seal record updated after smoke
```

Current seal state:

```text
E5 - Timetable / Room Scheduling     BOUNDED VERIFIED + SEALED
```

---

## Canonical Main Smoke

```text
Merge commit:
  origin/main@d7f6e4ac

npx jest src/products/bella-english-center/__tests__ --runInBand
  Test Suites: 5 passed, 5 total
  Tests:       40 passed, 40 total

npm run education:architecture:ci
  Education direct database access baseline: 197
  Education direct database access current: 197
  Education architecture baseline policy: ALLOW

npm run ci:education-conformance:test
  PASS EDUCATION CONFORMANCE MISSING SCHEMA = ALLOW INFRASTRUCTURE
  PASS EDUCATION CONFORMANCE SCHEMA OK = RUN TESTS
  PASS EDUCATION CONFORMANCE UNKNOWN PREFLIGHT = BLOCK

npm run education:conformance:ci
  Education conformance CI preflight: RUN_CONFORMANCE
  Education conformance CI reason: Education OS schema is available
  Test Suites: 6 passed, 6 total
  Tests:       39 passed, 39 total

npm run db:migration:check
  Local latest migration: 20260914120000
  Remote latest migration: none
  Migration drift check skipped for empty remote database
```
