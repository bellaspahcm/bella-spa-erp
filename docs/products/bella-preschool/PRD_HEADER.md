# Bella Preschool — Commercial Product Baseline PRD

**Version:** 1.0  
**Date:** September 7, 2026  
**Status:** EXECUTION CONTRACT  
**Purpose:** Transform verified foundation → demo-ready + sales-ready + commercially usable product

---

## Objective

Build a **market-standard preschool management system** that is:
- ✅ Demo-ready from day 1
- ✅ Sales-ready (can show prospects immediately)
- ✅ Commercially usable (real schools can operate)
- ✅ Production UI quality
- ✅ Coherent single-product experience

**NOT waiting for customer requirements** — building market-standard baseline based on:
- OneKids, KidsOnline, NextX, Cubaroo market analysis
- Verified Phase 2A foundation (18/18 tests PASS)
- Bella Platform reuse principles

---

## Product Scope Overview

```text
P3 — Core Operations
     └─ Foundation for all workflows
     
P4 — Preschool Care  
     └─ Differentiation from generic student management
     
P5 — Tuition & Finance
     └─ Commercial viability
     
P6 — Parent Experience
     └─ Modern preschool expectation
     
P7 — School Management
     └─ Staff operations
     
P8 — Commercial Readiness
     └─ Demo + deployment ready
```

---

## Implementation Protocol

After PRD consistency review:

```text
PRD → P3.1 Student/Guardian → VERIFY
    → P3.2 Classroom/Teacher → VERIFY  
    → P3.3 Attendance → VERIFY
    → P3.4 Dashboard → VERIFY
    → P4 Daily Care → VERIFY
    → P5 Tuition → VERIFY
    → P6 Parent → VERIFY
    → P7 Management → VERIFY
    → P8 Polish → VERIFY
```

**Verification for each capability:**
- Inspect Platform reuse
- Implement backend (if needed)
- Unit/contract tests
- UI integration
- Real-auth runtime test
- Persistence verification
- Authorization/RLS verification
- Critical E2E
- Evidence collected
- Continue

**No manual approval needed between steps unless:**
- Architecture boundary changes
- Platform Core modification required
- Security model must change
- Destructive migration needed
- Requirement ambiguous
- Evidence contradicts PRD

---

## Locked Boundaries

**DO NOT:**
- ❌ Create Education OS
- ❌ Create Education Kernel
- ❌ Redesign Platform Core
- ❌ Duplicate Finance/Auth/Audit infrastructure
- ❌ Build speculative AI features
- ❌ Weaken RLS or tenant isolation
- ❌ Change tests to obtain PASS

**DO:**
- ✅ Mark reusable capabilities as `EXTRACTION_CANDIDATE`
- ✅ Keep in Product layer during build
- ✅ Reuse Platform capabilities
- ✅ Build production-quality UI
- ✅ Maintain demo dataset

---

## Definition of Done

A capability is DONE when:
- ✅ Requirement implemented
- ✅ UI functional
- ✅ Business behavior correct
- ✅ Data persists
- ✅ Authorization verified
- ✅ Security verified (RLS where applicable)
- ✅ Critical E2E passes
- ✅ Evidence collected

A phase is DONE when:
- ✅ All capabilities DONE
- ✅ Critical workflows usable through production UI
- ✅ Can demo to prospects
- ✅ Can be deployed to customers

**Final product target:**
> A realistic preschool can be configured, operated, demonstrated, and deployed without test-only interfaces.

---

See individual phase PRDs:
- [P3: Core Operations](./PRD_P3_CORE_OPERATIONS.md)
- [P4: Preschool Care](./PRD_P4_PRESCHOOL_CARE.md)
- [P5: Tuition & Finance](./PRD_P5_TUITION_FINANCE.md)
- [P6: Parent Experience](./PRD_P6_PARENT_EXPERIENCE.md)
- [P7: School Management](./PRD_P7_SCHOOL_MANAGEMENT.md)
- [P8: Commercial Readiness](./PRD_P8_COMMERCIAL_READINESS.md)
- [Dependencies & Implementation Order](./PRD_DEPENDENCIES.md)
