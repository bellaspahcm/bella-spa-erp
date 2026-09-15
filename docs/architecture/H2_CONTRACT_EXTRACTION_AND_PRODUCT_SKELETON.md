# H2 Contract Extraction & Product Skeleton — Bella Haircut Shop

**Date:** 2026-09-15  
**Status:** 🟢 **READY TO START** (H1 APPROVED)  
**Phase:** H2 — Contract Extraction & Product Skeleton  
**Forecast Duration:** 6 weeks (Week 1-6)  
**Actual Duration:** TBD (start timer at first commit)  
**Objective:** Prove Bella can generate new Products from existing Platform capabilities

---

## Executive Summary

**H2 Purpose:** Extract 8 Beauty Capability Contracts from Bella Spa, build Haircut MVP consuming contracts, validate **platform-first development model**.

**Reuse Target:** ≥90% capability reuse (aspirational, NOT success gate)  
**Actual Reuse:** TBD (measured from implementation evidence)  

**⚠️ IMPORTANT:** Reuse ratio is **measurement outcome**, NOT success criterion. H0 taught us: evidence-based measurement > forecast targets. IF actual reuse = 82% with clean architecture → VALID result. Forcing 90% with inappropriate abstraction → FAILURE.

**Strategic Goal:** Prove Bella can **generate Products from Platform** (NOT build new software from scratch).

**Timeline (Forecast):**
- **Week 1-2:** Extract 4 critical contracts (Waitlist, Assignment, Appointment, Resource)
- **Week 3-4:** Build Haircut MVP consuming contracts + product features (Walk-in Queue, Inventory)
- **Week 5-6:** Extract remaining 4 contracts (ServiceCatalog, SessionTracking, DomainEvents, ServiceHistory)

**Timeline (Actual):** TBD (measure at H2 completion)

**Extraction Strategy:** **Incremental validation** (NOT batch extraction)
- Extract 1 contract → Create adapter → Run Spa regression → Validate → Contract #2
- IF abstraction wrong → Detect at Contract #1 (NOT after 4 contracts built)
- Architecture guard MUST pass after each contract extraction

---

## H2 Baseline (Locked at Start)

```
H2 BASELINE

Canonical commit          <SHA> (TBD at H2 start)
Spa regression            <result> (MUST be GREEN before H2 starts)
Architecture guard        <result> (healthcare:verify + logistics:verify GREEN)
Beauty contracts          0/8 extracted
Haircut product shell     NOT CREATED
E7 decision               PENDING (Week 1 investigation)

Forecast duration         6 weeks
Actual duration           START TIMER (TBD)

Reuse target              ≥90% (aspirational)
Actual reuse              TBD (measure at completion)

New-code target           <10% (aspirational)
Actual new code           TBD (measure at completion)

Cross-vertical debt       0 required
New architecture debt     0 required
```

**Measurement Philosophy:**
- Forecast = planning input (NOT success gate)
- Actual = evidence output (source of truth)
- IF Actual ≠ Forecast → Learn why, adjust Nail Shop forecast
- Haircut = benchmark #1 for future products

---

## H2 Scope

### IN SCOPE (H2)

✅ **Contract Extraction (8 contracts):**
1. IWaitlistEngine
2. IStaffAssignment
3. IAppointmentEngine
4. IResourceAllocation
5. IServiceCatalog
6. ISessionTracking
7. IDomainEvents
8. IServiceHistory

✅ **Haircut Product Skeleton:**
- Product structure (`src/products/bella-haircut/`)
- Contract consumption (adapter pattern)
- Product-specific features (Walk-in Queue, Service Inventory)
- Basic UI (booking flow, walk-in registration)

✅ **Contract Validation:**
- Contracts work for 2 products (Spa + Haircut)
- Contract interfaces are generic (not Spa-specific)
- Adapter pattern proven (contract → product implementation)

### OUT OF SCOPE (Deferred to Post-H2)

❌ **Full Haircut Implementation:**
- Advanced features (loyalty, promotions, referrals)
- Production deployment
- Performance optimization
- Complete UI/UX polish

❌ **Beauty Services Platform Formalization:**
- Platform layer extraction (deferred to Q2 2027 after Nail Shop)
- Dedicated platform team
- Formal governance (lightweight interim governance OK)

❌ **E7 Integration (If Applicable):**
- E7 investigation happens in Week 1 (2-3 days)
- E7 integration happens in Week 3 IF investigation concludes "E7 Applicable"
- If E7 not applicable, product-level inventory extension in Week 3

---

## H2 Phase Breakdown

### Phase 1: Critical Contract Extraction (Week 1-2)

**Objective:** Extract 4 critical contracts enabling Haircut MVP.

**Extraction Discipline:** Incremental validation (NOT batch)
1. Extract Contract #1 → Adapter → Spa regression → Architecture guard → Evidence
2. IF evidence valid → Contract #2
3. IF abstraction wrong → Fix Contract #1 before proceeding

**Parallel Tracks:**
- **Track A:** Contract extraction (4 contracts, incremental)
- **Track B:** E7 investigation (ADR-005, 2-3 days, does NOT block Track A)

---

**Week 1:**

**Day 1: H2 Baseline Lock + IWaitlistEngine Contract (Contract #1)**

**Morning: Baseline Lock**
```bash
# Record baseline commit
git rev-parse HEAD > docs/architecture/H2_BASELINE_COMMIT.txt

# Run Spa regression
npm run test:spa

# Run architecture guard
npm run healthcare:verify
npm run logistics:verify

# Record results in H2_BASELINE.md
```

**Afternoon: IWaitlistEngine Contract Extraction**
- Read existing implementation: `src/products/bella-spa/engines/waitlist-engine/`
- Define contract interface: `src/contracts/beauty/IWaitlistEngine.ts`
- **Principle:** Extract contract AROUND existing implementation (do NOT rewrite engine to fit contract)
- Create Spa adapter: `src/products/bella-spa/adapters/waitlist.adapter.ts`

**Evening: Validation Loop**
```bash
# Run Spa regression (waitlist features MUST work unchanged)
npm run test:spa -- --grep waitlist

# Run architecture guard
npm run healthcare:verify

# IF tests fail → Rollback, investigate, fix contract interface, retry
# IF tests pass → Commit, proceed to Contract #2
```

**Track B (Parallel): E7 Investigation Day 1**
- Contract review (IInventoryDomain, IMovement, IOperational)
- Ownership analysis (WHO owns service inventory? E7 vs Beauty Services)
- Semantic fit assessment (warehouse vocabulary → salon vocabulary)
- Document: E7 contract capabilities, ownership verdict, semantic mismatch indicators

---

**Day 2: IStaffAssignment Contract (Contract #2)**

**Track A: Contract Extraction**
- Read existing: `src/products/bella-spa/engines/staff-assignment-engine/`
- Define contract: `src/contracts/beauty/IStaffAssignment.ts`
- Extract AROUND implementation (do NOT rewrite)
- Create Spa adapter: `src/products/bella-spa/adapters/staff-assignment.adapter.ts`
- Validation loop: Spa regression → Architecture guard → Commit

**Track B (Parallel): E7 Investigation Day 2**
- Schema analysis (InventoryItem, Movement entities)
- Invariants check (stock consistency, movement atomicity, tenant isolation, reorder thresholds)
- E7 FROZEN validation (can use E7 WITHOUT modifying frozen code?)
- Document: Invariants compatibility, frozen constraint violations

---

**Day 3: IAppointmentEngine Contract (Contract #3)**

**Track A: Contract Extraction**
- Read existing: `src/products/bella-spa/engines/appointment-engine/`
- Define contract: `src/contracts/beauty/IAppointmentEngine.ts`
- Extract AROUND implementation
- Create Spa adapter: `src/products/bella-spa/adapters/appointment.adapter.ts`
- Validation loop: Spa regression → Architecture guard → Commit

**Track B (Parallel): E7 Investigation Day 3 (Decision Day)**
- Dependency direction check (Product → Contract → Kernel valid?)
- Data ownership validation (who writes/reads inventory?)
- Extension cost assessment (0-15 person-days scenarios)
- **DECISION:** E7 Applicable (YES/NO/INCONCLUSIVE)
  - IF INCONCLUSIVE → Default to product-level extension (fallback)
  - Document decision in ADR-005

---

**Day 4-5: IResourceAllocation Contract (Contract #4) + Week 1 Evidence**

**Track A: Contract Extraction**
- Read existing: `src/products/bella-spa/engines/resource-allocation-engine/`
- Define contract: `src/contracts/beauty/IResourceAllocation.ts`
- Extract AROUND implementation
- Create Spa adapter: `src/products/bella-spa/adapters/resource-allocation.adapter.ts`
- Validation loop: Spa regression → Architecture guard → Commit

**Track A: Week 1 Evidence Document**
```
Week 1 Evidence

Contracts extracted       4/8 (IWaitlistEngine, IStaffAssignment, IAppointmentEngine, IResourceAllocation)
Spa regression            PASS/FAIL (if FAIL, root cause documented)
Architecture guard        PASS/FAIL
Abstraction quality       Clean/Needs refinement (assess adapter complexity)
E7 decision               APPLICABLE / NOT APPLICABLE / PRODUCT-LEVEL FALLBACK

Blocker detected          YES/NO (if YES, H2 paused for resolution)
Week 1 actual duration    <X> days (compare to 5-day forecast)
```

**Track B: E7 Decision Finalized**
- Update ADR-005 status: Decision recorded (E7 integration OR product-level extension)
- IF E7 integration → Prepare E7 adapter plan (Week 3)
- IF product-level → Prepare service_inventory schema (Week 3)

**Phase 1 Deliverables:**
- ✅ 4 critical contracts extracted (`src/contracts/beauty/`)
- ✅ Spa continues working via adapters (zero disruption)
- ✅ Contract Registry created (version 1.0.0, owners, consumers)
- ✅ E7 investigation complete (decision: integrate E7 OR product-level extension)

---

### Phase 2: Haircut MVP + Product Features (Week 3-4)

**Objective:** Build Haircut product consuming 4 contracts, add product-specific features.

**Week 3:**

**Day 1-2: Haircut Product Structure**
```
src/products/bella-haircut/
├── adapters/
│   ├── waitlist.adapter.ts          (IWaitlistEngine → Haircut context)
│   ├── staff-assignment.adapter.ts  (IStaffAssignment → Haircut context)
│   ├── appointment.adapter.ts       (IAppointmentEngine → Haircut context)
│   └── resource.adapter.ts          (IResourceAllocation → Haircut context)
├── services/
│   ├── haircut-booking.service.ts
│   ├── walkin-queue.service.ts      (product feature)
│   └── service-inventory.service.ts (E7 adapter OR product-level)
├── controllers/
│   ├── booking.controller.ts
│   └── walkin.controller.ts
├── models/
│   └── haircut.model.ts
└── README.md
```

**Day 3: Walk-in Queue (Product Feature)**
- Create `walkin-queue.service.ts`
- Database: `haircut_walkin_queue` table
- Queue manager: Position tracking, customer info, ETA calculation
- Integration: Link to IAppointmentEngine when customer ready

**Day 4: Service Inventory (E7 Integration OR Product-Level)**

**IF E7 Applicable:**
- Create E7 adapter (`src/products/bella-haircut/adapters/inventory.adapter.ts`)
- Register haircut products in E7 (shampoo, gel, towels)
- Link to service execution (deduct inventory on completion)
- Reorder alerts integration

**IF E7 NOT Applicable:**
- Create `service-inventory.service.ts` (product-level)
- Database: `service_inventory`, `service_inventory_movements` tables
- Stock deduction logic
- Reorder alerts (product-level)

**Day 5: Haircut Booking Flow Integration**
- Booking controller → IAppointmentEngine contract
- Staff assignment → IStaffAssignment contract
- Resource allocation → IResourceAllocation contract
- Waitlist fallback → IWaitlistEngine contract

**Week 4:**

**Day 1-2: Basic UI (Booking Flow)**
- Customer booking form (service selection, date/time, staff preference)
- Walk-in registration form
- Appointment confirmation
- Waitlist status check

**Day 3-4: Testing & Validation**
- Integration tests (Haircut consumes 4 contracts correctly)
- Contract validation (contracts work for Spa + Haircut)
- Adapter pattern validation (clean separation)
- Product feature validation (Walk-in Queue, Inventory work)

**Day 5: Documentation**
- Haircut README (how to consume contracts)
- Adapter pattern documentation
- Product feature documentation (Walk-in Queue, Inventory)

**Phase 2 Deliverables:**
- ✅ Haircut MVP operational (booking, walk-in, inventory)
- ✅ 4 contracts validated (Spa + Haircut consuming)
- ✅ Adapter pattern proven (contract → product clean separation)
- ✅ Walk-in Queue product feature (NOT contract yet, extract if Nail Shop needs)
- ✅ Service Inventory integrated (E7 OR product-level based on investigation)

---

### Phase 3: Remaining Contract Extraction (Week 5-6)

**Objective:** Extract remaining 4 contracts, complete contract ecosystem.

**Week 5:**

**Day 1-2: IServiceCatalog Contract**
- Define contract interface (`src/contracts/beauty/IServiceCatalog.ts`)
- Extract from `src/products/bella-spa/services/package.service.ts`
- Create Spa adapter
- Create Haircut adapter (Haircut migrates to contract)
- Tests: Both Spa + Haircut use IServiceCatalog

**Day 3-4: ISessionTracking Contract**
- Define contract interface (`src/contracts/beauty/ISessionTracking.ts`)
- Extract from `src/products/bella-spa/services/session-tracking.service.ts`
- Create Spa adapter
- Create Haircut adapter
- Tests: Both Spa + Haircut use ISessionTracking

**Day 5: IDomainEvents Contract**
- Define contract interface (`src/contracts/beauty/IDomainEvents.ts`)
- Extract from `src/products/bella-spa/events/`
- Create Spa adapter
- Create Haircut adapter
- Tests: Both Spa + Haircut emit events via contract

**Week 6:**

**Day 1-2: IServiceHistory Contract**
- Define contract interface (`src/contracts/beauty/IServiceHistory.ts`)
- Extract from `src/products/bella-spa/services/service-history.service.ts`
- Create Spa adapter
- Create Haircut adapter
- Tests: Both Spa + Haircut track history via contract

**Day 3: Contract Registry Finalization**
- Update Contract Registry (8 contracts, v1.0.0)
- Document contract owners (Architecture Council interim)
- Document contract consumers (Spa, Haircut)
- Versioning rules (semantic versioning)
- Breaking change process (lightweight ADR)

**Day 4: Documentation & Governance**
- Contract documentation (8 contracts, usage examples, migration guides)
- Governance model documented (interim Architecture Council)
- Breaking change process documented
- Contract evolution guidelines (when to create v1.1.0 vs v2.0.0)

**Day 5: H2 Validation & Closeout**
- Contract reuse measurement (% reuse Spa → Haircut)
- Code volume analysis (new code vs reused contracts)
- Adapter pattern assessment (clean separation?)
- Success criteria validation (90%+ reuse achieved?)

**Phase 3 Deliverables:**
- ✅ 8 contracts extracted and documented
- ✅ Both Spa + Haircut consuming all 8 contracts
- ✅ Contract Registry operational (versioning, governance)
- ✅ Contract documentation complete
- ✅ Governance model established (interim, lightweight)

---

## H2 Success Criteria

### 1. Reuse Measurement (Evidence-Based)

**Metric:** % of Haircut code that is contract consumption (vs new code)

**Target:** ✅ **≥90% capability reuse (ASPIRATIONAL)** — NOT success gate

**Actual Reuse:** TBD (measured at H2 completion from implementation evidence)

**Measurement:**
```
Contract Consumption = 8 contracts × adapter code
Product Features = Walk-in Queue + Service Inventory (product-level if E7 not applicable)
Product UI = Booking forms, walk-in registration

Reuse % = (Contract Consumption) / (Total Haircut Code) × 100%
```

**Interpretation:**
- IF Reuse ≥ 90% → **EXCELLENT** (platform-first model proven strongly)
- IF Reuse 80-89% → **GOOD** (platform-first model validated, contracts need minor refinement)
- IF Reuse 70-79% → **ACCEPTABLE** (platform-first model works, contracts need refinement for Nail Shop)
- IF Reuse < 70% → **INVESTIGATE** (contracts may be too Spa-specific OR wrong abstraction level)

**Success Gate:** Reuse ratio documented with evidence (NOT "must reach 90%")

**Learning:** Actual reuse ratio = baseline for Nail Shop forecast. IF Haircut = 82% → Nail Shop target = 85% (improvement through contract maturity).

---

### 2. Contract Stability

**Metric:** Zero breaking changes to contracts during H2 (Week 1-6)

**Target:** ✅ **All contracts v1.0.0** (no v2.0.0 required during H2)

**Validation:**
- IF v1.0.0 → v1.1.0 (backward-compatible additions) → **OK** (contracts evolving naturally)
- IF v1.0.0 → v2.0.0 (breaking changes) → **WARNING** (contracts may be Spa-specific, investigate)

**Success Gate:** Document breaking changes with rationale (NOT "zero breaking changes required")

---

### 3. Adapter Pattern Validation

**Metric:** Clean separation between contracts and product implementations

**Target:** ✅ **Adapter layer < 20% of product code** (aspirational)

**Validation:**
- Adapter code = translation logic only (contract → product context)
- No business logic in adapters (business logic in engines behind contracts)
- Haircut adapters + Spa adapters similar size (contracts are generic)

**Success Gate:** Adapter pattern documented, complexity assessed (NOT "must be < 20%")

**Learning:** IF adapter > 30% → Contracts may lack methods (extract missing capabilities for Nail Shop)

---

### 4. No Spa Disruption (HARD GATE)

**Metric:** Spa regression tests 100% PASS throughout H2

**Target:** ✅ **Zero Spa breakage** (contract extraction is additive)

**Validation:**
- Run Spa regression tests after EACH contract extraction
- IF any test fails → Rollback contract extraction, fix, retry
- Spa users experience zero disruption

**Success Gate:** Spa regression GREEN throughout H2 (MANDATORY)

**⚠️ BLOCKER:** IF Spa regression fails after 3 retry attempts → H2 PAUSED, escalate to Architecture Council

---

### 5. Haircut MVP Functional

**Metric:** Haircut MVP supports core booking flow

**Target:** ✅ **Core flow operational:**
1. Customer books appointment (date, time, service, staff)
2. Staff assigned automatically (via IStaffAssignment)
3. Resource allocated (station, tools via IResourceAllocation)
4. Walk-in customer registers (queue position tracked)
5. Service completed (inventory deducted, session tracked)
6. Service history recorded (via IServiceHistory)

**Validation:**
- End-to-end test: Complete booking flow from customer arrival → service completion
- Integration test: All 8 contracts consumed correctly
- UI test: Booking form + walk-in registration functional

---

## H2 Risks & Mitigation

### Risk 1: Contract Extraction Breaks Spa

**Severity:** 🔴 Critical  
**Probability:** Medium  
**Impact:** Spa production disruption

**Mitigation:**
1. **Additive Extraction:** Create contracts + adapters BEFORE migrating Spa
2. **Incremental Validation:** Extract 1 contract → Spa regression → Architecture guard → Contract #2
3. **Regression After Each Contract:** Do NOT batch-extract 4 contracts then test
4. **Rollback Plan:** Git branch per contract, rollback if tests fail
5. **3-Retry Rule:** IF contract extraction fails 3 times → PAUSE H2, escalate to Architecture Council

**Contingency:**
- IF Spa breaks → Rollback contract extraction, investigate, fix, retry
- IF rollback fails → Keep Spa on old code, Haircut uses contracts directly (adapter pattern broken)
- IF 3 retries fail → H2 PAUSED, Architecture Council reviews extraction strategy

---

### Risk 2: Contracts Too Spa-Specific

**Severity:** 🟡 High  
**Probability:** Medium  
**Impact:** Haircut requires excessive adapter code (> 50%)

**Mitigation:**
1. **Contract Review:** Architecture Council reviews contract interfaces before extraction
2. **Generic Naming:** Use "service", "session", "resource" (NOT "spa", "treatment")
3. **Haircut Feedback:** Haircut team reviews contracts Week 1 (identify Spa-specific assumptions)
4. **Iterative Refinement:** If contract doesn't fit Haircut → refine interface (v1.1.0)

**Contingency:**
- IF contract cannot be made generic → Mark as "Spa-specific", Haircut builds custom
- IF > 50% contracts Spa-specific → Abandon contract extraction, keep product-level

---

### Risk 3: E7 Investigation Inconclusive

**Severity:** 🟡 High  
**Probability:** Medium  
**Impact:** Service Inventory decision delayed (Week 3 blocked)

**Mitigation:**
1. **Time-Box Investigation:** 2-3 days MAX (Day 5 Week 1 + Day 5 Week 2)
2. **Fallback Decision:** IF investigation > 3 days → default to product-level extension
3. **Clear Decision Criteria:** 7 conditions (ownership, semantic, invariants, frozen, dependency, data ownership, extension cost)

**Contingency:**
- IF Day 3 inconclusive → STOP investigation, default to product-level extension (50% new code)
- IF E7 partially fits → Build product-level NOW, revisit E7 for Nail Shop (Q1 2027)

---

### Risk 4: Walk-in Queue More Complex Than Expected

**Severity:** 🟢 Low  
**Probability:** Low  
**Impact:** Week 3 timeline slip (2-3 days → 5 days)

**Mitigation:**
1. **Scope Control:** Walk-in Queue v1 is simple (queue position, customer info, ETA)
2. **No Advanced Features:** No triage, no priority queue (Week 3 only basic queue)
3. **Investigation Optional:** Healthcare ER queue investigation is optional (1-2 days, can skip)

**Contingency:**
- IF Walk-in Queue takes > 3 days → Defer to Week 4 (still within H2 timeline)
- IF > 5 days → Simplify scope (manual queue, no auto-assignment)

---

## H2 Timeline Summary

| Week | Phase | Focus | Deliverables | Validation |
|------|-------|-------|--------------|------------|
| Week 1 | Phase 1 | Extract IWaitlistEngine, IStaffAssignment (incremental) | 2 contracts + E7 investigation Day 1 | Spa regression after EACH contract |
| Week 2 | Phase 1 | Extract IAppointmentEngine, IResourceAllocation (incremental) | 2 contracts + E7 decision | Spa regression after EACH contract |
| Week 3 | Phase 2 | Haircut product structure + product features | Haircut skeleton + Walk-in Queue + Inventory | Integration tests |
| Week 4 | Phase 2 | Haircut MVP + UI + validation | Haircut MVP functional | End-to-end tests |
| Week 5 | Phase 3 | Extract IServiceCatalog, ISessionTracking, IDomainEvents (incremental) | 3 contracts | Spa regression after EACH contract |
| Week 6 | Phase 3 | Extract IServiceHistory + governance + closeout | 1 contract + documentation + evidence | Final measurement |

**Forecast Duration:** 6 weeks  
**Actual Duration:** TBD (measure at H2 completion)  
**Total Contracts:** 8  
**Haircut MVP:** Week 4 (functional, consuming 4 contracts)  
**H2 Complete:** Week 6 (8 contracts extracted, Haircut validates contracts, evidence documented)

**Measurement Discipline:**
- Record actual duration per contract extraction (compare to forecast)
- Record actual reuse ratio (compare to ≥90% target)
- Record blocker days (if any)
- Haircut = benchmark #1 → Nail Shop forecast improved with Haircut actuals

---

## Post-H2: What Happens Next?

### Immediate Next Steps (Week 7+)

**H2 Evidence Review:**
1. **Measure Actual Reuse:** Calculate reuse ratio from implementation (contract consumption / total code)
2. **Measure Actual Duration:** Compare 6-week forecast vs actual duration
3. **Document Learnings:** What worked? What failed? Contract quality assessment
4. **Update Nail Shop Forecast:** Use Haircut actuals to improve Nail Shop estimates

**IF Actual Reuse ≥ 80% (Platform-First Model Validated):**
1. **Polish Haircut MVP:** Production deployment preparation
2. **Contract Stability Phase:** 2 quarters (Q4 2026 → Q1 2027) monitor contract stability
3. **Nail Shop Planning:** Q1 2027 (validate contracts with 3rd product)
4. **Forecast Improvement:** Nail Shop forecast = Haircut actual + 10% efficiency gain

**IF Actual Reuse 60-79% (Partial Success):**
1. **Contract Refinement:** Identify Spa-specific assumptions, generalize
2. **Haircut v1.1 Iteration:** Refine adapters, reduce adapter code
3. **Nail Shop Delayed:** Wait for contract refinement (2-4 weeks) before Nail Shop
4. **Root Cause Analysis:** Why < 80%? Wrong abstraction? Missing methods?

**IF Actual Reuse < 60% (Investigation Required):**
1. **Contract Postmortem:** Why did contracts fail? Too Spa-specific? Wrong abstraction level?
2. **Pivot Decision:** Abandon shared contracts OR redesign contracts (v2.0.0)
3. **Nail Shop Rethink:** Product-level development OR wait for contract redesign (8-12 weeks)
4. **Architecture Council Review:** Is Beauty Services Platform viable?

---

### Long-Term Roadmap (Q1-Q2 2027)

**Q1 2027: Nail Shop (3rd Product)**
- Validate contracts with 3rd use case
- Measure contract reuse % (target: 80%+ across 3 products)
- Validate Rule of Three (3 products = proven reusability)

**Q2 2027: Beauty Services Platform Formalization (Conditional)**
- IF Nail Shop validates contracts (80%+ reuse) → Formalize platform
- Create `platform/beauty-services/` (engines + contracts)
- Form Beauty Services Platform Team (2-3 FTE)
- Establish formal governance (ADR-based, breaking change process)

**Q3-Q4 2027: Platform Maturity**
- 4th product (Massage) consumes platform (proves generality)
- Platform team self-sufficient (no Architecture Council bottleneck)
- Contract ecosystem stable (2+ quarters, zero breaking changes)

---

## H2 Approval & Sign-Off

**Status:** 🟢 **READY TO START**  
**Prerequisites:**
- ✅ H1 Architecture Gate APPROVED + CLOSED
- ✅ 4 ADRs APPROVED (ADR-002, ADR-003, ADR-004, ADR-005)
- ✅ H0 reconciliation complete (8 contracts have clear ownership)

**Start Date:** Week 1, Day 1 (immediately after H1 approval)  
**Expected Completion:** Week 6, Day 5 (6 weeks from H1 approval)

**Decision Authority:** Architecture Council  
**Execution Team:**
- Platform team (contract extraction)
- Haircut product team (MVP development)
- Logistics team (E7 investigation support, if needed)

---

**H2 Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 🟢 **READY TO START** (H1 APPROVED)  
**Next Milestone:** Week 1, Day 1 — Begin IWaitlistEngine contract extraction
