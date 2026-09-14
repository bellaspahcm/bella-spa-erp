# Bella English Center - Post-RC Validation Evidence

**Date:** 2026-09-15
**Branch:** `codex/post-rc-validation-english-center`
**Base:** `origin/main@391b0ec5`
**Merge:** PR #109 -> `origin/main@62074058`
**Status:** VALIDATION HARNESS ADDED / FIELD VERIFIED RC HELD

---

## Scope

This workstream adds dedicated Post-RC validation gates after the bounded RC.
It does not add E11, a new product capability, or any Education Kernel change.

```text
Browser route smoke        E6-E9 English Center RC dashboards
Authenticated API probes   Safe GET probes through the browser context
Real database validation   English Center table/RLS/policy catalog checks
Evidence update            Status and validation findings
```

---

## Implemented Validation Gates

```text
npm run e2e:english-center-post-rc
  -> playwright test e2e/tests/28-english-center-post-rc-validation.spec.ts

npm run test:english-center-post-rc-real-db
  -> jest --config jest.real-db.config.ts
     src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts
     --runInBand
```

The browser gate is intentionally strict: browser runtime errors, failed app
fetches, server-component error text, HTTP errors, and unexpected API statuses
fail the gate.

The real database gate is intentionally environment-aware: it skips with a clear
reason when no runnable `DATABASE_URL`, `SUPABASE_DATABASE_URL`, or
`SUPABASE_DB_URL` is configured. A skip is not a PASS.

---

## Fresh Local Verification

```text
npm test -- src/app/api/english-center/__tests__/rc-closure-surface.test.ts --runInBand
  Test Suites: 1 passed, 1 total
  Tests:       4 passed, 4 total

npm test -- src/products/bella-english-center/__tests__/command-center.service.test.ts --runInBand
  Test Suites: 1 passed, 1 total
  Tests:       8 passed, 8 total

npm test -- src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts --runInBand
  Test Suites: 1 skipped, 1 total
  Tests:       1 skipped, 1 total
  Reason: no runnable DATABASE_URL, SUPABASE_DATABASE_URL, or SUPABASE_DB_URL

npx eslint <Post-RC validation files>
  PASS

npm run arch:guard
  PASS

npm run db:migration:zero-downtime
  PASS / no changed Supabase migrations require zero-downtime review

npm run db:migration:check
  PASS / remote drift check skipped because remote database is empty

npm run build
  PASS / collected English Center RC API routes and dashboard pages

git diff --check
  PASS
```

The Command Center service regression includes the Post-RC bugfix for
`rootOrgUnitId: null`, which must resolve active branch org units instead of
calling Platform hierarchy lookup with `null`.

---

## Browser Runtime Result

```text
npm run e2e:english-center-post-rc
  Result: FAIL / runtime environment gap found

Pages observed:
  /dashboard/english-center/learning        rendered
  /dashboard/english-center/tuition         rendered
  /dashboard/english-center/engagement      rendered
  /dashboard/english-center/command-center  page shell rendered,
                                             data fetch failed

API probes:
  /api/english-center/learning/attendance   expected validation status observed
  /api/english-center/learning/progress     expected validation status observed
  /api/english-center/tuition/invoices      expected validation status observed
  /api/english-center/command-center        500
```

Captured runtime blockers:

```text
permission denied for view user_org_unit_access
PGRST205 Could not find table public.english_center_class_sessions
PGRST205 Could not find table public.english_center_learning_progress
command-center API probe returned 500 instead of 200
```

Repository inspection found the corresponding migrations already present:

```text
supabase/migrations/20260914_create_user_org_unit_access_projection.sql
supabase/migrations/20260914120000_create_english_center_timetable_rooms.sql
supabase/migrations/20260914150000_create_english_center_learning_operations.sql
supabase/migrations/20260914190000_create_english_center_engagement.sql
```

This means the current local/staging runtime used by the browser gate is not
yet proven to be aligned with canonical migrations, schema cache, grants, and
authenticated database context.

---

## Canonical-Main Smoke

Executed after PR #109 merge from detached canonical
`origin/main@62074058`.

```text
npm test -- src/app/api/english-center/__tests__/rc-closure-surface.test.ts \
  src/products/bella-english-center/__tests__/command-center.service.test.ts \
  src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts \
  --runInBand
  Test Suites: 1 skipped, 2 passed, 2 of 3 total
  Tests:       1 skipped, 12 passed, 13 total
  Reason: real DB validation skipped locally because no runnable DB URL exists

npm run arch:guard
  PASS

git diff --check
  PASS

npm run build
  PASS / collected English Center RC API routes and dashboard pages

npm run e2e:english-center-post-rc
  FAIL / expected Field Verified RC blocker remains
```

Canonical browser validation still renders the learning, tuition, engagement,
and command-center page shells, but the command-center data path is blocked by:

```text
permission denied for view user_org_unit_access
PGRST205 Could not find table public.english_center_learning_progress
command-center API probe returned 500 instead of 200
```

This confirms PR #109 successfully installed the Post-RC gates on canonical
main, and those gates continue to hold Field Verified RC until a dedicated
runtime database is aligned and revalidated.

---

## Decision

Bella English Center remains:

```text
Release Candidate       BOUNDED RC
Field Verified RC       HELD
Production Candidate    NOT CLAIMED
```

The Post-RC validation workstream is valuable precisely because it found a real
runtime proof gap. The next closure step is not new product feature work; it is
to run the canonical migrations/grants/schema-cache refresh in a dedicated
staging or live-like database, then rerun:

```text
npm run test:english-center-post-rc-real-db
npm run e2e:english-center-post-rc
```

Only after both gates pass against that environment should the status be raised
from bounded RC to Field Verified RC.
