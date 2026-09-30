# Production Any-Type Batch P1-C Result

Date: 2026-09-30
Status: SEALED FOR P1-C SCOPE

## Scope

Production Batch P1-C targeted one type-local exhaustive narrowing violation:

```text
src/lib/decision-engine/providers/payroll/payroll-provider.ts
```

## Any-Type Evidence

```text
Before P1-C production baseline: 76 violations / 32 files
After P1-C production scan:      75 violations / 31 files
Removed:                          1 violation  /  1 file
```

Payroll provider production invariant violations after P1-C:

```text
0
```

## Change Pattern

Replaced:

```text
(condition as any).type
```

with the sibling-provider pattern:

```text
(condition as { type: string }).type
```

This preserves the unsupported-condition error message and does not change handling for supported `simple`, `all`, `any`, or function-based conditions.

## Verification

```text
targeted scan                       PASS
targeted ESLint                     PASS
targeted payroll provider tests      PASS
git diff --check                    PASS
independent production scan          PASS
production-runtime-integrity.test    EXPECTED FAIL
```

Targeted tests:

```text
npx jest src/lib/decision-engine/providers/payroll/__tests__/payroll-provider.unit.test.ts src/lib/decision-engine/providers/payroll/__tests__/payroll-provider.integration.test.ts --runInBand

Test Suites: 2 passed, 2 total
Tests:       32 passed, 32 total
```

## Production Invariant Result

The production invariant test still fails as expected:

```text
INVARIANT 1: Found 75 unapproved any in production code
INVARIANT 3: next.config.ts has ignoreBuildErrors: true
```

The remaining 75 violations are outside P1-C scope:

```text
Supabase/generated contract
Frozen Logistics
JSON/dynamic payload
Finance/Core-adjacent
runtime boundary
scanner-noise comment
Real Estate UI/generated contract
```

## Governance Classification

```text
Runtime behavior change  NONE intended
Contract change          NONE
DB/RPC change            NONE
Kernel/Core change       NONE
Frozen OS change         NONE
next.config.ts           UNCHANGED

Batch seal status        SEALED_FOR_P1C_SCOPE_ONLY
```

## Decision

Production Batch P1-C is sealed for the authorized exhaustive-narrowing scope only.

The broader production baseline remains open. No Logistics, Supabase/generated, JSON payload, Finance/Core, runtime-boundary, scanner-noise, or `next.config.ts` work is included in this seal.
