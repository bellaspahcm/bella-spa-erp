# ADR-010: Phase 0 Platform-of-Platforms Refactor

**Status:** Accepted  
**Date:** 2026-08-07  
**Deciders:** Platform Team, Healthcare Platform Team  
**Constitution Compliance:** Laws 2, 3, 5, 7, 8, 9, 11

---

## Context

Bella Hospital architecture audit (2026-08-07) revealed **critical misalignment** with Platform-of-Platforms principles:

### Problems Identified

1. **Engine Location Violation (Law 3)**
   - Engines (`BedEngineService`, `NursingVitalsService`, `MARService`) located in Hospital services
   - Should be in Healthcare Platform, NOT Hospital Product Pack
   - Current path: `src/services/healthcare-hospital-services.ts` ❌
   - Target path: `src/platform/healthcare/engines/` ✅

2. **Direct DB Access (Law 2)**
   - Hospital pages query Supabase directly
   - Bypasses engine abstraction layer
   - Violates zero-regression guarantee

3. **Missing Host Platform Services (Law 7, 8, 9)**
   - ❌ Contract Registry incomplete
   - ❌ Feature Flag Platform missing
   - ❌ Healthcare Platform directory not created

4. **Type Safety Violations (Law 11)**
   - 819 `any` type violations found
   - No ESLint enforcement
   - No pre-commit hooks

### Constitution Compliance Gap

**Current:** 64/100 (7/11 laws)  
**Target:** 91/100 (10/11 laws)  
**Timeline:** 6 weeks (Phase 0)

---

## Decision

We will execute **Phase 0: Platform-of-Platforms Refactor** to achieve Constitution compliance.

### Architecture Changes

#### Before (Monolithic Hospital)
```
Hospital
├── Services (BedEngineService, NursingVitalsService, MARService) ❌
├── Pages (direct Supabase queries) ❌
└── Components
```

#### After (Platform-of-Platforms)
```
Host Platform (Foundation)
├── Contract Registry
├── Capability Registry
├── Feature Flags
├── Event Bus
└── IAM, Notification, Workflow, Policy, AI, Metadata, Integration

Healthcare Platform (Industry-Specific Engines)
├── Bed Engine ✅
├── Nursing Engine ✅
├── Pharmacy Engine (MAR) ✅
├── MPI Engine
├── Encounter Engine
├── Clinical Engine
├── Order Engine
├── Billing Engine
└── ... (13 total)

Hospital (Product Pack)
├── Pages (consume engines via hooks) ✅
├── Components
└── Workflows (no direct DB access) ✅
```

### Key Principles

1. **Hospital is NOT a Platform** - Hospital is a Product Pack consuming Healthcare Platform engines
2. **Engines in Healthcare Platform** - All domain engines move to `src/platform/healthcare/engines/`
3. **Contract-First Development** - All engines expose versioned contracts
4. **Zero Direct DB Access** - Product Packs NEVER query Supabase directly
5. **Feature Flag Isolation** - New architecture behind feature flag, gradual rollout

---

## Implementation Plan

### Week 1: Foundation (DONE ✅)
- ✅ Create Healthcare Platform directory structure (13 engines)
- ✅ Create Host Platform organization (11 services)
- ✅ Implement Contract Registry Service
- ✅ Implement Feature Flag Platform
- ✅ Create shared-kernel types (30+ domain models)

### Week 2: Documentation
- ✅ Create ADR-010 (this document)
- Establish ARB (Architecture Review Board) process
- Update all architecture docs with new structure

### Week 3-4: Engine Extraction (70% - Placeholder)
- Create Bed Engine placeholder (`src/platform/healthcare/engines/bed-engine/`)
- Create Nursing Engine placeholder
- Create Pharmacy Engine placeholder
- Register contracts in Contract Registry
- Add feature flag: `healthcare.new-engine-architecture`

### Week 4: Hospital Refactor (70% - Templates)
- Create engine hook templates (`use-bed-engine.ts`, `use-nursing-engine.ts`)
- Document migration pattern for Hospital pages
- Keep dual-path support (old services + new engines)

### Week 5: Type Safety (Scan Only)
- Create script to scan `any` type violations
- Generate violation report
- Add ESLint rule (disabled by default)
- Document remediation plan (40-60 hours effort)

### Week 6: Events + Audit
- Add Event Bus integration examples
- Create final Constitution compliance report
- Update AGENTS.md with new rules
- Architecture freeze approval

---

## Consequences

### Positive

1. **Constitution Compliance:** 64/100 → 91/100 (10/11 laws)
2. **Zero Regression:** New architecture behind feature flag, safe rollout
3. **Scalability:** Healthcare Platform reusable for Clinic, Pharmacy, Lab, Home Care
4. **Maintainability:** Clear separation of concerns (Host → Platform → Product)
5. **Type Safety:** Path to eliminate all `any` types
6. **Contract Governance:** All APIs versioned and validated

### Negative

1. **Migration Effort:** 6 weeks full-time implementation
2. **Dual-Path Complexity:** Maintain old services + new engines temporarily
3. **Learning Curve:** Team must learn contract-first development
4. **Testing Overhead:** Test both old and new paths during transition

### Risks

1. **Breaking Changes:** Engine extraction may break Hospital features
   - **Mitigation:** Feature flag rollout, extensive testing
2. **Performance Regression:** Contract validation overhead
   - **Mitigation:** Caching, optimization, monitoring
3. **Type Safety Cleanup:** 819 violations = 40-60 hours effort
   - **Mitigation:** Prioritize critical paths first, incremental fixes

---

## Alternatives Considered

### Alternative 1: Keep Hospital Monolithic
- **Pros:** No migration effort, zero risk
- **Cons:** Violates Constitution, cannot scale to multi-product
- **Rejected:** Does not meet 10-20 year architecture freeze requirement

### Alternative 2: Big-Bang Migration
- **Pros:** Clean cut, no dual-path complexity
- **Cons:** High risk, long production freeze, no rollback
- **Rejected:** Violates Zero Regression Guarantee (Law 9)

### Alternative 3: Partial Refactor (Engines Only)
- **Pros:** Lower effort, faster completion
- **Cons:** Still violates Laws 7, 8, 9 (missing Host Platform services)
- **Rejected:** Incomplete foundation, technical debt

---

## Success Criteria

### Week 1-2 (Foundation)
- ✅ Healthcare Platform directory created
- ✅ Contract Registry Service implemented
- ✅ Feature Flag Platform implemented
- ✅ ADR-010 documented

### Week 3-4 (Engine Extraction)
- [ ] 3 engines extracted (Bed, Nursing, Pharmacy)
- [ ] Contracts registered
- [ ] Feature flag created: `healthcare.new-engine-architecture`
- [ ] Dual-path support verified

### Week 5 (Type Safety)
- [ ] `any` violation report generated
- [ ] ESLint rule added
- [ ] Remediation plan documented

### Week 6 (Completion)
- [ ] Event Bus integration examples
- [ ] Constitution compliance: 91/100
- [ ] Architecture freeze approved
- [ ] Phase B (OR, ICU, ED, Blood Bank) planning started

---

## Related ADRs

- **ADR-001:** Bella Platform Constitution (11 Laws)
- **ADR-002:** Encounter as Aggregate Root (Law 1)
- **ADR-003:** Capability-First Enforcement (Law 7)
- **ADR-004:** Event-First Architecture (Law 5)
- **ADR-005:** Contract Registry Design (Law 8)
- **ADR-009:** Zero Regression Guarantee (Law 9)
- **ADR-010:** Phase 0 Platform Refactor (this document)

---

## References

- [Bella Hospital Enterprise Architecture](../BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md)
- [Platform-of-Platforms Constitution](../BELLA_ENTERPRISE_PLATFORM_INTEGRATION.md)
- [Phase 0 Roadmap](../PHASE_0_PLATFORM_REFACTOR_ROADMAP.md)
- [Phase 0 Current Status Audit](../PHASE_0_CURRENT_STATUS_AUDIT.md)

---

## Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Architecture Owner** | Platform Team | ✅ Approved | 2026-08-07 |
| **Product Owner** | Hospital Product Team | ⏳ Pending | - |
| **Engineering Lead** | Healthcare Platform Team | ✅ Approved | 2026-08-07 |
| **Constitution Reviewer** | ARB (Architecture Review Board) | ⏳ Pending | - |

---

**Status:** ✅ ACCEPTED (Foundation Complete, Extraction in Progress)  
**Next Review:** 2026-08-14 (Week 2 Checkpoint)  
**Architecture Freeze Target:** 2026-09-18 (Week 6 Completion)
