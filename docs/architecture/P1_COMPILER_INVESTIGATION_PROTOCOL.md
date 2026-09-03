# P1 Compiler Bottleneck Investigation Protocol

**Date:** 2026-09-01  
**Type:** Engineering Investigation (NOT source remediation)  
**Priority:** CRITICAL — Blocks P1 completion

---

## Investigation Mandate

**Goal:** Identify root cause of TypeScript compiler hang on large dependency graphs

**NOT Goal:**
- ❌ "Make compiler run" by any means
- ❌ Fix source code before understanding problem
- ❌ Modify tsconfig to exclude problematic files
- ❌ Assume "toolchain issue" without evidence

**Success Criteria:**
- ✅ Identify exact compiler phase causing hang
- ✅ Identify exact module/type causing bottleneck
- ✅ Classify: SOURCE DEFECT vs TOOLCHAIN vs CONFIGURATION vs MIXED
- ✅ Provide evidence-based remediation recommendation

---

## Protocol Overview

```
PHASE A — Establish Baseline
     ↓
PHASE B — Identify Compiler Phase
     ↓
PHASE C — Binary-Search Dependency Graph
     ↓
PHASE D — Identify Pathological Module/Type
     ↓
PHASE E — Classify Root Cause
     ↓
PHASE F — Evidence-Based Remediation
     ↓
PHASE G — Full Compiler Verification
```

**NO CODE EDITS until Phase E classification complete**

---

## PHASE A — Establish Baseline

**Goal:** Understand compiler behavior and configuration baseline

### A1. Compiler Configuration Audit

**Inspect:**
```bash
# Root configuration
tsconfig.json

# Extended configurations
tsconfig.*.json
tsconfig.build.json
tsconfig.typecheck.*.json

# Project references
tsconfig.references.json
```

**Check for:**
- `extends` chains
- `paths` mappings (can cause resolution performance issues)
- `baseUrl` configuration
- `references` (project references)
- `incremental` mode
- `composite` mode
- `declaration` generation
- `moduleResolution` strategy
- `skipLibCheck` (may hide issues)
- `typeRoots` / `types` overrides

**Document:** Current configuration state

---

### A2. Baseline Compiler Runs

**Test matrix:**

| Test | Command | Cache State | Expected |
|------|---------|-------------|----------|
| 1 | `tsc --noEmit` | Clean | Baseline |
| 2 | `tsc --noEmit` | Cached | Compare |
| 3 | `tsc --noEmit --incremental` | Clean | Test incremental |
| 4 | `tsc --noEmit --incremental` | Cached | Test incremental cache |
| 5 | `tsc --showConfig` | N/A | Verify config |
| 6 | `tsc --listFilesOnly` | N/A | Verify graph |

**Measure for each:**
- Execution time (or timeout)
- CPU usage pattern
- Memory usage pattern
- Process count
- Any output/diagnostics produced
- Exit code

**Document:** Performance baseline, identify if incremental helps

---

### A3. Cluster-Specific Baseline

**For each blocked cluster (Finance, Healthcare, Logistics, Products):**

```bash
# Create scoped tsconfig
npx tsc -p tsconfig.typecheck.<cluster>.tmp.json --noEmit --extendedDiagnostics
```

**Measure:**
- Time to hang
- Files parsed
- Files checked
- Last diagnostic message before hang

**Compare:**
- Core: ~50-100 files → ✅ PASS (<10s)
- Runtime/Security: ~10 files → ✅ PASS (<10s)
- Finance: ~20-30 files → 🔴 HANG (~120s)
- Healthcare: ~200+ files → 🔴 HANG (~120s)
- Logistics: ~100+ files → 🔴 HANG (~60s)
- Products: ~300+ files → 🔴 HANG (expected ~90s)

**Hypothesis:** Threshold exists between "pass quickly" and "hang"

---

### A4. Deliverable

**Document:** `P1_COMPILER_BASELINE_FINDINGS.md`

**Contents:**
- Configuration audit results
- Baseline performance metrics
- Cluster comparison table
- Threshold hypothesis
- Proceed/no-proceed decision for Phase B

---

## PHASE B — Identify Compiler Phase

**Goal:** Determine which compiler phase causes hang

### B1. Extended Diagnostics

```bash
npx tsc -p tsconfig.typecheck.healthcare.tmp.json \
  --noEmit \
  --extendedDiagnostics \
  > healthcare-diagnostics.log 2>&1 &

# Monitor and kill after timeout
```

**Analyze log for last phase before hang:**
- Files: (parsing phase)
- Module resolution time: (resolution phase)
- Program structure time: (program construction)
- Type checking time: (type checking phase)
- Declaration emit time: (declaration phase)

**Expected:** Log will show which phase hangs

---

### B2. Trace Resolution

```bash
npx tsc -p tsconfig.typecheck.healthcare.tmp.json \
  --noEmit \
  --traceResolution \
  > healthcare-resolution.log 2>&1 &
```

**Check for:**
- Resolution loops
- Excessive module lookups
- `paths` mapping performance issues
- node_modules traversal depth

**Expected:** Identify if resolution phase is bottleneck

---

### B3. Generate Trace

```bash
npx tsc -p tsconfig.typecheck.healthcare.tmp.json \
  --generateTrace trace-healthcare \
  --noEmit
```

**Analyze with:**
```bash
npm install --save-dev @typescript/analyze-trace
npx analyze-trace trace-healthcare
```

**Expected:** Detailed breakdown of time spent per phase/file/type

---

### B4. Deliverable

**Document:** `P1_COMPILER_PHASE_ANALYSIS.md`

**Contents:**
- Exact phase causing hang
- Evidence (logs, traces)
- Hotspot files/types
- Proceed to Phase C with suspects list

---

## PHASE C — Binary-Search Dependency Graph

**Goal:** Isolate specific module causing hang

### C1. Module Isolation Strategy

**For Healthcare (example):**

```
Healthcare (200+ files) → HANG
     ↓
Test subdirectories individually:
     ├── shared-kernel → ?
     ├── contracts → ?
     ├── order-engine → ?
     ├── admission-engine → ?
     ├── bed-engine → ?
     ├── nursing-engine → ?
     └── ...
```

**For each engine/domain:**
```bash
npx tsc --noEmit src/platform/healthcare/engines/order-engine/**/*.ts
```

**Record:** PASS or HANG for each module

---

### C2. Binary Search

**If A PASS, B PASS, but A+B HANG:**

```
Test: A+B
  → HANG
  
Test: A
  → PASS
  
Test: B
  → PASS
  
Conclusion: Interaction between A and B causes hang
```

**Continue narrowing:**
```
Test: A + (B/2)
Test: A + (B/4)
...
```

**Until:** Single file or small file set identified

---

### C3. Import Chain Analysis

**Once suspect file(s) identified:**

```bash
# Generate dependency graph
npx madge --circular --extensions ts src/platform/healthcare/engines/order-engine
npx madge --circular --image order-engine-deps.svg src/platform/healthcare/engines/order-engine

# Check for cycles
npx madge --circular --warning src/platform/healthcare
```

**Look for:**
- Circular imports
- Deep import chains
- Barrel export re-exports
- Cross-kernel imports

---

### C4. Deliverable

**Document:** `P1_COMPILER_MODULE_ISOLATION.md`

**Contents:**
- Module-by-module test results
- Binary search path
- Suspect file(s) identified
- Dependency graph visualization
- Circular dependency report

---

## PHASE D — Identify Pathological Module/Type

**Goal:** Find exact type/import/pattern causing bottleneck

### D1. Suspect File Analysis

**For each suspect file, check:**

1. **Type complexity:**
   - Generic type parameters (depth, constraints)
   - Conditional types (nesting level)
   - Mapped types over large unions
   - Recursive type definitions
   - Intersection/union size

2. **Import patterns:**
   - Barrel re-exports
   - Import cycles
   - Dynamic imports
   - Type-only imports

3. **Contract patterns:**
   - Large interface definitions
   - Discriminated unions (size)
   - Branded types
   - Template literal types

---

### D2. Type Inference Hotspots

**Common pathological patterns:**

```typescript
// 1. Deep generic nesting
type A<T> = T extends B<C<D<E>>> ? F : G

// 2. Large union types
type Status = 'A' | 'B' | 'C' | ... (50+ members)

// 3. Recursive types
type JSON = string | number | boolean | null | JSON[] | { [key: string]: JSON }

// 4. Complex conditional types
type Extract<T> = T extends { type: infer U } 
  ? U extends 'A' ? A 
  : U extends 'B' ? B 
  : U extends 'C' ? C
  : never
  : never

// 5. Mapped types over unions
type Handlers = { [K in ActionType]: (action: Extract<Action, { type: K }>) => void }
```

**Check suspect files for these patterns**

---

### D3. Import Graph Analysis

**Specific checks:**

1. **Circular imports:**
```
shared-kernel → contracts → engine → shared-kernel
```

2. **Cross-kernel cycles:**
```
Healthcare Kernel → Finance Kernel → Healthcare Kernel
```

3. **Platform-Product cycles:**
```
Product → Industry Kernel → Platform Core → Product
```

4. **Barrel export chains:**
```
index.ts → sub-index.ts → sub-sub-index.ts → actual-file.ts
```

**Note:** Architecture Guard may PASS but TypeScript graph still pathological

---

### D4. Deliverable

**Document:** `P1_COMPILER_PATHOLOGY_IDENTIFICATION.md`

**Contents:**
- Exact file(s) causing hang
- Exact type(s) causing hang (if identified)
- Import cycle details (if found)
- Type complexity metrics
- Evidence (screenshots, type definitions, graphs)

---

## PHASE E — Classify Root Cause

**Goal:** Determine if SOURCE DEFECT, TOOLCHAIN, CONFIGURATION, or MIXED

### E1. Classification Matrix

| Evidence | Source Defect | Toolchain | Configuration | Mixed |
|----------|---------------|-----------|---------------|-------|
| Circular imports found | ✅ | | | |
| Pathological type found | ✅ | | | |
| `paths` mapping excessive | | | ✅ | |
| `skipLibCheck: false` + large deps | | | ✅ | |
| TypeScript version old | | ✅ | | |
| Complex type + old TS | | | | ✅ |
| Project references misconfigured | | | ✅ | |
| Incremental mode helps | | ✅ | | |
| Specific file removal fixes | ✅ | | | |

---

### E2. Classification Outcomes

#### 🟢 TOOLCHAIN CONFIGURATION

**Definition:** Compiler configuration issue, source is correct

**Evidence:**
- `paths` remapping causes excessive lookups
- `skipLibCheck: false` on large dependencies
- Project references circular
- Incremental cache missing

**Remediation:** Adjust tsconfig.json, no source changes

---

#### 🔴 SOURCE DEFECT

**Definition:** Source code pattern causes compiler performance issue

**Evidence:**
- Circular import detected
- Pathological type identified
- Import depth excessive
- Type inference exponential

**Remediation:** Source code refactoring required

---

#### 🟠 MIXED

**Definition:** Source creates pathological graph + configuration amplifies

**Evidence:**
- Source has circular imports AND `paths` mapping exacerbates
- Complex types AND old TypeScript version
- Deep generics AND incremental disabled

**Remediation:** Both source and configuration changes required

---

#### ⚪ INCONCLUSIVE

**Definition:** Insufficient evidence to classify

**Remediation:** Continue investigation, gather more evidence

---

### E3. Deliverable

**Document:** `P1_COMPILER_ROOT_CAUSE_CLASSIFICATION.md`

**Contents:**
- Classification verdict (🟢/🔴/🟠/⚪)
- Evidence supporting classification
- Specific source defects identified (if 🔴)
- Specific configuration issues identified (if 🟢)
- Recommended remediation approach
- **Authorization request for Phase F**

**GATE:** Must have clear classification before proceeding to Phase F

---

## PHASE F — Evidence-Based Remediation

**Goal:** Fix identified issues (source or configuration)

### F1. Configuration Remediation (if 🟢 or 🟠)

**Potential fixes:**

```json
{
  "compilerOptions": {
    // Enable incremental compilation
    "incremental": true,
    
    // Skip lib checks (if not source issue)
    "skipLibCheck": true,
    
    // Simplify paths if excessive
    "paths": { /* simplified */ },
    
    // Use project references
    "composite": true,
    "references": [
      { "path": "./src/platform" },
      { "path": "./src/products" }
    ]
  }
}
```

**Test each change individually, measure impact**

---

### F2. Source Remediation (if 🔴 or 🟠)

**Follow forensic protocol:**

1. **Circular import removal:**
```
Before: A → B → C → A
After:  A → B, C → B (extract common dependency)
```

2. **Type simplification:**
```typescript
// Before: Pathological
type Complex<T extends A<B<C<D>>>> = ...

// After: Simplified
type Simple<T extends A> = ...
```

3. **Barrel export cleanup:**
```typescript
// Before: Re-export everything
export * from './module-a'
export * from './module-b'

// After: Named exports only
export { specificExport } from './module-a'
```

4. **Union type reduction:**
```typescript
// Before: 50+ member union
type Status = 'A' | 'B' | 'C' | ... // 50 members

// After: Grouped or enum
enum StatusGroup {
  GroupA = 'group-a',
  GroupB = 'group-b'
}
```

**Each fix:**
- Isolated commit
- Forensic evidence
- Before/after compiler measurement
- Architecture Guard verification

---

### F3. Deliverable

**Commits:** Isolated remediation commits (if source changes)  
**Document:** `P1_COMPILER_REMEDIATION_EVIDENCE.md`

**Contents:**
- Changes applied
- Before/after measurements
- Forensic justification
- Architecture impact assessment

---

## PHASE G — Full Compiler Verification

**Goal:** Verify all 4 blocked clusters now compile

### G1. Re-verification Matrix

| Cluster | Before | After | Status |
|---------|--------|-------|--------|
| Finance | HANG (120s) | ? | |
| Healthcare | HANG (120s) | ? | |
| Logistics | HANG (60s) | ? | |
| Products | HANG (90s) | ? | |

**Success criteria:**
- ✅ Finance compiles in <30s
- ✅ Healthcare compiles in <60s
- ✅ Logistics compiles in <60s
- ✅ Products compiles in <90s
- ✅ All pass without errors

---

### G2. Full Project Verification

```bash
# Full type-check
npm run type-check

# Expect: PASS in reasonable time (<5 minutes)
```

---

### G3. Regression Prevention

**Add to CI/CD:**
```yaml
- name: Type-check with timeout
  run: |
    timeout 300 npm run type-check || exit 1
```

**Add compiler performance test:**
```typescript
test('compiler performance regression', () => {
  const start = Date.now()
  execSync('npx tsc --noEmit')
  const duration = Date.now() - start
  expect(duration).toBeLessThan(300_000) // 5 minutes
})
```

---

### G4. Deliverable

**Document:** `P1_COMPILER_VERIFICATION_COMPLETE.md`

**Contents:**
- Re-verification results
- Performance measurements
- Regression prevention measures
- P1 cluster status updates

---

## Governance Rules

### Investigation Phase (A-E)

**ALLOWED:**
- ✅ Reading source code
- ✅ Running compiler diagnostics
- ✅ Generating traces/profiles
- ✅ Creating test tsconfigs
- ✅ Analyzing dependency graphs

**NOT ALLOWED:**
- ❌ Modifying source code
- ❌ Modifying tsconfig.json
- ❌ Excluding files from compilation
- ❌ Assuming root cause without evidence

---

### Remediation Phase (F-G)

**ALLOWED (with evidence):**
- ✅ Source changes if SOURCE DEFECT proven
- ✅ Configuration changes if TOOLCHAIN proven
- ✅ Both if MIXED proven

**NOT ALLOWED:**
- ❌ Changes without Phase E classification
- ❌ "Try this and see" experimentation
- ❌ Excluding problematic files
- ❌ Weakening type checking

---

### Classification Requirements

**Before declaring 🟢 TOOLCHAIN CONFIGURATION:**
- Must prove source code has no pathological patterns
- Must identify specific configuration issue
- Must test configuration fix in isolation

**Before declaring 🔴 SOURCE DEFECT:**
- Must identify specific file/type causing hang
- Must prove pattern is pathological
- Must have forensic evidence

**Before declaring 🟠 MIXED:**
- Must prove both source and configuration contribute
- Must measure impact of each component
- Must have remediation plan for both

**If uncertain:**
- Declare ⚪ INCONCLUSIVE
- Continue investigation
- Do NOT proceed to remediation

---

## Success Criteria

**Investigation successful when:**
- ✅ Root cause identified with evidence
- ✅ Classification clear (🟢/🔴/🟠)
- ✅ Remediation approach defined
- ✅ Impact measured

**Remediation successful when:**
- ✅ All 4 clusters compile
- ✅ Performance acceptable (<5 min full project)
- ✅ No new errors introduced
- ✅ Architecture boundaries preserved

**P1 unblocked when:**
- ✅ Finance/Healthcare compiler re-verified
- ✅ Logistics/Products source investigated and classified
- ✅ All 6 clusters have clear status
- ✅ Compiler verification no longer bottleneck

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| A — Baseline | 2-4 hours | None |
| B — Phase ID | 4-8 hours | Phase A complete |
| C — Binary Search | 1-2 days | Phase B complete |
| D — Pathology ID | 1-2 days | Phase C complete |
| E — Classification | 4-8 hours | Phase D complete |
| F — Remediation | 1-3 days | Phase E complete |
| G — Verification | 4-8 hours | Phase F complete |

**Total:** 4-7 days (assuming no blockers)

---

## Next Step

**Begin Phase A: Establish Baseline**

**Start with:** Configuration audit and baseline compiler runs

**Deliverable:** `P1_COMPILER_BASELINE_FINDINGS.md`

**NO CODE EDITS until Phase E classification complete**

---

**Protocol owner:** TBD  
**Status:** READY TO BEGIN  
**Priority:** CRITICAL (blocks P1 completion)
