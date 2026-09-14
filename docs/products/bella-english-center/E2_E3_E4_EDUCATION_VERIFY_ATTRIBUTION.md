# E2/E3/E4 Education Verification Attribution

**Date:** 2026-09-14
**Scope:** Bella English Center E2/E3/E4 authorization closure
**Status:** ATTRIBUTION COMPLETE / GOVERNANCE ACCEPTED

---

## Executive Verdict

The branch-access architecture blocker for the English Center target scope has
been resolved and verified separately, but `education:verify` still fails in the
broader Education baseline.

The failing Education architecture guard violations are attributable to the
pre-existing `src/products/bella-education` product area, not to the current
English Center E2/E3/E4 branch-access fix.

```text
Target scope branch-access architecture       RESOLVED
Target scope branch-aware RLS                 APPLIED
Target scope runtime branch isolation         PASS
Targeted English Center tests                 PASS
Platform architecture guard                   PASS

Broader education:verify                      FAIL
Failure owner                                 Broader Bella Education baseline
E2/E3/E4 introduced Education violations      0
E2/E3/E4 touched Education violations         0
Unknown attribution                           0
E2/E3/E4 final seal                           BOUNDED VERIFIED + SEALED
E5                                            UNBLOCKED after commit, PR, CI, and main merge
```

---

## Command Evidence

### 1. Failing guard

Command:

```bash
npx jest src/products/bella-education/__tests__/bella-education-architecture.test.ts --runInBand --json --outputFile=%TEMP%/bella-education-architecture-jest.json
```

Result:

```text
Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total
Failing assertion:
Law 3: Zero Direct Kernel Database Access
```

Jest prints the diff header as:

```text
Received +199
```

However, parsing the actual violation messages in the failure output gives:

```text
Direct database query violations: 197
Direct RPC violations:            0
Actual violation entries:         197
```

The `+199` value is Jest's rendered diff-line count, not the count of violation
entries. The canonical actionable count for attribution is therefore 197
current violation entries.

### 2. Guard scan boundary

The failing test computes:

```ts
const BELLA_EDUCATION_ROOT = path.resolve(__dirname, '..');
```

Because the test file is under
`src/products/bella-education/__tests__`, the guard scans:

```text
src/products/bella-education
```

It excludes:

```text
__tests__
node_modules
*.d.ts
```

It does not scan:

```text
src/products/bella-english-center
supabase/migrations
docs/products/bella-english-center
```

### 3. Current change boundary

Command:

```bash
git diff --name-only
```

Current changed tracked files are limited to:

```text
docs/products/bella-english-center/E2_E3_E4_SEAL_DECISION.md
src/products/bella-english-center/__tests__/enrollment.service.test.ts
src/products/bella-english-center/__tests__/program-course-class.service.test.ts
src/products/bella-english-center/__tests__/teacher.service.test.ts
src/products/bella-english-center/services/enrollment.service.ts
supabase/migrations/20260913_create_english_center_enrollments.sql
supabase/migrations/20260913_create_english_center_program_course_class.sql
supabase/migrations/20260913_create_english_center_teachers.sql
```

There are no tracked changes under:

```text
src/products/bella-education
```

The new untracked artifacts are English Center documentation and Supabase
migrations only; they are also outside the Education architecture guard scan
root.

### 4. Baseline comparison

A guard-equivalent scan was run against both the current working tree and
`origin/main`.

Result:

```text
Current violation entries:      197
origin/main violation entries:  197
Introduced by current work:       0
Removed by current work:          0
Touched bella-education files:    0
```

Current violations by area:

```text
analytics                  18
care-wellbeing             23
facilities                 25
finance                    22
learning-development       55
parent-engagement          36
scheduling                 18
```

Current violations by kind:

```text
direct_table:edu_*         190
direct_table:students        7
direct_rpc                   0
```

---

## Attribution Classification

```text
PRE-EXISTING / BROADER EDUCATION SCOPE       197
INTRODUCED_BY_E2_E3_E4                         0
TOUCHED_BY_CURRENT_FIX                          0
UNKNOWN                                         0
```

The violations are pre-existing relative to `origin/main` and live entirely
inside `src/products/bella-education`. They should not be treated as new
English Center E2/E3/E4 violations.

---

## Governance Decision

Governance accepts scoped attribution:

```text
Broader Education architecture violations -> formally scoped out
E2/E3/E4 target evidence                  -> bounded verified + sealed
```

If this acceptance is later revoked or governance requires full
`education:verify` green before seal:

```text
E2/E3/E4 final seal -> HOLD
E5                  -> HOLD
```

This report does not itself seal E2/E3/E4. It only establishes that the current
`education:verify` failure is not introduced by the English Center branch-access
repair.

For the governed bounded-seal packet, use
`E2_E3_E4_BOUNDED_SEAL_REVIEW.md`.

---

## Migration Evidence Limitation

`db:migration:check` has passed only under drift-skip conditions because the
remote migration history is empty:

```text
Remote latest migration: none
Migration drift check skipped for empty remote database
```

This is not full migration-history proof. It may be acceptable only as a
bounded limitation if governance explicitly accepts it.
