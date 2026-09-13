# Bella Land v2 — RC Evidence Program (Official Baseline)

**Date:** 2026-09-11  
**Session:** 2 (Sealed)  
**Status:** 🔒 **BASELINE LOCKED**

---

## 🎯 Program Structure

```text
╔═══════════════════════════════════════════════════════════╗
║      BELLA LAND V2 — RC EVIDENCE PROGRAM                   ║
╚═══════════════════════════════════════════════════════════╝

CAPABILITY CLOSURE (Individual Entity Verification)

Phase 1 — Projects
🔒 VERIFIED + CLOSED

Phase 2 — Products
🟡 EVIDENCE CLOSURE NEXT
├─ P2.1 Write Flow
├─ P2.2 Tenant Isolation + Layer 5
├─ P2.3 Browser Runtime
├─ P2.4 Regression
└─ P2.5 Seal

Phase 3 — Customers
⚪ PENDING

Phase 4 — Reservations
🔒 VERIFIED + CLOSED

───────────────────────────────────────────────────────────

INTEGRATION CLOSURE (Cross-Capability Verification)

Phase 5 — Cross-Capability Business Flow
⚪ PENDING (after all capabilities closed)

Project
   ↓ create
Product / Apartment
   ↓ assign
Customer
   ↓ reserve
Reservation
   ↓ verify
DB persistence + Tenant integrity + Cross-entity integrity

───────────────────────────────────────────────────────────

FINAL RC SEAL
⏸️ NOT SEALED (evidence program in progress)
```

---

## 🔐 5-Layer Security Model (Universal)

**Applies to ALL capabilities, verified at each phase.**

```text
╔═══════════════════════════════════════════════════════════╗
║           BELLA LAND V2 — 5-LAYER DEFENSE MODEL            ║
╚═══════════════════════════════════════════════════════════╝

Layer 1: Type Boundary (Client)
├─ Client cannot send tenant_id
└─ Type system enforces Omit<Insert, 'tenant_id'>

Layer 2: Server/Auth Boundary (Action)
├─ getCurrentUser() validates auth.uid()
├─ Extracts tenant_id from membership table
└─ Rejects requests without valid session

Layer 3: Service Boundary (Business Logic)
├─ Validates tenant_id required
├─ Business validation (field rules)
└─ Explicit tenant_id injection into INSERT

Layer 4: Row-Level RLS (Database)
├─ USING clause filters SELECT to own tenant
├─ WITH CHECK validates INSERT/UPDATE tenant_id
└─ Cross-tenant forgery blocked

Layer 5: Cross-Entity Tenant Integrity (Hierarchical)
├─ Validates parent entity tenant matches child
├─ Blocks cross-tenant parent reference
└─ Enforced via service validation / CHECK constraint / RLS subquery
```

**Critical distinction:**

- **Layers 1-4:** Protect individual row tenant isolation
- **Layer 5:** Protects relationship tenant integrity

**Example failure scenario WITHOUT Layer 5:**

```text
Layers 1-4 PASS:
├─ Product.tenant_id = A  ✅ (RLS enforced)
└─ User authenticated as Tenant A  ✅

Layer 5 FAIL:
└─ Product.project_id → Project.tenant_id = B  ❌ VIOLATION

Result: Cross-tenant data leakage via parent reference
```

**Verification:**
- **Layers 1-4:** Tests A1-A8 (standard RLS)
- **Layer 5:** Tests A9-A10 (cross-entity integrity)

---

## 📊 Evidence vs. Implementation

### Critical Clarification

**"Products evidence gap 85-90%" means:**
- ✅ Products MAY be fully implemented
- ✅ Products MAY work correctly in production
- ❌ Evidence to PROVE correctness does NOT exist

**Evidence gap ≠ Implementation gap**

```text
Product Implementation:     🟢 92–95% (likely works)
Product Evidence:           🔴 15% (not proven)

Gap to close:              🟡 Evidence, not implementation
```

**Why this matters:**
- Product might be secure → but NOT VERIFIED
- Product might have RLS → but NOT TESTED with authenticated users
- Product might block cross-entity forgery → but NO TEST PROVES IT

**RC Program Principle:**

```text
Working ≠ Verified
Verified = Working + Evidence
```

**Session 3 approach:**
1. Run P2.1 tests → MAY PASS (product works) or FAIL (product broken)
2. If PASS: Evidence now exists ✅, move to P2.2
3. If FAIL: Freeze evidence → RCA → Remediation → Rerun
4. Do NOT change architecture to make tests pass

---

## 🎯 Capability Closure Criteria

### Per-Capability Evidence Standard

Each capability MUST have:

**P*.1: Production Write Flow (5 tests)**
- T1: Create entity via service layer
- T2: Field semantics (5+ fields)
- T3: Reload/read-back
- T4: Tenant injection verified
- T5: Parent relationship (if applicable)

**P*.2: Tenant Isolation (10 tests)**
- A1-A8: Standard RLS (Layers 1-4)
- A9-A10: Cross-entity integrity (Layer 5, if parent entity exists)

**P*.3: Browser Runtime**
- Manual UI test (authenticated)
- Screenshot evidence
- DB verification

**P*.4: Regression**
- Re-run P*.1 after any fixes
- No breaks introduced

**P*.5: Documentation + Seal**
- Evidence report
- Phase seal document
- RC tracker update

**Success criteria:** ALL sub-phases PASS (gate-based, not averaging)

---

## 🔗 Integration Closure Criteria (Phase 5)

### Cross-Capability Business Flow

**Scope:**

```text
E2E Real Estate Sales Workflow

Step 1: Project Creation (Tenant A)
Step 2: Product/Apartment Creation (Tenant A, under Project A)
Step 3: Customer Onboarding (Tenant A)
Step 4: Reservation Creation (Tenant A: Customer → Product)
Step 5: State Transitions (Product: available → booked)
Step 6: Cross-Tenant Isolation (Tenant B sees NONE)
```

**Verifications:**
1. All entities created with correct tenant_id
2. Foreign keys reference valid parents
3. Parents belong to same tenant (Layer 5)
4. State transitions propagate
5. Data persists
6. Cross-tenant access blocked

**Test method:**
- Authenticated script (multi-step)
- Browser workflow
- Multi-tenant negative testing

**Deliverable:** `FINAL_BUSINESS_FLOW_VERIFICATION.md`

---

## 📋 Phase Execution Rules

### Baseline Rules (Non-Negotiable)

**Rule 1: No Discovery Re-do**
```text
Discovery done once per capability.
Do NOT re-discover schema/architecture during testing.
```

**Rule 2: Test First, Fix Second**
```text
Run tests → Capture outcome (PASS/FAIL)
If FAIL → Freeze evidence → RCA → Fix → Rerun
Do NOT modify code before running tests.
```

**Rule 3: Evidence Integrity**
```text
Test failure = Evidence
Do NOT delete/hide failing test results.
Document failure → Root cause → Remediation → Retest.
```

**Rule 4: No Architecture Changes for Green Tests**
```text
If test FAILS, analyze root cause.
Fix implementation, NOT architecture.
Do NOT bypass security checks to make tests pass.
```

**Rule 5: Gate-Based Progression**
```text
P*.1 PASS → Move to P*.2
P*.2 PASS → Move to P*.3
ANY FAIL → Freeze + RCA
Do NOT skip phases.
```

**Rule 6: Authenticated Testing Only**
```text
All isolation tests MUST use authenticated users.
service-role bypass ONLY for DB evidence/debugging.
Document when service-role used and why.
```

**Rule 7: Layer 5 Required for Hierarchical Data**
```text
If entity has parent relationship:
├─ A1-A8 (Layers 1-4) NOT sufficient
├─ A9-A10 (Layer 5) REQUIRED
└─ Test cross-entity tenant integrity
```

---

## 🔒 Current Baseline Status

### Capability Closure

| Phase | Capability | Status | Evidence |
|-------|------------|--------|----------|
| **P1** | Projects | 🔒 CLOSED | 10/10 gates, HIGH quality |
| **P2** | Products | 🟡 ACTIVE | 15% evidence (gap closure in progress) |
| **P3** | Customers | ⚪ PENDING | Blocked by P2 |
| **P4** | Reservations | 🔒 CLOSED | 4/4 regression, prior work |

### Integration Closure

| Phase | Scope | Status | Evidence |
|-------|-------|--------|----------|
| **P5** | Business Flow | ⚪ PENDING | After all capabilities closed |

### Security Model

| Layer | Description | Status |
|-------|-------------|--------|
| **L1** | Type boundary | ✅ Verified (Projects) |
| **L2** | Auth boundary | ✅ Verified (Projects) |
| **L3** | Service boundary | ✅ Verified (Projects) |
| **L4** | Row-level RLS | ✅ Verified (Projects, Reservations) |
| **L5** | Cross-entity integrity | 🟡 Model defined, NOT tested (Products next) |

---

## 📍 Session 3 Execution Mandate

### Starting Point

```text
P2.1 Write Flow Testing — CREATE test-product-creation.ts
```

**No:**
- ❌ Discovery (already done)
- ❌ Architecture review
- ❌ Projects re-verification
- ❌ Gap re-analysis

**Yes:**
- ✅ Create test script
- ✅ Execute 5 tests (T1-T5)
- ✅ Document outcome (PASS/FAIL)
- ✅ If FAIL → RCA

### Execution Flow

```text
P2.1 RUN
    ↓
PASS? ──YES──→ P2.2 (Isolation + Layer 5)
    │
   NO
    ↓
Freeze Evidence
    ↓
Root Cause Analysis
    ↓
Remediation (minimal fix)
    ↓
P2.1 RERUN
    ↓
PASS? ──YES──→ P2.2
    │
   NO
    ↓
Document Blocker → User Decision
```

### Success Criteria

**P2.1:** 5/5 tests PASS  
**P2.2:** 10/10 tests PASS (includes A9/A10)  
**P2.3:** Browser test PASS + screenshot  
**P2.4:** Regression PASS (P2.1 rerun after fixes)  
**P2.5:** Documentation + seal

**Gate requirement:** ALL phases PASS before seal

---

## 🎯 RC Final Seal Criteria

```text
╔═══════════════════════════════════════════════════════════╗
║        BELLA LAND V2 — RC FINAL SEAL CRITERIA              ║
╚═══════════════════════════════════════════════════════════╝

Capability Evidence:
├─ Projects            🔒 VERIFIED (P1.0–P1.5)
├─ Products            🔒 VERIFIED (P2.0–P2.5)
├─ Customers           🔒 VERIFIED (P3.0–P3.5)
└─ Reservations        🔒 VERIFIED (Prior + regression)

Integration Evidence:
└─ Business Flow       🔒 VERIFIED (P5.1–P5.4)

Security Model:
├─ Layers 1-4          ✅ ALL capabilities verified
└─ Layer 5             ✅ Hierarchical data verified

Quality:
├─ Test scripts        ✅ ALL capabilities + integration
├─ Browser runtime     ✅ ALL capabilities + integration
├─ Documentation       ✅ Complete
└─ Regression          ✅ No breaks

───────────────────────────────────────────────────────────
VERDICT:               ✅ RC READY
FINAL RC STATUS:       🔒 SEALED
───────────────────────────────────────────────────────────
```

**Final document:** `BELLA_LAND_V2_RC_FINAL_SEAL.md`

---

## 📌 Baseline Version Control

**Version:** 1.0  
**Date:** 2026-09-11  
**Session:** 2  
**Status:** 🔒 **BASELINE LOCKED**

**Changes from baseline require:**
1. Architecture Change Request (ACR)
2. Human Architect approval
3. Evidence program impact analysis
4. Baseline version update

**Current baseline applies to:**
- Session 3: Products (P2.1–P2.5)
- Session 4: Customers (P3.0–P3.5)
- Session 5: Integration (P5.1–P5.4)
- Session 6: Final Seal

---

**Baseline Owner:** Bella AI System  
**Approval:** User confirmed Session 2  
**Signature:** `RC-BASELINE-V1.0-20260911`

