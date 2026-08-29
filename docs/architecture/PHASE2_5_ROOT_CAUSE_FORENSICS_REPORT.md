# PHASE 2.5: ROOT CAUSE FORENSICS REPORT

**Document Version:** 1.0  
**Date:** 2026-08-24  
**Status:** 🟡 **INVESTIGATION COMPLETE — ROOT CAUSE UNDETERMINED WITH STRONG SUSPECT**  
**Mode:** READ-ONLY INVESTIGATION

---

## EXECUTIVE SUMMARY

**Finding:** Strong suspect identified but **causality NOT YET PROVEN**.

**Root Cause Status:** 🟡 **UNDETERMINED** (not "CONFIRMED")

**Leading Hypothesis:** `f5_admin_cleanup_test_data` RPC deleted F1 transactions during test cleanup

**Confidence Level:** **HIGH CIRCUMSTANTIAL EVIDENCE** but **NO DIRECT PROOF OF INVOCATION**

**Recommendation:** Classify as **TEST ARTIFACT — LIKELY** pending RPC invocation log verification

---

## 1. INVESTIGATION METHODOLOGY

**Phase 2.5 investigated 5 areas:**

1. ✅ **Business Domain Verification** — Check if source_id exists in business tables
2. ✅ **Audit Trail Review** — Check for F1 deletion logs
3. ✅ **Migration History Analysis** — Check for cleanup operations
4. ✅ **Test Infrastructure Analysis** — Check for test cleanup mechanisms
5. ⚠️ **RPC Causality Verification** — Check for direct proof of RPC → F1 deletion (INCOMPLETE)

---

## 2. EVIDENCE COLLECTED

### Evidence 1: Business Domain — Source IDs NOT FOUND

**Query:** Check if 18 source_ids exist in business tables

**Tables Checked:**
- `finance_invoices`
- `bookings`
- `re_bookings`
- `auto_bookings`
- `student_tuition_payments`

**Result:** ❌ **ALL 18 source_ids NOT FOUND in ANY business table**

**Assessment:** 🔴 **STRONG INDICATOR — NOT REAL BUSINESS DATA**

### Evidence 2: Pattern Analysis — Identical Test Pattern

**Finding:**
- All 18 movements: 15,000,000 VND (exact same amount)
- All 18 movements: PAYMENT (same source_type)
- All 18 movements: INFLOW (same direction)
- All 18 movements: "1111-2222-3333" (same bank account)
- All 18 movements: "Cash Inflow Movement" (same description)
- All 18 movements: `cash-idemp-{UUID}` (same idempotency pattern)

**Code Found:** `src/__tests__/f5-reconciliation.integration.test.ts:1473`
```typescript
p_amount_minor: 15000000,
p_direction: 'INFLOW',
p_source_type: 'PAYMENT',
p_description: 'Cash Inflow Movement',
```

**Assessment:** 🔴 **EXACT MATCH — TEST CODE PATTERN**

### Evidence 3: Test Cleanup RPC Exists

**File:** `supabase/migrations/20260822000000_f5_test_cleanup_rpc.sql`

**Function:** `f5_admin_cleanup_test_data(p_tenant_ids UUID[], p_delete_master BOOLEAN)`

**Capabilities:**
- ✅ Can delete F1 transactions
- ✅ Bypasses immutability triggers via `session_replication_role = replica`
- ✅ Called by F5 integration tests (3 test files found)
- ✅ Safety guard: only deletes tenants named "Test Tenant F5%"

**Key Code:**
```sql
-- Use session_replication_role = replica to bypass immutability triggers
SET session_replication_role = replica;

-- Delete transactions
DELETE FROM public.finance_transactions
WHERE tenant_id = ANY(p_tenant_ids);
```

**Assessment:** 🔴 **STRONG SUSPECT — MECHANISM EXISTS AND IS USED**

### Evidence 4: RPC Invocations Found in Tests

**Files calling `f5_admin_cleanup_test_data`:**
1. `src/__tests__/f5-reconciliation.integration.test.ts` (3 invocations)
2. `src/__tests__/f5-hardening.integration.test.ts` (2 invocations)
3. `src/__tests__/f5-ar-reconciliation.integration.test.ts` (2 invocations)

**Invocation Pattern:**
```typescript
await supabase.rpc('f5_admin_cleanup_test_data', {
  p_tenant_ids: [testTenantId],
  p_delete_master: true,  // Deletes F1 transactions
});
```

**Assessment:** 🟡 **RPC IS CALLED BY TESTS** but cannot confirm it deleted these specific 18 F1 transactions

### Evidence 5: Timeline Correlation

**18 Orphan Movements:**
- 17 created on 2026-08-16
- 1 created on 2026-08-22

**f5_test_cleanup_rpc Migration:**
- Deployed: 2026-08-22 (version 20260822000000)

**Assessment:** ⚠️ **TIMELINE SUSPICIOUS** — Most orphans (17/18) created BEFORE RPC deployed, 1 created SAME DAY as RPC deployment

### Evidence 6: Audit Schema — NOT AVAILABLE

**Query:** Check for audit schema
```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'audit';
```

**Result:** ❌ **NO AUDIT SCHEMA EXISTS**

**Assessment:** ⚠️ **CANNOT VERIFY F1 DELETION VIA AUDIT LOGS**

### Evidence 7: Migration History — Many NULL Names

**Finding:** Multiple Finance OS migrations (2026-08-15 to 2026-08-22) have NULL names

**Potentially Relevant Migrations:**
- 20260815000000 through 20260816050000 (NULL names)
- 20260817000000 through 20260817020000 (NULL names)
- 20260818000000 (NULL name)
- **20260822000000 — f5_test_cleanup_rpc** ✅ NAMED

**Assessment:** ⚠️ **DEPLOYMENT COMPLEXITY** — Many migrations lack names, suggests active development/testing period

---

## 3. EVIDENCE SUMMARY TABLE

| Evidence | Finding | Strength | Assessment |
|----------|---------|----------|------------|
| **1. Business Domain** | ALL 18 source_ids NOT FOUND | 🔴 STRONG | Not real business data |
| **2. Test Pattern** | EXACT match with test code (15M, PAYMENT, INFLOW, cash-idemp-) | 🔴 STRONG | Test artifact pattern |
| **3. Cleanup RPC** | Exists, can delete F1, bypasses triggers | 🔴 STRONG | Mechanism present |
| **4. RPC Invocations** | Called by 3 test files | 🟡 MEDIUM | Used but not proven for these 18 |
| **5. Timeline** | 17/18 before RPC, 1/18 same day | ⚠️ WEAK | Correlation unclear |
| **6. Audit Trail** | No audit schema | ❌ NONE | Cannot verify deletion |
| **7. Migration History** | Many NULL names in period | ⚠️ WEAK | Active dev period |

**Overall Evidence Strength:** 🔴 **STRONG CIRCUMSTANTIAL** but **NO DIRECT PROOF**

---

## 4. ROOT CAUSE HYPOTHESIS

### Leading Hypothesis: Test Cleanup Artifact

**Hypothesis:**
1. F5 integration tests created 18 test tenants (likely with "Test Tenant F5" prefix)
2. Tests created F1 transactions + F2 cash movements (15M VND, PAYMENT, INFLOW)
3. Tests called `f5_admin_cleanup_test_data(p_tenant_ids, p_delete_master=true)`
4. RPC deleted F1 transactions (bypassing immutability triggers)
5. F2 movements survived because:
   - RPC did NOT delete F2 movements (not in deletion list)
   - OR tests called with `p_delete_master=false` (only cleanup F5 tables)
6. 18 orphan F2 movements remain referencing deleted F1 transactions

**Supporting Evidence:**
- ✅ Test code creates exact pattern (15M, PAYMENT, INFLOW, "Cash Inflow Movement")
- ✅ RPC exists and can delete F1
- ✅ RPC is called by tests
- ✅ NO business domain records exist for 18 source_ids
- ✅ Pattern 100% consistent across all 18 (not random business events)

**Missing Evidence:**
- ❌ Direct proof RPC was invoked for these specific 18 tenant_ids
- ❌ Audit log showing F1 deletion timestamp
- ❌ Correlation between 18 F1 UUIDs and test fixtures
- ❌ Tenant names verification (need to check if they were "Test Tenant F5%")

### Alternative Hypotheses (Less Likely)

**Hypothesis B: Transaction Rollback**
- F1 insert rolled back
- F2 insert committed
- **Evidence against:** 18 identical patterns (unlikely 18 rollbacks)

**Hypothesis C: Migration Artifact**
- Migration created F2 without F1
- **Evidence against:** No migration creates F2 directly (all via RPC)

**Hypothesis D: Manual Deletion**
- Human manually deleted 18 F1 transactions
- **Evidence against:** Immutability triggers would block manual DELETE

---

## 5. CAUSALITY VERIFICATION — INCOMPLETE

**What Would Prove Causality:**

1. ✅ **RPC invocation logs** showing:
   ```
   f5_admin_cleanup_test_data called
   p_tenant_ids = [18 tenant UUIDs matching orphans]
   p_delete_master = true
   Result: 18 F1 transactions deleted
   ```

2. ✅ **Audit trail** showing:
   ```
   DELETE FROM finance_transactions WHERE id IN (18 F1 UUIDs)
   session_replication_role = replica
   Timestamp: 2026-08-16 or 2026-08-22
   ```

3. ✅ **Test execution logs** showing:
   ```
   Test: f5-reconciliation.integration.test.ts
   Created: 18 tenants with "Test Tenant F5" prefix
   Created: 18 F1 + 18 F2 movements
   Cleanup: Called f5_admin_cleanup_test_data
   Result: F1 deleted, F2 orphaned
   ```

4. ✅ **Tenant name verification:**
   ```
   SELECT name FROM tenants WHERE id IN (18 orphan tenant_ids)
   Result: All start with "Test Tenant F5"
   ```

**Current Status:**
- ❌ RPC invocation logs: **NOT AVAILABLE**
- ❌ Audit trail: **NOT AVAILABLE** (no audit schema)
- ❌ Test execution logs: **NOT CHECKED**
- ❌ Tenant name verification: **ATTEMPTED BUT INCONCLUSIVE**

**Attempted Tenant Verification:**
```sql
SELECT t.name FROM tenants t
INNER JOIN finance_cash_movements fcm ON t.id = fcm.tenant_id
WHERE fcm has no F1
```
**Result:** Empty (query timeout or tenants deleted)

**Issue:** Cannot confirm tenant names match "Test Tenant F5%" pattern required by RPC safety guard

---

## 6. GAPS IN INVESTIGATION

### Critical Gaps

1. **No RPC Invocation Log**
   - Cannot prove `f5_admin_cleanup_test_data` was called for these 18 tenants
   - PostgreSQL logs not checked
   - Supabase dashboard audit events not checked

2. **Tenant Names Unknown**
   - Cannot verify 18 tenants had "Test Tenant F5%" prefix
   - RPC safety guard requires this prefix
   - If tenants did NOT have prefix, RPC would have raised exception

3. **No Transaction Timeline**
   - Cannot establish sequence: F1 created → F2 created → RPC called → F1 deleted
   - Only have F2.recorded_at (2026-08-16, 2026-08-22)
   - Do not have F1 creation timestamp or deletion timestamp

4. **F2 Movement Survival Unexplained**
   - RPC function shows F1 deletion but does NOT show F2 deletion
   - Need to verify: Does RPC delete cash movements?
   - Answer: **NO** — RPC only deletes F5 control tables + F1/lines/accounts if `p_delete_master=true`
   - F2 cash movements table NOT in deletion list

### Minor Gaps

5. **Test execution history** not checked
6. **CI/CD logs** not checked
7. **18 F1 UUID correlation** with test fixtures not established

---

## 7. CONCLUSION

### Root Cause Status

**Classification:** 🟡 **UNDETERMINED** (not "CONFIRMED")

**Most Likely Cause:** **TEST CLEANUP ARTIFACT**

**Confidence:** **HIGH CIRCUMSTANTIAL EVIDENCE** (80-85%) but **NO DIRECT PROOF**

### What We Know (Facts)

1. ✅ 18 F2 movements reference F1 IDs that do not exist
2. ✅ ALL 18 source_ids do NOT exist in any business table
3. ✅ Pattern matches test code EXACTLY (15M, PAYMENT, INFLOW, cash-idemp-)
4. ✅ `f5_admin_cleanup_test_data` RPC exists and can delete F1
5. ✅ RPC is called by F5 integration tests
6. ✅ RPC does NOT delete F2 cash movements (not in deletion list)

### What We DON'T Know (Unknowns)

1. ❌ Whether RPC was invoked for these specific 18 tenants
2. ❌ Whether 18 tenants had "Test Tenant F5%" names (RPC safety guard)
3. ❌ When F1 transactions were deleted (no timestamp)
4. ❌ Why 17 movements on 2026-08-16 but RPC deployed 2026-08-22
5. ❌ Direct causation: RPC invocation → 18 F1 deletion

### Principle Applied

**"Semantic Evidence Before Database Assertion"**

- ✅ Found strong circumstantial evidence
- ✅ Identified mechanism (RPC)
- ✅ Confirmed test pattern match
- ❌ Did NOT prove causation
- ❌ Did NOT assert "root cause confirmed"
- ✅ Classified as **UNDETERMINED with STRONG SUSPECT**

---

## 8. REMEDIATION RECOMMENDATION

### Option A: DELETE 18 F2 Movements (RECOMMENDED)

**Justification:**
- High confidence (80-85%) these are test artifacts
- NO business domain records exist
- Pattern 100% matches test code
- NO real financial impact if test data

**Prerequisites:**
1. Human Architect confirms acceptable to delete based on evidence
2. Document deletion reason: "Test artifact cleanup - no business events"
3. Record deleted movement IDs for audit trail

**Risk:** LOW — If these were real business events, source_ids would exist

### Option B: Keep as UNRESOLVED Orphans

**Justification:**
- Cannot prove 100% causation
- Maintain conservative approach
- Exclude from position calculations
- Flag for future investigation if evidence emerges

**Risk:** NONE — Safe but leaves data integrity issue unresolved

### Option C: Further Investigation (If Required)

**Additional Steps:**
1. Check PostgreSQL/Supabase logs for RPC invocations (2026-08-16 to 2026-08-22)
2. Check CI/CD logs for test execution
3. Check if backup from 2026-08-16 contains F1 transactions
4. Correlate 18 F1 UUIDs with test fixture generation patterns

**Effort:** HIGH — May require Supabase support for log access

---

## 9. HUMAN ARCHITECT DECISION REQUIRED

**Questions:**

1. **Accept 80-85% confidence?**
   - Is circumstantial evidence sufficient to classify as "test artifact"?
   - Or require 100% proof via RPC invocation logs?

2. **Remediation approach?**
   - Option A: DELETE 18 F2 movements (recommended)
   - Option B: Keep as UNRESOLVED
   - Option C: Further investigation (log analysis)

3. **Policy decision:**
   - Can test artifacts be cleaned up based on pattern + no-business-evidence?
   - Or must have direct proof of test execution?

4. **Prevention:**
   - Should `f5_admin_cleanup_test_data` also delete F2 cash movements?
   - Should tests use separate test database to prevent orphans?

---

## 10. PHASE 2.5 STATUS

**Investigation Status:** ✅ **COMPLETE** (within current scope)

**Root Cause:** 🟡 **UNDETERMINED** (strong suspect: test cleanup artifact)

**Confidence:** 🔴 **HIGH CIRCUMSTANTIAL** (80-85%) but **NO DIRECT PROOF**

**Recommendation:** Classify as **TEST ARTIFACT — LIKELY** and approve controlled cleanup

**Next Gate:** Human Architect reviews evidence → Decides remediation → Authorizes cleanup OR further investigation OR keep unresolved

---

## 11. EVIDENCE ARTIFACTS

**SQL Files Created:**
1. `phase2_5_root_cause_investigation.sql` — Business domain checks
2. `phase2_5_business_domain_check.sql` — Table existence
3. `phase2_5_source_id_verification.sql` — Source ID lookup
4. `phase2_5_test_artifact_evidence.sql` — Pattern evidence
5. `phase2_5_audit_check.sql` — Audit schema check
6. `phase2_5_tenant_verification.sql` — Tenant name check
7. `phase2_5_tenant_schema_check.sql` — Tenant schema
8. `phase2_5_tenant_names.sql` — Tenant classification
9. `phase2_5_final_causality_check.sql` — Summary evidence

**Key Findings:**
- ✅ Test code match found (f5-reconciliation.integration.test.ts)
- ✅ RPC mechanism identified (f5_admin_cleanup_test_data)
- ✅ NO business domain records (0/18 source_ids found)
- ⚠️ Causality NOT proven (no RPC invocation log)

---

**END OF PHASE 2.5 REPORT**

**Document Version:** 1.0  
**Date:** 2026-08-24  
**Status:** 🟡 ROOT CAUSE UNDETERMINED — STRONG SUSPECT IDENTIFIED  
**Next Action:** Human Architect reviews evidence and decides remediation approach
