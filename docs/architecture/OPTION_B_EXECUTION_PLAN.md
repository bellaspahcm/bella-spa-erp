# Option B Execution Plan: RPC First, F2 Renamed

**Date:** 2026-08-24  
**Status:** ✅ APPROVED by Human Architect  
**Decision:** Deploy cleanup RPC at `20260824000000`, defer F2 to `20260824040000`+

---

## **Evidence Summary (E1-E4)**

| Gate | Result | Evidence |
|------|--------|----------|
| E1 — Remote identity | ✅ PASS | `20260824000000` FREE on remote |
| E2 — Git status | ✅ PASS | F2 + RPC both untracked (new) |
| E3 — Git provenance | ✅ PASS | Duplicates traced to commits |
| E4 — F2 DDL provenance | ✅ PASS | **CASE B:** effective_date NOT FOUND → F2 genuine pending |

**Conclusion:** Version conflict between F2 (Finance Kernel) and RPC (cleanup utility).

---

## **Architect Decision**

**APPROVED: Option B**

**Rationale:**
- ✅ Step 2 Gate passes (ONLY RPC)
- ✅ No Dashboard bypass
- ✅ Clean migration chain
- ✅ F2 deployment → separate Phase 4.5 (after cleanup verified)
- ✅ Architectural separation: Cleanup utility ≠ Finance Kernel contract
- ✅ RPC does not depend on effective_date

---

## **Execution Steps**

### **Step 1: Rename F2 Migration Sequence**

**OLD versions (conflict with RPC):**
```
20260824000000_f2_cash_effective_date.sql
20260824010000_f2_fix_cash_contract.sql
20260824020000_f2_opening_balance_contract.sql
20260824030000_f2_opening_balance_provenance.sql
```

**NEW versions (free sequence):**
```
20260824040000_f2_cash_effective_date.sql
20260824050000_f2_fix_cash_contract.sql
20260824060000_f2_opening_balance_contract.sql
20260824070500_f2_opening_balance_provenance.sql
```

**Note:** Preserves content, only changes version prefix.

---

### **Step 2: Delete Non-Canonical Duplicates**

**Based on E1 + E3 evidence:**

**Delete:**
- `20260819040000_runtime_migration_e1_gate_schema_safe.sql` (E1: canonical is `fix_legacy_spa_rls_policies`)
- `20260820110000_database_role_separation_v2.sql` (E1: canonical is `database_role_separation`)

**Keep:**
- `20260819040000_fix_legacy_spa_rls_policies.sql` (E1 canonical)
- `20260820110000_database_role_separation.sql` (E1 canonical)

---

### **Step 3: Verify Provenance Preservation**

**Git diff verification:**
```bash
git diff --name-status
```

**Expected:**
- R (renamed): F2 migrations (000000 → 040000, etc.)
- D (deleted): 2 duplicate files
- No content changes (only filename/version changes)

---

### **Step 4: Verify Migration State**

**Check local migrations:**
```bash
Get-ChildItem .\supabase\migrations\20260824* | Select-Object Name
```

**Expected:**
```
20260824000000_finance_test_cleanup_rpc.sql      ← ONLY migration at 000000
20260824040000_f2_cash_effective_date.sql
20260824050000_f2_fix_cash_contract.sql
20260824060000_f2_opening_balance_contract.sql
20260824070500_f2_opening_balance_provenance.sql
```

---

### **Step 5: Verify db push Shows ONLY RPC**

```bash
npx supabase db push
```

**Expected output:**
```
Remote database is up to date.

Local migrations to apply:
  20260824000000_finance_test_cleanup_rpc.sql

Apply migrations? [y/N]
```

**Gate:** If ANY other migration appears → 🛑 STOP

---

### **Step 6: Deploy RPC**

**After Gate verification passes:**
```bash
npx supabase db push
# Answer: y
```

---

### **Step 7: Verify RPC**

```bash
npx tsx scripts/verify_cleanup_rpc.ts
```

**Expected:**
```
✅ RPC existence
✅ Tenant validation
✅ Return structure
✅ Manifest compatible

4/4 PASS
```

---

### **Step 8: STOP — Report to Architect**

**Do NOT proceed with:**
- ❌ Cleanup execution (274 records)
- ❌ F2 deployment (separate approval required)
- ❌ Any Finance data modification

---

## **Phase 4.5: F2 Temporal Contract Deployment**

**BLOCKED until:**
- ✅ Step 2 RPC verified
- ✅ Cleanup execution completed and verified
- ✅ Separate Human Architect approval for F2 deployment

**F2 Migration Sequence (deferred):**
```
20260824040000_f2_cash_effective_date.sql       ← Add effective_date column + backfill
20260824050000_f2_fix_cash_contract.sql         ← Contract fixes
20260824060000_f2_opening_balance_contract.sql  ← Opening balance contract
20260824070500_f2_opening_balance_provenance.sql ← Provenance tracking
```

**Deployment gate:** Separate approval, separate verification, separate regression testing.

---

## **Architectural Principles Preserved**

✅ **Migration governance:** No Dashboard bypass, CLI-driven deployment  
✅ **Gate isolation:** Step 2 = ONLY RPC  
✅ **Finance Kernel separation:** Cleanup utility ≠ Temporal contract  
✅ **Provenance:** All file operations tracked via git  
✅ **Evidence-based:** E1-E4 forensic analysis before mutations

---

**Status:** Ready for execution  
**Next:** Rename F2 + delete duplicates + verify gate
