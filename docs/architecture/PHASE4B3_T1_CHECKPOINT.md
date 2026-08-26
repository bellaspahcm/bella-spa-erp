# Phase 4B.3 T1 Checkpoint — Ready for Canonical Policy Application

**Date:** 2026-08-25  
**Status:** 🟡 AWAITING USER ACTION  

---

## ✅ COMPLETED

**Verification fixes:**
1. ✅ Drift detection semantic bug fixed (Interpretation B validated)
2. ✅ Tenant isolation pattern recognition expanded (4 production variants)
3. ✅ DirectPostgreSQLAdapter validated (no RPC coupling)
4. ✅ Contract v1.0.0 Option C correctly interpreted

**Canonical policy identification:**
1. ✅ hc_prescriptions policy found: `20260806030000_healthcare_kernel_schema.sql` line 95
2. ✅ hc_appointments policy found: `20260807000000_create_hc_appointments.sql` line 37
3. ✅ Both policies use canonical `get_auth_tenant_id()` function
4. ✅ SQL extracted to: `scripts/t1-canonical-policies.sql`

---

## 🔧 USER ACTION REQUIRED

### Step 1: Apply Canonical Policies

**Method: Supabase SQL Editor**

1. Open Supabase Dashboard → SQL Editor
2. Open file: `scripts/t1-canonical-policies.sql`
3. Copy entire content
4. Paste into SQL Editor
5. Execute
6. Verify output shows 2 policies created

**Expected verification output:**
```
table_name         | policy_name                          | command | using_clause
-------------------|--------------------------------------|---------|---------------------------
hc_appointments    | tenant_isolation_hc_appointments     | ALL     | (tenant_id = public.get_auth_tenant_id())
hc_prescriptions   | tenant_isolation_hc_prescriptions    | ALL     | (tenant_id = public.get_auth_tenant_id())
```

---

### Step 2: Rerun T1

**Command:**
```powershell
cd "d:\Antigravity\Projects\BELLA SPA ERP"
$env:USE_DIRECT_ADAPTER="true"
npx tsx test/phase4b3/t1-happy-path.ts
```

**Do NOT assume result:**
- ❌ Do NOT expect "85/90 PASS"
- ❌ Do NOT expect "deployment_eligible=true"
- ✅ Record actual result
- ✅ Read full artifact
- ✅ Classify all failures

---

### Step 3: Analyze T1 Artifact

**After T1 execution, provide:**
1. Overall result (PASS/FAIL)
2. Deployment eligible (true/false)
3. Checks passed/failed/warnings
4. verification_id
5. Artifact path

**Agent will classify failures:**
- **Category A:** RLS failures (should be fixed by canonical policies)
- **Category B:** FK failures (expected if tables don't exist)
- **Category C:** Additive/drift failures (declaration vs actual schema)
- **Category D:** Fixture-only failures (test setup issues)
- **Category E:** Verifier bugs (remaining semantic issues)

---

## 🚦 DECISION FLOW

```
Apply canonical SQL
        ↓
Rerun T1
        ↓
    T1 PASS?
        ├─ YES → Immediately proceed to T2
        │         (No cleanup, no refactor)
        │
        └─ NO → Analyze artifact
                    ↓
              Classify failures
                    ↓
              Each failure:
                    ├─ Canonical source? → Apply minimal fix
                    ├─ Test fixture issue? → Fix fixture
                    ├─ Verifier bug? → Fix verifier
                    └─ Unknown? → STOP, report
                    ↓
              Rerun T1
                    ↓
              (Repeat until T1 PASS)
```

**Critical rule:** T1 PASS required before T2. No Path B ("FAIL but engine works").

---

## 📊 CURRENT T1 STATE (Before Canonical Policies)

**Last execution:** v-71be3d81-528d-49d3-bcc9-2165219cb9d6

**Result:** FAIL  
**Checks:** 13/90 PASS  
**Deployment eligible:** false  

**Known failures:**
1. ❌ hc_prescriptions: Missing RLS policies → **Should fix after canonical SQL**
2. ❌ hc_appointments: Missing RLS policies → **Should fix after canonical SQL**
3. ✅ hc_encounters: Tenant isolation (fixed by pattern recognition)
4. ✅ edu_enrollments: Tenant isolation (fixed by pattern recognition)
5. ❌ FK: patient_id → hc_patients (expected, table doesn't exist)
6. ❌ FK: tenant_id → runtime_tenant_registry (expected, table doesn't exist)
7. ❌ Additive tenant_id on hc_encounters (undeclared column)
8. ❌ Additive tenant_id on hc_prescriptions (undeclared column)

---

## 🎯 SUCCESS CRITERIA

**T1 PASS requires:**
- All CRITICAL checks PASS
- No security invariant violations
- deployment_eligible = true

**Acceptable warnings:**
- FK failures if referenced tables don't exist (test DB limitation)
- Additive column warnings (if columns are canonical but undeclared in test fixture)

**NOT acceptable:**
- RLS policy missing on security-critical tables
- Tenant isolation not enforced
- Unexpected deletions/modifications

---

## 📚 ARTIFACTS

**Code fixes:**
- `src/platform/migration-governance/verification/checks/drift-detection.ts`
- `src/platform/migration-governance/verification/checks/rls-verification.ts`

**Canonical SQL:**
- `scripts/t1-canonical-policies.sql`

**Analysis documents:**
- `docs/architecture/PHASE4B3_OPTION_C_ANALYSIS.md`
- `docs/architecture/PHASE4B3_INTERPRETATION_B_EVIDENCE.md`
- `docs/architecture/PHASE4B3_T1_RERUN_RESULT.md`
- `docs/architecture/PHASE4B3_T1_REPAIR_FINAL.md`
- `docs/architecture/PHASE4B3_T1_CHECKPOINT.md` (this document)

**Latest T1 artifact:**
- `artifacts/verification/v-71be3d81-528d-49d3-bcc9-2165219cb9d6.json`

---

## 🔒 GUARDRAILS

**DO:**
- ✅ Apply canonical SQL from migrations
- ✅ Rerun T1 after each fix
- ✅ Classify all failures systematically
- ✅ Fix one issue at a time
- ✅ Record actual results (no assumptions)

**DO NOT:**
- ❌ Assume T1 will PASS after canonical policies
- ❌ Invent policies not in migrations
- ❌ Modify Contract v1.0.0
- ❌ Skip to T2 before T1 PASS
- ❌ Open new phases/frameworks
- ❌ Debug unrelated build errors
- ❌ Apply "Path B" (certificate without T1 PASS)

---

**Status:** 🟡 READY FOR USER ACTION  
**Next:** User applies `scripts/t1-canonical-policies.sql` → Reruns T1 → Reports result  
**Date:** 2026-08-25
