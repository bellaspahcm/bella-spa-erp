# RC Baseline v1.0 — Lock Confirmation

**Date:** 2026-09-11  
**Session:** 2 (Sealed)  
**Status:** 🔒 **LOCKED / CHANGE-CONTROLLED**

---

## 🔒 Lock Declaration

```text
╔═══════════════════════════════════════════════════════════╗
║                                                            ║
║       RC BASELINE v1.0 — LOCKED / CHANGE-CONTROLLED        ║
║                                                            ║
║  Document:        RC_BASELINE_OFFICIAL.md                  ║
║  Version:         1.0                                      ║
║  Date:            2026-09-11                               ║
║  Session:         2                                        ║
║                                                            ║
║  Status:          🔒 LOCKED                                ║
║  Direct modify:   ❌ PROHIBITED                            ║
║  Implementation:  ✅ FIX TO MEET BASELINE                  ║
║  Baseline change: ⚠️ ACR + APPROVAL REQUIRED              ║
║  Audit history:   ✅ PRESERVED                             ║
║                                                            ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 📋 What is Locked

### 1. Program Structure

```text
CAPABILITY CLOSURE (4 phases)
├─ Projects
├─ Products
├─ Customers
└─ Reservations

INTEGRATION CLOSURE (1 phase)
└─ Phase 5: Cross-Capability Business Flow

FINAL RC SEAL
└─ After all phases complete
```

**Locked:** Entity count (4), phase structure, integration requirement

---

### 2. Security Model

```text
5-LAYER DEFENSE MODEL (Universal)

Layer 1: Type Boundary (Client)
Layer 2: Server/Auth Boundary (Action)
Layer 3: Service Boundary (Business Logic)
Layer 4: Row-Level RLS (Database)
Layer 5: Cross-Entity Tenant Integrity (Hierarchical)
```

**Locked:** Layer definitions, security invariants, test patterns (A1-A10)

---

### 3. Evidence Standard

**Per-Capability:**
- P*.1: Write Flow (5 tests)
- P*.2: Tenant Isolation (10 tests, includes Layer 5)
- P*.3: Browser Runtime
- P*.4: Regression
- P*.5: Documentation + Seal

**Locked:** Test count, gate-based progression, evidence quality requirements

---

### 4. Execution Rules (7 Mandatory)

1. No discovery re-do
2. Test first, fix second
3. Evidence integrity maintained
4. No architecture changes for green tests
5. Gate-based progression
6. Authenticated testing only
7. Layer 5 required for hierarchical data

**Locked:** Process discipline, testing methodology

---

### 5. Key Principles

**Evidence vs. Implementation:**
```text
Working ≠ Verified
Verified = Working + Evidence
```

**Test Failure Protocol:**
```text
Failure → Freeze → RCA → Remediation → Rerun
NOT: Change test to make it pass
```

**Baseline Stability:**
```text
Baseline locked ≠ Design perfect
Baseline locked = Reference point for evidence
```

**Locked:** Core principles, philosophical approach

---

## 🚫 What Cannot Change (Without ACR)

### Prohibited Changes

❌ Reduce test count (5 → 3, 10 → 8)  
❌ Skip phases (P*.1 → P*.3 directly)  
❌ Remove Layer 5 tests (A9/A10)  
❌ Change from gate-based to percentage-based  
❌ Use service-role for isolation tests  
❌ Modify architecture to make tests pass  
❌ Remove Phase 5 integration requirement

---

## ✅ What Can Change (Without ACR)

### Permitted Adaptations

✅ Add supplementary tests (10 → 12 if needed)  
✅ Add evidence artifacts (more docs, screenshots)  
✅ Improve test implementation (better assertions, clearer output)  
✅ Add detailed sub-steps within phases  
✅ Enhance documentation clarity  
✅ Add tooling/automation (test runners, reporters)

**Principle:** Can strengthen evidence, cannot weaken it.

---

## 🔴 When Baseline Change IS Required

### Scenario 1: Design Invariant Proven Wrong

**Example:**
```text
Evidence proves Layer 5 cannot be enforced at database level.
Root cause: PostgreSQL RLS subquery limitation.
Impact: Layer 5 must move to service layer only.
```

**Action:**
1. Document evidence (test results, DB behavior)
2. Create Architecture Change Request (ACR)
3. Submit to Human Architect
4. If approved: Update baseline → new version (v1.1)
5. Re-verify affected capabilities

---

### Scenario 2: Scope Change

**Example:**
```text
New capability discovered (e.g., Contracts as separate entity).
Impact: 4 capabilities → 5 capabilities.
```

**Action:**
1. Document discovery
2. Create ACR with scope impact analysis
3. Human approval required
4. Update baseline version

---

### Scenario 3: Security Model Evolution

**Example:**
```text
New attack vector discovered requiring Layer 6.
Impact: 5-layer model → 6-layer model.
```

**Action:**
1. Document attack vector + mitigation
2. Create ACR
3. Human approval
4. Update baseline + re-verify sealed capabilities

---

## ✅ When Baseline Change NOT Required

### Scenario 1: Test Implementation Detail

**Example:**
```text
T1 test uses wrong assertion library.
Impact: Test logic same, implementation improved.
```

**Action:** Fix directly, document in test commit message.

---

### Scenario 2: Remediation Under Baseline

**Example:**
```text
P2.2 A9 test FAILS: Products allows cross-tenant parent.
Root cause: Missing Layer 5 enforcement.
```

**Action:**
```text
1. Freeze evidence (A9 FAIL documented)
2. RCA: Layer 5 not implemented
3. Remediation: Add CHECK constraint OR service validation
4. Rerun: A9 now PASS
5. Document in Products evidence report
```

**Baseline unchanged:** Layer 5 was REQUIRED, just not yet implemented.

---

### Scenario 3: Evidence Format Enhancement

**Example:**
```text
Add interactive HTML test report alongside markdown.
```

**Action:** Add enhancement, baseline principles unchanged.

---

## 📊 Current Baseline Status

```text
SESSION 2                    🔒 SEALED
RC BASELINE v1.0             🔒 LOCKED

Projects                     🔒 CLOSED (evidence complete)
Products                     ▶️ NEXT (P2.1 execution)
Customers                    ⚪ PENDING
Reservations                 🔒 CLOSED (evidence complete)
Phase 5 Integration          ⚪ PENDING

Bella Land v2 Final RC       ⏸️ NOT SEALED (evidence in progress)
```

---

## 🎯 Session 3 Execution Under Locked Baseline

### Mandate

**Action:** P2.1 Write Flow Testing

**Process:**
```text
1. Create test-product-creation.ts
2. Run 5 tests (T1-T5)
3. Document outcome (PASS/FAIL)
4. If PASS → P2.2
5. If FAIL → Freeze → RCA → Fix → Rerun
```

**Prohibited:**
- Change baseline to accommodate failure
- Reduce test count
- Skip phases
- Bypass security

**Permitted:**
- Fix implementation to meet baseline
- Add instrumentation for debugging
- Enhance test output clarity
- Document remediation

**Reference:** `SESSION_3_EXECUTION_BRIEF.md`

---

## 🔐 Baseline Integrity Guarantee

**Locked baseline ensures:**

1. **Consistency:** All capabilities judged by same standard
2. **Comparability:** Evidence quality objective, not subjective
3. **Stability:** No moving goalposts during execution
4. **Trust:** RC seal means something concrete
5. **Reproducibility:** Future verifications use same criteria

**Failure under baseline proves:**
- Implementation gap (fix implementation)
- OR baseline flaw (evidence + ACR required)

**NOT:** "Baseline too strict, let's reduce requirements"

---

## 📌 Version Control

**Current Version:** v1.0  
**Date Locked:** 2026-09-11  
**Session Locked:** 2  
**Status:** 🔒 **LOCKED / CHANGE-CONTROLLED**

**Change Control:**

```text
RC BASELINE v1.0

Status                🔒 LOCKED / CHANGE-CONTROLLED
Direct modification   ❌ PROHIBITED
Implementation fix    ✅ ALLOWED (to meet baseline)
Baseline exception    ⚠️ ACR REQUIRED
Baseline revision     ⚠️ ACR + APPROVAL
Audit history         ✅ PRESERVED
```

**Future versions:**
- v1.1: If ACR approved (scope/design change based on evidence)
- v2.0: Major program restructure (if evidence proves fundamental flaw)

**Versioning principle:** Increment = evidence-backed change, not convenience.

**Core principle:**
```text
Test fail → Fix implementation (not baseline)
Baseline change → Only if evidence proves baseline wrong
```

---

## ✅ Confirmation Checklist

**Baseline Lock Confirmed:**

- [x] Document created: `RC_BASELINE_OFFICIAL.md`
- [x] Version: v1.0
- [x] Session 2 sealed
- [x] 5-layer model defined
- [x] Evidence standard documented
- [x] Execution rules locked (7 rules)
- [x] Phase structure locked (4 + Phase 5)
- [x] Test patterns locked (A1-A10)
- [x] Change control defined (ACR required)
- [x] Session 3 brief ready

**Result:** 10/10 confirmed

---

## 🔒 Final Declaration

```text
╔═══════════════════════════════════════════════════════════╗
║                                                            ║
║    RC BASELINE v1.0 — LOCK CONFIRMED & CHANGE-CONTROLLED   ║
║                                                            ║
║  From this point forward:                                  ║
║                                                            ║
║  ✅ Baseline is reference point for ALL evidence           ║
║  ✅ Test failures addressed by remediation (not baseline)  ║
║  ✅ Baseline changes require ACR + approval + evidence     ║
║  ✅ Evidence integrity > test convenience                  ║
║  ✅ Working + Evidence = Verified                          ║
║  ✅ Audit trail preserved for all versions                 ║
║                                                            ║
║  Baseline owner:    Bella AI System                        ║
║  Approved by:       User (Session 2)                       ║
║  Lock date:         2026-09-11                             ║
║  Governance:        LOCKED / CHANGE-CONTROLLED             ║
║  Signature:         BASELINE-V1.0-LOCKED-20260911          ║
║                                                            ║
╚═══════════════════════════════════════════════════════════╝
```

---

**Document:** `BASELINE_LOCK_CONFIRMATION.md`  
**Status:** 🔒 **LOCKED / CHANGE-CONTROLLED**  
**Governance:** ACR required for baseline changes  
**Next:** → **Session 3: P2.1 Execution Under Baseline v1.0**

