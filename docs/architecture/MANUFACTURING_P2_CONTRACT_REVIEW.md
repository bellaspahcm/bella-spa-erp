# Manufacturing P2 — Contract Review

**Date:** 2026-09-05  
**Reviewer:** Architecture Analysis  
**Status:** 🔍 IN REVIEW  
**Question:** Is P2 contract minimal, or does it risk becoming a framework?

---

## Review Context

**Contract Size:** 226 LOC  
**Exports:** 15 (14 interfaces + 1 const)  
**Predicted Implementation:** ~650 LOC  
**Red Flag:** Contract alone is 226 LOC for a "minimal evidence collector"

---

## 1. MINIMALITY ANALYSIS

### Contract Inventory

**Exported Types (15 total):**

1. `BuildEvidence` — TypeScript build result per scope
2. `ArchitectureGuardEvidence` — Architecture Guard result
3. `TestEvidence` — Jest test result per suite
4. `ConformanceEvidence` — Product conformance gates
5. `MigrationEvidence` — Migration validation result
6. `ProductIdentity` — Product ID + version + dependencies
7. `ManufacturingInput` — Input spec identity
8. `ProductEvidenceBundle` — Complete evidence bundle
9. `EvidenceCollectorConfig` — Collection configuration
10. `EvidenceCollectionResult` — Collection output
11. `IEvidenceCollector` — Collector interface (3 methods)
12. `IArchitectureGuardAdapter` — Guard output parser
13. `IBuildAdapter` — Build output parser
14. `ITestAdapter` — Test output parser
15. `QUALIFICATION_REQUIREMENTS` — Minimum evidence rules

---

### Removal Analysis

#### Can Remove: `ProductIdentity`

**Current:**
```typescript
interface ProductIdentity {
  productId: string;
  version: string;
  kernelDependencies: string[];
  platformVersion: string;
}
```

**Issue:** `kernelDependencies` and `platformVersion` are NOT in existing tool outputs.

**Evidence:** These would need to be:
- Manually provided, OR
- Inferred from manifest files, OR
- **Invented by collector**

**Verdict:** 🔴 **VIOLATES "no invented evidence" rule**

**Recommendation:** TRIM to only `productId` + `version` (user-provided). Remove inferred fields.

---

#### Can Remove: `ManufacturingInput`

**Current:**
```typescript
interface ManufacturingInput {
  type: 'schema-spec' | 'manual' | 'unknown';
  specVersion?: string;
  specHash?: string;
  timestamp: string;
}
```

**Issue:** Only `specHash` is deterministic. The rest is metadata inference.

**Evidence:** 
- `type`: Inferred (not from tool output)
- `specVersion`: Inferred (not from tool output)
- `timestamp`: Non-deterministic
- `specHash`: Deterministic (IF spec provided)

**Verdict:** 🟡 **PARTIALLY NECESSARY**

**Recommendation:** TRIM to only `specHash?: string` (optional, deterministic input identity). Remove type/version inference.

---

#### Can Remove: `MigrationEvidence`

**Current:**
```typescript
interface MigrationEvidence {
  migrationFile: string;
  applied: boolean;
  validated: boolean;
  rlsEnabled: boolean;
  tenantIsolation: boolean;
  errors?: string[];
}
```

**Issue:** NO existing tool produces this output.

**Evidence:**
- `applied`: Would need database query (NOT read-only)
- `validated`: Undefined (what validation?)
- `rlsEnabled`: Would need SQL parsing (new logic)
- `tenantIsolation`: Would need SQL parsing (new logic)

**Verdict:** 🔴 **VIOLATES "consume existing outputs only" rule**

**Recommendation:** REMOVE entirely OR defer to future when migration validation tool exists.

---

#### Can Remove: `ConformanceEvidence`

**Current:**
```typescript
interface ConformanceEvidence {
  productId: string;
  gatesPassed: string[];
  gatesFailed: string[];
  totalGates: number;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details?: string;
}
```

**Issue:** Conformance tests are JUST Jest tests. This duplicates `TestEvidence`.

**Evidence:** Conformance tests output Jest JSON like any other test.

**Verdict:** 🟡 **DUPLICATE OF TestEvidence**

**Recommendation:** REMOVE dedicated type. Filter conformance from `TestEvidence[]` by suite name pattern.

---

#### Can Remove: Adapter Interfaces

**Current:** 3 adapter interfaces (`IArchitectureGuardAdapter`, `IBuildAdapter`, `ITestAdapter`)

**Issue:** These add abstraction without benefit for single-implementation adapters.

**Evidence:** Each adapter will have exactly ONE implementation. Interface adds ceremony.

**Verdict:** 🟡 **UNNECESSARY ABSTRACTION**

**Recommendation:** REMOVE interfaces. Implement adapters as functions:
```typescript
function parseArchitectureGuard(stdout: string, exitCode: number): ArchitectureGuardEvidence;
function parseBuild(stdout: string, exitCode: number): BuildEvidence[];
function parseTests(jestJson: any): TestEvidence[];
```

**Savings:** ~30 LOC

---

#### Can Remove: `EvidenceCollectionResult`

**Current:**
```typescript
interface EvidenceCollectionResult {
  bundle: ProductEvidenceBundle;
  bundlePath: string;
  collected: string[];
  skipped: string[];
  errors: string[];
}
```

**Issue:** `collected`/`skipped`/`errors` are debug metadata, not evidence.

**Evidence:** These don't appear in evidence bundle, only in collection logs.

**Verdict:** 🟡 **DEBUG METADATA (not evidence)**

**Recommendation:** Return `{ bundle, bundlePath }` only. Log collection details to console.

**Savings:** ~10 LOC

---

#### Can Remove: `summary` field

**Current:**
```typescript
summary: {
  status: 'QUALIFIED' | 'FAILED' | 'PARTIAL' | 'INCOMPLETE';
  passedChecks: number;
  failedChecks: number;
  incompleteChecks: number;
  qualificationReady: boolean;
}
```

**Issue:** **COLLECTOR BECOMES QUALIFICATION ENGINE**

**Evidence:** `qualificationReady` and `status` are JUDGMENTS, not evidence.

**Verdict:** 🔴 **VIOLATES "collector does not decide qualification" rule**

**Recommendation:** REMOVE `summary` entirely. Bundle contains raw evidence only. Human/qualification gate decides status.

**Savings:** ~15 LOC

---

### Minimality Summary

**Current:** 15 exports, 226 LOC  
**Removable:**
- `ProductIdentity` (inferred fields) → TRIM to productId/version
- `ManufacturingInput` (type/version inference) → TRIM to specHash
- `MigrationEvidence` → REMOVE (no source tool)
- `ConformanceEvidence` → REMOVE (duplicate of TestEvidence)
- Adapter interfaces → REMOVE (use functions)
- `EvidenceCollectionResult` metadata → TRIM to bundle/path
- `summary` field → REMOVE (qualification judgment)

**Trimmed:** ~8 exports, ~120-140 LOC  
**Reduction:** ~40% LOC reduction

---

## 2. SOURCE BOUNDARY VALIDATION

### Contract Claims

> "Consumes existing command outputs (does NOT re-run tools)"

**Verification:**

| Evidence Source | Existing Tool | Output Format | Read-Only? |
|-----------------|---------------|---------------|------------|
| **Build** | `npm run governance:typecheck` | Console stdout | ✅ YES |
| **Architecture Guard** | `npm run arch:guard` | Console stdout | ✅ YES |
| **Tests** | `jest --json` | JSON file | ✅ YES |
| **Conformance** | Jest (subset) | JSON file | ✅ YES |
| **Migrations** | ❌ NO TOOL | N/A | ❌ **WOULD REQUIRE NEW LOGIC** |

**Finding:** Migration evidence **VIOLATES** source boundary (no existing tool)

---

### Adapter Source Validation

**Architecture Guard Adapter:**
- **Source:** `scripts/architecture/architecture-guard.ts` stdout
- **Output:** Console text with status + violations
- **Exit codes:** 0 (PASS), 1-4 (FAIL with reason)
- **Verdict:** ✅ **Valid source** (existing, read-only)

**Build Adapter:**
- **Source:** `scripts/governance/scoped-typecheck.ts` stdout
- **Output:** Console text with per-scope status
- **Exit codes:** 0 (all PASS), 1 (FAIL), 2 (HOTSPOT), 3 (INCOMPLETE)
- **Verdict:** ✅ **Valid source** (existing, read-only)

**Test Adapter:**
- **Source:** Jest `--json` output file
- **Output:** JSON with test results
- **Verdict:** ✅ **Valid source** (existing, read-only)

**Migration Adapter:**
- **Source:** ❌ NONE
- **Would require:** SQL parsing + database queries + validation logic
- **Verdict:** 🔴 **INVALID** (no existing source, new logic required)

---

## 3. SOURCE OF TRUTH VALIDATION

**Question:** For every evidence field, what is the canonical source?

### BuildEvidence

```typescript
{
  scope: string;              // ✅ From Gate B stdout
  status: 'PASS'|'FAIL'|'HOTSPOT'; // ✅ From Gate B exit code + stdout
  duration: number;           // ✅ From Gate B stdout
  diagnosticCount: number;    // ✅ From Gate B stdout
  diagnostics?: string[];     // ✅ From Gate B stdout (sample)
  timedOut: boolean;          // ✅ From Gate B stdout ("HOTSPOT" classification)
}
```

**Verdict:** ✅ **All fields from canonical source** (Gate B)

---

### ArchitectureGuardEvidence

```typescript
{
  status: 'PASS' | 'FAIL';    // ✅ From Guard exit code
  violations: [...];          // ✅ From Guard stdout (violation reports)
  frozenLayersChecked: [...]; // 🟡 INFERRED (not explicit in output)
  timestamp: string;          // 🟡 COLLECTOR-GENERATED (not from Guard)
}
```

**Verdict:** 🟡 **Mostly valid, but 2 fields are inferred/generated**

**Issue:** 
- `frozenLayersChecked`: Guard doesn't explicitly list checked layers
- `timestamp`: Collector generates this (not from Guard output)

**Recommendation:** 
- Remove `frozenLayersChecked` (inference)
- Keep `timestamp` BUT mark as `collectionTimestamp` (collector metadata, not Guard evidence)

---

### TestEvidence

```typescript
{
  suiteName: string;          // ✅ From Jest JSON
  status: 'PASS'|'FAIL'|'SKIP'; // ✅ From Jest JSON
  testCount: number;          // ✅ From Jest JSON
  passedCount: number;        // ✅ From Jest JSON
  failedCount: number;        // ✅ From Jest JSON
  skippedCount: number;       // ✅ From Jest JSON
  duration: number;           // ✅ From Jest JSON
  failures?: [...];           // ✅ From Jest JSON
}
```

**Verdict:** ✅ **All fields from canonical source** (Jest JSON)

---

### ProductIdentity

```typescript
{
  productId: string;          // 🟡 USER-PROVIDED (not from tool)
  version: string;            // 🟡 USER-PROVIDED (not from tool)
  kernelDependencies: [...];  // 🔴 INFERRED (from manifest? invented?)
  platformVersion: string;    // 🔴 INFERRED (from where?)
}
```

**Verdict:** 🔴 **Inferred fields violate source of truth**

**Recommendation:** TRIM to `productId` + `version` (user-provided identity only)

---

## 4. FAILURE SEMANTICS VALIDATION

### Contract Status Values

**Build:** `'PASS' | 'FAIL' | 'HOTSPOT'`  
**Architecture Guard:** `'PASS' | 'FAIL'`  
**Tests:** `'PASS' | 'FAIL' | 'SKIP'`  
**Conformance:** `'PASS' | 'FAIL' | 'PARTIAL'`

**Issue 1: TIMEOUT handling**

**Problem:** Gate B has `HOTSPOT` (timeout), but contract has `timedOut: boolean` field.

**Question:** Is `HOTSPOT` preserved as status, or normalized to PASS/FAIL?

**Current contract:** Preserves `HOTSPOT` status ✅  
**But also has:** `timedOut: boolean` (redundant)

**Recommendation:** Keep `HOTSPOT` status, remove `timedOut` boolean (redundant).

---

**Issue 2: Architecture Guard has NO timeout/inconclusive state**

**Problem:** If Guard times out (environmental), contract has no way to represent it.

**Current:** Only `PASS | FAIL`  
**Missing:** `TIMEOUT` or `INCONCLUSIVE`

**Recommendation:** Add `'TIMEOUT'` status to `ArchitectureGuardEvidence`

---

**Issue 3: `NOT_RUN` missing everywhere**

**Problem:** What if evidence source wasn't collected?

**Current:** Optional fields (`build?:`, `tests?:`)  
**Issue:** Ambiguous — was it skipped, or did collection fail?

**Recommendation:** Keep optional fields for "not collected", but document clearly:
- `undefined` = not collected (user opted out)
- Present with status = collected

---

### Failure Semantics Summary

**PASS:** Tool succeeded  
**FAIL:** Tool failed with diagnostics  
**HOTSPOT:** Tool timed out (no verdict)  
**SKIP:** Test skipped  
**TIMEOUT:** Tool timed out (for Guard)  
**NOT_RUN:** Evidence not collected (field absent)

**Current contract:** Missing `TIMEOUT` for Guard, has redundant `timedOut` boolean

**Recommendation:** Align all status enums, remove redundant booleans

---

## 5. REPRODUCIBILITY VALIDATION

### Deterministic Identity Required

**Question:** What minimum identity is needed to reproduce an evidence bundle?

**Current contract provides:**
- `product.productId` + `product.version` (user-provided)
- `input.specHash` (deterministic input, if applicable)
- `timestamp` (NON-deterministic)
- `collector.version` (collector version)

**Issue:** No git commit/SHA identity for codebase state

**Missing:**
- Git commit SHA (codebase identity)
- Execution environment (node version? OS?)
- Tool versions (tsc version, jest version, guard version)

**Verdict:** 🟡 **INCOMPLETE REPRODUCIBILITY**

**Recommendation:** Add `execution` metadata:
```typescript
execution: {
  gitCommit?: string;      // Codebase SHA
  nodeVersion?: string;    // Runtime version
  toolVersions?: {         // Tool versions used
    typescript?: string;
    jest?: string;
  };
}
```

---

## 6. DETERMINISM VALIDATION

**Question:** Same source evidence → same normalized bundle?

**Deterministic Fields:**
- Build status, diagnostics → ✅ YES (parse from stdout)
- Guard status, violations → ✅ YES (parse from stdout)
- Test results → ✅ YES (parse from JSON)

**Non-Deterministic Fields:**
- `timestamp` → ❌ NO (collection time varies)
- `collectionTimestamp` → ❌ NO (varies by run)
- `duration` → 🟡 MAYBE (depends on system load)

**Verdict:** ✅ **Core evidence deterministic**, metadata non-deterministic (acceptable)

**Recommendation:** Document which fields are non-deterministic (timestamps only)

---

## 7. MANUAL EFFORT REDUCTION CLAIM

**Contract claims:** 30-60 min → 2-5 min (90-95% reduction)

**Baseline (30-60 min):**
1. Run `npm run arch:guard` → 1 min
2. Copy-paste stdout → 2 min
3. Run `npm run governance:typecheck` → 3 min
4. Scroll through 44 scopes, count PASS/FAIL → 10 min
5. Run `npm test -- {product}` → 5 min
6. Review test results → 5 min
7. Run conformance tests → 5 min
8. Review conformance → 5 min
9. Check migrations manually → 5 min
10. **Write qualification report** → 10-20 min

**Total:** ~51-71 minutes (average ~60 min)

---

**Automated (2-5 min):**
1. Run tools (unchanged) → 10 min (same as before)
2. Run `collector.collect()` → 10 seconds
3. Review JSON bundle → 2-5 min

**Total:** ~12-15 minutes

**Actual Reduction:** 60 min → 15 min = **75% reduction** (not 90-95%)

**Issue:** Claim overstates reduction because **tools still run manually**

---

**Revised Claim:**
- **Manual evidence assembly:** 30-60 min → 2-5 min (**90-95% reduction** ✅)
- **Total workflow:** 60 min → 15 min (**75% reduction**)

**Recommendation:** Clarify that reduction applies to **evidence assembly**, not total verification time

---

## 8. COMPLEXITY JUSTIFICATION

**Contract:** 226 LOC (15 exports)  
**Implementation estimate:** ~650 LOC  
**Total:** ~876 LOC

**Breakdown:**
- Contract: 226 LOC
- Adapters (3 × ~50 LOC): 150 LOC
- Collector: 200 LOC
- Tests: 300 LOC

**Question:** Why 876 LOC for "evidence collector"?

---

### After Trimming

**Remove:**
- `MigrationEvidence` (40 LOC) — no source tool
- `ConformanceEvidence` (15 LOC) — duplicate of TestEvidence
- Adapter interfaces (30 LOC) — unnecessary abstraction
- `summary` field (15 LOC) — qualification judgment
- Inferred identity fields (10 LOC)
- Collection result metadata (10 LOC)

**Trimmed Contract:** ~106 LOC (~53% reduction)

**Trimmed Implementation:**
- Contract: 106 LOC
- Adapters (3 functions): 120 LOC
- Collector: 150 LOC
- Tests: 200 LOC

**Trimmed Total:** ~576 LOC (~34% reduction from original)

---

## Review Findings

### Critical Issues (🔴 MUST FIX)

1. **`MigrationEvidence` has no source tool** — violates "consume existing outputs"
2. **`summary` field makes qualification judgments** — violates "collector does not qualify"
3. **Inferred identity fields** (`kernelDependencies`, `platformVersion`) — violates "no invented evidence"

---

### Moderate Issues (🟡 SHOULD FIX)

4. **`ConformanceEvidence` duplicates `TestEvidence`** — unnecessary type
5. **Adapter interfaces add ceremony** — use functions instead
6. **`EvidenceCollectionResult` has debug metadata** — not evidence
7. **Missing `TIMEOUT` status for Guard** — incomplete failure semantics
8. **Redundant `timedOut` boolean** — `HOTSPOT` status sufficient
9. **Incomplete reproducibility** — missing git commit, tool versions
10. **Overstated effort reduction claim** — 90-95% applies to assembly only, not total

---

### Minor Issues (🟢 ACCEPTABLE)

11. **Timestamps non-deterministic** — acceptable for metadata
12. **Duration varies by system** — acceptable variance

---

## Recommendation

**❌ TRIM P2 CONTRACT**

**Required Changes:**

1. **REMOVE** `MigrationEvidence` entirely (no source tool)
2. **REMOVE** `summary` field (qualification judgment)
3. **REMOVE** `ConformanceEvidence` (duplicate, use `TestEvidence` filter)
4. **REMOVE** adapter interfaces (use functions)
5. **TRIM** `ProductIdentity` to `productId` + `version` only
6. **TRIM** `ManufacturingInput` to `specHash` only
7. **TRIM** `EvidenceCollectionResult` to `bundle` + `bundlePath`
8. **ADD** `TIMEOUT` status to `ArchitectureGuardEvidence`
9. **REMOVE** `timedOut: boolean` (redundant with `HOTSPOT`)
10. **ADD** `execution` metadata for reproducibility
11. **CLARIFY** effort reduction claim (assembly-only, not total workflow)

**After Trimming:**
- Contract: ~106 LOC (from 226)
- Total implementation: ~576 LOC (from 876)
- **34% LOC reduction**

---

## Trimmed Contract Preview

```typescript
// Evidence from existing tools
export interface BuildEvidence {
  scope: string;
  status: 'PASS' | 'FAIL' | 'HOTSPOT';
  duration: number;
  diagnosticCount: number;
  diagnostics?: string[];
}

export interface ArchitectureGuardEvidence {
  status: 'PASS' | 'FAIL' | 'TIMEOUT';
  violations: Array<{
    layer: string;
    type: string;
    severity: 'ERROR' | 'WARNING';
    details: string;
  }>;
}

export interface TestEvidence {
  suiteName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  testCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;
  failures?: Array<{
    testName: string;
    errorMessage: string;
  }>;
}

// Evidence bundle
export interface ProductEvidenceBundle {
  // Identity (user-provided)
  productId: string;
  version: string;
  
  // Input (deterministic hash if applicable)
  specHash?: string;
  
  // Verification evidence
  build?: BuildEvidence[];
  architectureGuard?: ArchitectureGuardEvidence;
  tests?: TestEvidence[];
  
  // Execution metadata
  collectionTimestamp: string;
  execution?: {
    gitCommit?: string;
    nodeVersion?: string;
    toolVersions?: Record<string, string>;
  };
}

// Collector interface
export interface IEvidenceCollector {
  collect(productId: string, config?: { specHash?: string }): Promise<{
    bundle: ProductEvidenceBundle;
    bundlePath: string;
  }>;
  
  load(bundlePath: string): ProductEvidenceBundle;
}

// Adapter functions (not interfaces)
export function parseArchitectureGuard(stdout: string, exitCode: number): ArchitectureGuardEvidence;
export function parseBuild(stdout: string, exitCode: number): BuildEvidence[];
export function parseTests(jestJson: any): TestEvidence[];
```

**Trimmed:** ~100 LOC, 8 exports (from 226 LOC, 15 exports)

---

**Final Verdict:** ❌ **TRIM P2 CONTRACT**

**Post-Trim:** Re-review before implementation approval