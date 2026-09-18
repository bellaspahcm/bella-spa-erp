# Baseline Collection Blocked

**Status:** 🔴 BLOCKED  
**Date:** 2026-09-18  
**Blocker:** TypeScript and Jest collectors fail on Windows due to timeout/parsing issues

## Context

PR #118 merged Identity-Aware No-New-Debt Baseline Infrastructure @ main `24bf975c`.

Canonical baseline generation from clean main is **BLOCKED** by collector failures.

## Collector Status

```
TypeScript Collector
├─ Method:     npx tsc --noEmit
├─ Status:     ⏱️ TIMEOUT (>3 minutes)
├─ Root Cause: Full typecheck on large codebase too slow on Windows
└─ Baseline:   ❌ COLLECTION FAILED

ESLint Collector
├─ Method:     npx eslint . --format json
├─ Status:     ⚠️ PARSE FAILED (unterminated string @ 1MB+)
├─ Root Cause: Output truncation, buffer limit exceeded
└─ Baseline:   ❌ COLLECTION FAILED

Jest Collector
├─ Method:     npx jest --json --testPathPattern="src/"
├─ Status:     ❌ PARSE FAILED (missing testResults array)
├─ Root Cause: Invalid JSON output structure
└─ Baseline:   ❌ COLLECTION FAILED

Migration Collector
├─ Method:     node scripts/migrations/zero-downtime-check.js
├─ Status:     ✅ RUNS (needs verification)
└─ Baseline:   🟡 UNVERIFIED
```

## Fail-Closed Governance

Generator implements **fail-closed** behavior:

```typescript
if (collectionFailures.length > 0) {
  throw new Error(`Baseline collection failed: ${failures.join(', ')}`);
}
```

**GOVERNANCE PRINCIPLE:**
> Collector failure MUST NOT become zero findings.  
> No evidence ≠ No violations.

Invalid baseline with `0 findings` from collection failure was **DELETED**.

## Evidence

```bash
# Attempt 1: Full tsc --noEmit
Command timed out after 180000ms (3 minutes)

# Attempt 2: tsc --build --force
Command timed out after 600000ms (10 minutes)

# Attempt 3: Skip TypeScript + Parse ESLint/Jest
ESLint: SyntaxError: Unterminated string in JSON at position 1021352
Jest: missing testResults array

# Attempt 4: Fail-closed implementation
BASELINE GENERATION FAILED
Collectors failed: TypeScript, Jest
Error: Baseline collection failed
Exit Code: 1
```

## Impact

```
PR #116 (Logistics P1 TypeScript Hardening)
├─ Status:              PAUSED
├─ Diagnostics:         282 → 0 (fixed in PR)
├─ Tests:               547/547 PASS
├─ Attribution:         🛑 BLOCKED (no baseline)
└─ Merge:               🛑 BLOCKED (cannot prove NEW = 0)

Identity-Aware Baseline System
├─ Infrastructure:      ✅ DEPLOYED @ main 24bf975c
├─ Canonical baseline:  ❌ NOT GENERATED
├─ Bootstrap mode:      🟡 STILL ACTIVE (baseline missing)
└─ Real comparison:     🛑 BLOCKED (no baseline to compare against)
```

## Resolution Options

### Option A: Use CI Artifacts (RECOMMENDED)

GitHub Actions `Type Check` workflow @ main `24bf975c` shows **SUCCESS**.

```bash
gh run list --workflow="Type Check" --branch=main --limit=1
# Run 35352896893: SUCCESS @ 24bf975c
```

**Problem:** SUCCESS means 0 errors, but we need the actual diagnostic output to create fingerprints.

**Sub-options:**
- A1: Check if CI caches TypeScript output even on success
- A2: Force CI run with `--listFilesOnly` or diagnostic mode
- A3: Temporarily inject diagnostic collection into CI workflow

### Option B: Scope-Based Collection

Break collection into smaller scopes that don't timeout:

```typescript
// Collect by subsystem
const scopes = [
  'src/platform/healthcare/**/*.ts',
  'src/platform/logistics/**/*.ts',
  'src/platform/education/**/*.ts',
  'src/products/**/*.ts'
];

for (const scope of scopes) {
  const output = execSync(`npx tsc --noEmit --project tsconfig.${scope}.json`);
  findings.push(...adapt(output));
}
```

**Complexity:** Requires tsconfig splitting, may miss cross-scope issues.

### Option C: Linux Environment

Run baseline generation on Linux where `tsc` performance is better:

```bash
# On Linux CI or WSL
time npx tsc --noEmit  # Likely < 1 minute
```

**Note:** Must ensure same tsconfig/dependencies as Windows production environment.

### Option D: Accept Zero Baseline (REJECTED)

**ABSOLUTELY NOT.** This violates the core governance principle.

Accepting `TypeScript: 0 findings` when collector failed would mean:
- PR #116's 282 fixes would appear as 282 NEW violations (false positive regression)
- No-new-debt policy becomes meaningless
- Baseline serves no purpose

## Decision Required

**BLOCKED ON:** User must choose resolution approach (A, B, or C).

Until baseline is proven correct:
- Bootstrap mode remains ACTIVE
- PR #116 remains PAUSED
- Identity-Aware system infrastructure is DEPLOYED but NOT operational

## Related

- PR #116: Logistics P1 TypeScript Hardening (PAUSED)
- PR #118: Identity-Aware Baseline Infrastructure (MERGED)
- `docs/platform/IDENTITY_AWARE_BASELINE_DEPLOYMENT.md`
- `scripts/ci/baseline/generate-baseline.ts` (fail-closed implementation)

---

**Next Action:** User selects Option A, B, or C for baseline collection.
