# H2 Contract #4 — Validation Checkpoint

**Date:** 2026-09-15  
**Status:** ⏸️ **VALIDATION CHECKPOINT**  
**Purpose:** Gate before Phase 3 — ensure boundary decisions based on validated evidence

---

## Checkpoint Purpose

**Phase 1:** ✅ COMPLETE — Spa legacy discovery  
**Phase 2:** 🟡 PARTIAL — Proposed requirements available, validation pending  
**Phase 3:** ⏸️ BLOCKED — Cannot start without validated requirements

**Critical Distinction:**

```
PROPOSED REQUIREMENTS (current)
    = Hypothetical business scenarios
    = Architectural hypothesis
    = Sufficient for discussion
    = NOT sufficient for contract design
    ↓
VALIDATED REQUIREMENTS (needed)
    = Confirmed by Product/UX
    = Actual business workflows
    = Sufficient for boundary decisions
    = Required for Phase 3
```

---

## What We Have (Proposed)

### Haircut Minimum Domain Requirements

**Status:** PROPOSED (see `H2_HAIRCUT_MINIMUM_DOMAIN_REQUIREMENTS.md`)

**6 Use Cases:**
1. Customer books without stylist selection
2. Customer requests busy stylist
3. Stylist sick leave (reassignment)
4. Stylist double booking (conflict)
5. Chair double booking (conflict)
6. Chair maintenance (unavailability)

**Preliminary Boundary Assessment:**
- Appointment Lifecycle: ✅ Independent capability (high confidence)
- Professional Assignment: 🟡 LIKELY SEPARATE (tentative)
- Professional Recommendation: 🟡 Helper/Policy candidate (tentative)
- Resource Allocation: 🟡 LIKELY SEPARATE (tentative)

---

## What We Need (Validation)

### Critical Questions for Product/UX

#### Professional Assignment

**Q1: Reassignment Frequency**
- [ ] How often do stylist reassignments occur?
  - Daily (multiple times per day)
  - Weekly (several times per week)
  - Rare (exceptional cases only)

**Q2: Assignment History**
- [ ] Is assignment history business-critical?
  - YES: Required for audit/compliance/analytics
  - NO: Only current assignment matters

**Q3: Acceptance Workflow**
- [ ] Can stylists reject assignments?
  - YES: Stylist acceptance required
  - NO: System assigns, stylist must accept

**Q4: No-Show Tracking**
- [ ] Are stylist no-shows tracked/analyzed?
  - YES: Per-stylist accountability
  - NO: Overall salon metrics only

**Impact:** If Q1=Daily OR Q2=YES OR Q3=YES → Strong signal for separate `IProfessionalAssignment` contract

---

#### Resource Allocation

**Q5: Maintenance Windows**
- [ ] Are chair maintenance windows scheduled?
  - Regular (weekly/monthly scheduled maintenance)
  - Ad-hoc (only when broken)
  - No formal maintenance

**Q6: Capacity Management**
- [ ] Do stylists share equipment?
  - YES: Equipment quantity tracking needed
  - NO: 1:1 mapping (stylist has own tools)

**Q7: Resource Reassignment**
- [ ] How often are chairs reassigned?
  - Frequent (customer preference, optimization)
  - Rare (only when chair broken)
  - Never (chair assigned at booking, never changes)

**Q8: Conflict Criticality**
- [ ] Are chair conflicts more constrained than stylist conflicts?
  - YES: Chairs are bottleneck (fewer chairs than stylists)
  - NO: Stylists are bottleneck (chairs plentiful)

**Impact:** If Q5=Regular OR Q6=YES OR Q7=Frequent → Strong signal for separate `IResourceAllocation` contract

---

#### Professional Recommendation

**Q9: Walk-In Auto-Assignment**
- [ ] Are walk-in customers auto-assigned to stylists?
  - Always (immediate assignment)
  - Sometimes (depends on capacity)
  - Never (walk-ins wait for manual assignment)

**Q10: Recommendation Factors**
- [ ] What factors influence stylist recommendation?
  - Service compatibility (stylist can perform service)
  - Availability (not at capacity)
  - Workload balancing (distribute evenly)
  - Skill level / rating (prefer higher-rated)
  - Customer preference history (previous stylist)
  - Seniority / VIP rules (senior stylists for VIP customers)

**Q11: Recommendation Override**
- [ ] Can managers override recommendations?
  - Always (manager has full control)
  - Sometimes (exceptional cases only)
  - Never (system assignment is final)

**Q12: Recommendation Complexity**
- [ ] Is recommendation logic simple or complex?
  - Simple (next available stylist)
  - Moderate (availability + skill match)
  - Complex (multi-factor scoring with business rules)

**Impact:** If Q10=Complex OR Q12=Complex → Consider policy/contract instead of helper service

---

## Validation Method

### Recommended Approach

**1. Product/UX Interview** (1-2 hours)
- Review 6 use cases with Product Owner
- Walk through typical Haircut workflows
- Identify frequent vs exceptional scenarios
- Document actual business rules

**2. PRD/User Story Review** (if available)
- Extract appointment booking workflows
- Extract stylist assignment workflows
- Extract resource allocation workflows
- Map to 6 use cases

**3. Competitive Analysis** (optional)
- Review how competitors handle assignment/allocation
- Identify common patterns vs unique requirements
- Validate proposed requirements against industry norms

**4. Prototype Validation** (if available)
- Test proposed workflows with UX prototype
- Gather user feedback on assignment/allocation flows
- Validate use cases with actual user behavior

---

## Decision Tree After Validation

### Professional Assignment

```
IF reassignment frequency = Daily
   OR assignment history = Required
   OR acceptance workflow = YES
THEN
   → IProfessionalAssignment = SEPARATE CONTRACT
   → Contract inventory: 8 (unchanged)
ELSE
   → Professional assignment = Appointment attribute
   → Contract inventory: 8 → 7
```

---

### Resource Allocation

```
IF maintenance windows = Regular
   OR capacity management = YES
   OR reassignment frequency = Frequent
THEN
   → IResourceAllocation = SEPARATE CONTRACT
   → Contract inventory: 8 (unchanged)
ELSE
   → Resource allocation = Appointment attribute
   → Contract inventory: 8 → 7 (or 6 if both absorbed)
```

---

### Professional Recommendation

```
IF recommendation complexity = Complex
   AND recommendation is cross-vertical (used by Healthcare/Auto/Education)
THEN
   → Consider IProfessionalMatching = CONTRACT
   → Contract inventory: 8 → 9 (new contract)
ELSE IF recommendation complexity = Moderate/Complex
   AND Beauty-specific
THEN
   → Recommendation = Beauty policy/service (shared capability, not Platform)
   → Contract inventory: 8 (unchanged)
ELSE
   → Recommendation = Helper service (embedded in product)
   → Contract inventory: 8 (unchanged)
```

---

## What NOT to Do Before Validation

**❌ Do NOT:**
1. Design contract interfaces (Phase 3 premature)
2. Write TypeScript interface definitions
3. Implement Haircut booking logic
4. Create database schema for Haircut
5. Change contract denominator (8 → 7 or 6)
6. Seal boundary decisions as final

**✅ Do:**
1. Document proposed requirements (done)
2. Identify validation questions (done)
3. Schedule Product/UX validation session
4. Review existing Haircut documentation (PRD, user stories)
5. Keep denominator at 8 (unchanged)
6. Keep boundaries tentative (LIKELY SEPARATE, not CONFIRMED)

---

## Success Criteria for Validation Complete

**Phase 2 can be CLOSED when:**

1. ✅ All 12 validation questions answered
2. ✅ 6 use cases validated with Product/UX
3. ✅ Boundary decisions evidence-based (not hypothetical)
4. ✅ Haircut requirements status: PROPOSED → VALIDATED
5. ✅ Domain reconciliation complete (Spa + Haircut + Nail mapped)

**Phase 3 can START when:**

1. ✅ Phase 2 validation complete
2. ✅ Boundary decisions finalized (separate contract or absorbed)
3. ✅ Contract inventory updated (8 → actual count)
4. ✅ Target contracts identified (IAppointmentEngine + others)

---

## Current H2 Status

### Contract Extraction Progress

```
H2 CONTRACT INVENTORY

Baseline (H0/H1):              8 contracts
Extracted:                     2 contracts
├─ IWaitlistEngine             ✅ EXTRACTED (Platform Candidate)
└─ IServiceCatalog             ✅ EXTRACTED (Platform Candidate)

Under Reconciliation:          3 contracts
├─ IStaffAssignment            🟡 UNDER RECONCILIATION (boundary pending)
├─ IAppointmentEngine          🟡 PHASE 2 PARTIAL (validation needed)
└─ IResourceAllocation         🟡 UNDER RECONCILIATION (boundary pending)

Remaining:                     3 contracts unaudited
├─ IDomainEvents (H1 #8)       ⏸️ NOT STARTED
├─ IPaymentEngine (H1 #5)      ⏸️ NOT STARTED
└─ ICustomerSegmentation (#4)  ⏸️ NOT STARTED

Effective Count:               TBD (pending IAppointmentEngine validation)
Denominator:                   8 (UNCHANGED until Phase 2 validation complete)
```

---

### H2 Timeline

**Completed:**
- H0: Capability reuse assessment (73.33% reuse, 8 contracts identified)
- H1: Architecture gate (5/5 PASS, 4 ADRs)
- H2 Branch: feat/haircut-h2-contract-extraction
- H2 Timer: Started 2026-09-15T12:31:24+07:00
- Contract #1: IWaitlistEngine (EXTRACTED + SEALED)
- Contract #2: IServiceCatalog (EXTRACTED + SEALED)
- Contract #3: IStaffAssignment (RECONCILIATION COMPLETE, DEFERRED)
- ADR-007: Platform Contract Extraction Principles (APPROVED)
- ADR-007 Clarifications: 3 critical distinctions (APPROVED)
- Contract #4 Phase 1: Spa Legacy Discovery (COMPLETE)
- Contract #4 Phase 2: Partial (proposed requirements available)

**Current:**
- Contract #4 Phase 2: ⏸️ VALIDATION CHECKPOINT
- Haircut requirements: PROPOSED (not yet validated)
- Boundary decisions: TENTATIVE (not yet sealed)

**Blocked:**
- Contract #4 Phase 3: Target contract design (needs validation)
- Contracts #5-8: Extraction (depends on IAppointmentEngine completion)

---

## Next Steps

### Immediate (Unblock Phase 2)

**1. Schedule Product/UX Validation**
- Target: Product Owner, UX Designer, or Business Analyst
- Duration: 1-2 hours
- Agenda: Review 6 use cases + 12 validation questions
- Output: Validated Haircut requirements

**2. Document Validation Results**
- Update `H2_HAIRCUT_MINIMUM_DOMAIN_REQUIREMENTS.md`
- Status: PROPOSED → VALIDATED
- Record answers to 12 validation questions
- Document evidence for boundary decisions

**3. Complete Domain Reconciliation**
- Map validated Haircut requirements to domain model
- Finalize Spa + Haircut + Nail concept mapping
- Seal boundary decisions (separate contract or absorbed)
- Close Phase 2

---

### Sequential (After Validation)

**4. Start Phase 3: Target Contract Design**
- Design contract interfaces based on validated boundaries
- Define operations, types, invariants
- Validate multi-product fit (Spa adapter + Haircut native + Nail projection)

**5. Update Contract Inventory**
- Finalize effective count (8 → actual count)
- Update denominator (if contracts absorbed)
- Document final contract list

**6. Continue H2 Extraction**
- Contract #5: IPaymentEngine
- Contract #6-8: Remaining contracts

---

## Summary

**Phase 1:** ✅ COMPLETE (Spa legacy discovery)  
**Phase 2:** 🟡 PARTIAL (proposed requirements, validation pending)  
**Phase 3:** ⏸️ BLOCKED (needs validated requirements)

**Checkpoint Status:**
- Proposed requirements available (6 use cases)
- 12 validation questions defined
- Preliminary boundary assessment complete (TENTATIVE)
- Product/UX validation required to proceed

**Contract Inventory:** 8 (UNCHANGED)

**Key Principle:**
> **Proposed requirements → Architectural hypothesis**  
> **Validated requirements → Boundary decisions**  
> **Validated boundaries → Contract design**

**Next Action:** Schedule Product/UX validation session (12 questions + 6 use cases)

---

**Document Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ⏸️ **VALIDATION CHECKPOINT**  
**Next:** Validate requirements → Close Phase 2 → Start Phase 3
