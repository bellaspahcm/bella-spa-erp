# T1-T7 Runtime Validation Status

**Date:** 2026-08-25  
**Gate C:** 🟢 APPROVED  
**Status:** ⏸️ BLOCKED ON OPERATIONAL REQUIREMENT  

---

## 🟢 Gate C APPROVED

**Approval Date:** 2026-08-25  
**Approved By:** Architect  

**Approval Conditions Met:**
- ✅ R1: CA-bundle based TLS verification (no bypass paths)
- ✅ R2: verification_evidence append-only boundary proven (R2.4 reconciliation)
- ✅ R3: Targeted TypeScript compilation (0 errors)
- ✅ Security re-verification (8/8 PASS)
- ✅ Contract v1.0.0 (37ae4544) preserved
- ✅ Architecture Guard preserved
- ✅ No premature cleanup

---

## ⏸️ T1-T7 Execution: BLOCKED

**Blocker:** DATABASE_CA_CERT not configured (operational requirement, not code issue)

### Pre-flight Check Results

```
🧪 T1-T7 Runtime Validation
===========================

📋 Pre-flight Checks

🔴 BLOCKED: DATABASE_CA_CERT not set

R1 SSL remediation requires CA certificate for all environments.

To proceed:
  1. Export CA certificate from Supabase dashboard
  2. Save to file (e.g., supabase-ca.pem)
  3. Set: DATABASE_CA_CERT=/path/to/supabase-ca.pem
  4. Re-run validation

This is NOT a code issue — operational requirement for R1.
```

---

## 📋 T1-T7 Test Plan

**Contract Baseline:** v1.0.0 (commit 37ae4544) 🔒 FROZEN  
**Test Harness:** `docs/architecture/P0_3_PHASE4B_3_TEST_HARNESS.md` (e535ad0c)  
**Evidence Baseline:** `docs/architecture/P0_3_PHASE4B_3_TEST_EVIDENCE.md` (ab135cea)  

### Test Scenarios

| Test | Scenario | Expected Result | Deployment |
|------|----------|-----------------|------------|
| T1 | Happy path (all invariants satisfied) | PASS | ✅ ELIGIBLE |
| T2 | RLS missing on tenant-isolated table | FAIL | 🔴 BLOCKED |
| T3 | Foreign key constraint missing | FAIL | 🔴 BLOCKED |
| T4 | Unexpected column (additive drift) | WARNING | ✅ ELIGIBLE |
| T5 | RLS policy incomplete (missing command) | FAIL | 🔴 BLOCKED |
| T6 | Destructive drift (column deleted) | FAIL | 🔴 BLOCKED |
| T7 | No declaration (contract invariants only) | PASS/FAIL | Varies |

### Execution Plan

```
Gate C APPROVED ✅
       ↓
Configure DATABASE_CA_CERT                  ⏸️  BLOCKED (you are here)
       ↓
Adapter smoke test (with CA cert)           ⏳
       ↓
T1 → Basic verification (happy path)        ⏳
T2 → RLS missing (deployment block)         ⏳
T3 → Foreign key missing (deployment block) ⏳
T4 → Additive drift (warning only)          ⏳
T5 → RLS policy incomplete (block)          ⏳
T6 → Destructive drift (block)              ⏳
T7 → No declaration (OPC principle)         ⏳
       ↓
Evidence consolidation                      ⏳
       ↓
Gate D / Architect Review                   ⏳
```

---

## 🔐 R1 SSL Requirement

**Why DATABASE_CA_CERT is required:**

R1 remediation eliminated ALL certificate verification bypass paths:
- ❌ No `rejectUnauthorized: false`
- ❌ No `sslmode=no-verify`
- ❌ No `sslmode=disable`
- ✅ All environments use `rejectUnauthorized: true`

**For Supabase development:**
- Supabase uses self-signed certificates
- Node.js default trusted CAs don't include Supabase CA
- Must provide explicit CA bundle via `DATABASE_CA_CERT`

**This is production-grade security by design.**

### CA Certificate Export Procedure

**Step 1: Access Supabase Dashboard**
1. Navigate to your Supabase project
2. Go to Settings → Database
3. Connection string section

**Step 2: Download CA Certificate**
1. Look for "SSL Certificate" or "Download CA"
2. Download the certificate file
3. Save as `supabase-ca.pem` (or any name)

**Step 3: Configure Environment**
```bash
# Option 1: Environment variable
export DATABASE_CA_CERT=/path/to/supabase-ca.pem

# Option 2: .env.local (do NOT commit)
DATABASE_CA_CERT=/path/to/supabase-ca.pem
```

**Step 4: Verify**
```bash
# Test adapter connection
USE_DIRECT_ADAPTER=true npx tsx test/phase4b3/test-direct-adapter.ts

# Expected: 8/8 methods PASS
```

**Step 5: Run T1-T7**
```bash
USE_DIRECT_ADAPTER=true npx tsx test/phase4b3/run-t1-t7-validation.ts

# Expected: Pre-flight checks PASS, T1-T7 execution begins
```

---

## 📝 Governance Rules During T1-T7

### DO

✅ Execute tests in sequence T1 → T7  
✅ Record evidence for each test  
✅ Stop on failure → document → architect review  
✅ Generate verification artifacts  
✅ Compare expected vs actual outcomes  

### DO NOT

❌ Modify Contract v1.0.0 (37ae4544)  
❌ Remove SupabaseAdapter during validation  
❌ Cleanup RPC migration during validation  
❌ Auto-fix code to make tests pass  
❌ Bypass Architecture Guard  
❌ Proceed to Phase 2+ before Certificate  

**T1-T7 is validation, not implementation.**

If a test fails:
1. STOP execution
2. Record failure evidence
3. Classify failure (code bug, test bug, contract gap)
4. Architect review required
5. Fix approved → re-run
6. Do NOT continue to next test without review

---

## 🎯 Success Criteria

**T1-T7 Complete:**
- ✅ All 7 tests executed
- ✅ 7/7 PASS (or failures reviewed and resolved)
- ✅ Evidence artifacts generated (`artifacts/verification/v-t{1-7}-*.json`)
- ✅ Database records created (`migration_governance.verification_results`)
- ✅ Deployment blocking proven (T2, T3, T5, T6)
- ✅ OPC principle proven (T7)
- ✅ Contract 37ae4544 unchanged

**After T1-T7:**
- Evidence consolidation report
- Architect review
- Phase 4B.3 Certificate (if approved)
- ONLY THEN: Cleanup SupabaseAdapter/RPC

---

## 📊 Current Status Summary

```
Gate A: DB Security                     ✅ 8/8 PASS
Gate B: Implementation Approval         ✅ APPROVED
Phase 1: Direct Adapter                 ✅ COMPLETE
        ↓
R1: CA-based TLS                        ✅ COMPLETE
R2: RLS & Privileges                    ✅ RESOLVED
R2.4: Effective Privilege Reconciliation ✅ APPEND-ONLY CONFIRMED
R3: Targeted TypeScript                 ✅ PASS (0 errors)
        ↓
Security Re-verification                ✅ COMPLETE
        ↓
Gate C: T1-T7 Validation Approval       ✅ APPROVED
        ↓
>>> DATABASE_CA_CERT Configuration <<<  ⏸️  BLOCKED (operational)
        ↓
T1-T7 Runtime Validation                ⏳ PENDING CA CERT
```

---

## 🚀 Next Steps

### Immediate (Unblock T1-T7)

1. **Export CA Certificate:**
   - From Supabase dashboard
   - Save to secure location (e.g., `~/certs/supabase-ca.pem`)
   - Do NOT commit to repository

2. **Configure Environment:**
   ```bash
   export DATABASE_CA_CERT=~/certs/supabase-ca.pem
   # or add to .env.local (gitignored)
   ```

3. **Verify Adapter:**
   ```bash
   USE_DIRECT_ADAPTER=true npx tsx test/phase4b3/test-direct-adapter.ts
   # Expected: 8/8 PASS
   ```

4. **Run T1-T7:**
   ```bash
   USE_DIRECT_ADAPTER=true npx tsx test/phase4b3/run-t1-t7-validation.ts
   # Expected: T1-T7 execution begins
   ```

### After T1-T7 Complete

5. **Consolidate Evidence:**
   - Collect all verification artifacts
   - Generate summary report
   - Document any failures

6. **Architect Review:**
   - Present T1-T7 results
   - Resolve any failures
   - Obtain final approval

7. **Phase 4B.3 Certificate:**
   - If all tests PASS and reviewed
   - Certificate issued
   - ONLY THEN: Cleanup permitted

### After Certificate

8. **Cleanup (ONLY after Certificate):**
   - Remove SupabaseAdapter
   - Archive RPC migration
   - Update documentation
   - Close Phase 4B.3

---

## 📋 Files Created

**T1-T7 Execution:**
- `test/phase4b3/run-t1-t7-validation.ts` — Main test runner (pre-flight checks implemented)

**Status & Evidence:**
- `docs/architecture/T1_T7_STATUS.md` — This document
- `docs/architecture/GATE_C_FINAL_STATUS.md` — Gate C approval evidence
- `docs/architecture/PHASE1_REMEDIATION_R1_R3_REPORT.md` — R1-R3 evidence
- `docs/security/R2_EVIDENCE_RLS_FINDING.md` — R2 resolution
- `scripts/security/reconcile-executor-privileges.ts` — R2.4 reconciliation tool

**Contract & Test Harness (FROZEN):**
- `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md` (37ae4544) 🔒
- `docs/architecture/P0_3_PHASE4B_3_TEST_HARNESS.md` (e535ad0c) 🔒
- `docs/architecture/P0_3_PHASE4B_3_TEST_EVIDENCE.md` (ab135cea) — Reference baseline

---

**Status:** ⏸️ **BLOCKED ON DATABASE_CA_CERT** (operational requirement)  
**Gate C:** 🟢 **APPROVED**  
**Next:** Export Supabase CA certificate → Configure DATABASE_CA_CERT → Run T1-T7
