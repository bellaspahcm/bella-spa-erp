# Batch 20 Invariant Triage

Date: 2026-09-30
Status: COMPLETE / CAMPAIGN STILL STOPPED

## Question

Batch 20 reduced `check:any-types`, but targeted Jest failed in:

```text
src/__tests__/invariants/production-runtime-integrity.test.ts
```

This triage determines whether the failure was caused by Batch 20 or by an existing governance baseline.

## Evidence

### 1. Targeted Invariant Reproduction

Command:

```text
npx jest src/__tests__/invariants/production-runtime-integrity.test.ts --runInBand
```

Result:

```text
FAIL
Test Suites: 1 failed, 1 total
Tests:       2 failed, 6 passed, 8 total
```

Failing invariants:

```text
INVARIANT 1: Production Type Safety
- Found 93 unapproved 'any' in production code

INVARIANT 3: Build Integrity
- next.config.ts has ignoreBuildErrors: true
```

### 2. Independent Production Scan

An independent scanner using the same production scope and broad-type regex confirmed:

```text
Production files scanned: 1,620
Violations:               93
Files affected:           37
```

Top production files by count:

```text
src/platform/logistics/warehouse/receipt.service.ts                  10
src/app/dashboard/education/scheduling/page.tsx                       7
src/app/dashboard/education/facilities/page.tsx                       6
src/app/api/admin/partner-applications/[id]/approve/route.ts          5
src/app/api/admin/partner-applications/[id]/reject/route.ts           5
src/platform/logistics/engines/freight-audit-engine.ts                5
src/platform/real-estate/engines/property.service.ts                  4
src/platform/real-estate/repositories/property-unit.repository.ts      4
```

Area summary:

```text
src/platform/logistics              30
src/app/dashboard                   23
src/app/api                         12
src/platform/real-estate            10
src/platform/integration-runtime     8
src/platform/integration-hub         7
src/platform/finance                 2
src/lib/decision-engine              1
```

### 3. Batch 20 Production Scope Diff

Command:

```text
git diff --name-only -- src/platform src/app src/lib src/components next.config.ts
```

Result:

```text
<no output>
```

Batch 20 did not modify the production scope scanned by the invariant and did not modify `next.config.ts`.

### 4. Invariant Test Diff

Batch 20 changed only the detector expression inside the invariant test:

```text
regex literal
-> RegExp built from token
```

Purpose:

```text
Avoid making the invariant test source itself trip the repository-wide any-text checker.
```

Effect:

```text
Detection semantics preserved.
No suppression added.
No invariant relaxed.
No production behavior changed.
```

### 5. Build Integrity Baseline

Current `next.config.ts` contains:

```text
typescript: {
  ignoreBuildErrors: true,
}
```

`git show HEAD:next.config.ts` confirms the same setting already existed before the current Batch 20 diff.

## Classification

```text
Batch 20 caused regression:            NO EVIDENCE
Production any inventory stale:        NO
Production any baseline current:       YES
Build integrity baseline current:      YES
Root-test cleanup verification blocked:YES
```

There is a scope distinction:

```text
check:any-types
- scans all src TypeScript files
- current result: 667 violations / 169 files
- includes tests, products, platform, app, lib, components, modules, services

production-runtime-integrity invariant
- scans production patterns only
- current result: 93 violations / 37 files
- excludes normal test/spec files
```

There is also limited scanner noise inside the invariant result:

```text
src/platform/logistics/contracts/freight-audit.contract.ts
- inline comment text contains "any variance"

src/platform/integration-hub/finance-outbox-worker-test.ts
- filename is test-like but is not excluded by *.test.ts / *.spec.ts patterns
```

This noise does not invalidate the overall finding: the independent scan and Jest reproduction both confirm an existing production baseline.

## Decision

Batch 20 remains:

```text
NOT SEALED
CAMPAIGN STOPPED
```

The invariant failure is classified as:

```text
PRE_EXISTING_GOVERNANCE_BASELINE
```

The correct next step is not to fix production or `next.config.ts` merely to make Batch 20 pass. The next safe action is to create an explicit verification checkpoint for Batch 20 that records this pre-existing blocker, or to open a separate governance-baseline campaign for the production invariant findings.
