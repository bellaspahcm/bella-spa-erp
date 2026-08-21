# R4 — MIGRATION EXECUTION GATE FRAMEWORK (Entry Brief)

**Date:** 2026-08-20 19:00  
**Status:** 🟡 READY TO BEGIN  
**Entry Condition:** R3 baseline locked ✅  

---

## 🎯 R4 MISSION

**Build the Migration Execution Gate Framework**

Establish governed execution path for production migrations:
- WHEN migrations execute
- UNDER WHAT CONDITIONS they proceed
- HOW approval is verified
- WHAT checks run before execution
- HOW execution is controlled
- WHAT verification happens after
- HOW evidence is generated

---

## 📋 R3 → R4 TRANSITION

### R3 Closed: WHO

**Question:** WHO can mutate Production?

**Answer:** Only `bella_migration_executor` through controlled path

**Infrastructure:** PostgreSQL roles + CLI logout + Service key removal

**Guarantee:** Developer has no direct mutation authority

---

### R4 Will Close: WHEN + CONDITIONS

**Question:** WHEN and UNDER WHAT CONDITIONS can mutations execute?

**Answer:** (To be established in R4)

**Infrastructure:** Approval gates + Preflight checks + Controlled execution

**Guarantee:** All mutations go through approval verification

---

## 🔧 R4 COMPONENTS (From AUDIT_07)

### 1. Approval Verification Automation

**Current:** Manual approval record in `bella_migration_approval`

**R4 Goal:** Automated verification before execution

**Requirements:**
- Check approval exists for migration ID
- Verify approval not revoked
- Validate approver authority
- Confirm timestamp validity

---

### 2. Preflight Invariant Checks

**Purpose:** Verify system state before mutation

**Checks:**
- Migration not already applied
- Dependencies satisfied
- No conflicting migrations running
- Target schema version matches expectation
- Tenant isolation intact (if multi-tenant migration)

---

### 3. Execution Gate Logic

**Purpose:** Decision engine for "execute or block"

**Gates:**
- G0: Human Approval (must exist + valid)
- G1: Preflight Checks (all must pass)
- G2: Risk Assessment (severity < threshold OR explicit override)
- G3: Execution Window (time/environment constraints)

**Decision:** ALL gates PASS → execute; ANY gate FAIL → block + evidence

---

### 4. Controlled Executor Invocation

**Purpose:** Execute using `bella_migration_executor` role only

**Path:**
```
Migration Request
    ↓
Gate Framework (R4)
    ↓
Approval Verification ✅
    ↓
Preflight Checks ✅
    ↓
bella_migration_executor
    ↓
Production Mutation
```

**Guarantee:** No execution without passing all gates

---

### 5. Postflight Verification

**Purpose:** Verify mutation succeeded as intended

**Checks:**
- Migration marked as applied
- Schema version updated
- No data corruption detected
- Rollback script tested (if provided)
- Audit trail complete

---

### 6. Evidence Generation

**Purpose:** Machine-verifiable audit trail

**Evidence:**
- Gate execution results (PASS/FAIL for each gate)
- Approval verification (who approved, when, migration ID)
- Preflight check results (all assertions)
- Execution log (SQL statements, errors, timing)
- Postflight verification (final state)

**Format:** Structured JSON + human-readable markdown

---

## 🚧 R4 SCOPE BOUNDARIES

### In Scope

- ✅ Approval verification automation
- ✅ Preflight check framework
- ✅ Gate decision logic
- ✅ Controlled executor invocation
- ✅ Postflight verification
- ✅ Evidence generation

---

### Out of Scope (Future Phases)

- ❌ Migration authoring tools
- ❌ Rollback automation
- ❌ Multi-environment promotion
- ❌ CI/CD pipeline integration (later)
- ❌ Real-time monitoring dashboard

---

## 📐 R4 DESIGN PRINCIPLES

### 1. Machine-Verifiable Gates

Every gate produces executable test evidence (like R3).

**Example:**
```bash
node scripts/bdgf/r4-gate-test.mjs --migration-id=M001
→ Gate G0 (Approval): PASS
→ Gate G1 (Preflight): PASS
→ Gate G2 (Risk): PASS
→ Gate G3 (Window): PASS
→ Decision: EXECUTE
```

---

### 2. Fail-Safe Default

**Default:** BLOCK (safe)

**Execute only when:** ALL gates explicitly PASS

**Evidence requirement:** Every BLOCK must produce reason + evidence

---

### 3. Emergency Override

**Purpose:** Allow human override in emergency

**Requirement:** Override must generate evidence

**Example:**
```
Gate G2 (Risk): FAIL (severity=HIGH)
Human Override: APPROVED (reason="Critical hotfix", approver="Admin")
→ Decision: EXECUTE WITH OVERRIDE
→ Evidence: Override recorded in audit trail
```

---

### 4. Auditability

Every execution (success or failure) produces evidence:
- What was attempted
- Who approved it
- What gates checked
- What passed/failed
- What was executed
- What was the result

**No silent failures. No invisible executions.**

---

## 🧪 R4 VERIFICATION METHODOLOGY

### Same as R3: "Evidence > Assumption"

**Every gate must have:**
1. Executable test (demonstrates gate logic)
2. Negative test (demonstrates gate blocks when it should)
3. Evidence document (shows test results)

**Example:**
```bash
# Positive test
node scripts/bdgf/r4-test-approval-gate.mjs --approved
→ Gate G0: PASS

# Negative test
node scripts/bdgf/r4-test-approval-gate.mjs --not-approved
→ Gate G0: FAIL (no approval found)
→ Execution: BLOCKED
```

---

## 📋 R4 SUGGESTED SEQUENCE

### Phase 1: Approval Gate Automation

**Goal:** Automate approval verification (currently manual)

**Deliverables:**
- Approval verification script
- Negative tests (no approval → block)
- Evidence generation

---

### Phase 2: Preflight Framework

**Goal:** Define and execute preflight checks

**Deliverables:**
- Preflight check definitions
- Execution engine
- Negative tests (failed checks → block)

---

### Phase 3: Gate Decision Engine

**Goal:** Combine all gates into decision logic

**Deliverables:**
- Gate orchestration
- Decision logic (ALL pass → execute)
- Evidence aggregation

---

### Phase 4: Controlled Execution

**Goal:** Invoke bella_migration_executor through gates

**Deliverables:**
- Executor invocation script
- Execution logging
- Postflight verification

---

### Phase 5: End-to-End Verification

**Goal:** Prove complete path works

**Deliverables:**
- Full migration test (request → approval → gates → execution → evidence)
- Negative path tests (various failure scenarios)
- Evidence documents

---

## ✅ R4 ENTRY CHECKLIST

Before starting R4, verify:

- [x] R3 baseline locked
- [x] All 3 authorities closed
- [x] Credentials rotated
- [x] Evidence cleaned up
- [x] Status documents updated
- [x] AUDIT_07_REMEDIATION_PLAN.md reflects R3 complete

**Status:** ✅ ALL COMPLETE — R4 CAN BEGIN

---

## 🚀 NEXT STEPS

### Immediate

1. Review R4 objectives in AUDIT_07_REMEDIATION_PLAN.md
2. Design approval verification automation
3. Create R4 test framework (following R3 pattern)

### First Deliverable

**R4 Phase 1: Approval Gate Automation**

Create `scripts/bdgf/r4-verify-approval.mjs`:
- Check approval exists for migration ID
- Verify approval not revoked
- Validate approver authority
- Return PASS/FAIL decision

Then create negative tests proving it blocks when it should.

---

**R4 Status:** 🟡 READY TO BEGIN

**Entry Condition:** R3 baseline locked ✅

**Next Session:** Begin R4 Phase 1 — Approval Gate Automation

---

**Principle:** "Evidence > Assumption"

R4 will follow R3's methodology: every gate backed by executable tests and documented evidence.
