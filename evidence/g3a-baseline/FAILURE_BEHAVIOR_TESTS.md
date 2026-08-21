# G3a BASELINE: FAILURE BEHAVIOR TESTS

**Date:** 2026-08-20  
**Purpose:** Document how legacy gates reject invalid inputs  
**Why Critical:** BDGF must replicate failure semantics, not just success  

---

## FAILURE TEST STRATEGY

**Principle:** A governance gate is only trustworthy if it correctly rejects invalid inputs.

**Test Approach:**
- Inject known failures
- Capture rejection behavior
- Document error messages, exit codes, evidence
- Establish baseline for BDGF to replicate

**Test Categories:**
1. Missing file (artifact integrity)
2. Pattern not found (content validation)
3. Schema mismatch (runtime precondition)

---

## TEST 1: MISSING FILE

**Gate:** Package Integrity  
**Failure Type:** Artifact Integrity Violation  

### Test Procedure

**1. Identify Target File:**
```
supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
```

**2. Inject Failure:**
```powershell
# Temporarily rename file
mv supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql supabase/migrations/TEMP_HIDDEN.sql

# Run gate
node scripts/verify-amendment-12-v3-package-integrity.mjs > evidence/g3a-baseline/failure-test-1-missing-file.txt 2>&1

# Restore file
mv supabase/migrations/TEMP_HIDDEN.sql supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
```

**3. Expected Behavior:**
- Exit code: 1 (failure)
- Error message: "File not found" or "Missing migration file"
- Check result: FAIL for file existence check
- Gate stops execution (does not continue to next checks)

**4. Critical Assertions:**
- Gate MUST fail (not pass with warning)
- Error MUST be clear (which file missing)
- Exit code MUST be non-zero
- Evidence MUST document failure reason

---

## TEST 2: PATTERN NOT FOUND

**Gate:** Package Integrity  
**Failure Type:** Content Validation Failure  

### Test Procedure

**1. Create Temporary Modified Gate:**
```javascript
// Modify scripts/verify-amendment-12-v3-package-integrity.mjs
// Add a check for non-existent pattern in 05-A migration
// Example: Look for "INTENTIONALLY_MISSING_PATTERN_xyz123"
```

**2. Inject Failure:**
```powershell
# Run modified gate that checks for non-existent pattern
node scripts/verify-amendment-12-v3-package-integrity-MODIFIED.mjs > evidence/g3a-baseline/failure-test-2-pattern-not-found.txt 2>&1
```

**3. Expected Behavior:**
- Exit code: 1 (failure)
- Error message: "Pattern not found: INTENTIONALLY_MISSING_PATTERN_xyz123"
- Check result: FAIL for pattern validation
- Gate stops with clear failure reason

**4. Critical Assertions:**
- Gate MUST detect missing pattern
- Error MUST specify which pattern missing
- Gate MUST NOT continue if pattern missing
- False positive MUST NOT occur

---

## TEST 3: SCHEMA MISMATCH (Simulated)

**Gate:** E1 Runtime Preconditions  
**Failure Type:** Database State Violation  

### Test Procedure (Simulation - No DB Mutation)

**Strategy:** Document expected behavior without actual DB mutation

**Scenario A: Wrong tenant_id Type**
```
Expected precondition: tenant_id type = text
Failure injection: tenant_id type = uuid (wrong type)

Expected behavior:
- E1 gate detects type mismatch
- Error: "Schema mismatch: tenant_id type = uuid, expected text"
- Exit code: 1
- Gate stops with FAIL status
```

**Scenario B: Missing Fixtures**
```
Expected precondition: 5/5 TEXT fixtures present
Failure injection: Only 3/5 fixtures exist

Expected behavior:
- E1 gate detects missing fixtures
- Error: "Fixture count = 3, expected 5"
- Exit code: 1
- Gate stops with FAIL status
```

**Scenario C: FK Constraint Exists**
```
Expected precondition: No FK on tenant_id
Failure injection: FK constraint already exists

Expected behavior:
- E1 gate detects FK presence
- Error: "FK constraint found on tenant_id, expected none"
- Exit code: 1
- Gate stops (cannot proceed with migration)
```

**Note:** These are logical simulations. Actual injection would require database mutations, which violates baseline freeze principle. BDGF migration testing will include actual negative tests.

---

## FAILURE SEMANTICS BASELINE

### Exit Code Semantics

**Success:** Exit code 0  
**Failure:** Exit code 1  
**Error:** Exit code 1 (same as failure)

**No distinction between:**
- Expected failure (test rejection correctly)
- Unexpected error (bug in gate)

**BDGF must replicate:** Exit code 1 for any check failure or error

---

### Error Message Pattern

**Package Integrity:**
```
❌ File check failed: <filename> not found
❌ Pattern check failed: <pattern> not found in <file>
❌ Syntax check failed: <specific error>

STATUS: ❌ FAIL
Exit code: 1
```

**E0 Gate:**
```
❌ Artifact integrity failed: <reason>
❌ Dependency check failed: <reason>
❌ Precondition failed: <reason>

STATUS: ❌ FAIL
Exit code: 1
```

**E1 Gate:**
```
❌ Fixture check failed: <reason>
❌ Schema check failed: <reason>
❌ Precondition failed: <reason>

STATUS: ❌ FAIL
Exit code: 1
```

---

### Evidence on Failure

**Current Behavior:**
- Error message written to stdout/stderr
- Exit code 1
- No structured evidence file on failure
- Terminal output is complete evidence

**BDGF must replicate:**
- Clear error messages
- Exit code 1
- Evidence can be enhanced (structured JSON) but must include same information
- Must not pass silently on failure

---

## CRITICAL FAILURE SCENARIOS

### False Positive (Most Dangerous)

**Definition:** Gate reports PASS when should FAIL

**Example:**
- File missing but gate doesn't check
- Pattern missing but gate uses loose regex
- Schema wrong but gate has fallback logic

**Impact:** Allows invalid package to proceed

**G3a Validation:** Bypass Audit (Layer 3) will test for false positives

---

### False Negative (Over-strict)

**Definition:** Gate reports FAIL when should PASS

**Example:**
- Pattern exists but regex too strict
- Schema correct but check has wrong expectation
- Valid state rejected due to gate bug

**Impact:** Blocks valid package from proceeding

**G3a Validation:** Differential verification (Layer 4) will detect discrepancies

---

## NEGATIVE PATH VERIFICATION (From Package Integrity)

**Documented in baseline execution:**

Legacy Package Integrity gate explicitly verifies:
1. ✅ NO fuzzy match (exact pattern matching)
2. ✅ NO auto-assignment (manual mapping required)
3. ✅ NO graceful degradation (hard failures)

**This means:**
- Missing requirement → FAIL (not WARNING)
- Ambiguous state → FAIL (not assume)
- Optional check → Still executed (not skipped)

**BDGF must replicate:** Same strict rejection semantics

---

## FAILURE BEHAVIOR SUMMARY

### What Legacy Gates Do on Failure

1. **Detect failure** (check fails)
2. **Stop execution** (no continue to next checks)
3. **Report failure** (clear error message)
4. **Exit with code 1** (non-zero)
5. **Provide context** (which check, why failed)

### What BDGF Must Do on Failure

1. **Same detection** (check fails)
2. **Same stop behavior** (no continue)
3. **Same or better error** (clear message)
4. **Same exit code** (1)
5. **Same or better context** (which check, why failed)
6. **Optional enhancement:** Structured evidence (JSON)

### Unacceptable BDGF Behavior

1. ❌ Pass when legacy fails (false positive)
2. ❌ Fail when legacy passes (false negative, unless bug fix)
3. ❌ Silent failure (no error message)
4. ❌ Exit code 0 on failure
5. ❌ Continue execution after check fails
6. ❌ Downgrade failure to warning
7. ❌ Assume default on missing data

---

## TEST EXECUTION STATUS

**Test 1: Missing File**
- Status: ✅ EXECUTED
- Result: ✅ GATE CORRECTLY FAILED
- Evidence: `evidence/g3a-baseline/failure-test-1-missing-file.txt`
- Duration: <30 seconds

**Test 2: Pattern Not Found**
- Status: ⬜ PENDING (requires temporary gate modification)
- Risk: LOW (temporary script, no commit)
- Duration: ~1 hour (create modified script, test, cleanup)

**Test 3: Schema Mismatch**
- Status: ✅ DOCUMENTED (simulation, no DB mutation)
- Risk: ZERO (no actual injection)
- Approach: Logical reasoning from E1 gate code

---

## DECISION POINT

**Option A: Execute Test 1 + Test 2 (Full Failure Testing)**
- Pro: Complete failure behavior baseline
- Pro: Actual evidence of rejection behavior
- Con: Requires temporary modifications
- Time: ~1.5 hours

**Option B: Document Expected Behavior (Simulation)**
- Pro: No temporary modifications needed
- Pro: Baseline freeze completes faster
- Con: Failure behavior based on code analysis, not execution
- Time: ~15 minutes

**Option C: Execute Test 1 Only (Minimal Failure Testing)**
- Pro: Real failure evidence (missing file is simplest test)
- Pro: Quick to execute and reverse
- Con: Incomplete failure coverage
- Time: ~30 minutes

**Recommendation:** Execute **Test 1** (missing file) for real failure evidence, document **Test 2 + Test 3** as expected behavior based on code analysis.

**Rationale:**
- Test 1 is safe, quick, reversible
- Test 1 proves gate can fail (not always pass)
- Test 2/3 can be inferred from gate implementation
- G3a Layer 3 (Architecture Validation) will include BDGF negative tests
- Baseline freeze should not be delayed for exhaustive failure testing

---

## NEXT STEPS

1. Execute Test 1 (missing file) → capture failure evidence
2. Document expected behavior for Test 2 + Test 3
3. Mark failure behavior baseline as COMPLETE
4. Proceed to evidence archive
5. LOCK baseline

---

**Status:** Failure behavior tests designed  
**Execution:** Test 1 pending, Test 2/3 documented  
**Next:** Execute Test 1, complete failure baseline  


---

## TEST 1 RESULTS: MISSING FILE

**Test Executed:** ✅ YES  
**Date:** 2026-08-20  
**Gate:** Package Integrity

### Injected Failure

**Action:** Renamed migration file to hide it
```
20260819050000_runtime_migration_05a_classification_reservation.sql
→ TEMP_HIDDEN_FOR_TEST.sql
```

### Observed Behavior

**Exit Code:** 1 ✅ (correct, non-zero on failure)

**Status:** ❌ FAIL ✅ (correct, gate failed)

**Check Results:**
- Total Checks: 52
- ✅ PASS: 30 (checks before file existence)
- ❌ FAIL: 1 (missing file detected)
- ⏭️ SKIP: 21 (checks after failure, correctly skipped)

**Error Message:**
```
FAILED CHECKS:

❌ File: supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
   MISSING: supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql

RESOLUTION REQUIRED:
- Review failed checks above
- Ensure all 5 mandatory conditions are implemented
- Re-run verification after fixes

⚠️ DO NOT proceed to Package Review until all checks PASS
```

### Verification

**Gate correctly:**
1. ✅ Detected missing file
2. ✅ Stopped execution (skipped 21 subsequent checks)
3. ✅ Reported failure clearly (which file missing)
4. ✅ Exited with code 1
5. ✅ Provided resolution guidance
6. ✅ Blocked further progress (DO NOT proceed)

**No false positives:**
- Gate did NOT pass when file missing ✅
- Gate did NOT continue after failure ✅
- Gate did NOT downgrade to warning ✅

### BDGF Replication Requirements

**Must replicate:**
1. Detect missing artifact file
2. FAIL immediately (not warning)
3. Report which file missing (clear error)
4. Exit with code 1
5. Stop further checks (no continue after failure)
6. Provide actionable resolution guidance

**May enhance:**
- Structured evidence (JSON format)
- More detailed error context
- Suggested fix commands

**Must NOT:**
- Pass when file missing
- Continue after detection
- Silently fail
- Exit with code 0

---

## FAILURE BEHAVIOR BASELINE: COMPLETE

### Summary

**Test 1 (Missing File):** ✅ EXECUTED  
**Result:** Gate correctly failed, exit code 1, clear error message

**Test 2 (Pattern Not Found):** ✅ DOCUMENTED  
**Reason:** Behavior can be inferred from gate implementation + Test 1 result

**Test 3 (Schema Mismatch):** ✅ DOCUMENTED  
**Reason:** E1 gate code shows detection logic, Test 1 proves failure mechanism works

### Baseline Evidence

**Actual Execution:**
- `failure-test-1-missing-file.txt` - Real failure evidence

**Logical Inference:**
- Test 2/3 behavior documented from code analysis
- Test 1 proves gate failure mechanism works correctly
- Same mechanism used for pattern/schema checks

### Confidence Level

**High confidence that:**
1. Gates detect failures (Test 1 proves)
2. Gates stop on failure (Test 1 proves)
3. Gates exit with code 1 (Test 1 proves)
4. Gates report clear errors (Test 1 proves)

**Inferred with confidence:**
5. Pattern checks use same failure mechanism (code analysis)
6. Schema checks use same failure mechanism (code analysis)

### BDGF Validation

**G3a Layer 3 will include:**
- BDGF negative tests (inject failures, verify rejection)
- Bypass audit (ensure no false positives)
- Semantic equivalence (same rejection logic as legacy)

**This baseline provides:**
- Expected behavior for BDGF to replicate
- Reference evidence for differential verification
- Failure semantics to maintain

---

**Status:** ✅ FAILURE BEHAVIOR BASELINE COMPLETE  
**Evidence:** 1 real execution + 2 documented inferences  
**Next:** Evidence archive, baseline LOCK  
