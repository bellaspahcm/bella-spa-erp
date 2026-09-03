# R4.2 Verification Checklist

**Date:** 2026-08-20  
**Status:** 🟡 PENDING EXECUTION  
**Phase:** R4.2 — verify_approval() Implementation

---

## 🎯 VERIFICATION SEQUENCE

### Step 1: Pre-Deployment Review

**Review migration SQL:**
- [ ] State transitions defined (REQUESTED → APPROVED → CONSUMED)
- [ ] `no_self_approval` constraint present
- [ ] `unique_active_approval` constraint for single-use
- [ ] Indexes created for performance
- [ ] Permissions granted correctly
- [ ] Comments document invariants

**Review implementation:**
- [ ] All 8 invariants (I0-I7) implemented
- [ ] Fail-closed design (any error → BLOCK)
- [ ] Atomic status update for I3
- [ ] No NULL/missing treated as valid
- [ ] Evidence generated for all outcomes

**Review tests:**
- [ ] 11 negative tests (must BLOCK)
- [ ] 1 positive test (must PASS)
- [ ] Tests map to invariants
- [ ] Adversarial scenarios covered

---

### Step 2: Deploy Migration (DEV ONLY)

**DO NOT deploy to production yet.**

**Target:** Development/test environment

**Deployment:**
```bash
# Option A: Supabase CLI (if available)
npx supabase db push

# Option B: Supabase Dashboard SQL Editor
# Copy/paste supabase/migrations/20260820150000_r4_approval_contract.sql
# Execute in dev project
```

**Verification after deploy:**
```sql
-- Check table exists
SELECT * FROM information_schema.tables WHERE table_name = 'bella_migration_approval';

-- Check constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'bella_migration_approval';

-- Verify no_self_approval exists
SELECT * FROM information_schema.check_constraints 
WHERE constraint_name = 'no_self_approval';
```

**Deployment complete when:**
- [ ] Table created
- [ ] Constraints active
- [ ] Indexes created
- [ ] No errors in deployment

---

### Step 3: Run Test Suite

**Execute:**
```bash
node scripts/bdgf/r4-test-approval-gate.mjs
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════
TEST SUMMARY: 19 total tests
✅ PASSED: 19
❌ FAILED: 0
═══════════════════════════════════════════════════════════

🎉 ALL TESTS PASSED - R4.2 APPROVAL GATE VERIFIED
```

**Acceptance Criteria:**
- [ ] Test 1 (No approval) → BLOCK ✅
- [ ] Test 2 (Self-approval) → BLOCK ✅ (I0)
- [ ] Test 3 (Hash mismatch) → BLOCK ✅ (I1)
- [ ] Test 4 (Wrong environment) → BLOCK ✅ (I2/I5)
- [ ] Test 5 (Wrong schema) → BLOCK ✅ (I2)
- [ ] Test 6 (Expired) → BLOCK ✅ (I4)
- [ ] Test 7 (Not yet valid) → BLOCK ✅ (I4)
- [ ] Test 8 (Replay attack) → BLOCK ✅ (I3)
- [ ] Test 9 (Unauthorized approver) → BLOCK ✅ (I6)
- [ ] Test 10 (Tampered) → BLOCK ✅ (I7)
- [ ] Test 11 (Revoked) → BLOCK ✅
- [ ] Test 12 (Valid approval) → PASS ✅

**Total:** 12/12 tests PASS

---

### Step 4: If ANY Test Fails

**DO NOT:**
- ❌ Modify test to make it pass
- ❌ Skip failed test
- ❌ Continue to next step

**DO:**
1. Document which test failed
2. Analyze failure cause:
   - Contract error? (R4.1 needs revision)
   - Implementation error? (r4-verify-approval.mjs needs fix)
   - Database enforcement missing? (migration needs update)
   - Test checking wrong thing? (test needs fix)

3. Fix root cause
4. Re-run ALL tests
5. Only proceed when 12/12 PASS

---

### Step 5: Evidence Collection

**Create test results document:**

Document ALL test outputs, including:
- Each test name and result
- Evidence from each BLOCK decision
- Mapping test → invariant
- Timing information
- No secrets/passwords in evidence

**Critical Evidence:**

**I0 (No Self-Approval):**
```
requester_id: user_same
approver_id: user_same
→ BLOCK: SELF_APPROVAL_FORBIDDEN
```

**I1 (Migration Binding):**
```
approved_hash: abc123...
executing_hash: def456...
→ BLOCK: MIGRATION_HASH_MISMATCH
```

**I2 (Scope Binding):**
```
approved_for: staging
executing_in: production
→ BLOCK: ENVIRONMENT_MISMATCH
```

**I3 (Single-Use):**
```
First use: PASS
Second use: BLOCK (NO_APPROVAL_FOUND or ALREADY_USED)
```

**I4 (Time Validity):**
```
expires_at: 2026-08-20T18:00:00Z
now: 2026-08-20T19:00:00Z
→ BLOCK: APPROVAL_EXPIRED
```

**I6 (Approver Authority):**
```
approver_role: tech_lead
environment: production
authorized_roles: [admin, dba, emergency_override]
→ BLOCK: UNAUTHORIZED_APPROVER
```

**I7 (Integrity):**
```
stored_hash: original_hash...
computed_hash: tampered_hash...
→ BLOCK: APPROVAL_TAMPERED
```

---

### Step 6: R3 Regression Check

**CRITICAL:** Verify R4.2 did NOT reopen any R3 authorities.

**Re-run R3 tests:**
```bash
# Authority #1 test
node scripts/bdgf/r3-simple-test.mjs

# Expected: 8/8 PASS (bella_developer still READ-ONLY)
```

**Authority status after R4.2:**
- [ ] Authority #1 (DATABASE_URL): Still CLOSED ✅
- [ ] Authority #2 (Supabase CLI): Still CLOSED ✅
- [ ] Authority #3 (SERVICE_ROLE_KEY): Still CLOSED ✅

**R4.2 MUST NOT:**
- Grant bella_developer mutation rights
- Create new SERVICE_ROLE_KEY usage
- Bypass PostgreSQL permissions
- Reopen CLI access

**Regression check PASS when:**
- [ ] r3-simple-test.mjs: 8/8 PASS
- [ ] No new mutation authorities created
- [ ] R3 baseline unchanged

---

### Step 7: Completion Criteria

**R4.2 can be marked 🟢 COMPLETE ONLY when:**

- [x] Code implemented (verify_approval.mjs, test suite)
- [ ] Migration deployed (dev environment)
- [ ] 12/12 tests PASS
- [ ] Evidence documented
- [ ] R3 regression check PASS
- [ ] No secrets in evidence
- [ ] Test → invariant mapping complete

**When complete, create:**
1. `evidence/g3a-architecture/R4_2_TEST_RESULTS.md`
2. `evidence/g3a-architecture/R4_2_EVIDENCE.md`
3. `evidence/g3a-architecture/R4_2_COMPLETE.md`

---

## 🚫 BLOCKERS

### If Migration Deploy Fails

**Stop and investigate:**
- SQL syntax error?
- Permission denied?
- Constraint conflict?

**Fix migration, then retry.**

---

### If Tests Fail

**Possible causes:**

1. **Contract flaw (R4.1):**
   - Invariant impossible to enforce
   - Constraint too strict/loose
   - → Reopen R4.1, document deviation, refreeze

2. **Implementation bug:**
   - Logic error in verify_approval()
   - Missing invariant check
   - → Fix implementation, retest

3. **Database enforcement missing:**
   - Constraint not active
   - Index missing
   - → Update migration, redeploy

4. **Test error:**
   - Test checking wrong thing
   - Test data invalid
   - → Fix test, rerun

---

### If R3 Regression Detected

**CRITICAL BLOCKER:**

If R3 test fails or new mutation authority appears:

1. **STOP R4.2 immediately**
2. Document regression
3. Rollback R4.2 changes
4. Fix R3 regression
5. Re-verify R3 baseline
6. Only then retry R4.2

**R3 baseline is non-negotiable.**

---

## 📝 NEXT ACTION

**Immediate:** Deploy migration to dev and run tests.

```bash
# 1. Deploy (choose method)
npx supabase db push
# OR paste SQL in Supabase Dashboard

# 2. Run tests
node scripts/bdgf/r4-test-approval-gate.mjs

# 3. Check R3 regression
node scripts/bdgf/r3-simple-test.mjs
```

**Report results back for evidence documentation.**

---

**Current Status:** 🟡 CODE COMPLETE, AWAITING TEST EXECUTION

**Next Status:** Will be 🟢 COMPLETE or 🔴 BLOCKED depending on test results

**Principle:** "Evidence > Assumption" — No approval without test evidence.
