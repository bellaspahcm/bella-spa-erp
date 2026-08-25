# F2 M1–M4a DEPLOYMENT EVIDENCE REPORT

**Date:** 2026-08-24  
**Environment:** PENDING (DATABASE_URL not configured)  
**Status:** ⏸️ AWAITING DEPLOYMENT  
**Migrations:** 20260824000000 through 20260824030000

---

## 🚨 DEPLOYMENT STATUS

**Current State:** Migrations ready but not deployed

**Reason:** DATABASE_URL environment variable not set in current environment

**Required Action:**
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://..."

# Then deploy M1–M4a
psql "$DATABASE_URL" -f supabase/migrations/20260824000000_f2_cash_effective_date.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824010000_f2_fix_cash_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824020000_f2_opening_balance_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824030000_f2_opening_balance_provenance.sql

# Or use Supabase CLI with credentials:
supabase link --project-ref <project-ref>
supabase db push
```

---

## 📋 VERIFICATION CHECKLIST (TO BE EXECUTED AFTER DEPLOYMENT)

### 1. DEPLOYMENT CONFIRMATION

- [ ] Environment: `__________________`
- [ ] Migration 20260824000000 applied: `__________`
- [ ] Migration 20260824010000 applied: `__________`
- [ ] Migration 20260824020000 applied: `__________`
- [ ] Migration 20260824030000 applied: `__________`
- [ ] Deployment timestamp: `__________`
- [ ] Deployment duration: `__________`
- [ ] Errors during deployment: `__________`

---

### 2. SMOKE TESTS (12 Tests)

**Command:**
```bash
psql "$DATABASE_URL" -f docs/architecture/F2_CONTRACT_SMOKE_TEST.sql
```

**Expected Result:** `12/12 PASS`

**Actual Result:** `__________`

**Individual Test Results:**

| Test | Description | Expected | Actual | Status |
|------|-------------|----------|--------|--------|
| 1 | effective_date column exists and NOT NULL | PASS | _____ | _____ |
| 2 | effective_date backfill lineage valid | PASS | _____ | _____ |
| 3 | effective_date index exists | PASS | _____ | _____ |
| 4 | finance_get_cash_movements_as_of() callable | PASS | _____ | _____ |
| 5 | Contract return schema includes v1.2 fields | PASS | _____ | _____ |
| 6 | finance_cash_opening_balances table exists | PASS | _____ | _____ |
| 7 | Provenance columns exist (INV-F2-O2) | PASS | _____ | _____ |
| 8 | Immutability trigger exists (INV-F2-D3) | PASS | _____ | _____ |
| 9 | finance_cash_opening_balance_as_of() callable | PASS | _____ | _____ |
| 10 | RLS enabled | PASS | _____ | _____ |
| 11 | finance_cash_opening_balance_decisions table exists | PASS | _____ | _____ |
| 12 | decision_type constraint exists | PASS | _____ | _____ |

---

### 3. TEMPORAL LINEAGE VERIFICATION (Critical)

**Test 3.1: effective_date NOT NULL**
```sql
SELECT COUNT(*) AS null_count
FROM finance_cash_movements
WHERE effective_date IS NULL;
```
**Expected:** `0`  
**Actual:** `__________`  
**Status:** `__________`

---

**Test 3.2: effective_date = F1.posted_at (CRITICAL)**
```sql
SELECT 
    COUNT(*) AS total_movements,
    COUNT(*) FILTER (WHERE fcm.effective_date = ft.posted_at) AS valid_lineage_count,
    COUNT(*) FILTER (WHERE fcm.effective_date != ft.posted_at) AS invalid_lineage_count
FROM finance_cash_movements fcm
JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id;
```
**Expected:** `total_movements = valid_lineage_count AND invalid_lineage_count = 0`  
**Actual:**
- Total movements: `__________`
- Valid lineage: `__________`
- Invalid lineage: `__________`  
**Status:** `__________`

**⚠️ CRITICAL:** If invalid_lineage_count > 0, F2 temporal authority is NOT established correctly.

---

**Test 3.3: effective_date vs recorded_at (temporal ordering)**
```sql
SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE effective_date <= recorded_at) AS valid_order,
    COUNT(*) FILTER (WHERE effective_date > recorded_at) AS future_dated
FROM finance_cash_movements;
```
**Actual:**
- Total: `__________`
- Valid order: `__________`
- Future dated: `__________`  
**Notes:** Future-dated transactions are allowed (backdating support). This is NOT an error.

---

### 4. CONTRACT BEHAVIOR VERIFICATION

**Test 4.1: finance_get_cash_movements_as_of() uses effective_date**
```sql
-- Query contract with as_of = 1 day ago
SELECT COUNT(*) AS movement_count
FROM finance_get_cash_movements_as_of(
    (SELECT id FROM tenants LIMIT 1),
    NOW() - INTERVAL '1 day',
    'F2_CASH:v1'
);
```
**Actual movement count:** `__________`

**Test 4.2: Contract return schema v1.2**
```sql
SELECT column_name
FROM information_schema.routine_columns
WHERE routine_name = 'finance_get_cash_movements_as_of'
ORDER BY ordinal_position;
```
**Expected fields:**
- movement_id ✅
- bank_account_id ✅ (v1.2)
- direction ✅
- amount_minor ✅
- currency ✅
- cash_effective_date ✅
- valuation_rate ✅
- f1_transaction_id ✅ (v1.2)

**Actual fields:** `__________`  
**Status:** `__________`

---

### 5. OPENING BALANCE CONTRACT VERIFICATION

**Test 5.1: baseline_found = FALSE when no baseline**
```sql
SELECT 
    opening_balance_minor,
    baseline_effective_date,
    baseline_found
FROM finance_cash_opening_balance_as_of(
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    NOW(),
    'F2_OPENING:v1'
);
```
**Expected:** `baseline_found = FALSE, opening_balance_minor = 0`  
**Actual:**
- opening_balance_minor: `__________`
- baseline_found: `__________`  
**Status:** `__________`

**⚠️ CRITICAL:** If baseline_found = TRUE when no baseline exists, INV-F2-O4 is violated.

---

**Test 5.2: Opening balance table is empty (no data seeding)**
```sql
SELECT COUNT(*) AS row_count
FROM finance_cash_opening_balances;
```
**Expected:** `0`  
**Actual:** `__________`  
**Status:** `__________`

**⚠️ CRITICAL:** If row_count > 0, unauthorized data seeding occurred in M1–M4a.

---

### 6. SECURITY & RLS VERIFICATION

**Test 6.1: RLS enabled on new tables**
```sql
SELECT tablename, relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relname IN ('finance_cash_opening_balances', 'finance_cash_opening_balance_decisions')
  AND nspname = 'public';
```
**Expected:** `relrowsecurity = TRUE` for both tables  
**Actual:** `__________`  
**Status:** `__________`

---

**Test 6.2: Cross-tenant isolation (manual test required)**
```sql
-- Test with two different tenant IDs
-- Query 1: Tenant A
SELECT COUNT(*) FROM finance_cash_opening_balances WHERE tenant_id = '<tenant-a>';

-- Query 2: Tenant B (as Tenant A user)
SELECT COUNT(*) FROM finance_cash_opening_balances WHERE tenant_id = '<tenant-b>';
```
**Expected:** Tenant A user sees 0 rows for Tenant B  
**Actual:** `__________`  
**Status:** `__________`

---

### 7. IMMUTABILITY VERIFICATION

**Test 7.1: Immutability trigger exists**
```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'finance_cash_opening_balances'
  AND trigger_name = 'trg_opening_balance_immutability';
```
**Expected:** 2 rows (UPDATE, DELETE)  
**Actual:** `__________`  
**Status:** `__________`

---

**Test 7.2: Immutability enforcement (requires test data)**

*This test requires inserting a test opening balance record and attempting UPDATE/DELETE.*

**Setup:**
```sql
-- Insert test record
INSERT INTO finance_cash_opening_balances (
    tenant_id, bank_account_id, balance_minor, currency,
    effective_date, source_type, notes
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    100000000, 'VND', NOW()::DATE, 'MIGRATION_SEED', 'Test record'
) RETURNING id;
```

**Test UPDATE:**
```sql
UPDATE finance_cash_opening_balances
SET balance_minor = 200000000
WHERE id = '<test-record-id>';
```
**Expected:** `ERROR: OPENING_BALANCE_IMMUTABLE`  
**Actual:** `__________`  
**Status:** `__________`

**Test DELETE:**
```sql
DELETE FROM finance_cash_opening_balances
WHERE id = '<test-record-id>';
```
**Expected:** `ERROR: OPENING_BALANCE_IMMUTABLE`  
**Actual:** `__________`  
**Status:** `__________`

**Cleanup:**
```sql
-- Must disable trigger to clean up test data
-- Or truncate table after testing
```

---

### 8. SCOPE BOUNDARY VERIFICATION

**Test 8.1: No Worker modifications**
```bash
git diff HEAD src/platform/finance/engines/cash-engine/cash-projection-worker.ts
```
**Expected:** No changes  
**Actual:** `__________`  
**Status:** `__________`

---

**Test 8.2: No F5.6 implementation**
```bash
git log --oneline --grep="F5.6" --since="2026-08-24"
```
**Expected:** No commits  
**Actual:** `__________`  
**Status:** `__________`

---

**Test 8.3: No M4b migration created**
```bash
ls supabase/migrations/20260824040000*
```
**Expected:** File not found  
**Actual:** `__________`  
**Status:** `__________`

---

## 9. FULL VERIFICATION RESULTS SUMMARY

| Category | Tests | Passed | Failed | Status |
|----------|-------|--------|--------|--------|
| Deployment | 5 | _____ | _____ | _____ |
| Smoke Tests | 12 | _____ | _____ | _____ |
| Temporal Lineage | 3 | _____ | _____ | _____ |
| Contract Behavior | 2 | _____ | _____ | _____ |
| Opening Balance | 2 | _____ | _____ | _____ |
| Security & RLS | 2 | _____ | _____ | _____ |
| Immutability | 3 | _____ | _____ | _____ |
| Scope Boundary | 3 | _____ | _____ | _____ |
| **TOTAL** | **32** | **_____** | **_____** | **_____** |

---

## 10. CRITICAL ISSUES (If Any)

**Issue 1:** `__________`  
**Severity:** `__________`  
**Impact:** `__________`  
**Resolution:** `__________`

---

## 11. ARCHITECTURAL INVARIANTS VERIFICATION

| Invariant | Description | Verified | Status |
|-----------|-------------|----------|--------|
| **INV-F2-T1** | effective_date immutable | _____ | _____ |
| **INV-F2-T2** | effective_date = F1.posted_at | _____ | _____ |
| **INV-F2-T3** | Temporal determinism (contract uses effective_date) | _____ | _____ |
| **INV-F2-O1** | Baseline Closure semantics | _____ | _____ |
| **INV-F2-O2** | Baseline Provenance (source_type NOT NULL) | _____ | _____ |
| **INV-F2-O3** | No Historical Reinterpretation (no data seeding) | _____ | _____ |
| **INV-F2-O4** | Baseline Coverage (baseline_found signal) | _____ | _____ |
| **INV-F2-D3** | Opening balance immutability | _____ | _____ |

---

## 12. CONCLUSION

### Overall Status: `__________`

**Deployment Evidence:** `__________`

**Critical Findings:**
- `__________`

**Recommendations:**
- `__________`

---

## 13. NEXT GATE: BASELINE PROVENANCE DECISION

**Status:** 🔴 BLOCKED — Awaiting Human Architect Decision

**Required Decisions:**

### Decision 1: Baseline Strategy

- [ ] **Option A:** ZERO_BASELINE (greenfield accounts)
- [ ] **Option B:** VERIFIED_HISTORICAL (evidence-based)
- [ ] **Option C:** CURRENT_POSITION_BASELINE (recommended)

**Selected:** `__________`

---

### Decision 2: Zero Balance Treatment

- [ ] **YES:** Seed all accounts including balance = 0 (VERIFIED_ZERO)
- [ ] **NO:** Skip zero balances (remain NO_BASELINE)

**Selected:** `__________`

---

### Decision 3: Timestamp Precision

- [ ] **Day-boundary:** `NOW()::DATE` → 2026-08-24 00:00:00
- [ ] **Timestamp-boundary:** `NOW()` → 2026-08-24 13:45:22.123456

**Selected:** `__________`

---

### Decision 4: Evidence Source

**Evidence Reference:** `__________`

**Notes:** `__________`

---

### Decision 5: Scope

- [ ] **ALL ACCOUNTS:** applies_to_all_accounts = TRUE
- [ ] **PER ACCOUNT:** applies_to_all_accounts = FALSE (specify accounts)

**Selected:** `__________`

---

## 14. APPROVAL & SIGN-OFF

**Deployment Verified By:** `__________`  
**Date:** `__________`

**Baseline Provenance Approved By:** `__________`  
**Date:** `__________`

**Ready for M4b:** `YES / NO`

**Notes:** `__________`

---

**END OF EVIDENCE REPORT**

---

## 📋 HOW TO COMPLETE THIS REPORT

### Step 1: Deploy M1–M4a

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Deploy migrations
psql "$DATABASE_URL" -f supabase/migrations/20260824000000_f2_cash_effective_date.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824010000_f2_fix_cash_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824020000_f2_opening_balance_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824030000_f2_opening_balance_provenance.sql
```

### Step 2: Run Smoke Tests

```bash
psql "$DATABASE_URL" -f docs/architecture/F2_CONTRACT_SMOKE_TEST.sql
```

### Step 3: Run Full Verification

Execute all queries from `docs/architecture/F2_CONTRACT_IMPLEMENTATION_VERIFICATION.md`

### Step 4: Fill in This Report

Replace all `__________` placeholders with actual results

### Step 5: Submit for Review

Send completed report to Human Architect for baseline provenance decision

---

**HARD STOP: DO NOT PROCEED TO M4b WITHOUT APPROVAL**
