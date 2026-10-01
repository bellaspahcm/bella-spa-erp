# Broader ANY Gate - Batch C1 Result

Date: 2026-09-30
Scope: `components/customer-intelligence-tooltips`
Status: SEALED_WITH_SCOPED_TS_NOT_VERIFIED

## Scope

This batch only covered typed tooltip props in customer intelligence chart components:

- `src/components/intelligence/customer/CustomerActivityChart.tsx`
- `src/components/intelligence/customer/LtvByCohortChart.tsx`
- `src/components/intelligence/customer/LtvDistributionChart.tsx`

Out of scope:

- 34 classified production governance residuals
- Logistics frozen/domain-contract residuals
- Real Estate contract drift residuals
- Finance/Core governance residuals
- `next.config.ts`
- Healthcare, Education, DB/RPC, generated contracts, and Core changes

## Result

```text
check:any-types BEFORE    606 / 144 files
check:any-types AFTER     603 / 141 files
REMOVED                     3 /   3 files
```

## Verification

```text
target explicit-any scan    PASS
target ESLint               PASS
git diff --check            PASS
check:any-types             EXPECTED FAIL: 603 / 141 files remaining
scoped TypeScript           TIMEOUT / NOT_VERIFIED
```

Scoped TypeScript was run with a temporary tsconfig targeting only the three edited components. It produced no diagnostics before timeout and was stopped manually. This is not treated as PASS.

## Runtime / Contract Impact

```text
runtime behavior            NO INTENDED CHANGE
DB/RPC contract             NONE
generated contract          NONE
Core/Platform               NONE
Frozen Logistics            UNTOUCHED
Finance/Core residual       UNTOUCHED
Real Estate residual        UNTOUCHED
production residual count   UNCHANGED: 34
```

The changes replaced inline tooltip `any` props with local typed tooltip props and hoisted the tooltip renderers out of the component render path. The rendered JSX shape remains equivalent for the chart tooltip content.

## Seal Decision

Batch C1 is sealed for its narrow scope because the target any violations were removed, lint and diff verification passed, and the remaining `check:any-types` failure is outside this batch.
