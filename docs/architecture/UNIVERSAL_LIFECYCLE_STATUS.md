# Universal Lifecycle — Current Status

**Last Updated:** 2026-09-09  
**Status:** `PHASE 2 COMPLETE — AWAITING ARCHITECT DECISION`  

---

## Quick Summary

Universal Lifecycle hypothesis has been validated through **Rule-of-Three evidence** (Healthcare, Logistics, Preschool) and **adversarial falsification testing** (Surgical Case, Prescription, Inventory).

**Key Finding:** A minimal lifecycle kernel CAN provide shared mechanism, BUT has critical compile-time safety concerns for safety-critical workflows.

---

## Evidence Quality

| Phase | Status | Confidence |
|-------|--------|------------|
| **Phase 1: Rule-of-Three** | ✅ COMPLETE | HIGH (52 Healthcare tests + 547 Logistics tests) |
| **Phase 2: Falsification** | ✅ COMPLETE | HIGH (3 adversarial cases tested) |
| **Phase 3: Cost Analysis** | ⏳ NOT EVALUATED | Awaiting architectural direction decision |
| **Phase 4: Migration** | ⏳ NOT EVALUATED | Awaiting architectural direction decision |
| **Phase 5: ADR** | ⏳ NOT EVALUATED | Awaiting architectural direction decision |

---

## Promotion Gates

| Gate | Criteria | Status |
|------|----------|--------|
| **G1: Domain Coverage** | ≥3 independent domains | ✅ PASS (Healthcare, Logistics, Preschool) |
| **G2: Semantic Overlap** | Core invariants match | ✅ PASS (state machines, guards, evidence) |
| **G3: Real Duplication** | Code duplication exists | ✅ PASS (~2100-3950 LOC) |
| **G4: Cost Justified** | Abstraction cost < duplication | ⏳ NOT EVALUATED (awaiting direction) |
| **G5: Migration Feasible** | Low regression risk | ⏳ NOT EVALUATED (awaiting direction) |

---

## What CAN Be Standardized

✅ State machine definition (states, transitions, terminal states)  
✅ Guard mechanism (precondition checks)  
✅ Authority requirements (who can trigger)  
✅ Evidence requirements (what proof needed)  
✅ Audit trail (provenance tracking)  

---

## What CANNOT Be Standardized

❌ Parallel state composition (complexity explosion)  
❌ Quantity-aware semantics (domain-specific invariants)  
❌ Side effects (domain-specific business logic)  
❌ Domain-specific transition coupling  

---

## Critical Open Issue

🔴 **Compile-Time Safety for Mandatory Guards**

Current kernel hypothesis allows empty guard arrays, creating risk that safety blocks can be accidentally bypassed:

```typescript
// ❌ UNSAFE: Compiles fine but bypasses anesthesia consent check
{
  from: 'PREOP_READY',
  to: 'ANESTHETIZED',
  guards: [], // Developer forgot guard — safety block bypassed!
}
```

**Risk:** Abstraction becomes **weaker execution path** than current inline implementation.

---

## Architectural Decision Required

> **Bella có thực sự cần một shared lifecycle execution kernel, hay chỉ cần một shared lifecycle contract/specification + validation pattern?**

### Option A: Shared Execution Kernel

**Build:** Runtime abstraction with centralized guard enforcement  
**Pros:** Standardized behavior, reduced duplication  
**Cons:** Compile-time safety risk, safety-critical code in shared runtime  
**Next Step:** Solve compile-time safety issue (builder pattern, type-level enforcement)  

### Option B: Shared Contract/Specification

**Build:** Design pattern + validation utilities, NOT runtime engine  
**Pros:** Domain retains control, compile-time safety preserved, audit/validation still standardized  
**Cons:** Some duplication remains  
**Next Step:** Document lifecycle contract specification, create validation utilities  

### Option C: Hybrid Approach

**Build:** Kernel for non-critical lifecycles only (Bed, Item, Location), inline for critical (Surgical, Prescription)  
**Pros:** Balance standardization and safety  
**Cons:** Two patterns coexist  
**Next Step:** Define criteria for kernel vs. inline, proceed with non-critical lifecycles  

---

## Evidence Documents

- **Full Evidence:** `docs/architecture/LIFECYCLE_EVIDENCE_HEALTHCARE_LOGISTICS.md`
- **Discovery:** `docs/architecture/PLATFORM_CAPABILITY_DISCOVERY_PRESCHOOL.md`

---

## Investigation Status

```
UNIVERSAL LIFECYCLE CANDIDATE
────────────────────────────────────────
Phase 1 — Evidence Collection       ✅ COMPLETE
Phase 2 — Falsification             ✅ COMPLETE

Rule-of-Three                       ✅ VALIDATED
G1 Domain Coverage                  ✅ PASS
G2 Semantic Overlap                 ✅ PASS
G3 Real Duplication                 ✅ PASS
G4 Cost Justification               ⏳ NOT EVALUATED
G5 Migration Feasibility            ⏳ NOT EVALUATED

Minimum common boundary             ✅ IDENTIFIED
Parallel composition                ❌ REJECTED
Domain-specific invariants          🔒 DOMAIN OWNED
Compile-time safety                 🔴 OPEN

ADR                                 ❌ NOT OPENED
Platform Standard                   ❌ NOT APPROVED

Overall:
⏸️ PAUSED — EVIDENCE SUFFICIENT FOR
   FUTURE ARCHITECTURAL DECISION
```

---

## Knowledge Captured

This investigation has produced valuable architectural knowledge:

✅ **Lifecycle pattern is real** — Rule-of-Three validated across Healthcare, Logistics, Preschool  
✅ **Common mechanism exists** — Minimum kernel boundary identified  
✅ **Complexity boundaries clear** — Parallel composition rejected, domain invariants stay domain-owned  
✅ **Critical risk identified** — Compile-time safety for mandatory guards  

**No immediate action required.** This knowledge is available for future architectural decisions when business/product context makes Universal Lifecycle standardization a priority.

---

## If/When Resumed

Should Bella decide to pursue Universal Lifecycle standardization in the future, three options exist:

**Option A: Shared Execution Kernel** — Runtime abstraction with centralized enforcement  
**Option B: Shared Contract/Specification** — Design pattern documentation without runtime engine  
**Option C: Hybrid Approach** — Kernel for simple lifecycles, inline for critical  

Next steps would be:
1. Choose architectural direction (A, B, or C)
2. If A or C: Solve compile-time safety issue
3. Execute G4 (Cost Analysis) and G5 (Migration Feasibility)
4. Open ADR if justified

---

**Status:** ⏸️ **PAUSED — No further action required at this time**
