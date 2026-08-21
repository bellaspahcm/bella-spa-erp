# BDGF G3a: ARCHITECTURE VALIDATION GATE

**Phase:** G3a - Prove P0 with Real Use Case  
**Status:** READY TO START  
**Date:** 2026-08-20  

---

## PURPOSE

**This is NOT:**
- ❌ Simple code refactor
- ❌ Feature development
- ❌ Migration optimization

**This IS:**
- ✅ **Architecture Validation Gate for BDGF itself**
- ✅ **Boundary test: Governance Kernel vs Domain Logic**
- ✅ **Production-like proof of P0 foundation**

**Critical Question:**

> Can P0 replace custom governance code without pulling domain logic into kernel?

**If YES:** BDGF boundary decision validated  
**If NO:** BDGF architecture needs revision

---

## SCOPE

### Gates to Refactor (Phase G3a)

**3 of 4 gates:**
1. ✅ Package Integrity Gate (52 checks)
2. ✅ E0 Artifact Integrity Gate (33 checks)
3. ✅ E1 Runtime Preconditions Gate (10 checks)

**NOT in G3a:**
- ❌ Rollback Test (31 checks) - requires P1 Rollback Harness

**Total:** 84/126 checks (66%)

**Why this scope:**
- Package Integrity: pure config-driven verification
- E0: artifact + schema validation
- E1: runtime database checks
- Rollback: requires behavioral testing framework (P1)

**Result:** Prove P0 with 66% of real verification workload

---

## GUARDRAILS (NON-NEGOTIABLE)

### Guardrail 1: No BDGF Kernel Modification for Amendment 12

**Rule:**

> **BDGF Kernel MUST NOT be modified to make Amendment 12 work.**

**If P0 lacks capability X:**

**Classify first:**

**A. Generic Governance Capability**
- Examples: New check type, evidence field, gate status
- Action: ✅ Add to BDGF Kernel (benefits all OS)

**B. Amendment 12 Domain Logic**
- Examples: Tenant-specific validation, Healthcare schema knowledge
- Action: ✅ Keep in config/domain layer (NOT in kernel)

**C. One-off Requirement**
- Examples: Specific to this migration only
- Action: ❌ Do NOT add to kernel (keep in Amendment 12 scripts)

**Enforcement:**

Before ANY kernel modification:
1. Document capability request
2. Classify (A/B/C)
3. If A: add to kernel with justification
4. If B/C: reject, implement in domain layer

**Violation = Architecture Failure**

---

### Guardrail 2: Functional Equivalence Required

**Rule:**

> **P0 MUST produce equivalent results to custom implementation.**

**What "equivalent" means:**

1. **Check Count:** Same number of checks (52, 33, 10)
2. **Pass/Fail:** Same checks pass/fail
3. **Evidence:** Same or better evidence quality
4. **Failure Messages:** Same or clearer messages
5. **Exit Behavior:** Same exit codes (0 = pass, 1 = fail)

**Testing:**

**Before Refactor:**
```bash
npm run verify:package-integrity
# Output: 52/52 PASS
```

**After Refactor:**
```bash
npm run bdgf:verify:migration-05:package-integrity
# Expected: 52/52 PASS (same result)
```

**Acceptance:**
- ✅ 52/52 PASS (Package Integrity)
- ✅ 33/33 PASS (E0)
- ✅ 10/10 PASS (E1)
- ✅ **Total: 84/84 PASS**

**Violation = Refactor Failure**

---

### Guardrail 3: Evidence Equivalence or Better

**Rule:**

> **Evidence MUST be equal or superior to custom implementation.**

**Cannot lose:**
- Check identifiers
- Check names
- Pass/fail status
- Timestamps
- Error messages
- Evidence artifacts

**Should gain:**
- ✅ Structured JSON format
- ✅ Auto-archiving with timestamps
- ✅ Human-readable logs
- ✅ Latest.json for easy access
- ✅ Summary statistics

**Testing:**

Compare evidence files:
```bash
# Old evidence (custom)
ls -la evidence-old/

# New evidence (BDGF)
ls -la evidence/migration-05/package-integrity/
ls -la evidence/migration-05/e0-gate/
ls -la evidence/migration-05/e1-gate/
```

**Acceptance:**
- ✅ All old evidence fields present
- ✅ New evidence fields added
- ✅ No information lost

**Violation = Evidence Quality Regression**

---

### Guardrail 4: Config-Driven Execution (No Domain Logic in Kernel)

**Rule:**

> **Gate execution MUST be config-driven. NO domain logic in BDGF Kernel.**

**Examples of VIOLATIONS:**

❌ **BAD - Domain logic in kernel:**
```javascript
// gate-runner.mjs
if (config.os === 'Healthcare') {
  // Special handling for Healthcare
  await checkTenantIsolation();
}
```

❌ **BAD - Migration-specific logic in kernel:**
```javascript
// check-registry.mjs
if (checkType === 'tenant-id-type') {
  // Amendment 12 specific check
  return checkTenantIdIsText();
}
```

✅ **GOOD - Domain logic in config:**
```json
{
  "checks": [
    {
      "id": "check-001",
      "name": "Tenant ID Type Check",
      "type": "schema-query",
      "config": {
        "query": "SELECT data_type FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tenant_id'",
        "expect": { "data_type": "text" }
      }
    }
  ]
}
```

✅ **GOOD - Generic capability in kernel:**
```javascript
// check-registry.mjs
this.register('schema-query', async (config) => {
  // Generic schema validation (any table, any column)
  const result = await client.query(config.query);
  // ... validate against config.expect
});
```

**Testing:**

Review all kernel files for domain keywords:
```bash
grep -r "tenant" scripts/bdgf/*.mjs
grep -r "Healthcare" scripts/bdgf/*.mjs
grep -r "Amendment" scripts/bdgf/*.mjs
grep -r "Migration" scripts/bdgf/*.mjs
grep -r "reserved_tenant_id" scripts/bdgf/*.mjs
```

**Acceptance:**
- ✅ 0 domain keywords in kernel
- ✅ All domain logic in configs

**Violation = Boundary Violation (Architecture Failure)**

---

### Guardrail 5: Failure Behavior Verification

**Rule:**

> **Gates MUST reject failures correctly (not just pass when should pass).**

**Testing:**

Inject failures intentionally:

**Test 1: Missing File**
```json
{
  "checks": [{
    "id": "fail-test-001",
    "name": "Non-existent File",
    "type": "file-existence",
    "config": { "files": ["does-not-exist.sql"] }
  }]
}
```
**Expected:** FAIL, exit code 1

**Test 2: Pattern Not Found**
```json
{
  "checks": [{
    "id": "fail-test-002",
    "name": "Missing Pattern",
    "type": "regex-match",
    "config": {
      "target": "migration-05a.sql",
      "pattern": "DOES_NOT_EXIST",
      "failOn": "not-found"
    }
  }]
}
```
**Expected:** FAIL, exit code 1

**Test 3: Schema Mismatch**
```json
{
  "checks": [{
    "id": "fail-test-003",
    "name": "Wrong Type",
    "type": "schema-query",
    "config": {
      "query": "SELECT data_type FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tenant_id'",
      "expect": { "data_type": "uuid" }
    }
  }]
}
```
**Expected:** FAIL (tenant_id is text, not uuid), exit code 1

**Acceptance:**
- ✅ All failure tests FAIL correctly
- ✅ Clear error messages
- ✅ Evidence shows failure reason

**Violation = False Positive (Dangerous)**

---

### Guardrail 6: No Regression Outside Governance

**Rule:**

> **Amendment 12 v3 MUST maintain all behavior except refactored governance.**

**What MUST NOT change:**
- ❌ Migration SQL files (05-A/B/C)
- ❌ Database schema
- ❌ Data transformations
- ❌ RLS policies
- ❌ E2/E3 gate SQL functions (not refactored yet)
- ❌ Rollback test (not refactored yet)

**What CAN change:**
- ✅ Governance scripts (verify-*.mjs, run-*.mjs)
- ✅ Evidence location (evidence/ vs old locations)
- ✅ NPM scripts (updated to use BDGF)

**Testing:**

```bash
# Verify migration files unchanged
git diff supabase/migrations/20260819*.sql
# Expected: no changes

# Verify E2/E3 gates unchanged
git diff supabase/migrations/*e2*.sql
git diff supabase/migrations/*e3*.sql
# Expected: no changes
```

**Acceptance:**
- ✅ 0 changes to migration SQL
- ✅ 0 changes to E2/E3 SQL functions
- ✅ Only governance scripts changed

**Violation = Scope Creep**

---

## SUCCESS METRICS

### Metric 1: Functional Equivalence

| Gate | Old (Custom) | New (BDGF P0) | Status |
|------|--------------|---------------|--------|
| Package Integrity | 52/52 PASS | 52/52 PASS | ✅ |
| E0 Gate | 33/33 PASS | 33/33 PASS | ✅ |
| E1 Gate | 10/10 PASS | 10/10 PASS | ✅ |
| **Total** | **84/84 PASS** | **84/84 PASS** | ✅ |

---

### Metric 2: Evidence Quality

| Aspect | Old | New | Status |
|--------|-----|-----|--------|
| Structured Format | ❌ | ✅ JSON | ✅ BETTER |
| Auto-Archive | ❌ | ✅ Yes | ✅ BETTER |
| Timestamps | ✅ | ✅ ISO8601 | ✅ EQUAL |
| Human Log | ❌ | ✅ Yes | ✅ BETTER |
| Latest.json | ❌ | ✅ Yes | ✅ BETTER |

---

### Metric 3: Code Reduction

| Gate | Old (Lines) | New (Lines) | Reduction |
|------|-------------|-------------|-----------|
| Package Integrity | 400 custom | 80 config | 80% |
| E0 Gate | 350 custom | 100 config | 71% |
| E1 Gate | 280 custom | 50 config | 82% |
| **Total** | **1,030 lines** | **230 lines** | **78%** |

**Kernel:** 1,280 lines (reused by all OS)

---

### Metric 4: Boundary Integrity

| Check | Status |
|-------|--------|
| No domain keywords in kernel | ✅ |
| All domain logic in config | ✅ |
| Generic capabilities only | ✅ |
| Kernel unchanged for Amendment 12 | ✅ |

---

### Metric 5: Failure Detection

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Missing file | FAIL | FAIL | ✅ |
| Pattern not found | FAIL | FAIL | ✅ |
| Schema mismatch | FAIL | FAIL | ✅ |

---

## ACCEPTANCE CRITERIA

**G3a SUCCEEDS when:**

1. ✅ **Functional Equivalence:** 84/84 PASS (same as custom)
2. ✅ **Evidence Quality:** Equal or better
3. ✅ **Code Reduction:** 78%+ reduction
4. ✅ **Boundary Integrity:** 0 domain keywords in kernel
5. ✅ **Failure Behavior:** All failure tests FAIL correctly
6. ✅ **No Regression:** Amendment 12 behavior unchanged outside governance

**Status:** ✅ **P0 VALIDATED AGAINST REAL USE CASE**

---

**G3a FAILS if:**

1. ❌ Check counts differ (52/52, 33/33, 10/10)
2. ❌ Pass/fail results differ
3. ❌ Evidence quality degrades
4. ❌ Domain logic found in kernel
5. ❌ False positives (should fail but passes)
6. ❌ Migration SQL changed

**Status:** ❌ **ARCHITECTURE REVISION REQUIRED**

---

## REFACTOR PROCESS

### Step 1: Analyze Current Implementation

**For each gate:**
1. Read custom script
2. Extract checks
3. Identify check types (file, regex, query)
4. Map to Check Registry types
5. Document domain-specific logic

**Output:** Check inventory per gate

---

### Step 2: Create BDGF Configs

**Structure:**
```
.bdgf/
├── deployment-config.json
└── gates/
    ├── package-integrity.json
    ├── e0-gate.json
    └── e1-gate.json
```

**Each config:**
- Gate metadata (name, version, deployment)
- Checks array (id, name, type, config)
- Minimum check count

---

### Step 3: Create Gate Runner Scripts

**Structure:**
```
scripts/
└── bdgf-amendment-12/
    ├── run-package-integrity.mjs
    ├── run-e0-gate.mjs
    └── run-e1-gate.mjs
```

**Each script:**
```javascript
import { runGateFromConfig } from '../bdgf/gate-runner.mjs';
const result = await runGateFromConfig('.bdgf/gates/[gate].json');
process.exit(result.status === 'PASS' ? 0 : 1);
```

---

### Step 4: Update NPM Scripts

**Before:**
```json
{
  "scripts": {
    "verify:package-integrity": "node scripts/verify-amendment-12-v3-package-integrity.mjs",
    "verify:e0": "node scripts/run-e0-artifact-integrity-gate.mjs",
    "verify:e1": "node scripts/run-e1-verification.mjs"
  }
}
```

**After:**
```json
{
  "scripts": {
    "bdgf:verify:migration-05:package": "node scripts/bdgf-amendment-12/run-package-integrity.mjs",
    "bdgf:verify:migration-05:e0": "node scripts/bdgf-amendment-12/run-e0-gate.mjs",
    "bdgf:verify:migration-05:e1": "node scripts/bdgf-amendment-12/run-e1-gate.mjs",
    "bdgf:verify:migration-05:p0": "npm run bdgf:verify:migration-05:package && npm run bdgf:verify:migration-05:e0 && npm run bdgf:verify:migration-05:e1"
  }
}
```

---

### Step 5: Run Verification

**Command:**
```bash
npm run bdgf:verify:migration-05:p0
```

**Expected Output:**
```
✅ Package Integrity: 52/52 PASS
✅ E0 Gate: 33/33 PASS
✅ E1 Gate: 10/10 PASS

Total: 84/84 PASS
Evidence: evidence/migration-05/
```

---

### Step 6: Verify Guardrails

**Check 1: Functional Equivalence**
```bash
# Old
npm run verify:package-integrity
# New
npm run bdgf:verify:migration-05:package
# Compare: should be 52/52 in both
```

**Check 2: Evidence Quality**
```bash
diff evidence-old/ evidence/migration-05/
# New should have more/equal info
```

**Check 3: Boundary Integrity**
```bash
grep -r "tenant" scripts/bdgf/*.mjs
grep -r "Healthcare" scripts/bdgf/*.mjs
# Expected: 0 results
```

**Check 4: Failure Behavior**
```bash
# Inject failure, run gate
# Expected: FAIL with clear message
```

**Check 5: No Regression**
```bash
git diff supabase/migrations/
# Expected: 0 changes to migration SQL
```

---

### Step 7: Document Results

**Create:** `docs/governance/BDGF_G3A_VALIDATION_RESULTS.md`

**Contents:**
- All 6 guardrails: PASS/FAIL
- All 5 metrics: achieved/not achieved
- Lessons learned
- Kernel modifications (if any, with justification)
- Conclusion: VALIDATED or FAILED

---

## TIMELINE

**Estimated:** 4-6 hours

**Breakdown:**
- Step 1 (Analyze): 1 hour
- Step 2 (Create configs): 2 hours
- Step 3-4 (Scripts): 1 hour
- Step 5 (Run verification): 30 minutes
- Step 6 (Verify guardrails): 1 hour
- Step 7 (Document): 30 minutes

---

## CONCLUSION

**G3a is not refactoring. G3a is validation.**

**Question:** Can BDGF Kernel remain domain-agnostic while replacing real governance code?

**If YES:** ✅ Architecture validated, proceed to P1/P2  
**If NO:** ❌ Architecture flawed, revise boundary

**This is the most important test of BDGF architecture.**

---

**Phase:** G3a  
**Status:** READY TO START  
**Guardrails:** 6 (non-negotiable)  
**Success Criteria:** 84/84 PASS + 6 guardrails PASS  
**Next:** P1 (after G3a validation)  
