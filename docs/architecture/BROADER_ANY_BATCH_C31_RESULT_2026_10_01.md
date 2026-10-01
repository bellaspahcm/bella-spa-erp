# Broader Any Gate - Batch C31 Result - 2026-10-01

## Scope

- `src/__tests__/e2e-accounting-vat-calculation.test.ts`
- `src/__tests__/e2e-accounting-inter-branch-clearing.test.ts`
- Layer: root accounting E2E assertions
- Change class: generated Json/row type narrowing

## Result

```text
Before check:any-types  375 / 91 files
After check:any-types   372 / 89 files
Removed                   3 /  2 files
```

## Verification

```text
Target any scan         PASS
Targeted Jest           PASS 2/2
Targeted ESLint         PASS
git diff --check        PASS
check:any-types         EXPECTED FAIL 372 / 89 files
```

## Boundary

```text
Runtime production behavior   NONE
Production residual           UNCHANGED
Contract change               NONE
Accounting policy change      NONE
DB/RPC/generated contract     NONE
Frozen Logistics              UNTOUCHED
Healthcare/Education          UNTOUCHED
Finance/Core governance       UNTOUCHED
next.config.ts                UNTOUCHED
```

## Status

```text
BATCH C31 = SEALED
NEXT      = Continue broader gate cleanup outside frozen/governance residual
```
