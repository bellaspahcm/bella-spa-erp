# Broader Any Gate - Batch C25 Result - 2026-09-30

## Scope

- `src/services/decision-actions/__tests__/booking-decisions.test.ts`
- Layer: booking decision action tests
- Change class: test-local Supabase mock typing

## Result

```text
Before check:any-types  394 / 100 files
After check:any-types   392 /  99 files
Removed                   2 /   1 file
```

## Verification

```text
Target any scan         PASS
Targeted Jest           PASS 10/10
Targeted ESLint         PASS
git diff --check        PASS
check:any-types         EXPECTED FAIL 392 / 99 files
```

## Boundary

```text
Runtime production behavior   NONE
Production residual           UNCHANGED
Contract change               NONE
DB/RPC/generated contract     NONE
Frozen Logistics              UNTOUCHED
Healthcare/Education          UNTOUCHED
Finance/Core governance       UNTOUCHED
next.config.ts                UNTOUCHED
```

## Status

```text
BATCH C25 = SEALED
NEXT      = Continue broader gate cleanup outside frozen/governance residual
```
