# INDUSTRY DISCOVERY PRINCIPLES

**Date:** 2026-09-06  
**Status:** 🔒 LOCKED  
**Type:** Governance Principles (not framework)

**Purpose:** Core principles for Industry OS development, extracted from Governance Investigation checkpoint.

---

## Context

During Retail OS planning, a governance investigation identified principles for Industry OS discovery without building premature automation.

**Key learning:**

> **Prove pattern with Retail first. Build automation only after pattern repeats.**

---

## 5 Core Principles

### 1. Investigate Before Building

**Principle:**
> **Before implementing a capability, check if Platform or existing Kernel already provides it.**

**Sequence:**
```text
Requirement
    ↓
Platform Core provides? → Use Platform
    ↓
Existing Kernel provides? → Use Kernel
    ↓
Can extend existing? → Extend
    ↓
Only then: Build new capability
```

**Example:** Retail OS runtime investigation discovered Platform provides shared primitives, avoiding duplicate implementation.

---

### 2. Discovery Limit: Max 2 Reference Products

**Principle:**
> **For a new Industry OS, use no more than 2 Reference Products to discover and validate capabilities, unless human explicitly authorizes expansion.**

**⚠️ Important:** This is **current discovery guidance**, not a permanent Platform invariant. Future evidence may justify different limits.

**Rationale:**
- Reference Products exist to **discover** canonical capabilities
- 2 Products sufficient for broad coverage + boundary validation
- More Products = scope creep, diminishing returns
- Human can authorize exception if evidence justifies

**Not automated (yet):**
- No `ReferenceProductGuard.ts`
- No enforcement engine
- Human judgment via roadmap review

**Review after Retail:** Did 2 Products provide sufficient discovery? Too limiting? Adjust based on evidence.

**Apply automation when pattern repeats:** If multiple Industries struggle with scope creep, then consider automation.

---

### 3. Human Decides Business Boundaries

**Principle:**
> **Human decides: business scope, canonical capability, Kernel boundary.**

**Industry OS Construction:**
```text
Reference Products
    ↓
Observe real workflow
    ↓
Discover capabilities
    ↓
Human decides Kernel boundary ← JUDGMENT
    ↓
Build/Qualify Industry OS
    ↓
Factory creates Products
```

**Never automate:**
- Business scope definition
- Canonical capability semantics
- Kernel promotion decisions
- Industry OS boundary

**Can automate:**
- Evidence collection
- Capability detection
- Consistency checks
- Test verification

**Key distinction:**

> **OS needs judgment. Product needs automation.**

---

### 4. Reuse Qualified OS Capability

**Principle:**
> **When Factory creates new Products, Qualified OS capabilities MUST be prioritized for reuse.**

**Sequence:**
```text
Product requirement
    ↓
Qualified OS provides? → REUSE
    ↓
Can extend OS? → EXTEND with evidence
    ↓
Product-specific only? → BUILD (but document why)
```

**Anti-pattern:**
- Building Product-specific capability when OS provides equivalent
- Duplicating OS capability because "easier to build fresh"

**Enforcement:**
- Architecture Guard (boundaries)
- Code review
- Factory schema generation (standard patterns)

---

### 5. Automate Only Proven Patterns

**Principle:**
> **Only automate patterns/invariants proven by evidence. Do not automate unproven patterns.**

**Proven patterns (automate):**
- Architecture boundaries ✅
- Regression protection ✅
- RLS/tenant isolation ✅
- Evidence collection ✅
- Factory schema generation ✅

**Unproven patterns (manual for now):**
- Discovery lifecycle tracking ❌
- Reference Product limit enforcement ❌
- Capability Identity Model ❌
- Semantic duplicate detection ❌
- Governance workflow ❌

**When to automate unproven pattern:**
```text
Pattern observed in Industry #1
    ↓
Pattern repeats in Industry #2
    ↓
Evidence: manual process is bottleneck
    ↓
Design automation
    ↓
Prove automation works
    ↓
Apply to Industry #3+
```

**Current status:** Retail OS is Industry #1 for these patterns. Wait for Industry #2 before automating.

---

## What We Will NOT Build (Yet)

**Not needed until pattern proven across multiple Industries:**

❌ **Industry Discovery Framework**  
❌ **ReferenceProductGuard.ts**  
❌ **DiscoveryLifecycle engine**  
❌ **TransitionGate**  
❌ **Capability Identity Model**  
❌ **Semantic Duplicate Detector**  
❌ **Product Registry**  
❌ **Governance workflow automation**  

**Reason:** Pattern unproven (only Healthcare OS exists, Retail is #2)

---

## Application to Retail OS

### Current State

**Foundation:** ✅ Complete (Schema + Domain + Tests)  
**Runtime:** ⏸️ Pending business decision  
**Reference Products:** 🎯 **Next step**

### Recommended Path

```text
1. Define Reference Product #1 and #2
   ↓
2. Build Products using Platform
   ↓
3. Discover Retail capabilities
   ↓
4. Human decides Kernel boundary
   ↓
5. Extract/Build Retail OS
   ↓
6. Qualify Retail OS
   ↓
7. Factory creates Product #3
   ↓
8. MEASURE Factory leverage:
   - Development time vs Product #1/2
   - LOC reuse percentage
   - Human intervention reduction
   - Automation effectiveness
```

**Governance:** Manual tracking for now (no framework)

---

## Related Documents

**Investigation Evidence:**
- [Governance Decision](INDUSTRY_DISCOVERY_GOVERNANCE_DECISION.md) — Investigation approval
- [Governance Reconciliation](../architecture/GOVERNANCE_RECONCILIATION.md) — Existing mechanisms
- [Implementation Design](INDUSTRY_DISCOVERY_GOVERNANCE_IMPLEMENTATION_DESIGN.md) — Marked STOPPED

**Outcome:** Principles extracted, framework development stopped.

---

## Review Schedule

**Review after:** Retail OS qualification

**Questions to answer:**
1. Did 2 Reference Product limit work for Retail?
2. Did manual governance create bottlenecks?
3. Did patterns repeat from Healthcare to Retail?
4. Is automation justified for any pattern?

**Then decide:** Keep manual or introduce selective automation.

---

**Status:** 🔒 LOCKED  
**Next:** Return to Retail OS — Define Reference Products #1 and #2
