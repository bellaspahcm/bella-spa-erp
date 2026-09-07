# Gate 2 — Root-Cause Proof CLOSURE

**Status:** ✅ CLOSED  
**Date:** September 7, 2026  
**Workstream:** BELLA TYPE-SYSTEM ROOT-CAUSE & HARDENING

---

## Executive Summary

**Gate 2 completed successfully.** Three distinct systemic failure mechanisms proven through controlled investigation of representative hotspots.

**Key achievement:** Demonstrated that **type-system debt has architectural structure, not 251 random errors.**

**Closure rationale:** Sufficient root-cause evidence collected to design targeted architectural hardening (Gate 3). NOT because all diagnostics resolved.

---

## Completion Status

```text
BELLA TYPE-SYSTEM ROOT-CAUSE & HARDENING
────────────────────────────────────────

Gate 1 — Canonical Diagnosis       ✅ CLOSED
Gate 2 — Root-Cause Proof          ✅ CLOSED

Representative findings
├── Preschool
│   └── Generator drift            ✅ PROVEN
│
├── AutoMove
│   └── Consumer/schema drift      ✅ PROVEN
│
├── Business Truth
│   └── Contract/export drift      ✅ PROVEN
│
└── Healthcare
    ├── Governance coverage gap    ✅ PROVEN
    └── Diagnostic root cause      ⚪ UNRESOLVED
```

**Root-cause proof complete:** 3/4 hotspots (Healthcare deferred due to scope gap)

---

## Three Proven Systemic Mechanisms

### Mechanism A: Generator Drift (Preschool)

**What:**
```text
Database schema evolves (migration applied)
→ Generated types NOT refreshed
→ Static types diverge from runtime schema
→ Typed queries fail (missing table/column definitions)
```

**Evidence:**
- Preschool migration: Sept 7, 6:21 AM
- Generated types: Sept 3, 7:22 PM (4-day gap)
- Controlled experiment: Type regeneration eliminated 24/29 diagnostics (83%)
- **NO consumer code changes required**

**Attribution:** 24/29 diagnostics eliminated (82.8%)

**Boundary:** Generator (Supabase type generation)

**Remediation target:** Automate type regeneration trigger post-migration

**Documents:**
- [Hotspot #1 Investigation](GATE2_HOTSPOT1_STUDENT_ACTIONS_INVESTIGATION.md)

---

### Mechanism B: Consumer/Schema Column Name Drift (AutoMove)

**What:**
```text
Consumer code expects column names
→ Canonical schema defines DIFFERENT names
→ Generated types correctly reflect schema
→ Typed queries fail (consumer expects non-existent columns)
```

**Evidence:**
| Consumer Uses | Schema Has | Errors |
|---------------|------------|--------|
| `total_price` | `total_amount` | 4 |
| `tax_rate` | `tax_amount` | 2 |
| `description` | `work_description` | 1 |

**Attribution:** 100% (11/11 diagnostics)

**Boundary:** Consumer code ↔ Canonical schema

**Remediation target:** Schema-first validation or align consumer code with canonical names

**Documents:**
- [Hotspot #3 Investigation](GATE2_HOTSPOT3_AUTOMOVE_INVESTIGATION.md)

---

### Mechanism C: Contract Import/Property Drift (Business Truth)

**What:**
```text
C1: Consumer imports from wrong module path
C2: Consumer uses wrong property names in shared contracts
→ Module boundaries not enforced
→ Type errors at import/access sites
```

**Evidence:**

**Sub-mechanism C1 (5 diagnostics):**
- Consumer imports: `Evidence` from `'../types/business-truth'`
- Canonical export: `Evidence` from `'../types/provenance'`

**Sub-mechanism C2 (5 diagnostics):**
- Consumer: `truth.type` → Schema: `truth.contentType`
- Consumer: `conflict.description` → Schema: `conflict.nature`

**Attribution:** 10/13 diagnostics attributed (77%)

**Boundary:** Module boundaries, shared type contracts

**Remediation target:** Contract versioning + import linting

**Documents:**
- [Hotspot #4 Investigation](GATE2_HOTSPOT4_BUSINESS_TRUTH_INVESTIGATION.md)

---

### Mechanism D: Governance Coverage Gap (Healthcare)

**What:**
```text
Services layer (src/services/**) excluded from scoped typecheck
→ Diagnostics invisible to governance gates
→ False confidence (45/45 PASS while production code has errors)
```

**Evidence:**
- `src/services/healthcare/healthcare-actions.ts`: 65 diagnostics (Gate 1)
- `tsconfig.platform-healthcare.json`: Only includes `src/platform/healthcare/**`
- Services layer NOT in 45 Platform scoped configs

**Impact:**
- Gate 1's 251 diagnostic count included unscoped files
- Production code NOT covered by governance gates
- **Coverage model mismatch** between full-program and scoped checks

**Boundary:** Governance scope architecture

**Remediation target:** Extend governance coverage to services layer

**Documents:**
- [Hotspot #2 Investigation](GATE2_HOTSPOT2_HEALTHCARE_INVESTIGATION.md)

---

## Healthcare Hotspot Status

**Classification:** INCONCLUSIVE (NOT failed)

**Proven:** Governance coverage gap exists

**NOT proven:** Root cause of 65 diagnostics

**Why deferred:**
- Healthcare-actions.ts in `src/services/**` (unscoped layer)
- Cannot execute controlled baseline measurement (module resolution breaks in isolation)
- Full-program timeout prevents reliable diagnostic capture
- Baseline from Gate 1 unreliable (from timeout-affected run)

**Decision:** Fix coverage architecture first, THEN investigate Healthcare diagnostics against reliable baseline.

**Do NOT interpret as:** "Healthcare is unsolvable" or "Healthcare has no root cause"

**Interpret as:** "Healthcare investigation blocked by governance scope gap; remediation deferred to Gate 3 coverage work"

---

## Key Insight

**Type-system debt has STRUCTURE.**

NOT "251 random errors to fix one by one."

Four distinct architectural failure modes:
1. **Generator staleness** (Preschool)
2. **Schema/code name mismatch** (AutoMove)
3. **Contract/module boundary drift** (Business Truth)
4. **Governance blind spots** (Healthcare services)

Each mechanism requires **different architectural remediation:**
- A → Automate type regeneration trigger
- B → Schema-first validation or code generation
- C → Contract versioning + import linting
- D → Extend scope coverage

**Mass "fix all 251 errors" approach would have:**
- ❌ Mixed unrelated fixes without understanding
- ❌ No architectural learning
- ❌ No prevention strategy
- ❌ Risk of introducing new errors
- ❌ Symptom treatment, not root-cause remedy

**Gate 2 structured approach delivered:**
- ✅ Three proven root causes with controlled experiments
- ✅ Clear mechanism classification
- ✅ Targeted remediation paths identified
- ✅ Architectural visibility into type-system debt structure
- ✅ Prevention strategy framework established

---

## Gate 2 Exit Criteria — All Met ✅

```text
✅ 4 hotspots investigated with root-cause protocol
✅ Each investigated hotspot has evidence (3 proven, 1 gap identified)
✅ Systemic vs isolated: THREE SYSTEMIC MECHANISMS identified
✅ Generator/boundary/consumer responsibility mapped
✅ Remedy strategy framework designed (not yet implemented)
✅ Scoped typecheck remains 45/45 PASS (preserved throughout)
```

**Additional achievement:** Governance coverage gap discovered (Mechanism D)

---

## NOT Authorized at Gate 2 Closure

❌ **Mass diagnostic fixing** — mechanisms not yet remediated at source

❌ **Consumer code changes** — except for controlled experiments

❌ **Healthcare diagnostic resolution** — coverage gap must be fixed first

❌ **Production deployment** — type-system hardening required

---

## Authorized at Gate 3 Entry

✅ **Architectural remediation** — build prevention gates for proven mechanisms

✅ **Governance hardening** — extend coverage, strengthen gates

✅ **Factory capability updates** — add type-contract integrity requirement

✅ **Targeted fixes** — ONLY after corresponding prevention gate exists

---

## Transition to Gate 3

**Gate 3 objective:** Architectural Hardening + Prevention Gate Construction

**NOT:** "Fix 251 errors"

**BUT:** "Build architectural safeguards that prevent these 4 mechanisms from recurring"

**Strategic shift:**

```text
BEFORE GATE 2:
"Which TypeScript errors need fixing?"

AFTER GATE 2:
"Which Factory rules are missing that allowed this drift class to exist?"
```

This is the correct approach before Bella scales to more Industry OSes.

---

## Gate 3 Priority Framework

### Priority 1: Schema-Type Synchronization (Mechanism A)

**Why first:** Controlled experiment proven (83% attribution with zero consumer changes)

**Target:** TG-1 Schema-Type Sync Gate

**Trigger:** Migration/schema change → generated DB types must match → mismatch = BLOCK

---

### Priority 2: Production Source Coverage Integrity (Mechanism D)

**Why second:** False confidence risk (governance PASS while production code uncovered)

**Target:** TG-2 Production Coverage Gate

**Requirement:** Every production TS/TSX → belongs to governed typecheck → uncovered = BLOCK

---

### Priority 3: Consumer-Schema Contract Enforcement (Mechanism B)

**Why third:** After coverage fixed, enforce schema-first contracts

**Target:** TG-3 Consumer-Schema Contract Gate

**Requirement:** Consumer DB access → conform to canonical schema → unknown column = BLOCK

---

### Priority 4: Shared Contract Integrity (Mechanism C)

**Why fourth:** Shared contracts less critical than data-layer contracts

**Target:** TG-4 Shared Contract Integrity Gate

**Requirement:** Canonical contracts → valid imports + properties → drift = BLOCK

---

### Priority 5: Repository-Wide Typecheck Scalability

**Why last:** Architectural issue, not correctness risk

**Investigation deferred:** Full-program timeout (>300s) separate from diagnostic resolution

---

## Factory Capability Requirement — NEW

**From Gate 3 forward, a capability is NOT construction-eligible for closure when:**

```text
Build                    ✅
Runtime                  ✅
E2E                      ✅

BUT

Type Contract Integrity  ❌
```

**New principle:**

> **"Runtime works" is NOT sufficient for Factory closure. Static contract integrity is mandatory.**

Factory must protect:
- Schema-type synchronization
- Consumer-schema contracts
- Shared contract/export integrity
- Governance coverage

**No more:** "It runs in production so it's done."

**Now:** "Static contract verified, THEN runs, THEN done."

---

## Documents Generated During Gate 2

1. [Gate 1 Canonical Diagnosis](GATE1_CANONICAL_DIAGNOSIS_COMPLETE.md) ✅
2. [Hotspot #1 Preschool Investigation](GATE2_HOTSPOT1_STUDENT_ACTIONS_INVESTIGATION.md) ✅
3. [Hotspot #2 Healthcare Investigation](GATE2_HOTSPOT2_HEALTHCARE_INVESTIGATION.md) ⚠️
4. [Hotspot #3 AutoMove Investigation](GATE2_HOTSPOT3_AUTOMOVE_INVESTIGATION.md) ✅
5. [Hotspot #4 Business Truth Investigation](GATE2_HOTSPOT4_BUSINESS_TRUTH_INVESTIGATION.md) ✅
6. [Gate 2 Closure](GATE2_ROOT_CAUSE_PROOF_CLOSURE.md) ✅ (this document)

---

## Commits

- `86d705a` — Database types regenerated with preschool schema (Hotspot #1 experiment)
- `7007a6b` — Hotspot #1 claims refined to evidence boundary
- `5c250a5` — Hotspot #2 Healthcare scope limitation discovered
- `5c9e557` — Hotspot #2 Healthcare claim refined (coverage model)
- `9b11efb` — Hotspot #3 AutoMove consumer/schema drift proven
- `977aa42` — Hotspot #4 Business Truth contract drift proven + Gate 2 complete

---

## Next Workstream

**Gate 3 — Architectural Hardening**

**Focus:** Build prevention gates for proven mechanisms (NOT mass diagnostic fixing)

**Success criteria:** Four architectural gates operational, governance coverage extended

**Status:** 🟡 READY TO START

---

## Closure Statement

**Gate 2 successfully completed.**

Three systemic failure mechanisms proven with controlled experiments. Type-system debt structure revealed. Architectural remediation framework established.

**Factory now has the evidence base to build durable type-contract integrity governance, not just fix symptoms.**

**Bella TYPE-SYSTEM ROOT-CAUSE & HARDENING transitions from diagnosis/proof phase to architectural prevention phase.**

**Gate 2 CLOSED.**  
**Gate 3 AUTHORIZED.**
