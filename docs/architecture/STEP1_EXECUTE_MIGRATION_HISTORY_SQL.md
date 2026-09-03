# STEP 1: Execute Migration History SQL

**Date:** 2026-08-24  
**Status:** ✅ APPROVED by Human Architect  
**Action:** Record 16 migration histories via Supabase Dashboard

---

## Approval Evidence

✅ 16/16 migrations verified as Class B (DDL applied, history missing)  
✅ 11 Runtime/Approval: pg_catalog verification (HIGH confidence)  
✅ 5 Logistics: table existence verification (HIGH confidence)  
✅ 0 Class A (no missing DDL)  
✅ Only history recording (NO DDL re-execution)  
✅ ON CONFLICT DO NOTHING (safe for re-runs)  
✅ Transaction wrapped (BEGIN/COMMIT)  
✅ No Finance data modification  
✅ No SPA business data modification  
✅ Cleanup NOT executed in this step

---

## Execution Instructions

### Step 1.1: Navigate to Supabase Dashboard

1. Open: https://supabase.com/dashboard
2. Select project: BELLA SPA ERP
3. Navigate to: SQL Editor

### Step 1.2: Execute SQL Script

1. Click: "New query"
2. Open local file: `scripts/record_migration_history.sql`
3. Copy entire content
4. Paste into SQL Editor
5. Click: "Run" or press `Ctrl+Enter`

### Step 1.3: Verify Output

**Expected output:**
```
version                              | name                                           | statement_count
-------------------------------------|------------------------------------------------|----------------
20260819040000                       | runtime_migration_e1_gate_schema_safe          | 1
20260819050000                       | runtime_migration_05a_classification_reserv... | 3
20260819050001                       | runtime_migration_05_e2_orphan_safety_gate     | 1
20260819050002                       | runtime_migration_05b_canonical_tenant_crea... | 5
20260819050003                       | runtime_migration_05c_text_to_uuid_type_mig... | 6
20260819050004                       | runtime_migration_e3_post_05c_verification     | 1
20260820110000                       | database_role_separation_v2                    | 3
20260820140000                       | enable_rls_block_service_key                   | 2
20260820151000_r4_3_gate_tokens            | r4_3_gate_tokens                               | 4
20260820152000_r4_4_monitoring_audit       | r4_4_monitoring_audit                          | 3
20260820150000_r4_approval_contract        | r4_approval_contract                           | 1
20260821115404                       | logistics_schema                               | 6
20260821_create_accessorial_rates... | create_accessorial_rates_table                 | 1
20260821121000_create_carrier_rates_table  | create_carrier_rates_table                     | 1
20260821123000_create_discrepancies_table  | create_discrepancies_table                     | 1
20260821120000_create_freight_audit_tables | create_freight_audit_tables                    | 2

(16 rows)
```

**Validation:**
- ✅ Total rows: 16
- ✅ All versions present
- ✅ No errors

**If fewer than 16 rows:**
- Some migrations already recorded (ON CONFLICT DO NOTHING)
- Still acceptable (idempotent operation)

---

## Post-Execution Checklist

After SQL execution succeeds:

- [ ] ✅ Verify 16 rows returned (or fewer if some already existed)
- [ ] ✅ No error messages
- [ ] ✅ Transaction committed successfully
- [ ] ✅ Report verification output to Human Architect
- [ ] 🛑 **STOP** — Do NOT proceed to Step 2 yet
- [ ] ⏸️ Await confirmation before `npx supabase db push`

---

## Next Steps (After Verification)

### Step 2: Deploy RPC Migration

```bash
npx supabase db push
```

**Expected:**
```
Connecting to remote database...
Do you want to push these migrations?
 • 20260824000000_finance_test_cleanup_rpc.sql
 [Y/n] y
Applying migration 20260824000000_finance_test_cleanup_rpc.sql...
Migration applied successfully.
```

**If OTHER migrations appear:**
- 🛑 STOP immediately
- Do NOT proceed
- Report to Human Architect

### Step 3: Verify RPC Deployment

```bash
npx tsx scripts/verify_cleanup_rpc.ts
```

**Expected:**
```
✅ Test 1: RPC Existence - PASS
✅ Test 2: Tenant Validation Gate - PASS
✅ Test 3: Return Structure - PASS
✅ Test 4: Manifest ID Compatibility - PASS

✅ RPC DEPLOYMENT VERIFIED
```

### Step 4: STOP — Human Architect Approval

🛑 **Do NOT execute cleanup automatically**

Report to Human Architect:
- Step 1: Migration history recorded ✅
- Step 2: RPC deployed ✅
- Step 3: RPC verified (4/4 tests) ✅
- Step 4: Ready for cleanup execution ⏸️

**Await explicit approval for:**
```bash
npx tsx scripts/phase4_4_execute_cleanup.ts
```

---

## Frozen Boundary (Maintained)

### ✅ Allowed (Steps 1-3)
- Record migration history (Step 1)
- Deploy RPC function (Step 2)
- Verify RPC contract (Step 3)

### ❌ NOT Allowed (Until Step 4 Approval)
- Execute cleanup (DELETE 274 records)
- Modify Finance transactions
- Modify SPA business data
- Cascade delete F2 movements
- Skip verification steps

### 🔒 Protected Data
- 165 F1 with F2 dependencies → PRESERVE
- 5 SPA_BOOKING → PRESERVE (100%)
- 0 orphan F2 created
- SPA business logic → UNTOUCHED

---

## Cleanup Scope (Step 4 - Pending Approval)

**DELETE (274 records):**
- SALES_ORDER: 63 (without F2)
- AP_PAYMENT: 63 (without F2)
- VERIFICATION: 40
- CONCURRENCY_TEST: 99
- F2_REGRESSION: 5
- test: 4

**PRESERVE (165 records):**
- SALES_ORDER: 146 (with F2)
- AP_PAYMENT: 14 (with F2)
- SPA_BOOKING: 5 (with F2)

**Post-Cleanup Verification:**
- F1 POSTED: 675 → 401
- Orphan F2: 0
- SPA regression: PASS
- Architecture Guards: PASS

---

## Rollback Plan (If Needed)

### If Step 1 fails:
- No rollback needed (no data modified)
- SQL can be re-run (ON CONFLICT DO NOTHING)

### If Step 2 fails:
- DROP FUNCTION finance_admin_cleanup_test_transactions
- Re-attempt deployment

### If Step 3 fails (verification):
- Investigate RPC contract mismatch
- Do NOT proceed to Step 4

### If Step 4 fails (cleanup):
- Restore from snapshot: `PHASE4_4_SNAPSHOT_20260824.json`
- Verify F1 count returns to 675
- Investigate root cause before retry

---

**Current Status:** Ready for Step 1 execution  
**Human Architect Approval:** ✅ APPROVED  
**Execution Method:** Supabase Dashboard SQL Editor  
**Next Action:** Execute SQL → Report verification output → Await Step 2 approval
