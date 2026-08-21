# ADR-002: Platform Core Freeze Criteria and Governance
**Status:** PROPOSED  
**Date:** August 22, 2026 (Day 3 - Architecture Proof Week)  
**Deciders:** Platform Architecture Team, CTO  
**Impact:** HIGH — Controls all Platform Core modifications  
**Related:** ADR-001 (Core-Kernel Boundary), Healthcare Constitution, Education Constitution

---

## 📋 EXECUTIVE SUMMARY

**Decision:** Freeze Platform Core with strict modification criteria and governance process.

**Rationale:** Bella has proven Platform-of-Platforms architecture with Healthcare Kernel 1:3 reusability ratio, zero P0 violations, and 100% contract-first compliance. Current Platform Core is sufficient for 5 Industry OS. Future modifications must be evidence-based and justified.

**Impact:** Ensures architectural stability, protects reusability pattern, enables predictable scaling.

**Key Metric:** Core modification rate → Target: **0 changes per quarter** after freeze.

---

## 🎯 CONTEXT

### Current State (Day 3 Evidence)

**Platform Architecture Validated:**
```
Platform Core (Foundation + Infrastructure)
    ↓
Industry OS Kernels (Healthcare, Finance, Education, Real Estate, Accounting)
    ↓ Public Contracts
Product Verticals (Hospital, Clinic, Dental, Education, Real Estate)
```

**Measured Evidence:**
- ✅ **5 Industry Kernels** built on current Platform Core
- ✅ **Healthcare 1:3 reusability ratio** (1 Kernel → 3 Products)
- ✅ **39+ engines** across 5 Industry OS
- ✅ **Zero engine duplication** found
- ✅ **100% contract-first compliance** in products
- ✅ **0 P0 architectural violations**
- ✅ **Marginal cost decreasing** (3rd product ~20% of 1st)

**Strategic Pivot:**
- **OLD:** "Build more Industry Kernels to prove platform works"
- **NEW:** "Freeze proven Core, scale by adding products/kernels with zero Core changes"

### Problem Statement

**Without Core Freeze:**
- Platform Core becomes "kitchen sink" for any shared code
- "Convenience" changes accumulate without architectural review
- Reusability degraded by industry-specific logic creeping into Core
- Unpredictable breaking changes to Kernel contracts
- Cost of new Industry OS increases (not decreases) over time

**With Core Freeze:**
- Clear boundary between Core / Kernel / Product
- Predictable platform stability
- Reusability pattern protected
- Marginal cost continues decreasing
- Architectural discipline enforced

---

## 🏛️ DECISION

### Core Freeze Declaration

**Effective Date:** [To be determined — after 100% inventory + P1/P2 debt remediation]

**Scope:** All code under `src/foundation/`, `src/core/`, and Platform Core components in `src/platform/` (event bus, state machine, runtime, policy engine, etc.)

**Principle:**
> **"Core may only change when the change serves ≥2 Industry OS and does not contain domain-specific logic."**

**Goal:**
> **"Build next Industry OS with ZERO Platform Core modifications."**

---

## ✅ CORE FREEZE CRITERIA (9 Mandatory Gates)

Any change to Platform Core MUST satisfy ALL 9 criteria:

### Gate 1: Multi-Industry Requirement
**Criterion:** Capability must be used by **≥2 Industry OS** (Healthcare, Finance, Education, Real Estate, etc.)

**Examples:**
- ✅ Event bus (all industries need events)
- ✅ State machine (all industries need workflows)
- ✅ Policy engine (all industries need rules)
- ❌ HIPAA compliance logic (Healthcare only → Healthcare Kernel)
- ❌ Tuition calculation (Education only → Education Kernel)

**Verification:** ADR must list ≥2 Industry OS that need this capability.

---

### Gate 2: Domain-Agnostic Logic
**Criterion:** Core MUST NOT contain business logic specific to any industry domain.

**Examples:**
- ✅ Generic workflow orchestration
- ✅ Tenant isolation
- ✅ Event sourcing infrastructure
- ❌ Patient admission rules (domain logic → Healthcare Kernel)
- ❌ Financial posting rules (domain logic → Finance Kernel)
- ❌ Student enrollment validation (domain logic → Education Kernel)

**Test:** Can this code be used in Beauty Spa OS, Construction OS, Retail OS without modification?

---

### Gate 3: No Reverse Dependencies
**Criterion:** Platform Core MUST NOT import from or depend on Industry Kernels or Product Verticals.

**Allowed dependency flow:**
```
Product → Kernel → Core  ✅
Core → Kernel            ❌ FORBIDDEN
Core → Product           ❌ FORBIDDEN
```

**Verification:** Static analysis must show zero imports from `platform/{healthcare,finance,education,real-estate}/` or `products/` into Core.

---

### Gate 4: Contract Stability
**Criterion:** Changes MUST NOT break existing Public Contracts between Core ↔ Kernel or Kernel ↔ Product.

**Allowed:**
- ✅ Add optional parameters with defaults
- ✅ Add new contracts (versioned)
- ✅ Extend interfaces (backward-compatible)

**Forbidden:**
- ❌ Remove contract methods
- ❌ Change required parameters
- ❌ Change return types (non-compatible)
- ❌ Rename contracts without deprecation period

**Verification:** Run full contract test suite (52+ test files, 119+ tests). All existing tests MUST pass.

---

### Gate 5: Reusability Preserved
**Criterion:** Change MUST NOT reduce reusability ratios or force Industry Kernels to duplicate logic.

**Examples:**
- ✅ Add event bus filtering capability (increases reusability)
- ❌ Hard-code Healthcare-specific event types in Core event bus (decreases reusability)
- ❌ Add Healthcare patient ID to Core tenant context (couples Core to Healthcare)

**Measurement:** After change, reusability ratios must not decrease:
- Healthcare: ≥1:3
- Other Kernels: ≥1:1

---

### Gate 6: Test Coverage + Regression Evidence
**Criterion:** Change MUST include automated tests and evidence that existing functionality is not broken.

**Requirements:**
- ✅ Unit tests for new capability (≥80% coverage)
- ✅ Integration tests with ≥2 Industry Kernels
- ✅ All 52+ existing BDGF/Kernel test suites PASS
- ✅ Regression report showing 0 breaking changes

**Verification:** CI/CD pipeline must pass 100%.

---

### Gate 7: ADR Justification Required
**Criterion:** Every Core modification MUST have an ADR explaining why Core change is necessary and why Kernel/Product layer cannot handle it.

**ADR Template:**
```markdown
# ADR-XXX: [Core Change Title]

## Context
- Which ≥2 Industry OS need this?
- Why can't this be in Kernel layer?
- What is the evidence this is needed?

## Decision
- What exactly changes in Core?
- What contracts are affected?
- What is the migration path?

## Consequences
- How does this affect reusability?
- What is the regression risk?
- How is this enforced going forward?

## Alternatives Considered
- Why not put this in Healthcare Kernel?
- Why not put this in Product layer?
- Why not use existing Core capability?
```

**Verification:** ADR must be reviewed and approved before implementation begins.

---

### Gate 8: Architecture Review Approval
**Criterion:** Core changes MUST be reviewed and approved by Architecture Review Board.

**Review Board:**
- Platform Lead (mandatory)
- Security Lead (mandatory)
- Industry Kernel leads (≥2 representatives)
- CTO (for high-impact changes)

**Review Checklist:**
- [ ] All 9 gates satisfied?
- [ ] ADR complete and convincing?
- [ ] ≥2 Industry OS evidence provided?
- [ ] Alternatives considered and rejected?
- [ ] Test coverage sufficient?
- [ ] Migration plan clear?
- [ ] Rollback plan exists?

**Approval Threshold:** Unanimous consent required (any "no" vote = change rejected).

---

### Gate 9: BDGF Protection in Production
**Criterion:** Core changes MUST be deployed through BDGF governance (Request → Approval → Token → Execution → Audit).

**Requirements:**
- ✅ Core change must be a BDGF-protected migration
- ✅ Approval from Platform Lead + CTO required
- ✅ Rollback plan tested in staging
- ✅ Monitoring + alerting in place
- ✅ Post-deployment verification plan

**Rationale:** Platform Core is too critical to deploy without governance oversight.

---

## ❌ CORE FREEZE REJECTION CRITERIA

Changes are **automatically rejected** if any of these apply:

### Rejection 1: Single-Industry Logic
**Rule:** If capability only serves one Industry OS → belongs in that Industry Kernel.

**Examples:**
- ❌ HIPAA audit logging → Healthcare Kernel (H3 Audit/Compliance Engine)
- ❌ Chart of accounts structure → Finance Kernel (F1 Ledger Engine)
- ❌ Student grade calculation → Education Kernel (Assessment domain)

**Action:** Reject Core change, implement in Kernel layer.

---

### Rejection 2: Product-Specific Features
**Rule:** If capability only serves one Product Vertical → belongs in that Product.

**Examples:**
- ❌ Hospital-specific dashboard widgets → bella-hospital product
- ❌ Dental chair reservation UI → bella-dental product
- ❌ School timetable display → bella-education product

**Action:** Reject Core change, implement in Product layer.

---

### Rejection 3: "Convenience" Changes
**Rule:** If change is made "because it's easier to put it in Core" without architectural justification → reject.

**Examples:**
- ❌ "Let's add this Healthcare helper function to Core so multiple products can use it" → Healthcare Shared Kernel
- ❌ "This validation logic is used in 2 places in Hospital product, let's move to Core" → bella-hospital shared utilities

**Action:** Reject. Solve with proper layering (Shared Kernel or Product utilities).

---

### Rejection 4: Premature Abstraction
**Rule:** If capability is used by only 1 Industry OS today, even if "we might need it for other OS later" → wait for actual need.

**Rationale:** Premature abstractions create wrong interfaces. Wait for 2nd Industry OS to reveal true abstraction.

**Examples:**
- ❌ "Let's make this Healthcare scheduling engine generic so Education can use it later" → Keep in Healthcare Kernel until Education proves they need it

**Action:** Reject. Implement in current Kernel. Refactor to Core when ≥2 Industry OS actually need it.

---

### Rejection 5: Breaking Contract Changes
**Rule:** If change breaks existing Kernel → Core or Product → Kernel contracts → reject or require deprecation cycle.

**Examples:**
- ❌ Rename `IEventBus.publish()` to `IEventBus.emit()` without transition period
- ❌ Change `IStateMachine.transition()` signature without backward-compatible version

**Action:** Reject breaking change OR require:
- Deprecation warning for 1 quarter
- Dual-support for old + new interface
- Migration guide for all Industry Kernels

---

## 🏛️ CORE COMPOSITION (What IS in Core)

### Platform Foundation (`src/foundation/`)

**Approved Core Components:**
```
foundation/
├── organization/          ✅ Multi-tenant org management
├── people/                ✅ Person/user master data
├── assignment/            ✅ Generic assignment logic
└── contracts/             ✅ Foundation contracts
```

**Rationale:** Organization and People are universal across all industries.

---

### Platform Infrastructure (`src/core/`)

**Approved Core Components:**
```
core/
├── events/                ✅ Event bus, event sourcing
├── state-machine/         ✅ Generic workflow engine
├── policy-engine/         ✅ Rules/policy evaluation
├── runtime/               ✅ Execution runtime
├── middleware/            ✅ Core middleware (auth, logging, etc.)
├── plugins/               ✅ Plugin system
├── providers/             ✅ Provider pattern infrastructure
├── services/              ✅ Core services (DI, config, etc.)
└── types/                 ✅ Core type definitions
```

**Rationale:** Infrastructure shared by all Industry Kernels.

---

### Platform Services (`src/platform/[service]/`)

**Approved Core Services:**
```
platform/
├── notification-hub/      ✅ Multi-channel notifications
├── messaging/             ✅ Internal messaging bus
├── document-engine/       ✅ Document generation/storage
├── template-engine/       ✅ Template rendering
├── search-engine/         ✅ Full-text search
├── metadata-engine/       ✅ Metadata management
├── integration-hub/       ✅ External integration orchestration
├── integration-runtime/   ✅ Integration execution
├── contract/              ✅ Contract management
├── ai-orchestrator/       ✅ AI orchestration layer
├── capability-platform/   ✅ Capability registry
├── knowledge/             ✅ Knowledge management
├── kpi-engine/            ✅ KPI tracking (generic)
├── projection-engine/     ✅ Data projections
├── activity-stream/       ✅ Activity logging
├── timeline/              ✅ Timeline management
├── composition/           ✅ Component composition
├── extensions/            ✅ Extension system
├── host/                  ✅ Hosting infrastructure
├── sdk/                   ✅ SDK framework
├── party/                 ✅ Party master data (universal)
├── registry/              ✅ Component registry
├── security/              ✅ Security services (non-domain)
├── config-center/         ✅ Configuration management
├── asset/                 ✅ Asset management (generic)
├── resource-engine/       ✅ Resource allocation (generic)
└── scheduler-registry/    ✅ Scheduling infrastructure
```

**Rationale:** Services used by ≥2 Industry OS, domain-agnostic.

---

### ⚠️ QUESTIONABLE (Requires Review)

```
platform/
├── lead-engine/           ⚠️ CRM-specific? Or multi-industry?
├── journey/               ⚠️ Customer journey = CRM? Or universal?
└── iam-matrix/            ⚠️ IAM = Core? Or specialized?
```

**Action:** Requires investigation during 100% inventory (Task #4-5).

---

## 🚫 WHAT IS NOT IN CORE

### Industry OS Kernels (MUST NOT be in Core)

```
❌ platform/healthcare/     → Healthcare Kernel (H1-H27 engines)
❌ platform/finance/         → Finance Kernel (F1-F2 engines)
❌ platform/accounting/      → Accounting Kernel (shared journal logic)
❌ platform/education/       → Education Kernel (Course, Enrollment, etc.)
❌ platform/real-estate/     → Real Estate Kernel (Property, Reservation, etc.)
```

**Rationale:** Domain-specific logic belongs in Industry Kernels, not Platform Core.

**Note:** These directories are correctly located but conceptually separate from Core.

---

### Product Verticals (MUST NOT be in Core)

```
❌ products/bella-hospital/   → Hospital product
❌ products/bella-medical/    → Clinic product
❌ products/bella-dental/     → Dental product
❌ products/bella-education/  → School product
❌ products/bella-land/       → Real Estate product
```

**Rationale:** Product-specific UI, orchestration, customization.

---

## 🔄 CORE MODIFICATION PROCESS

### Step 1: Evidence Gathering (Before ADR)

**Questions to Answer:**
1. Which ≥2 Industry OS need this capability?
2. Can this be solved in Kernel layer instead?
3. Can this be solved in Product layer instead?
4. What is the evidence this capability is universal?
5. What happens if we DON'T add this to Core?

**Evidence Required:**
- Code references from ≥2 Industry Kernels showing need
- Explanation why Kernel layer cannot handle it
- Explanation why Product layer cannot handle it

---

### Step 2: ADR Creation

**Required Sections:**
- Context (≥2 Industry OS evidence)
- Decision (what changes, why Core)
- Consequences (reusability impact, regression risk)
- Alternatives (why not Kernel/Product layer)

**Review:** Platform Lead + ≥2 Kernel leads review ADR before proceeding.

---

### Step 3: Architecture Review

**Attendees:**
- Platform Lead (mandatory)
- Security Lead (mandatory)
- ≥2 Industry Kernel leads
- CTO (if high-impact)

**Agenda:**
- Present ADR
- Review 9 gate criteria
- Discuss alternatives
- Vote (unanimous approval required)

**Outcome:**
- ✅ Approved → proceed to implementation
- ❌ Rejected → implement in Kernel/Product layer
- ⏸️ Deferred → need more evidence

---

### Step 4: Implementation

**Requirements:**
- Follow ADR specifications exactly
- Write tests (unit + integration with ≥2 Kernels)
- Run full regression suite (52+ test files, 119+ tests)
- Document contract changes
- Create migration guide if breaking

---

### Step 5: Staging Deployment

**Verification:**
- Deploy to staging environment
- Run full test suite in staging
- Verify ≥2 Industry Kernels still work
- Test rollback procedure

---

### Step 6: Production Deployment (via BDGF)

**BDGF Requirements:**
- Create migration request
- Get approval (Platform Lead + CTO)
- Generate BDGF token
- Execute migration with BDGF protection
- Verify execution
- Audit trail captured

---

### Step 7: Post-Deployment Monitoring

**Monitor for 48 hours:**
- Error rates (should not increase)
- Performance (should not degrade)
- Contract usage (no breaking changes)
- Reusability ratios (should not decrease)

**Rollback trigger:** Any of above metrics degrade → immediate rollback.

---

## 📊 SUCCESS METRICS

### Primary Metric: Core Modification Rate

**Target:** **0 Core modifications per quarter** after freeze.

**Measurement:**
```sql
SELECT 
  DATE_TRUNC('quarter', commit_date) AS quarter,
  COUNT(*) AS core_modifications
FROM git_commits
WHERE file_path LIKE 'src/foundation/%' 
   OR file_path LIKE 'src/core/%'
   OR file_path LIKE 'src/platform/[core-services]/%'
GROUP BY quarter
ORDER BY quarter DESC;
```

**Goal:** After Core Freeze, new Industry OS should require ZERO Core changes.

---

### Secondary Metrics

**Reusability Ratios (Should Increase):**
```
Healthcare:   1:3 → Target: 1:5  (3rd → 5th product)
Finance:      1:0 → Target: 1:3  (activate across products)
Accounting:   1:1 → Target: 1:5  (all products use accounting)
Education:    1:1 → Target: 1:3  (K-12, University, Training)
Real Estate:  1:1 → Target: 1:3  (Residential, Commercial, Rental)
```

**Marginal Cost (Should Decrease):**
```
Product #1:   100% effort
Product #2:   ~30% effort
Product #3:   ~20% effort
Product #5:   Target: <10% effort
```

**Time-to-Market (Should Decrease):**
```
First Healthcare Product:  6 months
Second Healthcare Product: 2 months  (67% faster)
Third Healthcare Product:  1 month   (83% faster)
Target (5th Product):      <2 weeks  (90%+ faster)
```

---

## 🚀 CONSEQUENCES

### Positive Consequences

**✅ Architectural Stability:**
- Predictable platform behavior
- Reduced regression risk
- Clear boundaries enforced

**✅ Reusability Protected:**
- Pattern proven with Healthcare 1:3
- Prevents domain logic creeping into Core
- Marginal cost continues decreasing

**✅ Faster Scaling:**
- New Industry OS built without Core changes
- Kernel layer handles domain logic
- Product layer handles customization

**✅ Valuation Support:**
- Evidence-based architectural discipline
- Compound economics (not linear scaling)
- Predictable cost per new product

---

### Negative Consequences

**⚠️ Slower Core Evolution:**
- Changes require extensive justification
- Multi-stakeholder approval process
- May slow down "urgent" changes

**Mitigation:** If ≥2 Industry OS genuinely need capability, process is fast. If only 1 Industry OS needs it, it belongs in Kernel (correct layering).

---

**⚠️ Potential Friction:**
- Developers may resist "bureaucracy"
- "It's easier to just put it in Core" mindset

**Mitigation:** 
- Education on Platform-of-Platforms principles
- Show evidence: Healthcare 1:3 proves layered approach works
- Measure success: Marginal cost decreasing over time

---

## 🔍 MONITORING & ENFORCEMENT

### CI/CD Gates

**Automated Checks (Pre-Merge):**
- [ ] No Core → Kernel imports (static analysis)
- [ ] All 52+ test suites pass (regression)
- [ ] Contract compatibility verified
- [ ] Code coverage ≥80% for Core changes

**Manual Checks (Architecture Review):**
- [ ] ADR exists and complete
- [ ] ≥2 Industry OS evidence provided
- [ ] Alternatives considered
- [ ] Unanimous approval received

---

### Periodic Reviews

**Quarterly Architecture Audit:**
- Review all Core modifications in past quarter
- Measure reusability ratios
- Measure marginal cost trends
- Identify architectural drift
- Update ADR-002 if needed

---

### Exception Process

**What if Core genuinely needs to change?**

If all 9 gates are satisfied, change is approved. Core Freeze is not "no changes ever" — it's "changes require evidence and discipline."

**Example Valid Core Change:**
- Healthcare + Finance both need capability X
- Capability X is domain-agnostic
- ADR justifies why Kernel layer insufficient
- Tests pass, contracts stable, Architecture Review approves
- → Change is approved ✅

---

## 🗓️ TIMELINE

### Phase 1: Preparation (Week 1 — Current)
- [x] Day 1-2: Platform inventory (50% complete)
- [x] Day 2: P0 validation (0 violations found)
- [x] Day 3: Reusability ratios measured (Healthcare 1:3)
- [x] Day 3: ADR-002 created (this document)
- [ ] Day 3-4: 100% inventory + P1/P2 debt identification
- [ ] Day 4-5: Debt remediation plan

---

### Phase 2: Core Freeze Enforcement (Week 2)
- [ ] Architecture Review Board formation
- [ ] CI/CD gates implementation
- [ ] Developer training on Core Freeze process
- [ ] First Architecture Review drill (practice)

---

### Phase 3: Official Freeze (Week 3)
- [ ] Core Freeze declared (effective date)
- [ ] All Core modifications require ADR + review
- [ ] Monitoring dashboards deployed
- [ ] Quarterly audit schedule set

---

### Phase 4: Proof (Week 4-8)
- [ ] Build new Industry OS with 0 Core changes
- [ ] Measure time-to-market reduction
- [ ] Measure cost reduction
- [ ] Validate compound economics

---

## 🔗 RELATED DOCUMENTS

**Architecture:**
- `docs/architecture/ADR-001-CORE-KERNEL-BOUNDARY.md` — Core/Kernel split definition
- `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md` — Healthcare Kernel rules
- `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` — Education Kernel rules

**Evidence:**
- `docs/PLATFORM_REUSABILITY_RATIOS.md` — Measured 1:3 Healthcare ratio
- `docs/BELLA_PLATFORM_INVENTORY_INITIAL.md` — 50% inventory, 0 P0 violations
- `docs/DAY_2_SUMMARY.md` — P0 investigation results
- `docs/EOS_EIP_ARCHITECTURE_CURRENT_STATE.md` — EOS/EIP layers

**Governance:**
- `docs/BDGF_AWS_SECRETS_MANAGER_SETUP.md` — BDGF deployment
- `docs/BDGF_EMERGENCY_PROCEDURES.md` — Incident response
- `scripts/bdgf/*` — BDGF governance scripts

---

## 💡 KEY PRINCIPLES

### 1. Evidence-Based Architecture
> "Core changes require evidence from ≥2 Industry OS, not opinions."

### 2. Reusability First
> "Protect the Healthcare 1:3 pattern. Every change must preserve or improve reusability."

### 3. Marginal Cost Decreasing
> "If 5th product costs more than 3rd product, architecture is regressing."

### 4. Zero Core Changes = Success
> "Next Industry OS should require 0 Core modifications. That proves platform maturity."

### 5. Freeze ≠ Stagnation
> "Core Freeze protects stability. Innovation happens in Kernel + Product layers."

---

## ✅ APPROVAL

**Proposed By:** Platform Architecture Team  
**Date:** August 22, 2026 (Day 3)

**Approval Required:**
- [ ] Platform Lead
- [ ] Security Lead  
- [ ] Healthcare Kernel Lead
- [ ] Finance Kernel Lead
- [ ] Education Kernel Lead
- [ ] Real Estate Kernel Lead
- [ ] CTO

**Effective Date:** [To be determined after 100% inventory + debt remediation]

---

**Status:** PROPOSED (Pending Architecture Review)  
**Next Review:** After Week 1 completion (100% inventory)  
**Version:** 1.0.0

---
