# H3 Product/UX Validation Packet — Bella Haircut Shop

**Date:** 2026-09-15  
**Branch:** `feat/haircut-h2-contract-extraction`  
**Status:** READY FOR PRODUCT/UX SESSION  
**Previous checkpoint:** `H2_CHECKPOINT_2026_09_15.md`  
**Results worksheet:** `H3_PRODUCT_UX_VALIDATION_RESULTS.md`

---

## Purpose

This packet is the entry point after H2 reached the validation gate.

H2 produced a contract hypothesis, not a final platform design. The next step is to validate Haircut business operations before any additional contract design, TypeScript interface work, database schema work, or product implementation.

**Session goal:** answer 12 Product/UX questions and walk through 6 Haircut use cases so H2 Phase 2 can move from proposed requirements to evidence-backed boundary decisions.

---

## Non-Negotiable Constraints

1. Do not re-audit Spa.
2. Do not copy Spa legacy architecture into Haircut.
3. Do not design new contracts during this session.
4. Do not change the contract denominator during this session.
5. Do not claim validation unless a Product/UX/business stakeholder answer is recorded.
6. Treat the H1 baseline of 8 contracts as a hypothesis. Evidence may prove 6, 7, 8, or a different structure.

---

## Evidence Quality Standard

The 12 questions are not a theoretical survey. Each answer must be supported by an actual salon operating scenario, policy, exception case, or field workflow.

Weak evidence:

```text
Q2 = yes
```

Acceptable evidence:

```text
Q2 = yes. When a stylist is changed because of sudden leave, the branch manager needs to know the originally assigned stylist and the final service provider to reconcile revenue, service quality, and performance review.
```

If the session can only produce abstract answers without operating examples, keep the requirement status as `PROPOSED` or mark the specific boundary `UNRESOLVED`.

---

## Required Participants

| Role | Required? | Reason |
|------|-----------|--------|
| Product Owner / Business Owner | Required | Confirms operating rules and commercial priority |
| UX Designer / Workflow Owner | Required | Validates staff/customer interaction flow |
| Salon Operations Representative | Strongly recommended | Confirms real branch behavior and exceptions |
| Architect / Engineering Lead | Required | Records boundary implications, does not design contracts |

---

## Session Outputs

By the end of the session, produce:

1. Answer table for Q1-Q12.
2. Use case validation table for UC1-UC6.
3. Evidence notes for each boundary signal.
4. Updated status for each boundary:
   - `VALIDATED_SEPARATE`
   - `VALIDATED_ABSORBED`
   - `UNRESOLVED`
5. Explicit list of deferred or rejected requirements.

If any core answer is missing, keep H2 Phase 2 open.

Decision rules in this packet are decision aids, not automatic architecture generators. The final boundary decision must consider the question answers and the 6 use case walkthroughs together.

---

## Validation Questions

### A. Professional Assignment

| ID | Question | Allowed Answers | Evidence Required | Boundary Signal |
|----|----------|-----------------|-------------------|-----------------|
| Q1 | How often do stylist/barber reassignments happen? | `daily`, `weekly`, `rare`, `unknown` | Real branch scenario or policy | `daily` strongly suggests separate assignment capability |
| Q2 | Is assignment history business-critical? | `yes`, `no`, `unknown` | Audit, commission, dispute, or analytics need | `yes` strongly suggests separate assignment capability |
| Q3 | Can stylists/barbers reject assignments? | `yes`, `no`, `unknown` | Staff workflow or manager policy | `yes` suggests assignment lifecycle beyond simple FK |
| Q4 | Are stylist/barber no-shows tracked per professional? | `yes`, `no`, `unknown` | Accountability/reporting requirement | `yes` suggests assignment event/history tracking |

**Decision aid:** if Q1=`daily` or Q2=`yes` or Q3=`yes`, keep Professional Assignment as a separate boundary candidate. This is a strong signal, not an automatic decision; UC1-UC4 must still show whether assignment has a lifecycle/history beyond frequent appointment updates.

---

### B. Resource Allocation

| ID | Question | Allowed Answers | Evidence Required | Boundary Signal |
|----|----------|-----------------|-------------------|-----------------|
| Q5 | Are chair/station maintenance windows scheduled? | `regular`, `ad-hoc`, `none`, `unknown` | Branch operating rule | `regular` suggests separate resource availability |
| Q6 | Do stylists share constrained equipment? | `yes`, `no`, `unknown` | Equipment/station capacity model | `yes` suggests resource capacity management |
| Q7 | How often are chairs/stations reassigned? | `frequent`, `rare`, `never`, `unknown` | Manager exception scenarios | `frequent` suggests separate allocation lifecycle |
| Q8 | Are chairs/stations a bottleneck compared with stylists? | `yes`, `no`, `unknown` | Capacity ratio or operational observation | `yes` strengthens resource allocation boundary |

**Decision aid:** if Q5=`regular` or Q6=`yes` or Q7=`frequent`, keep Resource Allocation as a separate boundary candidate. This is a strong signal, not an automatic decision; UC5-UC6 must still show whether resource behavior has lifecycle/availability semantics beyond appointment validation.

---

### C. Professional Recommendation

| ID | Question | Allowed Answers | Evidence Required | Boundary Signal |
|----|----------|-----------------|-------------------|-----------------|
| Q9 | Are walk-in customers auto-assigned to stylists? | `always`, `sometimes`, `never`, `unknown` | Walk-in intake workflow | `always` or `sometimes` confirms recommendation capability need |
| Q10 | Which factors influence stylist recommendation? | Select all: `service`, `availability`, `workload`, `skill`, `rating`, `history`, `vip`, `seniority`, `manual-only` | Real dispatch rules | More factors increase policy/service complexity |
| Q11 | Can managers override recommendations? | `always`, `sometimes`, `never`, `unknown` | Manager authority policy | Override implies recommendation is advisory, not final assignment |
| Q12 | How complex is recommendation logic? | `simple`, `moderate`, `complex`, `unknown` | Rule count and exception handling | `complex` may justify policy/service; not automatically Platform |

**Decision aid:** recommendation is not a persistence boundary unless validated evidence shows it owns durable state or cross-vertical policy. Default classification remains helper/policy, not a contract; complexity alone does not prove Platform ownership.

---

## Use Case Walkthroughs

### UC1 — Customer Books Without Stylist Selection

**Scenario:** Customer selects service and time but does not choose a stylist.

**Validate:**
- Who selects the stylist?
- Is assignment immediate, at confirmation, at check-in, or manual?
- Is customer shown options or only assigned one?
- Is assignment reversible before service starts?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

### UC2 — Customer Requests Busy Stylist

**Scenario:** Customer requests a stylist who is already booked for the same time.

**Validate:**
- Does the system block, warn, waitlist, or allow manager override?
- Are alternatives suggested automatically?
- Does conflict belong to appointment timing or professional assignment?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

### UC3 — Stylist Sick Leave Reassignment

**Scenario:** A stylist with appointments today becomes unavailable before the day starts.

**Validate:**
- Is bulk reassignment required?
- Is reassignment history needed?
- Are customers notified?
- What happens when no replacement is available?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

### UC4 — Stylist Double Booking

**Scenario:** Two appointments overlap for the same stylist.

**Validate:**
- Is this always blocked?
- Is overlap allowed for services with waiting/dwell time?
- Is manager override possible?
- Is conflict checked at booking, assignment, confirmation, or check-in?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

### UC5 — Chair/Station Double Booking

**Scenario:** Two appointments overlap on the same chair or cutting station.

**Validate:**
- Is every service tied to a physical chair/station?
- Can one chair handle multiple service states?
- Are stations pooled, fixed, or skill-specific?
- Does conflict logic differ from stylist conflict logic?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

### UC6 — Chair/Station Maintenance

**Scenario:** A chair/station is unavailable during a time window.

**Validate:**
- Is maintenance scheduled in advance or only ad-hoc?
- Does the resource have status/lifecycle?
- Are existing appointments moved automatically, manually, or cancelled?
- Is this important for MVP or later chain operations?

**Record outcome:**

| Field | Answer |
|-------|--------|
| Valid business flow? | `yes` / `no` / `variant` |
| Actual workflow | |
| Boundary signal | |
| Evidence note | |

---

## Decision Worksheet

### Professional Assignment Boundary

| Evidence | Result |
|----------|--------|
| Q1 reassignment frequency | |
| Q2 assignment history required | |
| Q3 acceptance workflow | |
| Q4 no-show tracking | |
| UC1 no-stylist booking signal | |
| UC2 busy stylist signal | |
| UC3 sick leave signal | |
| UC4 double booking signal | |
| Boundary decision | `VALIDATED_SEPARATE` / `VALIDATED_ABSORBED` / `UNRESOLVED` |

---

### Resource Allocation Boundary

| Evidence | Result |
|----------|--------|
| Q5 maintenance windows | |
| Q6 constrained shared equipment | |
| Q7 reassignment frequency | |
| Q8 resource bottleneck | |
| UC5 chair conflict signal | |
| UC6 maintenance signal | |
| Boundary decision | `VALIDATED_SEPARATE` / `VALIDATED_ABSORBED` / `UNRESOLVED` |

---

### Professional Recommendation Boundary

| Evidence | Result |
|----------|--------|
| Q9 auto-assignment | |
| Q10 recommendation factors | |
| Q11 manager override | |
| Q12 complexity | |
| UC1 no-stylist booking signal | |
| UC2 busy stylist signal | |
| UC3 replacement signal | |
| Boundary decision | `HELPER` / `BEAUTY_POLICY` / `PLATFORM_CANDIDATE` / `UNRESOLVED` |

---

## Boundary Decision Rules

### Separate Boundary

Use `VALIDATED_SEPARATE` only when at least one of these is true:

- The capability owns durable state independent of appointment.
- The capability has lifecycle transitions independent of appointment.
- The capability needs history/audit beyond current assignment/allocation.
- The capability has conflict/availability rules that differ materially from appointment lifecycle.
- Product/UX confirms frequent operational scenarios requiring independent operations.

### Absorbed Boundary

Use `VALIDATED_ABSORBED` only when all of these are true:

- Only current value matters.
- Updates are rare or simple.
- No independent lifecycle is required.
- No independent history/audit is required.
- Conflict rules are simple appointment validation rules.

### Unresolved

Use `UNRESOLVED` when:

- Stakeholders disagree.
- Answers are unknown.
- Scenarios are plausible but not observed.
- MVP and chain-operation answers differ materially.

---

## Phase Gate Result Template

Complete this after the Product/UX session:

```yaml
phase: H3 Product/UX Validation
date:
participants:
status: VALIDATED | PARTIAL | BLOCKED

questions:
  answered: 0
  total: 12

use_cases:
  validated: 0
  total: 6

boundaries:
  professional_assignment: UNRESOLVED
  resource_allocation: UNRESOLVED
  professional_recommendation: UNRESOLVED

contract_inventory:
  h1_baseline: 8
  effective_count: TBD
  change_authorized: false

phase2_status:
  can_close: false
  reason: "Stakeholder answers not recorded yet"
```

---

## Current Status

This packet is ready to run the validation session.

No validation answers have been recorded in this document yet. Therefore:

- Haircut requirements remain `PROPOSED`.
- H2 Phase 2 remains open.
- H2 Phase 3 remains blocked.
- Contract inventory remains 8 as the unchanged H1 hypothesis.
