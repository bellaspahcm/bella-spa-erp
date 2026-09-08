# NEXT CHECKPOINT — IMPLEMENTATION DESIGN

**Date:** 2026-09-06  
**Previous:** Governance Reconciliation (conditionally accepted) + Human Decision (approved)  
**Current:** Implementation Design required  
**Status:** 🔄 **NOT STARTED**

---

## Purpose

**NOT:** Start coding  
**BUT:** Design implementation based on approved governance decisions

**Output:** Evidence-based implementation design ready for human approval

---

## Approved Scope (from Human Decision)

✅ **Industry Discovery Governance** = Platform-level reusable capability  
✅ **Canonical ownership** = Reuse existing mechanisms (Architecture Guard, BDGF, Evidence Collector, etc.)  
✅ **New governance** = Only genuine gaps (discovery lifecycle, reference product limit)  
✅ **Capability Identity** = Option B (DEFER semantic duplication)  
❌ **No implementation** until this checkpoint complete

---

## Implementation Design Tasks

### Task 1: Complete Raw Evidence Collection

**For each existing mechanism, document:**

1. **Architecture Guard**
   - File: `scripts/architecture/architecture-guard.ts`
   - Current capabilities (with line references)
   - Extension points for Product boundaries
   - Configuration structure for Industry patterns
   - How to add Product layer rules
   - How to enforce Contract-only access

2. **BDGF (Bella Database Governance Framework)**
   - Files: `scripts/bdgf/*.mjs`
   - Approval workflow mechanism
   - Gate token structure
   - How to adapt for non-DB approvals (Kernel promotion, Scope approval)
   - Integration points

3. **Evidence Collector**
   - File: `scripts/governance/evidence-collector.ts`
   - Current evidence types
   - Extension pattern for new evidence types
   - How to add stage-specific requirements
   - Integration with Factory

4. **Regression Gate**
   - File: `scripts/governance/check-regression.ts`
   - Current baseline mechanism
   - How to integrate with Industry Discovery lifecycle

5. **Freeze Check**
   - Part of Architecture Guard
   - Current FROZEN/SEALED layer mechanism
   - How to apply to Qualified Industry OS

**Output:** Evidence index with file paths, line ranges, capabilities, extension points

---

### Task 2: Design Extensions to Existing Mechanisms

**Based on Task 1 evidence, design:**

#### 2.1 Architecture Guard Extensions

**Requirement:** Enforce Product → Contract boundary

**Design questions:**
- How to add Product layer to `FROZEN_LAYERS`?
- How to define `forbiddenImports` for Product bypassing Contract?
- How to detect DB direct access patterns?
- Configuration structure for Industry-specific rules?

**Output:** Architectural design (not code yet)

#### 2.2 BDGF Workflow Adaptation

**Requirement:** Human approval for Kernel promotion and Scope definition

**Design questions:**
- How to adapt gate token mechanism for non-DB approvals?
- Workflow for AI proposal → Human review → Approval → Execute?
- Integration with existing BDGF infrastructure?

**Output:** Workflow design (not code yet)

#### 2.3 Evidence Collector Extensions

**Requirement:** Collect stage-specific evidence (Discovery → Manufacturing transition)

**Design questions:**
- What evidence types are needed?
- How to extend current evidence collection?
- Integration with Factory P2?

**Output:** Evidence schema design (not code yet)

---

### Task 3: Design New Minimal Components

**For genuine governance gaps not owned by existing mechanisms:**

#### 3.1 Reference Product Limit Guard

**Requirement:** Enforce max 2 Reference Products during Discovery phase

**Design questions:**
- How to count Reference Products?
- How to distinguish Discovery vs. Manufacturing phase?
- How to allow human exception approval?
- Exit codes? (0 = allow, 2 = block, require exception)

**Output:** Guard design (not code yet)

#### 3.2 Discovery Lifecycle Management

**Requirement:** Define and track Discovery → Manufacturing transition

**Design questions:**
- How to define lifecycle states?
- How to track which phase Industry OS is in?
- Configuration? (`.kiro/governance/industry-discovery.json`?)

**Output:** Lifecycle model design (not code yet)

#### 3.3 Scope Approval Workflow

**Requirement:** Human approval of Product scope before implementation

**Design questions:**
- How does AI propose scope?
- How does human review and approve?
- Where is approved scope stored?
- How does guard enforce approved scope?

**Output:** Workflow design (not code yet)

#### 3.4 Capability Promotion Workflow

**Requirement:** Human approval for promoting capability to Kernel

**Design questions:**
- How does AI detect candidate capabilities?
- How does AI collect evidence?
- How does human review and decide?
- Integration with BDGF approval pattern?

**Output:** Workflow design (not code yet)

---

### Task 4: Define Validation Criteria

**For each component, define:**

1. **How to verify it works?**
   - What evidence proves the guard is enforcing?
   - What tests are needed?

2. **Success criteria**
   - What does "working" mean?
   - How to measure effectiveness?

3. **Failure modes**
   - What can go wrong?
   - How to detect and recover?

**Output:** Validation plan for each component

---

### Task 5: Estimate Effort (Evidence-Based)

**ONLY after Tasks 1-4 complete:**

- Review designed components
- Estimate implementation effort based on actual extension points
- Compare with existing mechanism complexity
- Provide range (optimistic / realistic / pessimistic)

**Note:** These are estimates for implementation planning, not commitments

**Output:** Evidence-based effort estimate

---

### Task 6: Document Implementation Design

**Create:** `docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_IMPLEMENTATION_DESIGN.md`

**Contents:**
- Evidence index (Task 1)
- Extension designs (Task 2)
- New component designs (Task 3)
- Validation criteria (Task 4)
- Effort estimates (Task 5)
- Open questions
- Recommendations

---

## Success Criteria for This Checkpoint

**Checkpoint complete when:**

1. ✅ Raw evidence collected for all existing mechanisms (with file paths, line ranges)
2. ✅ Extensions designed for all reusable mechanisms (architectural design, not code)
3. ✅ New components designed for genuine gaps (architectural design, not code)
4. ✅ Validation criteria defined for each component
5. ✅ Effort estimates provided (evidence-based, after design)
6. ✅ Implementation design document complete
7. ⏸️ Human approval of implementation design

**Then (and only then):** Implementation checkpoint authorized

---

## What This Checkpoint Is NOT

❌ **NOT:** Start implementing guards  
❌ **NOT:** Write code  
❌ **NOT:** Estimate LOC before designing  
❌ **NOT:** Skip evidence collection  
❌ **NOT:** Assume extension points without verification

---

## Core Principle

> **Design before coding. Evidence before design. Decision before evidence collection.**

```text
Decision ✅
    ↓
Evidence Collection (Task 1) ⏸️
    ↓
Design (Tasks 2-3) ⏸️
    ↓
Validation Planning (Task 4) ⏸️
    ↓
Estimation (Task 5) ⏸️
    ↓
Human Approval ⏸️
    ↓
Implementation 🔒
```

---

## Expected Timeline

**This checkpoint:** Evidence collection + design (no coding)

**Estimated effort:** 
- Task 1 (Evidence): 2-3 hours (file reading + documentation)
- Task 2-3 (Design): 3-4 hours (architectural design)
- Task 4 (Validation): 1-2 hours (criteria definition)
- Task 5 (Estimation): 1 hour (after design complete)
- Task 6 (Documentation): 1-2 hours (compilation)

**Total:** ~8-12 hours for complete Implementation Design checkpoint

**No coding during this phase.**

---

## Next Checkpoint After This

**If approved:** Implementation checkpoint
- Extend existing mechanisms
- Implement new minimal components
- Create validation tests
- Collect evidence
- Human qualification

**If refined:** Iterate on design based on feedback

**If rejected:** Document reasons, defer or cancel

---

## Status

🔄 **NOT STARTED** — Awaiting initiation of Implementation Design tasks

**No implementation authorization until this checkpoint complete and approved.**

---

**Checkpoint defined. Ready to begin when authorized.**
