# Bella Industry Integration Template v1.0
**Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** 🔒 FROZEN  
**Frozen By:** Validation Report v1.0.0 (5/5 Freeze Gate tests PASS)  
**Purpose:** Standardized process for integrating new Industry OS with Finance OS

---

## Document Purpose

**This is:**
- ✅ Process/governance artifact
- ✅ Phase-by-phase guide for new industry integration
- ✅ Gate criteria for architecture approval
- ✅ Change control mechanism

**This is NOT:**
- ❌ Implementation blueprint
- ❌ Code specification
- ❌ Technology choice
- ❌ SDK design
- ❌ Database schema definition

**Template answers:**
> "What process must a new Industry OS follow to integrate with Finance OS?"

**Template does NOT answer:**
> "How to implement Industry OS or Adapter?"

---

## Governance Context

**Template must work for:**
- Hospital ✅ (validated)
- Education ✅ (validated)
- Retail ✅ (validated)
- Real Estate (future)
- Automotive (future)
- Manufacturing (future)
- Any future industry

**Template must NOT be:**
- ❌ Education-shaped
- ❌ Retail-shaped
- ❌ Healthcare-specific

---

## Core Principles (Invariant)

### Principle 1: Finance Protection

```
Industry OS
   ↓ business truth
Adapter
   ↓ semantic transformation
Financial Intent
   ↓
Finance OS
   ↓ accounting treatment
F1-F5
   ↓
Financial integrity
```

**Every phase must maintain this boundary.**

---

### Principle 2: Generality by Test

> New industry integration must pass Generality Test (Constitution Section 14).

**Not sufficient:** "This industry can map to framework."  
**Required:** "Framework unchanged when this industry added."

---

### Principle 3: Policy Space vs. Policy Choice

**Template requires:**
- Define policy space (range of valid policies)
- NOT define policy choice (specific policy selection)

**Example:**
- ✅ "Revenue recognition trigger: ENROLLMENT | PAYMENT | COMPLETION"
- ❌ "Revenue recognized on payment"

---

### Principle 4: Business Truth vs. Financial Truth

**Template enforces:**
- Industry OS owns business truth (entities, events)
- Finance OS owns financial truth (GL balances, journals)
- Integration transforms semantics, does NOT duplicate truth

---

## Template Structure

**9 Phases:**

| Phase | Objective | Gate |
|-------|-----------|------|
| Phase 0 | Domain Discovery | Discovery Complete |
| Phase 1 | Boundary & Constitution | Boundary Clear |
| Phase 2 | Financial Touch Points | Touch Points Mapped |
| Phase 3 | Capability + Policy Space | Product Definition |
| Phase 4 | Contract Design | Contract General |
| Phase 5 | E-ARCH Generality Gate | Architecture Approved |
| Phase 6 | Implementation | Integration Functional |
| Phase 7 | Verification | Evidence Collected |
| Phase 8 | Freeze & Sign-off | Baseline Frozen |

---

## Phase 0: Domain Discovery

### Objective

**Question to answer:**
> "What is the business truth of this Industry OS?"

**NOT:**
> "How to integrate this industry?"

---

### Required Inputs

**Before Phase 0:**
- Industry OS exists (conceptually or implemented)
- Business domain understood
- Stakeholders identified

**No Finance knowledge required yet.**

---

### Required Outputs

**Deliverables:**

1. **Domain Entity Map**
   - Core entities (e.g., Patient, Order, Contract)
   - Relationships
   - Lifecycle states

2. **Business Event Catalog**
   - Key events (e.g., Order Placed, Patient Discharged)
   - Event frequency
   - Event triggers

3. **Business Model Understanding**
   - Revenue model
   - Cost model
   - Obligation model (AR? Cash?)

4. **Unknowns Documentation**
   - Policy decisions not yet made
   - Business rules unclear
   - Data not yet modeled

**Format:** Markdown document (e.g., `{INDUSTRY}_DOMAIN_DISCOVERY.md`)

**Example:** `EDUCATION_FINANCE_DOMAIN_DISCOVERY.md` (Phase 2 evidence)

---

### Gate Criteria

**Phase 0 PASS if:**
- ✅ Domain entities documented (source: actual schema or design)
- ✅ Business events identified (not invented)
- ✅ Business model understood (revenue, cost, obligations)
- ✅ Unknowns documented honestly (no assumptions)

**Phase 0 FAIL if:**
- ❌ Domain understanding shallow (guesswork)
- ❌ Unknowns hidden (assumed away)
- ❌ No stakeholder validation

---

### Prohibited Actions

**During Phase 0, do NOT:**
- ❌ Design financial integration
- ❌ Create Financial Intents
- ❌ Decide accounting treatment
- ❌ Design adapters
- ❌ Write code

**Phase 0 = Pure business domain discovery**

---

## Phase 1: Boundary & Constitution

### Objective

**Question to answer:**
> "Where does Industry OS stop and Finance OS start?"

**Validate:**
> "Does Framework Constitution (frozen) apply to this industry?"

---

### Required Inputs

**Before Phase 1:**
- ✅ Phase 0 complete (Domain Discovery)
- ✅ Framework Constitution v1.0.0 (frozen)

---

### Required Outputs

**Deliverables:**

1. **Industry Boundary Definition**
   - Industry OS responsibilities
   - Integration responsibilities
   - Finance OS responsibilities
   - Prohibited crossings

2. **Constitution Applicability Check**
   - Which Constitution laws apply?
   - Any conflicts detected?
   - Any gaps exposed?

3. **Finance Protection Verification**
   - Industry does NOT create journal entries? ✅
   - Industry does NOT choose GL accounts? ✅
   - Finance remains accounting authority? ✅

**Format:** Markdown document (e.g., `{INDUSTRY}_BOUNDARY_DEFINITION.md`)

---

### Gate Criteria

**Phase 1 PASS if:**
- ✅ Boundaries clear (no ambiguity)
- ✅ Constitution applies (no conflicts)
- ✅ Finance Protection maintained

**Phase 1 FAIL if:**
- ❌ Boundary ambiguous (unclear ownership)
- ❌ Constitution conflict detected (law violation)
- ❌ Finance Protection violated (industry owns accounting)

**If FAIL:** Escalate to Framework review (do NOT proceed)

---

### Prohibited Actions

**During Phase 1, do NOT:**
- ❌ Design contract
- ❌ Create Financial Intents
- ❌ Implement adapter
- ❌ Modify Constitution (frozen)

**Phase 1 = Boundary validation only**

---

## Phase 2: Financial Touch Points

### Objective

**Question to answer:**
> "What business events have financial consequences?"

**NOT:**
> "How to account for these events?" (Finance decides)

---

### Required Inputs

**Before Phase 2:**
- ✅ Phase 0 complete (Domain Discovery)
- ✅ Phase 1 complete (Boundary clear)

---

### Required Outputs

**Deliverables:**

1. **Financial Touch Point Catalog**
   - For each business event:
     - Business event name
     - Financial consequence (potential)
     - Financial Intent candidate
     - Accounting treatment: KNOWN / UNKNOWN
     - Policy dependencies

2. **Touch Point Analysis**
   - Which touch points require policy decisions?
   - Which touch points are clear?
   - Which touch points are industry-specific vs. general?

3. **Unknowns Escalation**
   - Policy decisions blocking integration
   - Business rules requiring Product Owner input

**Format:** Markdown document (e.g., `{INDUSTRY}_FINANCIAL_TOUCH_POINTS.md`)

**Example:** `EDUCATION_FINANCE_TOUCH_POINTS.md` (Phase 2 evidence)

---

### Gate Criteria

**Phase 2 PASS if:**
- ✅ All financial touch points identified
- ✅ Financial Intent candidates defined (semantic, not GL)
- ✅ Policy dependencies documented
- ✅ Unknowns escalated (not assumed)

**Phase 2 FAIL if:**
- ❌ Touch points missed (incomplete)
- ❌ Intent candidates specify GL accounts (Finance Protection violation)
- ❌ Unknowns hidden (assumed without Product Owner)

---

### Prohibited Actions

**During Phase 2, do NOT:**
- ❌ Decide accounting treatment (Finance decides)
- ❌ Create journal entries
- ❌ Choose GL accounts
- ❌ Implement adapter
- ❌ Assume business policies (if unknown)

**Phase 2 = Semantic mapping only**

---

## Phase 3: Capability + Policy Space

### Objective

**Question to answer:**
> "What capabilities does this industry need, and what is the policy space?"

**Define:**
- Capability Model (what system CAN do)
- Policy Space (range of valid configurations)

**NOT:**
- Policy Choice (specific policy selection)

---

### Required Inputs

**Before Phase 3:**
- ✅ Phase 0 complete (Domain Discovery)
- ✅ Phase 1 complete (Boundary clear)
- ✅ Phase 2 complete (Touch Points mapped)
- ✅ Product Owner engaged (for policy definition)

---

### Required Outputs

**Deliverables:**

1. **Capability Model**
   - Capabilities required (e.g., Revenue Recognition, Obligation Management)
   - For each capability:
     - Purpose
     - Semantic model
     - Configuration dimensions
     - Policy space (valid configurations)

2. **Policy Space Definition**
   - Not "which policy to use"
   - But "what policies are possible"
   - Configuration schema (abstract)

3. **Product Definition Proposal**
   - Capability model
   - Policy space
   - Generality validation (works for sub-industries?)

4. **Product Definition Gate**
   - Awaits Product Owner approval
   - NO code until approved

**Format:** Markdown document (e.g., `{INDUSTRY}_PRODUCT_DEFINITION_PROPOSAL.md`)

**Example:** `EDUCATION_FINANCE_P1_P4_PRODUCT_DEFINITION_PROPOSAL_V1.md`

---

### Gate Criteria

**Phase 3 PASS if:**
- ✅ Capability Model complete
- ✅ Policy Space adequate (covers sub-industries)
- ✅ **Product Owner approves** (required)
- ✅ Generality validated (not single-model-specific)

**Phase 3 FAIL if:**
- ❌ Capability Model incomplete
- ❌ Policy Space too narrow (single model only)
- ❌ Product Owner rejects
- ❌ Generality not validated

**Phase 3 BLOCKED if:**
- 🟡 Product Owner has not reviewed (WAIT, do NOT proceed)

---

### Prohibited Actions

**During Phase 3, do NOT:**
- ❌ Choose specific policy (define space, not choice)
- ❌ Implement contract
- ❌ Write code
- ❌ Bypass Product Owner approval

**Phase 3 = Product Definition, NOT implementation**

---

## Phase 4: Contract Design

### Objective

**Question to answer:**
> "How to design Industry Finance Contract that is general across sub-industries?"

**Design:**
- Financial Intent types
- Contract schema
- Versioning strategy
- Policy configuration structure

---

### Required Inputs

**Before Phase 4:**
- ✅ Phase 3 complete (Product Definition approved by PO)
- ✅ Framework Constitution v1.0.0 (frozen)
- ✅ Capability Model frozen

---

### Required Outputs

**Deliverables:**

1. **Contract Schema**
   - Financial Intent types (semantic)
   - Metadata requirements
   - Versioning scheme

2. **Policy Configuration Schema**
   - How capabilities configured per tenant/sub-industry
   - Policy profile structure

3. **Contract Design Document**
   - Intent catalog
   - Mapping: Business Event → Financial Intent
   - Policy-aware routing logic (conceptual, not code)

4. **Generality Validation**
   - Contract works for multiple sub-industries?
   - Contract unchanged for new sub-industry?

**Format:** Markdown document (e.g., `{INDUSTRY}_FINANCE_CONTRACT_DESIGN.md`)

---

### Gate Criteria

**Phase 4 PASS if:**
- ✅ Contract schema general (not single-model-specific)
- ✅ Financial Intents semantic (not GL instructions)
- ✅ Policy configuration adequate
- ✅ Generality validated (works for 2+ sub-industries)

**Phase 4 FAIL if:**
- ❌ Contract too specific (single model only)
- ❌ Intents specify GL accounts (Finance Protection violation)
- ❌ Policy hard-coded (not configurable)

---

### Prohibited Actions

**During Phase 4, do NOT:**
- ❌ Implement contract (design only)
- ❌ Write Adapter code
- ❌ Modify Framework Constitution (frozen)
- ❌ Choose GL accounts

**Phase 4 = Contract design, NOT implementation**

---

## Phase 5: E-ARCH Generality Gate

### Objective

**Question to answer:**
> "Does this industry integration meet architecture standards?"

**Verify:**
1. Contract Generality
2. Finance Protection
3. Additive Integration
4. Boundary Clarity
5. Testability

---

### Required Inputs

**Before Phase 5:**
- ✅ Phase 4 complete (Contract Design)
- ✅ Constitution v1.0.0 (frozen)
- ✅ Existing integrations operational (Hospital, etc.)

---

### Required Outputs

**Deliverables:**

1. **E-ARCH-1: Contract Generality**
   - Cross-Industry Test (Hospital + Education + This Industry)
   - New Industry Type Test (mock sub-industry)
   - Capability Independence Test
   - Result: PASS / FAIL

2. **E-ARCH-2: Finance Protection**
   - Adapter does NOT create journal entries? ✅ / ❌
   - Adapter does NOT choose GL accounts? ✅ / ❌
   - Finance remains sole authority? ✅ / ❌
   - Result: PASS / FAIL

3. **E-ARCH-3: Additive Integration**
   - Existing integrations unaffected? ✅ / ❌
   - F1-F5 unchanged? ✅ / ❌
   - Result: PASS / FAIL

4. **E-ARCH-4: Boundary Clarity**
   - Industry / Integration / Finance boundaries clear? ✅ / ❌
   - No ambiguity? ✅ / ❌
   - Result: PASS / FAIL

5. **E-ARCH-5: Testability**
   - Integration testable? ✅ / ❌
   - Regression strategy defined? ✅ / ❌
   - Result: PASS / FAIL

**E-ARCH Gate Document:** `{INDUSTRY}_E_ARCH_GATE_RESULTS.md`

---

### Gate Criteria

**Phase 5 PASS if:**
- ✅ All 5 E-ARCH tests PASS
- ✅ Architecture approved

**Phase 5 FAIL if:**
- ❌ Any E-ARCH test FAIL
- ❌ Generality not proven

**If FAIL:** Return to Phase 4 (refine contract) or Phase 3 (refine capability model)

---

### Prohibited Actions

**During Phase 5, do NOT:**
- ❌ Modify Constitution (frozen)
- ❌ Proceed to implementation if FAIL
- ❌ Bypass architecture approval

**Phase 5 = Architecture gate, NOT implementation**

---

## Phase 6: Implementation

### Objective

**Question to answer:**
> "How to implement approved contract and adapter?"

**Implement:**
- Industry Adapter
- Policy configuration
- Integration tests

---

### Required Inputs

**Before Phase 6:**
- ✅ Phase 5 complete (E-ARCH gate PASS)
- ✅ Contract Design approved
- ✅ Common Integration Runtime available (if extracted)

---

### Required Outputs

**Deliverables:**

1. **Industry Adapter Implementation**
   - Business event → Financial intent transformer
   - Policy evaluation logic
   - Idempotency handling

2. **Policy Profile Implementations**
   - Configuration for each sub-industry (if applicable)
   - Policy validation

3. **Integration Tests**
   - Happy path tests
   - Error handling tests
   - Idempotency tests

4. **Implementation Documentation**
   - Architecture decisions
   - Code structure
   - Deployment guide

---

### Gate Criteria

**Phase 6 PASS if:**
- ✅ Adapter implemented (follows approved design)
- ✅ Integration tests pass
- ✅ Finance Protection maintained (verified)
- ✅ No Constitution violations

**Phase 6 FAIL if:**
- ❌ Adapter violates Constitution
- ❌ Tests fail
- ❌ Finance Protection violated

---

### Prohibited Actions

**During Phase 6, do NOT:**
- ❌ Modify Contract Design (approved in Phase 4)
- ❌ Violate Constitution
- ❌ Bypass tests

**Phase 6 = Implementation per approved design**

---

## Phase 7: Verification

### Objective

**Question to answer:**
> "Does implementation match design? Is integration verified?"

**Verify:**
- Implementation correctness
- Regression (existing integrations intact)
- Performance
- Evidence collection

---

### Required Inputs

**Before Phase 7:**
- ✅ Phase 6 complete (Implementation done)
- ✅ Test infrastructure ready

---

### Required Outputs

**Deliverables:**

1. **Integration Test Results**
   - All integration tests PASS
   - Coverage report

2. **Regression Test Results**
   - Hospital integration intact? ✅ / ❌
   - Education integration intact? ✅ / ❌
   - F1-F5 invariants maintained? ✅ / ❌

3. **Performance Test Results**
   - Throughput acceptable
   - Latency acceptable
   - Resource usage acceptable

4. **Evidence Package**
   - Test results
   - Logs
   - Metrics
   - Audit trail

**Verification Document:** `{INDUSTRY}_VERIFICATION_RESULTS.md`

---

### Gate Criteria

**Phase 7 PASS if:**
- ✅ Integration tests PASS
- ✅ Regression tests PASS (existing integrations unaffected)
- ✅ Performance acceptable
- ✅ Evidence collected

**Phase 7 FAIL if:**
- ❌ Integration tests FAIL
- ❌ Regression tests FAIL (existing broken)
- ❌ Performance unacceptable
- ❌ Evidence incomplete

---

### Prohibited Actions

**During Phase 7, do NOT:**
- ❌ Skip regression tests (required)
- ❌ Deploy without evidence
- ❌ Bypass verification

**Phase 7 = Verification, NOT deployment**

---

## Phase 8: Freeze & Sign-off

### Objective

**Question to answer:**
> "Is this industry integration baseline frozen and ready for production?"

**Finalize:**
- Baseline freeze
- Documentation complete
- Sign-off obtained

---

### Required Inputs

**Before Phase 8:**
- ✅ Phase 7 complete (Verification PASS)
- ✅ All evidence collected

---

### Required Outputs

**Deliverables:**

1. **Baseline Freeze Document**
   - What is frozen (contract, adapter, policies)
   - Version numbers
   - Freeze date

2. **Integration Sign-off**
   - Product Owner sign-off
   - Architecture sign-off
   - Engineering sign-off

3. **Final Documentation Package**
   - All phase deliverables
   - Evidence
   - Deployment guide
   - Runbook

**Sign-off Document:** `{INDUSTRY}_INTEGRATION_SIGN_OFF.md`

---

### Gate Criteria

**Phase 8 PASS if:**
- ✅ Baseline frozen (versioned)
- ✅ Sign-offs obtained (PO, Architect, Engineering)
- ✅ Documentation complete
- ✅ Production-ready

**Phase 8 FAIL if:**
- ❌ Sign-offs missing
- ❌ Documentation incomplete
- ❌ Not production-ready

---

### Prohibited Actions

**After Phase 8, do NOT:**
- ❌ Modify baseline without change control
- ❌ Deploy without sign-off

**Phase 8 = Freeze, then deploy**

---

## Change Control

### When Abstraction Gap Discovered

**If new industry exposes framework gap:**

```
Integration Attempt
    ↓
Abstraction Gap Detected
    ↓
FAIL (stop implementation)
    ↓
Evidence Collection
    ↓
Change Request (to Framework/Template)
    ↓
Framework/Template Review
    ↓
Refine Framework/Template
    ↓
Re-validation (Hospital + Education + Retail + New)
    ↓
If PASS: Freeze updated Framework
    ↓
Re-attempt Industry Integration
```

**Prohibited:**
- ❌ Silently modify Framework to fit one industry
- ❌ Create industry-specific workaround
- ❌ Bypass change control

**Required:**
- ✅ Document evidence (why gap exists)
- ✅ Propose Framework refinement
- ✅ Re-validate with ALL industries (Hospital, Education, Retail, etc.)
- ✅ Freeze updated Framework before proceeding

---

## Template Definition of Done

**Template v1.0 complete when:**

- ✅ Not dependent on Education
- ✅ Not dependent on Retail
- ✅ Can guide Industry from Discovery → Freeze
- ✅ Has Product Definition Gate (Phase 3)
- ✅ Has Contract Design Gate (Phase 4)
- ✅ Has E-ARCH Generality Gate (Phase 5)
- ✅ Has Finance Protection Gate (embedded in all phases)
- ✅ Has evidence/change-control mechanism
- ✅ Distinguishes Policy Space vs. Policy Choice
- ✅ Distinguishes Business Truth vs. Financial Truth
- ✅ Does NOT require SDK/Runtime to understand or apply

---

## Template Validation

**This template will be validated against:**

| Industry | Phase Reached | Template Adequate? |
|----------|---------------|-------------------|
| Hospital | Phase 8 (Complete) | ✅ Retroactively validates |
| Education | Phase 3 (Pending PO) | 🟡 In progress |
| Retail | Phase 2 (Discovery only) | ✅ Validates discovery process |

**Template FROZEN when:**
- Hospital retroactively fits template? ✅
- Education follows template? ✅
- Retail discovery followed template? ✅

**If any industry does NOT fit template:**
→ Refine template  
→ Re-validate  
→ Freeze updated template

---

## Appendix A: Phase Summary Table

| Phase | Objective | Key Question | Gate | Deliverable |
|-------|-----------|--------------|------|-------------|
| 0 | Domain Discovery | What is business truth? | Discovery Complete | `{INDUSTRY}_DOMAIN_DISCOVERY.md` |
| 1 | Boundary & Constitution | Where boundaries? | Boundary Clear | `{INDUSTRY}_BOUNDARY_DEFINITION.md` |
| 2 | Financial Touch Points | What has financial effect? | Touch Points Mapped | `{INDUSTRY}_FINANCIAL_TOUCH_POINTS.md` |
| 3 | Capability + Policy Space | What policy space? | **Product Definition (PO)** | `{INDUSTRY}_PRODUCT_DEFINITION.md` |
| 4 | Contract Design | How design general contract? | Contract General | `{INDUSTRY}_CONTRACT_DESIGN.md` |
| 5 | E-ARCH Gate | Architecture approved? | **E-ARCH 5/5 PASS** | `{INDUSTRY}_E_ARCH_RESULTS.md` |
| 6 | Implementation | How implement? | Integration Functional | Adapter code + tests |
| 7 | Verification | Does it work? | Evidence Collected | `{INDUSTRY}_VERIFICATION_RESULTS.md` |
| 8 | Freeze & Sign-off | Baseline frozen? | Sign-offs Obtained | `{INDUSTRY}_SIGN_OFF.md` |

---

## Appendix B: Critical Gates

**3 gates block progression:**

### Gate 1: Product Definition (Phase 3)

**Blocker:** Product Owner must approve Capability Model + Policy Space

**Cannot proceed to Phase 4 without PO approval**

**Example:** Education currently at this gate (🟡 Awaiting PO)

---

### Gate 2: E-ARCH (Phase 5)

**Blocker:** Architecture must approve contract generality

**5 tests must PASS:**
1. Contract Generality
2. Finance Protection
3. Additive Integration
4. Boundary Clarity
5. Testability

**Cannot proceed to Phase 6 without E-ARCH approval**

---

### Gate 3: Verification (Phase 7)

**Blocker:** Regression tests must PASS

**Existing integrations must remain intact**

**Cannot proceed to Phase 8 without verification**

---

## Appendix C: Finance Protection Checklist

**Every phase must verify:**

- [ ] Industry does NOT create journal entries
- [ ] Industry does NOT choose GL accounts
- [ ] Industry does NOT decide DR/CR
- [ ] Industry owns business truth only
- [ ] Finance owns financial truth only
- [ ] Integration transforms semantics only
- [ ] Finance applies accounting treatment
- [ ] F1-F5 invariants maintained

**If ANY checklist item fails → STOP and escalate**

---

## Appendix D: Template vs. Framework vs. Runtime

**Clarification:**

| Artifact | Purpose | Status |
|----------|---------|--------|
| **Constitution** | Laws (what must be true) | 🔒 FROZEN v1.0.0 |
| **Template** | Process (how to integrate) | 🟢 THIS DOCUMENT |
| **Runtime** | Execution (shared infrastructure) | 🟡 TO BE EXTRACTED |
| **SDK** | Tools (developer convenience) | 🟡 DEFERRED |

**Template does NOT depend on Runtime or SDK.**

**New industry can follow Template even if Runtime not yet extracted.**

---

## Document Status

**Version:** 1.0.0 DRAFT  
**Status:** AWAITING VALIDATION  
**Validation:** Hospital (retroactive), Education (in progress), Retail (partial)

**Template FROZEN when:**
- ✅ Hospital fits template retroactively
- ✅ Education follows template (when Phase 3 unblocked)
- ✅ Retail discovery validated template

**Next:** Validate template against Hospital/Education/Retail evidence

---

**END OF BELLA INDUSTRY INTEGRATION TEMPLATE V1.0**

**Process standardized. Governance formalized. Framework operationalized.**

**Education remains 🟡 Awaiting PO — governance maintained.**
