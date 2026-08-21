# G3a LAYER 2.1: PACKAGE INTEGRITY MIGRATION

**Date:** 2026-08-20  
**Gate:** Package Integrity (52 checks)  
**Status:** 🟡 IN PROGRESS  

---

## OBJECTIVE

**Migrate Package Integrity gate from legacy implementation to BDGF.**

**Legacy:** `scripts/verify-amendment-12-v3-package-integrity.mjs` (420 lines)  
**Target:** BDGF config + thin runner (<50 lines)

**Success Criteria:** 52/52 PASS (same as baseline)

---

## CHECK BREAKDOWN (52 CHECKS)

### File Existence (7 checks)
1. E1 gate SQL file
2. E2 gate SQL file
3. E3 gate SQL file
4. Migration 05-A SQL file
5. Migration 05-B SQL file
6. Migration 05-C SQL file
7. E1 verification script

**Check Type:** `file-exists`

---

### Condition #1: P4 Metadata Validation (6 checks)

8. P4 metadata documentation
9. created_at introspection
10. provisioned_by extraction (syntax)
11. provisioned_by COALESCE handling
12. UNKNOWN classification → STOP
13. UNKNOWN classification handling

**Check Types:** `file-contains-text`, `file-contains-pattern`

---

### Condition #2: Advisory Lock (4 checks)

14. pg_try_advisory_xact_lock in 05-A
15. hashtext('BELLA_MIGRATION_05') lock key
16. pg_try_advisory_xact_lock in 05-B
17. Lock acquisition check + failure handling

**Check Types:** `file-contains-text`, `file-contains-pattern`

---

### Condition #3: Mapping Immutability (4 checks)

18. prevent_canonical_id_change function
19. CREATE TRIGGER trigger_prevent_canonical_id_change
20. OLD.reconciliation_phase = 'COMPLETE' check
21. OLD.canonical_tenant_id IS DISTINCT FROM NEW.canonical_tenant_id

**Check Types:** `file-contains-text`

---

### Condition #4: Transaction + Lock + Verification (8 checks)

22. BEGIN (transaction boundaries)
23. UNIQUE index uq_canonical_map_reserved_uuid
24. UNIQUE index uq_canonical_map_canonical_uuid
25. migration_05a_preflight_p4_collision_gate
26. migration_05b_preflight_p2_reservation_complete
27. migration_05b_preflight_p3_schema_compatibility
28. migration_05b_preflight_collision_recheck
29. (implicit: transaction boundaries verification)

**Check Types:** `file-contains-text`

---

### Condition #5: Deletion Audit Columns (9 checks)

30. deleted_at TIMESTAMPTZ column definition
31. deleted_by TEXT column definition
32. deletion_reason TEXT column definition
33. deleted_at = NOW() population
34. Complete audit trail (deleted_at + deleted_by + deletion_reason)
35. Audit UPDATE before DELETE (atomicity)
36. deleted_by = CURRENT_USER
37. deletion_reason = 'E2 orphan safety gate PASS'
38. (implicit: audit column completeness check)

**Check Types:** `file-contains-text`, `file-contains-pattern`

---

### Design Implementation Mapping (7 checks)

39. reserved_tenant_id UUID (Correction 1)
40. canonical_tenant_id UUID (Correction 1)
41. NO FK constraint during reservation (Correction 1)
42. FK added by 05-B (Correction 1)
43. information_schema introspection in E1 (Correction 3)
44. information_schema in 05-B (Correction 4)
45. E2-A orphan safety gate (Correction 6)

**Check Types:** `file-contains-text`, `file-contains-pattern`

---

### Gate Integrity (5 checks)

46. migration_05_e1_gate function
47. migration_05_e2_orphan_safety_gate function
48. migration_05_e3_gate function
49. migration_05a_preflight_p4_collision_gate function
50. migration_05b_preflight_p3_schema_compatibility function

**Check Types:** `file-contains-text`

---

### Negative Path Verification (4 checks)

51. NO fuzzy matching in 05-C
52. NO auto-delete/reassign in P4
53. Unmapped TEXT ID → EXCEPTION
54. NO graceful degradation in E2

**Check Types:** `file-contains-pattern`

**Note:** Listed 54 checks (52 unique + 2 implicit combined into others)

---

## BDGF MAPPING STRATEGY

### Check Type Usage

**`file-exists`:** 7 checks (file existence)  
**`file-contains-text`:** 30 checks (simple substring match)  
**`file-contains-pattern`:** 15 checks (regex pattern match)

**Total:** 52 checks mapped to 3 check types (all available in Check Registry)

---

## MIGRATION APPROACH

### 1. Create BDGF Gate Config

**File:** `.bdgf/gates/amendment-12/package-integrity.json`

**Structure:**
```json
{
  "version": "1.0",
  "gate": {
    "id": "amendment-12-v3-package-integrity",
    "name": "Amendment 12 v3 Package Integrity",
    "description": "Verify 5 mandatory conditions before Package Review",
    "checks": [
      {
        "id": "file-exists-e1-gate",
        "type": "file-exists",
        "config": {
          "path": "supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql"
        },
        "description": "File: E1 gate SQL"
      },
      ... (51 more checks)
    ]
  }
}
```

### 2. Create BDGF Runner

**File:** `scripts/bdgf-amendment-12/run-package-integrity.mjs`

**Structure:**
```javascript
import { runGate } from '../bdgf/gate-runner.mjs';

const config = await readFile('.bdgf/gates/amendment-12/package-integrity.json');
const result = await runGate(config, {
  workspaceRoot: process.cwd(),
  evidencePath: 'evidence/g3a-layer2'
});

// Print formatted results
console.log(formatGateResult(result));

// Exit with gate status
process.exit(result.status === 'PASS' ? 0 : 1);
```

**Size Estimate:** ~40-50 lines (vs 420 lines legacy)

---

## EXECUTION PLAN

### Step 1: Create Config (Estimated: 2 hours)

**Tasks:**
- [ ] Create `.bdgf/gates/amendment-12/` directory
- [ ] Create `package-integrity.json` with 52 checks
- [ ] Map each legacy check to BDGF check type
- [ ] Verify config validates against Gate Contract

### Step 2: Create Runner (Estimated: 30 minutes)

**Tasks:**
- [ ] Create `scripts/bdgf-amendment-12/` directory
- [ ] Create `run-package-integrity.mjs`
- [ ] Import Gate Runner
- [ ] Load config
- [ ] Execute gate
- [ ] Format results (match legacy output style)

### Step 3: Execute & Capture (Estimated: 15 minutes)

**Tasks:**
- [ ] Run BDGF Package Integrity
- [ ] Capture output to `evidence/g3a-layer2/result-B-package.txt`
- [ ] Verify execution completes

### Step 4: Compare Results (Estimated: 30 minutes)

**Tasks:**
- [ ] Load baseline: `result-A-package.txt` (52/52 PASS)
- [ ] Load BDGF: `result-B-package.txt` (?/52)
- [ ] Compare check-by-check
- [ ] Document any discrepancies

### Step 5: Verify Equivalence (Estimated: 1 hour)

**Expected:** 52/52 PASS (same as baseline)

**If PASS:**
- [ ] Document equivalence
- [ ] Mark Layer 2.1 COMPLETE
- [ ] FREEZE Layer 2.1
- [ ] Proceed to Layer 2.2 (E0 Gate)

**If Discrepancy:**
- [ ] Classify: EXPECTED / BUG / SEMANTIC DRIFT / BASELINE ERROR
- [ ] If BUG: Fix BDGF config or runner
- [ ] If BASELINE ERROR: Document (do NOT modify baseline)
- [ ] Re-execute and re-verify

---

## SUCCESS CRITERIA

**Functional Equivalence:**
- ✅ 52/52 PASS (same as baseline)

**Check Identity:**
- ✅ Same 52 checks executed
- ✅ Same check semantics
- ✅ Same failure conditions

**Evidence Quality:**
- ✅ Same or better evidence
- ✅ Clear PASS/FAIL status
- ✅ Exit code 0 (PASS) or 1 (FAIL)

**Boundary Discipline:**
- ✅ No Amendment 12 logic in BDGF kernel
- ✅ All domain logic in config
- ✅ Runner is domain-agnostic

---

## RISK MITIGATION

### Risk 1: Config Complexity

**Concern:** 52 checks in JSON might be verbose

**Mitigation:**
- Use clear structure
- Group checks by condition
- Add comments via `description` field

### Risk 2: Pattern Mismatch

**Concern:** Regex patterns might not match exactly

**Mitigation:**
- Test each pattern individually
- Use baseline files for validation
- Document any pattern adjustments

### Risk 3: False Negative

**Concern:** BDGF might be too strict (fail when legacy passes)

**Mitigation:**
- Compare failure points
- Verify pattern correctness
- Adjust if BDGF is over-strict (document reason)

---

## LAYER 2.1 CHECKLIST

- [ ] Create `.bdgf/gates/amendment-12/package-integrity.json` (52 checks)
- [ ] Create `scripts/bdgf-amendment-12/run-package-integrity.mjs` (runner)
- [ ] Execute BDGF gate → capture result-B-package.txt
- [ ] Compare: result-A vs result-B
- [ ] Verify: 52/52 PASS equivalence
- [ ] Document: Layer 2.1 complete
- [ ] FREEZE: Layer 2.1 immutable

---

## ESTIMATED TIME

**Total:** 4-6 hours

**Breakdown:**
- Config creation: 2 hours
- Runner creation: 30 minutes
- Execution: 15 minutes
- Comparison: 30 minutes
- Verification & documentation: 1-2 hours
- Contingency (if discrepancies): +1-2 hours

---

## NEXT AFTER LAYER 2.1

**If Layer 2.1 PASS:**
- G3a Layer 2.2: E0 Gate Migration (33 checks)

**If Layer 2.1 FAIL:**
- Analyze root cause
- Fix BDGF (if bug)
- Document baseline error (if baseline wrong)
- Re-verify before proceeding

---

**Status:** 🟡 READY TO START  
**Prerequisite:** ✅ Layer 1 LOCKED  
**Next Action:** Create package-integrity.json  
