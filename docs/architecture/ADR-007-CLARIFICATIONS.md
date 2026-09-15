# ADR-007 Clarifications — Platform vs Beauty-Shared vs Product-Specific

**Date:** 2026-09-15  
**Status:** ✅ **APPROVED CLARIFICATIONS**  
**Related:** ADR-007 (Platform Contract Extraction Principles)

---

## Purpose

ADR-007 established 3-phase extraction methodology. This document clarifies **three critical distinctions** to prevent over-abstraction:

1. **Beauty-shared ≠ Platform** (domain boundary)
2. **Projected consumer ≠ Validated consumer** (evidence rigor)
3. **Example ≠ Decision** (ADR examples are illustrations, not contracts)

---

## Clarification 1: Beauty-Shared ≠ Platform

### Problem

**ADR-007 states:**
> "Contract must fit Spa + Haircut + Nail = Platform contract"

**Risk:** Spa, Haircut, Nail are **all Beauty Services domain**. Fitting 3 Beauty products does NOT automatically mean Platform.

---

### Corrected Classification Ladder

```
Evidence Level 1: Single Product
Spa only
    ↓
Product-specific capability
(NOT reusable)

Evidence Level 2: Beauty Domain (Spa + Haircut + Nail)
Fits Spa + Haircut + Nail
    ↓
Beauty-shared capability PROVEN
    ↓
    ├── Beauty-specific semantics detected
    │      → Beauty Capability Contract
    │      → Location: src/platform/beauty/contracts/
    │
    └── Domain-neutral semantics + no Beauty coupling
           → Platform Contract CANDIDATE
           → Location: src/platform/contracts/ (provisional)
                ↓
           Need cross-vertical validation
                ↓
           Healthcare OR Auto OR Education consumer added
                ↓
           Platform Contract CONFIRMED
```

---

### Examples

**Example 1: IServiceCatalog**

**Current Status:**
- ✅ Fits Spa (adapter proven)
- ✅ Fits Haircut (implementation planned)
- ✅ Fits Nail (projection validated)
- ❌ No Healthcare/Auto/Education consumer

**Classification:**
- **NOT:** Platform Contract (lacks cross-vertical validation)
- **IS:** Platform Contract **CANDIDATE** (Beauty-validated, pending cross-vertical)
- **Location:** `src/platform/contracts/v1/` (provisional, may move to Beauty layer)

**Promotion Criteria:**
- Add Healthcare treatment catalog consumer, OR
- Add Auto service catalog consumer, OR
- Add Education course catalog consumer
- **THEN:** Platform Contract CONFIRMED

---

**Example 2: IWaitlistEngine**

**Current Status:**
- ✅ Fits Spa (walk-in queue)
- ✅ Fits Haircut (walk-in queue)
- ✅ Fits Nail (walk-in queue)
- ✅ Generic semantics (time-based queue, no Beauty coupling)
- ✅ Cross-vertical use cases identified (Healthcare clinic queue, Auto service queue, Education enrollment queue)

**Classification:**
- **IS:** Platform Contract (temporal capability, cross-vertical semantics)
- **Location:** `src/platform/contracts/v1/` (confirmed)

**Why Platform:**
- Temporal primitive (time-based queue management)
- No Beauty-specific semantics (queue, entry, position are generic)
- Applicable to multiple verticals (Healthcare, Auto, Education waitlists)

---

**Example 3: Hypothetical `IBeautyTreatmentProtocol`**

**Hypothetical Status:**
- ✅ Fits Spa (treatment protocols for facial, massage)
- ✅ Fits Haircut (treatment protocols for hair coloring)
- ✅ Fits Nail (treatment protocols for nail art)
- ❌ Beauty-specific semantics (treatment, protocol specific to beauty services)

**Classification:**
- **NOT:** Platform Contract (Beauty-specific)
- **IS:** Beauty Capability Contract
- **Location:** `src/platform/beauty/contracts/` (Beauty domain layer)

**Why Beauty-only:**
- Treatment protocol = Beauty-specific concept
- No cross-vertical applicability (Healthcare has clinical protocols, NOT beauty treatment protocols)

---

### Clarified Rule

**Spa + Haircut + Nail validation proves:**
- ✅ Beauty-shared capability (reusable within Beauty domain)

**To claim Platform Contract, MUST additionally prove:**
- ✅ Domain-neutral semantics (no Beauty-specific concepts)
- ✅ Cross-vertical applicability (use cases identified in non-Beauty verticals)
- ✅ Cross-vertical consumer validation (actual Healthcare/Auto/Education consumer)

**Platform ownership criteria (from ADR-007, still valid):**
1. ✅ Semantic genericity (generic types, no vertical-specific semantics)
2. ✅ Multiple vertical consumers (2+ **different verticals**, not just same vertical)
3. ✅ Cross-domain validation (use cases from different business domains)

**Spa + Haircut + Nail satisfies #1, fails #2-#3** (all same vertical = Beauty).

---

## Clarification 2: Projected Consumer ≠ Validated Consumer

### Problem

**ADR-007 states:**
> "Contract must fit Nail = validated"

**Risk:** Nail is **projected consumer** (not yet implemented). Projection ≠ Validation.

---

### Evidence Strength Hierarchy

```
Evidence Strength: PROVEN
    ↓
Implementation exists + contract consumed
    ↓
Spa (legacy adapter) ✅ PROVEN
Haircut (H2 active implementation) ✅ PROVEN (when implemented)

Evidence Strength: PROJECTED
    ↓
Requirements analyzed + no known contradiction
    ↓
Nail (future product) ⏳ PROJECTED

Evidence Strength: SPECULATED
    ↓
Use case identified + feasibility unclear
    ↓
Healthcare/Auto/Education ❓ SPECULATED
```

---

### Corrected Validation Language

**WRONG (overstates evidence):**
> "Contract validated with Spa, Haircut, Nail (3 products)"

**CORRECT (reflects evidence strength):**
> "Contract validated with Spa (adapter proven), Haircut (implementation active).
> No known contradiction with projected Nail requirements."

**When Nail is implemented and consumes contract:**
> "Contract validated with Spa, Haircut, Nail (3 products proven)."

---

### Current H2 Evidence Status

**Spa:**
- **Status:** ✅ PROVEN (legacy implementation exists)
- **Evidence:** Actual code, actual DB, actual business logic
- **Role:** Reference implementation + adapter consumer

**Haircut:**
- **Status:** 🟡 ACTIVE (H2 implementation in progress)
- **Evidence:** Requirements analyzed, contracts being designed
- **Role:** First native Platform consumer (validation in progress)

**Nail:**
- **Status:** ⏳ PROJECTED (future product, not yet started)
- **Evidence:** H0 projection based on Beauty domain similarity
- **Role:** Third consumer validation (when implemented)

---

### Clarified Rule

**To claim "validated with N products":**
- ✅ Implementation exists + contract consumed = COUNT
- ⏳ Projected requirements analyzed = DO NOT COUNT (yet)
- ❓ Speculated use case = DO NOT COUNT

**Current valid claim:**
- "Validated with Spa (1 product), Haircut validation in progress."
- "No known contradiction with Nail projection."

**After Nail implementation:**
- "Validated with Spa, Haircut, Nail (3 products)."

---

## Clarification 3: Example ≠ Decision

### Problem

**ADR-007 includes:**
> "Example 2: IAppointmentEngine (Pending)
> 
> ```typescript
> interface IAppointmentEngine {
>   assignProfessional()
>   recommendProfessional()
>   assignResource()
>   checkResourceConflicts()
> }
> ```"

**Risk:** Example looks like decided contract, but Contract #3 reconciliation proved we **don't know** if these belong together or separately.

---

### Corrected Status

**ADR-007 examples are:**
- ✅ Illustrations (demonstrate methodology)
- ✅ Candidate shapes (possible outcomes)
- ❌ **NOT** decisions (actual boundaries TBD)

**IAppointmentEngine example should be read as:**
> "This is ONE POSSIBLE outcome if domain reconciliation determines all capabilities belong in single contract.
> 
> Actual boundaries determined by Phase 1-3 audit, NOT by this example."

---

### Possible Outcomes After Audit

**Outcome A: Monolithic Appointment**
```typescript
interface IAppointmentEngine {
  // Appointment lifecycle
  createAppointment()
  confirmAppointment()
  
  // Professional assignment (embedded)
  assignProfessional()
  recommendProfessional()
  
  // Resource assignment (embedded)
  assignResource()
  checkResourceConflicts()
}
```

**Outcome B: Appointment + Separate Capabilities**
```typescript
interface IAppointmentEngine {
  // Appointment lifecycle only
  createAppointment()
  confirmAppointment()
  
  // References other contracts
  // assignProfessional() → calls IProfessionalAssignment
  // assignResource() → calls IResourceAllocation
}

interface IProfessionalAssignment {
  assignProfessional()
  recommendProfessional()
}

interface IResourceAllocation {
  assignResource()
  checkResourceConflicts()
}
```

**Outcome C: Appointment with Recommendation Service**
```typescript
interface IAppointmentEngine {
  // Appointment lifecycle + assignment
  createAppointment()
  confirmAppointment()
  assignProfessional()
  assignResource()
}

// Separate recommendation service (NOT contract)
class ProfessionalRecommendationService {
  recommendProfessional()
}

class ResourceRecommendationService {
  recommendResource()
}
```

**Decision Authority:** **Code evidence** (Spa implementation audit + Haircut requirements + domain reconciliation)

**NOT:** ADR-007 example (illustration only)

---

### Clarified Rule

**ADR-007 examples:**
- Purpose: Demonstrate methodology application
- Status: Candidate illustrations (NOT binding decisions)
- Authority: Actual boundaries determined by 3-phase audit

**Actual contract boundaries decided by:**
1. Spa legacy discovery (what capabilities exist, how organized)
2. Domain reconciliation (Spa + Haircut + Nail common concepts)
3. Target contract design (validated boundaries)

---

## Impact on H2

### Revised Success Metrics

**WRONG (overstates achievement):**
- "2/8 contracts extracted = 25% progress"
- "Contracts validated with 3 products (Spa, Haircut, Nail)"
- "Platform contracts confirmed"

**CORRECT (reflects evidence strength):**
- "2 contracts extracted, Contract #3 reconciliation complete"
- "IWaitlistEngine: Platform Contract (temporal primitive, cross-vertical semantics)"
- "IServiceCatalog: Platform Contract CANDIDATE (Beauty-validated, pending cross-vertical)"
- "Validated with Spa (proven), Haircut (active), Nail (projected)"

---

### Revised Contract Inventory Terminology

**Beauty-Shared Capability:**
- Proven reusable within Beauty domain (Spa, Haircut, Nail)
- May be Beauty-specific OR Platform candidate
- Location: TBD (beauty/contracts/ or platform/contracts/)

**Platform Contract Candidate:**
- Beauty-shared capability (validated)
- Domain-neutral semantics (no Beauty coupling)
- Pending cross-vertical validation (Healthcare/Auto/Education consumer)
- Location: `src/platform/contracts/` (provisional)

**Platform Contract Confirmed:**
- Beauty-shared capability (validated)
- Domain-neutral semantics (proven)
- Cross-vertical validation (non-Beauty consumer added)
- Location: `src/platform/contracts/` (permanent)

---

### Current H2 Status (Corrected)

**IWaitlistEngine:**
- **Classification:** ✅ Platform Contract CONFIRMED
- **Rationale:** Temporal primitive, cross-vertical semantics, no Beauty coupling
- **Evidence:** Spa proven, Haircut active, cross-vertical use cases identified

**IServiceCatalog:**
- **Classification:** ⏳ Platform Contract CANDIDATE
- **Rationale:** Domain-neutral semantics, BUT only Beauty consumers validated
- **Evidence:** Spa proven, Haircut active, Nail projected
- **Promotion Path:** Add Healthcare/Auto/Education consumer → Platform CONFIRMED

---

## Revised H2 Objectives

### Before (Too Focused on Count)

> "Extract 8 contracts from Spa for Haircut reuse = 73% reuse"

---

### After (Focused on Quality)

> "From Spa proven business logic, formalize **Beauty-shared capabilities** for Haircut/Nail consumption without inheriting Spa technical debt.
> 
> Identify **Platform contract candidates** (domain-neutral, cross-vertical potential).
> 
> Success measured by:
> - Capability formalization quality (clean boundaries, no Spa coupling)
> - Haircut can consume without Spa dependency
> - Nail reuse path validated (when implemented)
> 
> NOT measured by:
> - Exact contract count (8 vs 6 vs 7)
> - Reuse percentage (73% vs 90%)
> - Platform classification speed (candidate → confirmed takes time)"

---

## Summary of Clarifications

### 1. Beauty-Shared ≠ Platform

**Spa + Haircut + Nail proves:** Beauty-shared capability

**To claim Platform:** Need cross-vertical consumer (Healthcare/Auto/Education)

**Current status:**
- IWaitlistEngine: Platform CONFIRMED (cross-vertical semantics)
- IServiceCatalog: Platform CANDIDATE (pending cross-vertical validation)

---

### 2. Projected ≠ Validated

**Spa:** PROVEN (legacy implementation exists)

**Haircut:** ACTIVE (H2 implementation in progress)

**Nail:** PROJECTED (future product, not yet validated)

**Valid claim:** "Validated with Spa, Haircut active, Nail projected"

**NOT:** "Validated with 3 products"

---

### 3. Example ≠ Decision

**ADR-007 IAppointmentEngine example:** Illustration (candidate shape)

**Actual boundaries:** Determined by 3-phase audit (Spa discovery + domain reconciliation + target design)

**Decision authority:** Code evidence, NOT ADR example

---

## Next Actions

### 1. IAppointmentEngine 3-Phase Audit

**Phase 1: Spa Legacy Discovery**
- Audit bookings implementation
- Document assignment/resource capabilities
- Extract business logic evidence

**Phase 2: Domain Reconciliation**
- Spa: KTV + Room/Bed
- Haircut: Stylist + Chair
- Nail: Technician + Station
- Common concepts: Professional + Resource

**Phase 3: Target Contract**
- Determine boundaries (monolithic vs separate contracts)
- Validate multi-product fit
- Design contract (TBD based on evidence)

**Outcome:** Actual contract boundaries (may differ from ADR-007 example)

---

### 2. Continue Evidence-Based Extraction

**Process:**
1. Legacy Discovery (what Spa does)
2. Domain Reconciliation (Spa + Haircut + Nail common)
3. Target Contract (validated boundaries)

**NOT:**
1. Spa schema → interface → Platform ❌

---

### 3. Platform Candidate Promotion (When Ready)

**Trigger:** Healthcare/Auto/Education consumer added to IServiceCatalog

**Action:** Promote Platform Candidate → Platform CONFIRMED

**Timeline:** After Haircut launch, when other verticals adopt

---

**Clarifications Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ✅ **APPROVED CLARIFICATIONS**  
**Impact:** Prevents over-abstraction, maintains evidence rigor
