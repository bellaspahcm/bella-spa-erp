# Production Any-Type Batch P1 Result

Date: 2026-09-30
Status: SEALED FOR P1-A SCOPE

## Scope

Production Batch P1 targeted only Education API/UI catch narrowing:

- `src/app/api/education/analytics/route.ts`
- `src/app/api/education/care/medication/route.ts`
- `src/app/dashboard/education/facilities/page.tsx`
- `src/app/dashboard/education/scheduling/page.tsx`

## Any-Type Evidence

```text
Before P1 production baseline: 93 violations / 37 files
After P1 production scan:      79 violations / 34 files
Removed:                       14 violations /  3 files
```

P1 removed all targeted catch narrowing violations:

```text
rg "catch ((err|error): any)" in touched files = CLEAN
```

Remaining touched-file production violation:

```text
src/app/dashboard/education/scheduling/page.tsx
- onChange={(e) => setLeaveType(e.target.value as any)}
- classification: P1-B Type-local UI union narrowing
- intentionally not changed in P1-A catch narrowing batch
```

## Verification

```text
targeted catch scan                  PASS
independent production scan           PASS
git diff --check                      PASS
targeted ESLint                       PASS
targeted Jest                         NOT FOUND
production-runtime-integrity.test.ts  EXPECTED FAIL
```

## Lint Blocker Resolution

A pre-existing lint blocker was exposed during the first P1-A verification:

```text
src/app/dashboard/education/scheduling/page.tsx
react/no-unescaped-entities
Chưa có ca làm việc nào được xếp cho ngày này. Bấm nút "Phân Công Ca Sáng Mẫu" để khởi tạo.
```

This is not caused by P1. `git show HEAD:src/app/dashboard/education/scheduling/page.tsx` shows the same text existed before the current P1 diff at old line 524.

The blocker was handled in a separate lint mini-campaign:

```text
LINT_BASELINE_P1A_BLOCKER = SEALED
```

After that, targeted ESLint passed with exit code 0. It still reports two hook dependency warnings:

```text
src/app/dashboard/education/facilities/page.tsx
- React Hook useEffect has a missing dependency: loadData

src/app/dashboard/education/scheduling/page.tsx
- React Hook useEffect has a missing dependency: loadData
```

These warnings do not fail the targeted ESLint command and are outside P1-A.

## Production Invariant Result

The production invariant test was rerun:

```text
npx jest src/__tests__/invariants/production-runtime-integrity.test.ts --runInBand
```

Result:

```text
FAIL
INVARIANT 1: Found 79 unapproved any in production code
INVARIANT 3: next.config.ts has ignoreBuildErrors: true
```

This is expected for P1-A because the remaining 79 violations are explicitly outside the catch-narrowing scope:

```text
P1-B UI union narrowing
Supabase/generated contract
Frozen Logistics
JSON/dynamic payload
Finance/Core-adjacent
runtime boundary
scanner-noise comment
```

## Governance Classification

```text
Runtime change       NONE intended
Contract change      NONE
DB/RPC change        NONE
Kernel/Core change   NONE
Frozen OS change     NONE
next.config.ts       UNCHANGED

Batch seal status    SEALED_FOR_P1A_SCOPE_ONLY
```

## Decision

Production Batch P1-A is sealed for the authorized catch-narrowing scope only:

```text
14 catch any violations removed
targeted ESLint PASS
production scan 79 / 34 confirmed
```

The broader production baseline remains open. No P1-B, Logistics, Supabase/generated, JSON payload, Finance/Core, runtime-boundary, or `next.config.ts` work is included in this seal.
