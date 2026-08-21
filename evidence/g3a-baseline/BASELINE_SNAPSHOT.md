# G3a BASELINE SNAPSHOT

**Date:** 2026-08-20  
**Phase:** G3a Layer 1 - Baseline Freeze  
**Purpose:** Capture state BEFORE refactor to enable differential verification  
**Git Commit:** 41749609edd5d5a1831d8f0be9815bc60714aae7  

---

## CODE METRICS

### Gate Scripts

**File:** `scripts/verify-amendment-12-v3-package-integrity.mjs`  
**Lines:** ~420 lines (counted)

**File:** `scripts/run-e0-artifact-integrity-gate.mjs`  
**Lines:** ~470 lines (counted)

**File:** `scripts/run-e1-verification.mjs`  
**Lines:** ~301 lines (counted)

**Total:** 1,191 lines of custom governance code

---

## CHECK INVENTORY

### Package Integrity Gate

**Expected Checks:** 52 checks

**Check Categories:**
1. File existence verification (6 migration files)
2. P4 metadata validation (created_at + provisioned_by)
3. Advisory lock explicit acquisition
4. Mapping immutability (trigger after COMPLETE)
5. Transaction + lock + PK/UNIQUE + verification
6. Deletion audit columns (deleted_at, deleted_by, deletion_reason)
7. SQL syntax validation
8. Semantic pattern validation
9. Behavioral assertions
10. Negative path verification (NO fuzzy match, NO auto-assignment, NO graceful degradation)

**Verification Method:** Static analysis + pattern matching

---

### E0 Artifact Integrity Gate

**Expected Checks:** 33 checks

**Check Categories:**
1. Artifact Integrity (15 checks)
   - Migration files exist
   - Verification scripts exist
   - File hashes verified
   - Structure validated

2. Dependency Integrity (6 checks)
   - Database schema state
   - Table existence
   - Column types
   - Constraint state

3. Execution Preconditions (4 checks)
   - No prior execution (migration history)
   - Database state correct
   - Privileges sufficient

4. Gate Integrity (8 checks)
   - E1 gate independence
   - E2 gate independence
   - E3 gate independence
   - Verification gates cannot be bypassed

**Verification Method:** File checks + database queries

---

### E1 Runtime Preconditions Gate

**Expected Checks:** 10 checks

**Check Categories:**
1. Fixture Integrity (tenant fixtures present)
2. RLS State (row-level security enabled)
3. RLS Policies (policies exist and correct)
4. Migration History (no previous execution)
5. Schema Compatibility (column types match preconditions)
6. FK Absence (pre-migration state: no FK on tenant_id)
7. Canonical Authority (canonical table exists if required)
8. Privilege Verification (database user has UPDATE permission)

**Verification Method:** Runtime database queries

---

## TOTAL CHECK COUNT

**Package Integrity:** 52 checks  
**E0 Gate:** 33 checks  
**E1 Gate:** 10 checks  

**Total:** 95 checks

**Critical Distinction:**

**Check Inventory:** 95 check definitions identified  
**Baseline Execution:** ⬜ PENDING (not yet run)

**Note:** Originally stated as 84 checks in planning. Actual code review reveals 95 checks.

**Reason:** 84 was planning estimate based on high-level understanding. 95 is verified implementation baseline from code review.

**Impact:** G3a target updated to **95/95 PASS** (not 84/84)

**Evidence Strength:** BDGF validated against implementation evidence, not planning assumption. This strengthens G3a architectural validation.

---

## EXECUTION BASELINE

### Commands

```bash
# Package Integrity
npm run verify:amendment-12:package-integrity
# or
node scripts/verify-amendment-12-v3-package-integrity.mjs

# E0 Gate
npm run verify:amendment-12:e0
# or
node scripts/run-e0-artifact-integrity-gate.mjs

# E1 Gate
npm run verify:amendment-12:e1
# or
node scripts/run-e1-verification.mjs
```

---

## EXPECTED RESULTS (TO BE CAPTURED)

### Package Integrity Gate

**Expected Output:**
```
╔══════════════════════════════════════════════════════════╗
║ AMENDMENT 12 V3 — PACKAGE INTEGRITY VERIFICATION         ║
╚══════════════════════════════════════════════════════════╝

[52 checks execute]

Result: 52/52 PASS
Exit Code: 0
```

---

### E0 Gate

**Expected Output:**
```
╔══════════════════════════════════════════════════════════╗
║ E0 ARTIFACT INTEGRITY GATE                               ║
╚══════════════════════════════════════════════════════════╝

[33 checks execute]

Result: 33/33 PASS
Exit Code: 0
```

---

### E1 Gate

**Expected Output:**
```
╔══════════════════════════════════════════════════════════╗
║ E1 RUNTIME PRECONDITIONS GATE                            ║
╚══════════════════════════════════════════════════════════╝

[10 checks execute]

Result: 10/10 PASS
Exit Code: 0
```

---

## EXIT SEMANTICS

**Success:** Exit code 0  
**Failure:** Exit code 1  
**Error:** Exit code 1 with error message

**Output:** Console logs + optional evidence files

---

## EVIDENCE FORMAT (CURRENT)

**Location:** Mixed (console output, some file-based)

**Structure:** Custom per gate, not standardized

**Archiving:** Manual

**Timestamps:** Some gates have timestamps, not all

**Query:** No standard query interface

---

## FAILURE BEHAVIOR (TO BE TESTED)

### Test Scenarios

**Test 1: Missing File**
- Remove one migration file temporarily
- Run Package Integrity
- Expected: FAIL with "File not found" message

**Test 2: Pattern Not Found**
- Modify config to check non-existent pattern
- Run gate
- Expected: FAIL with "Pattern not found" message

**Test 3: Schema Mismatch**
- Modify database schema (simulate wrong state)
- Run E0 or E1
- Expected: FAIL with "Schema mismatch" message

---

## ENVIRONMENT

**Node Version:** (captured at runtime)

**Database:** PostgreSQL 17.6 via Supabase  
**Connection:** `.env` file (DATABASE_URL)

**Dependencies:**
- pg (PostgreSQL client)
- fs/promises (file operations)
- dotenv (environment variables)

---

## GIT STATE

**Branch:** (to be captured)

**Commit:** 41749609edd5d5a1831d8f0be9815bc60714aae7

**Status:** Clean (no uncommitted changes expected)

**Files to Track:**
- scripts/verify-amendment-12-v3-package-integrity.mjs
- scripts/run-e0-artifact-integrity-gate.mjs
- scripts/run-e1-verification.mjs

---

## BASELINE FREEZE STATUS

**Status:** 🟡 IN PROGRESS (NOT LOCKED)

**Completed:**
- ✅ Git SHA captured (4174960)
- ✅ LOC baseline (1,191 lines)
- ✅ 95-check inventory (52 + 33 + 10)
- ✅ Baseline snapshot document created

**Pending (REQUIRED for LOCK):**
- ⬜ **Legacy Execution Evidence** (CRITICAL)
  - Run Package Integrity → capture 52/52 result
  - Run E0 Gate → capture 33/33 result
  - Run E1 Gate → capture 10/10 result
  - Archive all output to result-A-*.txt

- ⬜ **Failure Behavior Baseline** (CRITICAL)
  - Inject failure: missing file → capture FAIL behavior
  - Inject failure: pattern not found → capture FAIL behavior
  - Inject failure: schema mismatch → capture FAIL behavior
  - Document error messages, exit codes, evidence

- ⬜ **Evidence Archive** (REQUIRED)
  - Archive all baseline execution evidence
  - Document environment (Node version, DB version)
  - Capture exact check results per gate

- ⬜ **Baseline LOCK** (FINAL STEP)
  - Review all evidence complete
  - Mark baseline as immutable
  - Approve Layer 2 migration start

**DO NOT proceed to Layer 2 until ALL pending items complete and baseline LOCKED.**

---

## CRITICAL DISTINCTION

**Check Inventory vs Execution:**

**Inventory:** 95 check definitions identified from code review ✅  
**Execution:** ?/95 checks actually run and verified ⬜

**Only after legacy execution complete can we state:**
> **Baseline Execution: 95/95 PASS**

**This distinction critical for audit:**
- Inventory = static analysis (definitions found in code)
- Execution = dynamic verification (checks actually run)

**Both required for complete baseline.**

---

## NOTES

**Check Count Discrepancy:**

Original planning assumed 84 checks (52 + 33 + 10 = 95, not 84).

**Reason:** Initial estimate was based on high-level understanding. Actual baseline after code review shows 95 checks.

**Impact:** G3a success criteria updated to 95/95 PASS (not 84/84).

**No Change to Architecture:** Same 3 gates, just more checks per gate than initially estimated.

---

**Baseline Snapshot Version:** 1.0  
**Status:** PARTIAL (metrics captured, execution pending)  
**Next:** Capture legacy execution results  
