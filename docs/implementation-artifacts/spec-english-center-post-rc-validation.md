---
title: 'English Center Post-RC Validation'
type: 'chore'
created: '2026-09-15'
status: 'implemented-with-runtime-blocker'
context:
  - '{project-root}/docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md'
  - '{project-root}/docs/products/bella-english-center/E10_PRODUCT_RECONCILIATION_RC.md'
  - '{project-root}/docs/products/bella-english-center/RC_CLOSURE_EVIDENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bella English Center is a bounded RC, but the remaining confidence gap is runtime evidence: browser route rendering, live/staging API reachability, real database RLS/schema checks, and tenant/branch runtime isolation are not yet proven by a dedicated Post-RC workstream.

**Approach:** Add a narrow, opt-in validation layer that reuses the existing Playwright and Jest/PG harnesses. The work must create evidence gates only; it must not add E11 features, mutate Education Kernel code, or convert missing environment execution into a false PASS.

## Boundaries & Constraints

**Always:** Start from canonical `origin/main`; keep `.cache/` outside commits; route Product through existing API/UI/service/contract surfaces; use existing Playwright auth and PG harnesses; skip with explicit reasons when staging credentials or DB URLs are unavailable; document evidence boundaries honestly.

**Ask First:** Any change requiring new database migrations, seed data in a shared staging tenant, production credential changes, CI required-check policy changes, or Education/Platform Kernel edits.

**Never:** Add E11/product capability, modify `src/platform/education/`, touch Healthcare Kernel, fake live browser/real database PASS with mocks, or use local diverged `main` as provenance.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Browser smoke available | Playwright has E2E auth credentials or localhost Supabase admin env | English Center RC dashboard routes render without HTTP/runtime errors and show expected content | Fail route-specific assertion with captured browser error context |
| Browser smoke unavailable | Missing E2E auth/staging env | Test is skipped with a clear reason | No PASS claim |
| Real DB env available | `DATABASE_URL`, `SUPABASE_DATABASE_URL`, or `SUPABASE_DB_URL` configured | English Center tables exist, RLS is enabled, tenant-scope columns exist, and RLS policies are present | Fail with exact missing table/policy/column evidence |
| Real DB env unavailable | No supported DB URL | Test is skipped with a clear reason | No PASS claim |

</frozen-after-approval>

## Code Map

- `playwright.config.ts` -- Existing browser E2E runner and env loading behavior.
- `e2e/fixtures/auth.ts` -- Existing authenticated admin Playwright fixture.
- `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` -- Pattern for read-only route smoke and runtime error collection.
- `jest.real-db.config.ts` -- Existing real database Jest config, currently enumerates specific files.
- `docs/products/bella-english-center/RC_CLOSURE_EVIDENCE.md` -- Current bounded RC evidence and explicit live E2E non-claim.

## Tasks & Acceptance

**Execution:**
- [x] `docs/products/bella-english-center/POST_RC_VALIDATION_ARCHITECTURE_GATE_RESULT.md` -- create architecture gate for validation-only scope.
- [x] `e2e/tests/28-english-center-post-rc-validation.spec.ts` -- add authenticated browser smoke for English Center RC routes and API reachability.
- [x] `src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts` -- add PG-backed real database schema/RLS validation that skips without DB env.
- [x] `jest.real-db.config.ts` -- include the English Center real DB validation file.
- [x] `package.json` -- add focused validation scripts for English Center Post-RC.
- [x] `docs/products/bella-english-center/POST_RC_VALIDATION_EVIDENCE.md` and `STATUS.md` -- record fresh local evidence and non-claimed gates.

**Acceptance Criteria:**
- Given no staging credentials, when the browser smoke command runs, then it skips with an explicit auth/env reason and does not record PASS.
- Given real DB URL is configured, when the real database validation runs, then it verifies all English Center RC tables have RLS and tenant-scope columns.
- Given the Post-RC validation branch, when targeted regression runs, then existing RC surface tests still pass.
- Given evidence docs are updated, when reading status, then Bounded RC remains intact and Field Verified RC remains pending until live browser/real DB gates execute successfully.

## Verification

**Commands:**
- `npm test -- src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts --runInBand` -- expected: pass or explicit skip when DB URL absent.
- `npx playwright test e2e/tests/28-english-center-post-rc-validation.spec.ts` -- expected: pass or explicit skip when E2E auth env absent.
- `npm test -- src/app/api/english-center/__tests__/rc-closure-surface.test.ts --runInBand` -- expected: 4/4 PASS.
- `npm run arch:guard` -- expected: PASS.
- `git diff --check` -- expected: PASS.
