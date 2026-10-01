# Broader Any Batch C67 Result

Date: 2026-10-01
Scope: `src/services/intelligence/hr/__tests__/integration.test.ts`
Status: SEALED

## Baseline

Official baseline before C67:

```text
157 violations / 36 files
```

Raw scanner output before C67:

```text
155 violations / 35 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Removed `as any` casts from HR materialized view `.from(...)` calls where generated database view contracts exist.
- Replaced the invalid-month `as any` test input with a typed invalid `DateRange`.
- Did not modify HR production queries, DB schema, generated types, Customer Intelligence, Finance, Core, Logistics, Healthcare, Nail Shop, or Preschool.

## Verification

```text
rg any in scope                  PASS
npx eslint scope                 PASS
npx jest scope                   PASS / skipped suite (22 skipped)
git diff --check scope           PASS
npm run arch:guard               PASS
npm run check:any-types          EXPECTED FAIL
  raw count                      150 / 34
```

Additional diagnostic:

```text
scoped TypeScript program        FAIL / NOT_VERIFIED
```

The scoped TypeScript failure is a pre-existing stale skipped-suite mismatch:

- `MemoryCacheService` is no longer exported from `../../cache/memory-cache`.
- The test expects `getWorkforceAnalytics(...).data` to be an array, while the current service type returns `WorkforceAnalytics`.
- Several calls still pass `TEST_MONTH` where the current service signature expects `TimePeriod | DateRange`.

This is not repaired in C67 because it would turn the batch into a broader HR integration-suite contract rewrite.

## Result

```text
Official baseline before C67  157 / 36
Official baseline after C67   152 / 35
Removed                         5 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

