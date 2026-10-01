# Broader Any Gate - Batch C22 Result - 2026-09-30

## Scope

- `src/lib/decision-engine/providers/booking/__tests__/capacity-management-provider.test.ts`
- Layer: decision-engine booking provider tests
- Change class: test-local fixture typing and invalid-input runtime validation wrapper

## Result

```text
Before check:any-types  404 / 103 files
After check:any-types   399 / 102 files
Removed                   5 /   1 file
```

## Verification

```text
Target any scan         PASS
Targeted Jest           PASS 40/40
Targeted ESLint         PASS
git diff --check        PASS
check:any-types         EXPECTED FAIL 399 / 102 files
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
BATCH C22 = SEALED
NEXT      = Continue broader gate cleanup outside frozen/governance residual
```
