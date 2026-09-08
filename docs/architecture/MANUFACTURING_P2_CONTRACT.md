# Manufacturing P2 — Evidence Collection Contract (TRIMMED)

**Date:** 2026-09-05  
**Status:** ✅ **TRIMMED & APPROVED**  
**Purpose:** Minimal contract for automated evidence gathering

---

## Trim Results

**Before:** 226 LOC, 15 exports  
**After:** ~145 LOC, 8 exports  
**Reduction:** ~36% (81 LOC removed)

---

## What Was Removed

### 1. MigrationEvidence (40 LOC) ❌
**Reason:** No existing tool produces migration evidence  
**Would require:** SQL parsing + database queries (violates "consume existing outputs")

### 2. Qualification Summary (15 LOC) ❌
**Reason:** Collector must NOT make qualification judgments  
**Removed fields:** `status: QUALIFIED|FAILED`, `qualificationReady`, counts

### 3. ConformanceEvidence (15 LOC) ❌
**Reason:** Duplicate of TestEvidence  
**Solution:** Filter conformance tests from Jest output by suite name

### 4. Adapter Interfaces (30 LOC) ❌
**Reason:** Unnecessary abstraction (single implementation per adapter)  
**Replaced with:** Function type signatures

### 5. Inferred Identity Fields (10 LOC) ❌
**Removed:** `kernelDependencies`, `platformVersion` from ProductIdentity  
**Reason:** Would be inferred/invented (not from tool output)

### 6. Collection Result Metadata (10 LOC) ❌
**Removed:** `collected[]`, `skipped[]`, `errors[]` from result  
**Reason:** Debug metadata, not evidence

### 7. Redundant Fields (5 LOC) ❌
- `timedOut: boolean` → redundant with `HOTSPOT` status
- `frozenLayersChecked[]` → inferred (not explicit in Guard output)
- `timestamp` in Guard evidence → moved to collection metadata

---

## What Was Added

### 1. TIMEOUT Status ✅
**Added to:** `ArchitectureGuardEvidence.status`  
**Reason:** Environmental timeouts must be distinguished from PASS/FAIL

### 2. Execution Metadata ✅
```typescript
execution?: {
  gitCommit?: string;
  nodeVersion?: string;
  toolVersions?: Record<string, string>;
}
```
**Reason:** Reproducibility requires codebase + runtime identity

---

## Trimmed Contract Structure

```typescript
// 3 Evidence Types
export interface BuildEvidence { ... }
export interface ArchitectureGuardEvidence { ... }
export interface TestEvidence { ... }

// 1 Bundle Type
export interface ProductEvidenceBundle {
  productId: string;
  version: string;
  specHash?: string;
  build?: BuildEvidence[];
  architectureGuard?: ArchitectureGuardEvidence;
  tests?: TestEvidence[];
  collectionTimestamp: string;
  execution?: { ... };
}

// 2 Interfaces
export interface EvidenceCollectorConfig { ... }
export interface IEvidenceCollector {
  collect(): Promise<{ bundle, bundlePath }>;
  load(): ProductEvidenceBundle;
}

// 3 Adapter Function Types
export type ParseArchitectureGuardFn = ...;
export type ParseBuildFn = ...;
export type ParseTestsFn = ...;
```

**Total:** 8 exports, ~145 code LOC

---

## Contract Principles (Enforced)

### 1. Consume Existing Outputs Only
- ✅ Architecture Guard: stdout from `npm run arch:guard`
- ✅ Build: stdout from `npm run governance:typecheck`
- ✅ Tests: JSON from `jest --json`
- ❌ Migrations: NO SOURCE TOOL (removed)

### 2. No Invented/Inferred Evidence
- ✅ All evidence fields from tool outputs
- ❌ Removed: `kernelDependencies`, `platformVersion`, `frozenLayersChecked`

### 3. No Qualification Judgments
- ✅ Bundle contains raw evidence only
- ❌ Removed: `summary.status`, `qualificationReady`
- ✅ Human decides qualification from evidence

---

## Failure Semantics (Preserved)

**Build:** `PASS | FAIL | HOTSPOT`  
- `HOTSPOT` = timeout (no verdict)

**Architecture Guard:** `PASS | FAIL | TIMEOUT`  
- `TIMEOUT` = environmental failure (added)

**Tests:** `PASS | FAIL | SKIP`  
- Standard Jest semantics

**NOT_RUN:** Field absent (undefined)

---

## Manual Effort Reduction (Clarified)

**Baseline (Manual Evidence Assembly):**
- Run tools → 10 min (unchanged)
- Copy/paste outputs → 15 min
- Count PASS/FAIL → 10 min
- Write report → 20 min
- **Total:** ~55 minutes

**Automated (Collector):**
- Run tools → 10 min (unchanged)
- Run collector → 10 seconds
- Review JSON → 5 min
- **Total:** ~15 minutes

**Evidence Assembly Reduction:** 45 min → 5 min = **~89% reduction** ✅  
**Total Workflow:** 55 min → 15 min = **~73% reduction**

**Note:** 90-95% claim applies to **assembly only**, not total workflow

---

## Implementation Estimate (Updated)

**Trimmed Implementation:**
- Contract: ~145 LOC (trimmed)
- Adapter functions (3): ~120 LOC
- Collector: ~150 LOC
- Tests: ~200 LOC

**Total:** ~615 LOC (vs. 876 LOC before trim = 30% reduction)

---

## Next Steps

1. ✅ Type-check trimmed contract
2. ✅ Verify exports
3. ⏳ Implement adapter functions (~120 LOC)
4. ⏳ Implement collector (~150 LOC)
5. ⏳ Add focused tests (~200 LOC)
6. ⏳ Validate with Medical Product evidence
7. ⏳ Run Architecture Guard
8. ⏳ Document P2 results

---

**Status:** ✅ **CONTRACT TRIMMED & APPROVED**  
**Next:** Implement adapters + collector (no further approval required)  
**Estimated:** ~615 LOC total
