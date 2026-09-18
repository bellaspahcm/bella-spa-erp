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

### Option C: CI-Derived Artifacts (SELECTED)

**Status:** ✅ IMPLEMENTED, ⏳ RUNTIME PROOF PENDING

GitHub Actions workflow collects machine-readable artifacts on Ubuntu (fast tsc).

**Implementation:**
- Workflow: `.github/workflows/baseline-artifact-collector.yml`
- Generator: `scripts/ci/baseline/generate-from-artifacts.ts`
- Determinism verifier: `scripts/ci/baseline/verify-determinism.ts`

**Invariants Enforced:**

```
I1 — COLLECTION INTEGRITY
  requested_commit == actual_commit
  commit_verified == true
  Enforced: Workflow SHA verification step

I2 — GENERATION PROVENANCE
  baseline.provenance.source_commit == actual_commit
  All artifacts from same collection/run
  Collector FAILED → generation FAIL
  Enforced: generate-from-artifacts.ts validation

I3 — SEMANTIC DETERMINISM
  same artifacts + same generator version
  → same normalized findings/fingerprints
  Enforced: verify-determinism.ts

I4 — NO MIXED ARTIFACTS
  All artifacts must have same collection_timestamp
  Prevents "Frankenstein baseline" from mixed runs
  Enforced: generate-from-artifacts.ts timestamp check
```

**Closure Sequence:**

```
1. Merge PR #119 (artifact collector + provenance validation)
2. Record new main SHA (post-merge)
3. Trigger baseline-artifact-collector workflow @ new main SHA
4. Download artifacts from workflow run
5. Run generate-from-artifacts.ts
   → Validates I1, I2, I4
   → Generates baseline with provenance
6. Review baseline counts + provenance
7. Run verify-determinism.ts (twice on same artifacts)
   → Validates I3
8. Commit baseline to .github/ci/baselines/main.json
9. Close bootstrap mode (baseline missing → exit 1)
10. Create test PR (trivial change)
11. Verify end-to-end: bootstrap OFF, real comparison, NEW=0
12. If test PR PASS → Mark system PROVEN
13. Unblock PR #116 for re-run with real baseline

CRITICAL: #116 remains BLOCKED until step 12 completes
```

**Runtime Proof Gates:**

- [ ] PR #119 merged to main
- [ ] Artifact collector workflow executed successfully
- [ ] All 4 artifacts collected (TypeScript, ESLint, Jest, Migration)
- [ ] Provenance validation PASS (I1)
- [ ] Baseline generation PASS (I2)
- [ ] Collection integrity verified (I4)
- [ ] Semantic determinism verified (I3)
- [ ] Baseline committed to main
- [ ] Bootstrap mode closed
- [ ] Test PR end-to-end PASS
- [ ] System status: IMPLEMENTED → PROVEN

Until all gates PASS, Identity-Aware Baseline System is **IMPLEMENTED but NOT PROVEN**.

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
