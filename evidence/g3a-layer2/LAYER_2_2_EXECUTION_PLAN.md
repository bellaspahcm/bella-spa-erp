# G3a LAYER 2.2: E0 ARTIFACT INTEGRITY — EXECUTION PLAN

**Date:** 2026-08-20  
**Gate:** E0 Artifact Integrity (33 checks)  
**Status:** 🟡 READY TO START  
**Prerequisite:** ✅ Layer 2.1 FROZEN  

---

## OBJECTIVE

**Migrate E0 Artifact Integrity gate from legacy to BDGF.**

**Pattern:** Same proven pattern from Layer 2.1

**Target:** 33/33 functional equivalence with boundary maintained

---

## SUCCESS CRITERIA (NON-NEGOTIABLE)

### 1. Functional Equivalence

- ✅ 33/33 PASS (same as baseline)
- ✅ Same check semantics
- ✅ Same validation logic
- ✅ Same exit code (0)

### 2. Evidence Quality

- ✅ Same or better evidence than legacy
- ✅ Structured evidence (JSON)
- ✅ Evidence archived
- ✅ Audit trail complete

### 3. Boundary Discipline

- ✅ Kernel has 0 Amendment 12 knowledge
- ✅ All domain logic in config
- ✅ Runner is thin adapter
- ✅ No domain-specific behavior in P0

### 4. Config-Driven

- ✅ All checks defined in config
- ✅ No hardcoded logic in runner
- ✅ Declarative governance

### 5. Failure Semantics

- ✅ Gate correctly rejects invalid input
- ✅ Same error messages
- ✅ Same exit codes on failure

### 6. No Regression

- ✅ No changes to P0 kernel for E0
- ✅ Package Integrity still works (frozen)
- ✅ No side effects

---

## BASELINE REFERENCE

**Source:** `evidence/g3a-baseline/result-A-e0.txt`

**Result:** 33/33 PASS, Exit 0

**Check breakdown:**
- Group A: Artifact Integrity (15 checks)
- Group B: Dependency Integrity (6 checks)
- Group C: Execution Preconditions (4 checks)
- Group D: Gate Integrity (8 checks)

**Total:** 33 checks

---

## E0 CHECK STRUCTURE (FROM BASELINE)

### Group A: Artifact Integrity (15 checks)

1. Migration file exists: E1 gate SQL
2. Migration file exists: E2 gate SQL
3. Migration file exists: E3 gate SQL
4. Migration file exists: 05-A SQL
5. Migration file exists: 05-B SQL
6. Migration file exists: 05-C SQL
7. Verification script exists: Package Integrity
8. Verification script exists: E1
9. Verification script exists: E0 (self)
10. Documentation exists: Package Review
11. 05-A structure: canonical_tenant_map table
12. 05-A structure: P4 collision gate function
13. 05-B structure: Immutability trigger
14. 05-B structure: Orphan deletion logic
15. E2 structure: Orphan safety verification

**Check types:** `file-exists`, `file-contains-text`

---

### Group B: Dependency Integrity (6 checks)

16. Dependency: runtime_tenant_registry exists
17. Dependency: tenant_id type = text (pre-migration)
18. Dependency: public.tenants exists
19. Dependency: public.tenants.id type = uuid
20. Precondition: migration_evidence schema NOT exists
21. Precondition: canonical_tenant_map NOT exists

**Check types:** `database-table-exists`, `database-column-type`, `database-schema-not-exists`

**⚠️ IMPORTANT:** E0 requires **database checks**

---

### Group C: Execution Preconditions (4 checks)

22. Precondition: 5 TEXT fixtures present
23. Precondition: No FK on tenant_id
24. Precondition: PostgreSQL >= 12 (partial UNIQUE index)
25. Precondition: Database user has CREATE privileges

**Check types:** `database-query`, `database-constraint-check`, `database-version`, `database-privilege`

**⚠️ IMPORTANT:** E0 requires **runtime database verification**

---

### Group D: Gate Integrity (8 checks)

26. Gate integrity: E1 defined as SQL function
27. Gate integrity: E1 returns structured results
28. Gate integrity: E2 defined as SQL function
29. Gate integrity: E3 defined as SQL function
30. Gate integrity: 05-B calls E2 BEFORE deletion
31. Gate integrity: 05-B blocks if E2 fails
32. Gate integrity: E2 uses EXCEPTION for stops
33. Gate integrity: Advisory lock prevents concurrent execution

**Check types:** `file-contains-text`, `file-contains-pattern`

---

## CRITICAL CHALLENGE: DATABASE CHECKS

### The Problem

**E0 Group B + C (10 checks) require:**
- Database connection
- Table existence verification
- Column type checking
- Schema verification
- Query execution
- Version detection
- Privilege checking

**Current P0 Check Registry:**
- `file-existence` ✅
- `regex-match` ✅
- `negative-match` ✅
- `file-hash` ✅
- `directory-structure` ✅
- `json-schema` ✅
- `yaml-validation` ✅
- `custom` ✅

**Missing:** Database check types

---

### The Decision Point

**Option A: Add Generic Database Checks to Check Registry**

**Add:**
- `database-table-exists`
- `database-column-type`
- `database-schema-exists`
- `database-query`
- `database-version`
- `database-privilege`

**Classification:** GENERIC GOVERNANCE CAPABILITY ✅

**Reason:**
- Database state verification is common governance need
- Not specific to Amendment 12
- Healthcare, Finance, Education all need DB validation
- Reusable across all OS

**Decision:** ✅ ALLOWED (enhances kernel reusability)

---

**Option B: Use Custom Check Type**

**Approach:**
- Define database checks as `custom` type
- Provide JavaScript function for each check
- Keep in config (not kernel)

**Classification:** WORKAROUND ⚠️

**Reason:**
- Custom checks are allowed but less declarative
- Harder to audit
- Less reusable

**Decision:** ⚠️ ACCEPTABLE but not preferred

---

**Option C: Put Database Logic in Domain Layer**

**Approach:**
- Keep E0 as custom script (no BDGF migration)
- Only migrate file-based checks

**Classification:** PARTIAL MIGRATION ❌

**Reason:**
- Defeats purpose of G3a
- Doesn't test BDGF boundary with database governance
- Incomplete validation

**Decision:** ❌ NOT ACCEPTABLE

---

### RECOMMENDED APPROACH

**Enhance Check Registry with generic database checks.**

**Why this is correct:**

1. **Generic capability:** Database validation is governance primitive
2. **Reusable:** All OS need database state verification
3. **Declarative:** Config can specify DB checks without code
4. **Boundary-safe:** No domain logic, pure infrastructure

**What to add:**
```javascript
// In Check Registry
{
  'database-table-exists': async (config) => { /* generic DB check */ },
  'database-column-type': async (config) => { /* generic DB check */ },
  'database-schema-exists': async (config) => { /* generic DB check */ },
  'database-query': async (config) => { /* generic DB check */ },
  'database-version': async (config) => { /* generic DB check */ },
  'database-privilege': async (config) => { /* generic DB check */ }
}
```

**Connection config:**
```json
{
  "database": {
    "connectionString": "${DATABASE_URL}",
    "type": "postgresql"
  }
}
```

**This is P0 enhancement, not domain leakage.**

---

## EXECUTION STEPS

### Phase 1: Enhance Check Registry (demand-driven)

**Task:** Add generic database check types **only as E0 proves necessary**

**Approach:** Let E0 requirements drive capability decisions

**DO NOT assume all 6 types must be added.**

**For each E0 check:**
1. Try existing primitives first
2. If inadequate, classify need:
   - Generic capability → Add to kernel
   - Domain-specific → Config/custom
   - One-off → Don't add

**Estimated time:** 2-4 hours (depends on actual requirements)

**Deliverables:**
- Enhanced `check-registry.mjs` with proven generic types
- Database connection handler (if needed)
- Error handling for DB checks
- Independent test for each new primitive (non-Amendment-12 data)

**Validation:**
- Each check type tested independently
- No domain logic in primitives
- Reusable across OS (Healthcare/Finance/Education)

**This phase proves:** BDGF can self-extend safely

---

### Phase 2: Create E0 Config

**Task:** Define 33 checks in BDGF config

**Estimated time:** 2-3 hours

**Structure:**
```json
{
  "gateName": "amendment-12-v3-e0-artifact-integrity",
  "gateVersion": "1.0",
  "deployment": "g3a-layer2-2",
  "database": {
    "connectionString": "${DATABASE_URL}"
  },
  "checks": [
    // 15 file-based checks (Group A)
    // 6 database checks (Group B)
    // 4 runtime checks (Group C)
    // 8 pattern checks (Group D)
  ]
}
```

**File:** `.bdgf/gates/amendment-12/e0-artifact-integrity.json`

---

### Phase 3: Create E0 Runner

**Task:** Create thin adapter for E0 execution

**Estimated time:** 30 minutes

**Structure:** Same as Package Integrity runner

**File:** `scripts/bdgf-amendment-12/run-e0-artifact-integrity.mjs`

---

### Phase 4: Execute & Capture

**Task:** Run BDGF E0 and capture results

**Command:**
```bash
node scripts/bdgf-amendment-12/run-e0-artifact-integrity.mjs > evidence/g3a-layer2/result-B-e0.txt 2>&1
```

**Expected result:** 33/33 PASS, Exit 0

---

### Phase 5: Differential Verification

**Task:** Compare Legacy A vs BDGF B

**Baseline:** `evidence/g3a-baseline/result-A-e0.txt` (33/33 PASS)  
**BDGF:** `evidence/g3a-layer2/result-B-e0.txt` (target: 33/33 PASS)

**Verify A ≡ B:**
- Check count: 33 = 33 ✅
- PASS count: 33 = 33 ✅
- FAIL count: 0 = 0 ✅
- Exit code: 0 = 0 ✅
- Check semantics: Equivalent ✅
- Evidence quality: Same or better ✅
- Failure behavior: Same rejection semantics ✅

**Not just PASS/FAIL, but full equivalence.**

---

### Phase 6: Boundary Audit

**Task:** Verify kernel remains domain-agnostic

**Check:**
- P0 kernel files: 0 Amendment 12 imports
- Check Registry: Only generic DB capabilities
- E0 config: Contains Amendment 12 specifics (allowed)
- E0 runner: Minimal domain logic (thin adapter)

**If boundary violated:** FAIL and fix before proceeding

---

### Phase 7: Freeze Layer 2.2

**Task:** Document and freeze E0 migration

**Deliverables:**
- `LAYER_2_2_COMPLETE.md`
- `LAYER_2_2_FROZEN.md`

**Only after:** 33/33 equivalence proven + boundary maintained

**Then:** Progress becomes 85/95 (89% proven)

---

## WHY E0 IS HARDER THAN PACKAGE INTEGRITY

**Package Integrity (Layer 2.1):**
- Used existing primitives (`file-existence`, `regex-match`)
- No kernel enhancement needed
- Boundary relatively straightforward
- **Proof:** BDGF works with static governance

**E0 Artifact Integrity (Layer 2.2):**
- Likely requires new database primitives
- Controlled kernel enhancement needed
- Boundary more complex (database/runtime)
- **Proof:** BDGF can self-extend while maintaining boundary

**E0 tests architectural property Package Integrity could not:**

> Can BDGF add generic capabilities without domain leakage?

**This is the stress test for platform scalability.**

If E0 fails → Boundary architecture has fundamental flaw  
If E0 passes → BDGF proven capable of safe evolution

**That's why E0 evidence is more valuable than Package Integrity evidence.**

---

## RISK ASSESSMENT

### Risk 1: Database Check Complexity

**Risk:** Database checks more complex than file checks

**Mitigation:**
- Start with simple checks (table existence)
- Build incrementally
- Test each check type independently

### Risk 2: Connection Management

**Risk:** Database connection errors, timeouts

**Mitigation:**
- Use connection pooling
- Add timeout handling
- Clear error messages

### Risk 3: Schema State Dependency

**Risk:** Database state affects check results

**Mitigation:**
- Document expected state in config
- Checks verify preconditions
- Clear failure messages

### Risk 4: Boundary Temptation

**Risk:** Temptation to add Amendment 12 logic to DB checks

**Mitigation:**
- Keep DB checks generic
- Classify any capability request (Generic/Domain/One-off)
- Review before adding to kernel

---

## NON-NEGOTIABLE BOUNDARIES

**MUST NOT add to Check Registry:**
- `amendment-12-specific-check`
- `tenant-reconciliation-check`
- `identity-migration-check`
- Any check with business domain knowledge

**MAY add to Check Registry:**
- `database-table-exists` (generic)
- `database-column-type` (generic)
- `database-query` (generic, parameterized)
- `database-version` (generic)

**Classification guide:**
- Generic governance primitive → Add to kernel
- Domain-specific validation → Keep in config
- One-off hack → Do not add anywhere

---

## DECISION CHECKPOINT

**Before proceeding, confirm:**

1. [ ] Layer 2.1 (Package Integrity) is frozen
2. [ ] Baseline E0 evidence exists (33/33 PASS)
3. [ ] Decision made: Enhance Check Registry with DB checks
4. [ ] No domain logic will enter kernel
5. [ ] Success criteria clear: 33/33 + boundary + evidence

**Only proceed if all confirmed.**

---

## ESTIMATED TIMELINE

**Phase 1:** Check Registry enhancement (2-3 hours)  
**Phase 2:** E0 config creation (2-3 hours)  
**Phase 3:** E0 runner creation (30 minutes)  
**Phase 4:** Execution & capture (15 minutes)  
**Phase 5:** Differential verification (1 hour)  
**Phase 6:** Boundary audit (1 hour)  
**Phase 7:** Freeze documentation (30 minutes)

**Total:** 7-9 hours (1-2 sessions)

---

## NEXT ACTION

**Immediate:** Enhance Check Registry with generic database check types

**After that:** Create E0 config → Execute → Verify → Freeze

**Then:** Layer 2.3 (E1, 10 checks)

---

**Status:** 🟡 READY TO START  
**Prerequisite:** ✅ Layer 2.1 FROZEN  
**Next:** Enhance Check Registry with database checks  
