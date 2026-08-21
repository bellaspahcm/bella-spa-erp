# BDGF G3a: ARCHITECTURE GATE EXECUTION PROTOCOL

**Phase:** G3a - Architecture Validation Gate  
**Type:** ARCHITECTURE GATE (not refactor task)  
**Date:** 2026-08-20  
**Status:** LOCKED  

---

## CRITICAL DEFINITION

**G3a is NOT:**
- ❌ Code refactoring task
- ❌ Optimization exercise
- ❌ Feature development

**G3a IS:**
- ✅ **Architecture Validation Gate for BDGF**
- ✅ **Boundary test: Can kernel remain domain-agnostic?**
- ✅ **Production-like proof of P0 foundation**

**Single Question:**

> Can P0 replace real governance code without breaking boundary?

**If YES:** P1/P2 approved  
**If NO:** P0 architecture must be revised

---

## 4-LAYER EXECUTION STRUCTURE

```
Layer 1: Baseline Freeze
   ↓
Layer 2: Migration (incremental, per-gate)
   ↓
Layer 3: Architecture Validation (boundary audit)
   ↓
Layer 4: Differential Verification (A ≡ B)
   ↓
G3a Evidence Package
   ↓
G3a PASS/FAIL
```

---

## LAYER 1: BASELINE FREEZE

### Purpose

**Capture state BEFORE refactor so differential verification possible.**

**Problem if skipped:**
> After refactor, cannot prove equivalence (no baseline to compare)

---

### Artifacts to Capture

**1. Code Metrics**
```bash
# Count lines
wc -l scripts/verify-amendment-12-v3-package-integrity.mjs
wc -l scripts/run-e0-artifact-integrity-gate.mjs
wc -l scripts/run-e1-verification.mjs
# Total: 1,030 lines (baseline)
```

**2. Check Inventory**
```bash
# Package Integrity
node scripts/verify-amendment-12-v3-package-integrity.mjs --dry-run
# Expected: 52 checks listed

# E0
node scripts/run-e0-artifact-integrity-gate.mjs --dry-run
# Expected: 33 checks listed

# E1
node scripts/run-e1-verification.mjs --dry-run
# Expected: 10 checks listed

# Total: 84 checks (baseline)
```

**3. Execution Results**
```bash
# Run all gates, capture output
npm run verify:package-integrity > baseline-package.txt 2>&1
npm run verify:e0 > baseline-e0.txt 2>&1
npm run verify:e1 > baseline-e1.txt 2>&1

# Archive
mkdir -p evidence/g3a-baseline/
mv baseline-*.txt evidence/g3a-baseline/
```

**4. Evidence Format**
```bash
# Capture current evidence structure
ls -laR evidence-old/ > evidence/g3a-baseline/evidence-structure.txt
```

**5. Failure Behavior**
```bash
# Inject failures intentionally
# Test 1: Missing file (should FAIL)
# Test 2: Pattern not found (should FAIL)
# Test 3: Schema mismatch (should FAIL)

# Document baseline failure behavior
```

---

### Baseline Snapshot

**Create:** `evidence/g3a-baseline/BASELINE_SNAPSHOT.md`

**Contents:**
```markdown
# G3a Baseline Snapshot

**Date:** 2026-08-20
**Captured Before:** Refactor to BDGF

## Code Metrics
- verify-amendment-12-v3-package-integrity.mjs: 400 lines
- run-e0-artifact-integrity-gate.mjs: 350 lines
- run-e1-verification.mjs: 280 lines
- **Total:** 1,030 lines

## Check Counts
- Package Integrity: 52 checks
- E0 Gate: 33 checks
- E1 Gate: 10 checks
- **Total:** 84 checks

## Execution Results
- Package Integrity: 52/52 PASS
- E0 Gate: 33/33 PASS
- E1 Gate: 10/10 PASS
- **Total:** 84/84 PASS

## Evidence Artifacts
- [List evidence files and locations]

## Failure Behavior
- Missing file: FAIL (exit 1)
- Pattern not found: FAIL (exit 1)
- Schema mismatch: FAIL (exit 1)

## Exit Semantics
- Success: exit 0
- Failure: exit 1
- Error messages: [documented]
```

**Status:** ✅ Baseline frozen, cannot change during G3a

---

## LAYER 2: MIGRATION (INCREMENTAL)

### Purpose

**Migrate gates ONE AT A TIME, verify after each.**

**Problem if done all at once:**
> If failure occurs, cannot identify which gate caused it

---

### Execution Sequence

**Step 2.1: Package Integrity**

```bash
# 1. Create BDGF config
mkdir -p .bdgf/gates/
# Create .bdgf/gates/package-integrity.json

# 2. Create gate runner script
# Create scripts/bdgf-amendment-12/run-package-integrity.mjs

# 3. Update NPM script
# Add: "bdgf:verify:migration-05:package": "..."

# 4. Run verification
npm run bdgf:verify:migration-05:package

# 5. Verify result
# Expected: 52/52 PASS

# 6. FREEZE (do not proceed if FAIL)
```

**Checkpoint:** ✅ Package Integrity migrated, 52/52 PASS

---

**Step 2.2: E0 Gate**

```bash
# Only after Step 2.1 PASS

# 1. Create BDGF config
# Create .bdgf/gates/e0-gate.json

# 2. Create gate runner script
# Create scripts/bdgf-amendment-12/run-e0-gate.mjs

# 3. Update NPM script
# Add: "bdgf:verify:migration-05:e0": "..."

# 4. Run verification
npm run bdgf:verify:migration-05:e0

# 5. Verify result
# Expected: 33/33 PASS

# 6. FREEZE
```

**Checkpoint:** ✅ E0 migrated, 33/33 PASS

---

**Step 2.3: E1 Gate**

```bash
# Only after Step 2.2 PASS

# 1. Create BDGF config
# Create .bdgf/gates/e1-gate.json

# 2. Create gate runner script
# Create scripts/bdgf-amendment-12/run-e1-gate.mjs

# 3. Update NPM script
# Add: "bdgf:verify:migration-05:e1": "..."

# 4. Run verification
npm run bdgf:verify:migration-05:e1

# 5. Verify result
# Expected: 10/10 PASS

# 6. FREEZE
```

**Checkpoint:** ✅ E1 migrated, 10/10 PASS

---

**Step 2.4: Combined Verification**

```bash
# Only after all 3 gates PASS individually

npm run bdgf:verify:migration-05:p0
# This runs: package + e0 + e1

# Expected: 84/84 PASS
```

**Checkpoint:** ✅ All gates migrated, 84/84 PASS

---

## LAYER 3: ARCHITECTURE VALIDATION

### Purpose

**Verify BDGF boundary: Kernel must remain domain-agnostic.**

**This is the most critical layer.**

---

### Audit 1: Kernel Boundary Integrity

**Command:**
```bash
# Search for domain keywords in kernel
grep -r "tenant" scripts/bdgf/*.mjs
grep -r "Healthcare" scripts/bdgf/*.mjs
grep -r "Amendment" scripts/bdgf/*.mjs
grep -r "Migration" scripts/bdgf/*.mjs
grep -r "reserved_tenant_id" scripts/bdgf/*.mjs
grep -r "canonical_tenant_id" scripts/bdgf/*.mjs
grep -r "Package Integrity" scripts/bdgf/*.mjs
grep -r "E0" scripts/bdgf/*.mjs
grep -r "E1" scripts/bdgf/*.mjs
```

**Expected:** 0 results for all searches

**If ANY found:** ❌ **ARCHITECTURE VIOLATION** → FAIL immediately

---

### Audit 2: Import Analysis

**Command:**
```bash
# Check kernel does not import Amendment 12
grep -r "amendment-12" scripts/bdgf/*.mjs
grep -r "migration-05" scripts/bdgf/*.mjs
grep -r "verify-amendment" scripts/bdgf/*.mjs
```

**Expected:** 0 results

**If ANY found:** ❌ **BOUNDARY VIOLATION** → FAIL immediately

---

### Audit 3: Config vs Implementation

**Check:** Configs contain governance declarations, NOT business implementation

**❌ BAD (business logic in config):**
```json
{
  "checks": [{
    "type": "custom-tenant-check",
    "config": {
      "businessRule": "if tenant is Healthcare, check HIPAA compliance"
    }
  }]
}
```

**✅ GOOD (governance declaration):**
```json
{
  "checks": [{
    "type": "data-query",
    "config": {
      "query": "SELECT COUNT(*) FROM tenants WHERE tenant_id IS NULL",
      "expect": { "count": 0 }
    }
  }]
}
```

**Manual Review:** Read all configs, ensure declarative not imperative

---

### Audit 4: Evidence Comparison

**Command:**
```bash
# Compare evidence structure
diff -r evidence/g3a-baseline/ evidence/migration-05/

# Check: new evidence has >= information
```

**Expected:**
- ✅ All baseline fields present
- ✅ New fields added (structured JSON, timestamps, etc.)
- ✅ No information lost

---

### Audit 5: Failure Injection (Negative Test)

**Critical:** Happy path is not enough, must test rejection

**Test 1: Missing File**
```bash
# Modify config to check non-existent file
# Run gate
# Expected: FAIL with clear message
```

**Test 2: Pattern Not Found**
```bash
# Modify config to check pattern that doesn't exist
# Run gate
# Expected: FAIL with clear message
```

**Test 3: Schema Mismatch**
```bash
# Modify config to expect wrong type
# Run gate
# Expected: FAIL with clear message
```

**If ANY test PASS (should FAIL):** ❌ **FALSE POSITIVE** → FAIL immediately

---

### Audit 6: Exit Semantics

**Check:** Exit codes unchanged

**Baseline:**
- Success: exit 0
- Failure: exit 1

**After Refactor:**
- Success: exit 0
- Failure: exit 1

**If changed:** ❌ **SEMANTICS VIOLATION** → FAIL

---

### Audit 7: No Bypass

**Check:** No "quick fixes" to make tests pass

**Examples of BYPASS (❌ FORBIDDEN):**
```javascript
// gate-runner.mjs
if (process.env.G3A_TEST === 'true') {
  return { status: 'PASS' }; // Bypass!
}

// check-registry.mjs
if (checkType === 'problematic-check') {
  return { status: 'PASS', evidence: {} }; // Skip!
}
```

**Manual Review:** Code review for bypass patterns

**If ANY bypass found:** ❌ **BYPASS DETECTED** → FAIL immediately

---

## LAYER 4: DIFFERENTIAL VERIFICATION

### Purpose

**Prove functional equivalence: Legacy ≡ BDGF**

**This is the strongest evidence.**

---

### Execution

**Step 1: Run Legacy Implementation**
```bash
npm run verify:package-integrity > result-A-package.txt 2>&1
npm run verify:e0 > result-A-e0.txt 2>&1
npm run verify:e1 > result-A-e1.txt 2>&1
```

**Step 2: Run BDGF Implementation**
```bash
npm run bdgf:verify:migration-05:package > result-B-package.txt 2>&1
npm run bdgf:verify:migration-05:e0 > result-B-e0.txt 2>&1
npm run bdgf:verify:migration-05:e1 > result-B-e1.txt 2>&1
```

**Step 3: Compare Results**
```bash
diff result-A-package.txt result-B-package.txt
diff result-A-e0.txt result-B-e0.txt
diff result-A-e1.txt result-B-e1.txt
```

**Expected:** Semantically equivalent (check counts, pass/fail status same)

---

### Comparison Matrix

| Aspect | Legacy (A) | BDGF (B) | Status |
|--------|------------|----------|--------|
| **Package Integrity** |
| Check count | 52 | 52 | ✅ |
| Pass count | 52 | 52 | ✅ |
| Fail count | 0 | 0 | ✅ |
| Exit code | 0 | 0 | ✅ |
| **E0 Gate** |
| Check count | 33 | 33 | ✅ |
| Pass count | 33 | 33 | ✅ |
| Fail count | 0 | 0 | ✅ |
| Exit code | 0 | 0 | ✅ |
| **E1 Gate** |
| Check count | 10 | 10 | ✅ |
| Pass count | 10 | 10 | ✅ |
| Fail count | 0 | 0 | ✅ |
| Exit code | 0 | 0 | ✅ |
| **Total** |
| Check count | 84 | 84 | ✅ |
| Pass count | 84 | 84 | ✅ |
| Fail count | 0 | 0 | ✅ |

**If ALL ✅:** Functional Equivalence PROVEN

**If ANY differ:** ❌ **EQUIVALENCE VIOLATION** → FAIL

---

## GATE CRITERIA (REVISED)

### Hard Gates (MUST PASS - Architecture)

1. ✅ **84/84 Checks PASS** (functional equivalence)
2. ✅ **Evidence ≥ Baseline** (no information lost)
3. ✅ **0 Domain Logic in Kernel** (boundary maintained)
4. ✅ **Failure Behavior Correct** (negative tests FAIL as expected)
5. ✅ **No Regression** (Amendment 12 unchanged outside governance)
6. ✅ **Config-Driven** (no imperative code in configs)

**ALL must PASS for architecture validation.**

---

### Optimization Metric (Nice to Have)

7. ≥78% Code Reduction (1,030 → 230 lines)

**NOT a Hard Gate.**

**Reason:**
- If BDGF needs 50 more lines for generic capability → OK (still domain-agnostic)
- If reduced to 100 lines but with domain logic in kernel → FAIL (boundary violated)

**LOC is optimization, not architectural invariant.**

---

## G3A EVIDENCE PACKAGE

### Must Prove 6 Statements

**Statement 1:** BDGF can replace real governance code  
**Evidence:** 84/84 PASS, differential verification A ≡ B

**Statement 2:** BDGF does not need to understand Amendment 12 domain  
**Evidence:** 0 domain keywords in kernel, boundary audit PASS

**Statement 3:** 84 checks maintain semantics  
**Evidence:** Check counts same, pass/fail same, exit codes same

**Statement 4:** Evidence not lost  
**Evidence:** Baseline comparison, all fields present or better

**Statement 5:** Failure still blocked  
**Evidence:** Negative tests FAIL correctly, no false positives

**Statement 6:** Kernel reusable for other OS  
**Evidence:** No Amendment 12 imports, generic capabilities only

---

### Evidence Package Structure

```
evidence/g3a/
├── baseline/
│   ├── BASELINE_SNAPSHOT.md
│   ├── result-A-package.txt
│   ├── result-A-e0.txt
│   └── result-A-e1.txt
├── migration/
│   ├── package-integrity-migration.md
│   ├── e0-gate-migration.md
│   └── e1-gate-migration.md
├── validation/
│   ├── boundary-audit.md
│   ├── import-analysis.md
│   ├── config-review.md
│   ├── evidence-comparison.md
│   ├── failure-injection-results.md
│   ├── exit-semantics-verification.md
│   └── bypass-audit.md
├── differential/
│   ├── result-B-package.txt
│   ├── result-B-e0.txt
│   ├── result-B-e1.txt
│   └── comparison-matrix.md
└── G3A_FINAL_VERDICT.md
```

---

## EXECUTION SEQUENCE (STRICT ORDER)

```
1. Baseline Freeze
   ├─ Capture code metrics
   ├─ Capture check inventory
   ├─ Run legacy gates → capture results
   ├─ Document evidence format
   ├─ Test failure behavior
   └─ Create BASELINE_SNAPSHOT.md

2. Migration (Incremental)
   ├─ Package Integrity
   │  ├─ Create config
   │  ├─ Create runner
   │  ├─ Run verification
   │  ├─ Verify 52/52 PASS
   │  └─ FREEZE
   ├─ E0 Gate
   │  ├─ Create config
   │  ├─ Create runner
   │  ├─ Run verification
   │  ├─ Verify 33/33 PASS
   │  └─ FREEZE
   └─ E1 Gate
      ├─ Create config
      ├─ Create runner
      ├─ Run verification
      ├─ Verify 10/10 PASS
      └─ FREEZE

3. Architecture Validation
   ├─ Audit 1: Kernel boundary (grep domain keywords)
   ├─ Audit 2: Import analysis (no Amendment 12 imports)
   ├─ Audit 3: Config review (declarative not imperative)
   ├─ Audit 4: Evidence comparison (baseline vs new)
   ├─ Audit 5: Failure injection (negative tests)
   ├─ Audit 6: Exit semantics (exit codes unchanged)
   └─ Audit 7: Bypass detection (code review)

4. Differential Verification
   ├─ Run legacy → result A
   ├─ Run BDGF → result B
   ├─ Compare A ≡ B
   └─ Create comparison matrix

5. G3a Evidence Package
   ├─ Collect all evidence
   ├─ Prove 6 statements
   └─ Create G3A_FINAL_VERDICT.md

6. G3a PASS/FAIL Decision
   └─ Review 6 hard gates + 6 statements
```

---

## SCOPE RESTRICTIONS

**During G3a:**

❌ **FORBIDDEN:**
- Do NOT modify P0 components (unless generic capability needed)
- Do NOT build P1 components (Rollback Harness, Scope Guard, Human GO)
- Do NOT build P2 components (Compliance Reporter)
- Do NOT expand scope beyond 3 gates
- Do NOT add features
- Do NOT optimize prematurely

✅ **ALLOWED:**
- Create BDGF configs for 3 gates
- Create gate runner scripts
- Add generic check types to Check Registry (if needed, with justification)
- Document evidence
- Fix bugs in P0 (if discovered, with justification)

---

## FINAL DECISION

**G3a PASS when:**
- ✅ All 6 hard gates PASS
- ✅ All 6 statements have evidence
- ✅ Evidence package complete

**Conclusion:** ✅ **BDGF Governance Kernel Architecture VALIDATED**

**Then:** Approve P1/P2 build with confidence

---

**G3a FAIL when:**
- ❌ ANY hard gate FAIL
- ❌ ANY statement lacks evidence
- ❌ Domain logic found in kernel

**Conclusion:** ❌ **ARCHITECTURE REVISION REQUIRED**

**Then:** Fix P0 architecture before P1/P2

---

## CRITICAL QUESTION (SINGLE FOCUS)

> **"P0 có thực sự đủ tốt để thay thế governance code thực tế mà không phá vỡ boundary không?"**

**If YES:** Architecture validated → proceed  
**If NO:** Architecture flawed → revise

**This is the ONLY question G3a answers.**

---

**Phase:** G3a - Architecture Gate  
**Type:** ARCHITECTURE VALIDATION (not refactor)  
**Status:** LOCKED  
**Execution:** 4 layers, strict sequence  
**Decision:** PASS/FAIL based on 6 hard gates + 6 statements  
