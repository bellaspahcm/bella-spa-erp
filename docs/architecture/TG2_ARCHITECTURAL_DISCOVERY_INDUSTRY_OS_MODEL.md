# TG-2 Architectural Discovery: Industry OS Organization Model

**Date:** September 7, 2026  
**Status:** 🔶 **ARCHITECTURAL INSIGHT**  
**Impact:** Platform-wide organizational principle

---

## Discovery Context

**Original TG-2 goal:** Detect uncovered production TypeScript source

**What TG-2 actually revealed:**
> **Bella lacks clear architectural representation of Industry OS → Product → Shared Capability relationships in governance structure**

---

## The Healthcare Finding

### Initial Observation

TG-2 detected 161 uncovered files in `src/services/healthcare/**`

**Naive interpretation:** "Healthcare services need a tsconfig"

**Actual reality:** Healthcare is NOT a single domain

```text
Healthcare = Industry OS
├── Hospital (Product)
├── Medical Clinic (Product)  
├── Dental (Product)
└── Shared Healthcare (Kernel/Capabilities)
```

### Decomposition Analysis

**TG-2.2A Healthcare decomposition revealed:**

```text
13 Healthcare service files:
├── Hospital-owned:          4 files (ICU, Emergency, Nursing, CSSD)
├── Medical Clinic-owned:    1 file (Appointments)
├── Dental-owned:            0 files
└── Shared Healthcare:       8 files (Pharmacy, Lab, Billing, Patient Identity)
```

**Key insight:** Majority are **shared capabilities**, not product-specific

---

## Architectural Ambiguity Exposed

### Before TG-2

**Folder-driven organization:**
```text
src/services/healthcare/
├── hospital logic
├── clinic logic
├── dental logic
├── shared healthcare logic
└── ??? unclear owner
```

**System works. Tests pass. But:**

> **"Who is responsible for protecting the contract of this file?"**  
> → Answer: UNCLEAR

### What TG-2 Forces

**Ownership-driven organization:**
```text
SOURCE FILE
    ↓
CAPABILITY
    ↓
ARCHITECTURAL OWNER
    ↓
GOVERNED SCOPE
    ↓
TYPECHECK
    ↓
EVIDENCE
```

**No longer:** Folder → tsconfig

**Now:** Architecture → Ownership → Governance → Source

---

## The Correct Mental Model

### Wrong Model (Flat)

```text
Healthcare
Medical Clinic
Dental
Hospital
```
All treated as peer domains.

### Right Model (Hierarchical)

```text
                 HEALTHCARE OS
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Hospital     Medical Clinic     Dental
    (Product)      (Product)      (Product)
        │              │              │
        └──────────────┼──────────────┘
                       ▼
           Shared Healthcare Core
              (Kernel/Capability)
```

**Principle:**
> Healthcare OS is the Industry domain. Hospital, Medical Clinic, Dental are products within that domain. They share common capabilities but have product-specific logic.

---

## Why This Matters

### 1. Governance Boundary Clarity

**Before:** Unclear who owns service files

**After:** Explicit ownership mapping
- Hospital-specific → Hospital Product scope
- Clinic-specific → Medical Clinic Product scope
- Shared → Healthcare Shared Kernel scope

### 2. Factory Reuse Model

**When Factory creates new Healthcare product:**

```text
Healthcare OS
      │
      ├── Shared capability A ───── REUSE ✅
      ├── Shared capability B ───── REUSE ✅
      │
      └── New Product
             └── product-specific ───── BUILD NEW
```

**Factory can now:**
- ✅ Know what to reuse (Shared Healthcare capabilities)
- ✅ Know what NOT to copy (Hospital-specific != Medical Clinic)
- ✅ Block when ownership unclear (don't guess)

### 3. Rule-of-Three Protection

**Wrong pattern:**
```text
Logic appears in 2 products
    ↓
Abstract immediately to Shared
    ↓
Premature abstraction
```

**Right pattern:**
```text
Product-specific logic
    ↓
Observed reuse across products
    ↓
Proven common semantics
    ↓
Promote to Healthcare Shared Kernel
```

**TG-2 ownership mapping supports this by forcing explicit classification before sharing.**

### 4. Reference Architecture for Other Industry OSes

**If Healthcare model proven:**

```text
Industry OS Pattern
│
├── Shared Domain Kernel / Capabilities
│   └── Cross-product reusable logic
│
├── Product A
│   └── Product-specific capabilities
├── Product B
├── Product C
│
└── Governance
     └── Every source: Owner + Scope + Evidence
```

**Apply to:**
- Retail OS → bella-retail-store, bella-specialty-store, shared retail kernel
- Finance OS → banking, insurance, investment, shared finance kernel
- Education OS → preschool, K-12, university, shared education kernel
- Automotive OS → dealership, service center, shared automotive kernel

---

## Governance Architecture Principle

### Old: Folder-Centric

```text
Folder structure defines governance
src/services/healthcare/** → one tsconfig
```

**Problem:** Doesn't reflect product boundaries

### New: Ownership-Centric

```text
Architecture defines ownership
Ownership defines governance scope
Governance scope protects source
```

**Principle:**
> **Folder does not decide ownership. Architecture decides ownership.**

---

## Value Beyond Coverage Metrics

**TG-2 started as:** "Find uncovered files" (technical debt)

**TG-2 evolved into:** "Map architectural ownership" (strategic clarity)

**Original question:**
> "Which files aren't typechecked?"

**Real question exposed:**
> **"How does Bella organize the relationship between Industry OS, shared capabilities, and specialized products within each OS?"**

---

## Healthcare as Reference Architecture

**If Healthcare ownership model is proven successful:**

### Benefits:
1. ✅ Clear Product/Kernel boundaries within Industry OS
2. ✅ Governed scope structure reflects architecture
3. ✅ Factory understands reuse semantics
4. ✅ Rule-of-Three enforced by ownership classification
5. ✅ Pattern replicable across all Industry OSes

### Healthcare becomes:
> **Reference model for how Bella organizes product families within Industry OSes**

---

## Implementation Impact

### NOT just "add Healthcare to tsconfig"

**Must decide:**
1. Hospital Product scope (inpatient, ICU, emergency, surgical)
2. Medical Clinic Product scope (outpatient, appointments, queue)
3. Dental Product scope (odontogram, dental procedures)
4. Shared Healthcare scope (patient identity, pharmacy, lab, billing)

### Each scope represents:
- ✅ Clear architectural ownership
- ✅ Product/capability boundary
- ✅ Governed typecheck protection
- ✅ Evidence trail

---

## Strategic Value

**TG-2 coverage increase:** 16% → potentially 23% (Healthcare services added)

**TG-2 architectural value:**
> **Standardized Industry OS organization pattern that scales to all Bella Industry OSes**

**This is more valuable than coverage percentage.**

---

## Principle Locked

> **TG-2 is not optimizing coverage percentage. TG-2 is forcing architectural ownership clarity.**

**Coverage increases as byproduct of correct architecture, not as primary goal.**

---

## Next Actions

### 1. Healthcare Ownership Decision (TG-2.2A)

Review decomposition analysis:
- Hospital: 4 files
- Medical Clinic: 1 file
- Shared Healthcare: 8 files

Confirm ownership or reclassify based on actual architecture.

### 2. Scope Structure Decision

**Option A:** 4 separate scopes (Hospital, Medical Clinic, Dental, Shared Healthcare)

**Option B:** Hybrid (Products share one scope + separate Shared Healthcare)

**Option C:** Different model based on actual architecture

**Decision maker:** Human architectural judgment required

### 3. Implementation

Create/extend governed scopes per ownership decision.

### 4. Validation

Rerun TG-2, verify coverage, document ownership boundaries.

### 5. Pattern Generalization

If successful, apply Industry OS organization model to:
- Retail OS
- Finance OS
- Education OS
- Other Industry OSes

---

## Success Metric

**NOT:** Coverage 16% → 100%

**BUT:**
> Every production file has clear architectural owner + governed scope + evidence trail.

**AND:**
> Industry OS → Product → Shared Capability relationship clearly represented in governance structure.

---

## Conclusion

**TG-2 discovery:**

> **An Industry OS governance gap is more valuable to fix than a coverage metric gap.**

**Healthcare provides opportunity to:**
1. Establish Industry OS organization pattern
2. Prove Product/Kernel boundary model
3. Create reference architecture for all Bella Industry OSes
4. Scale to entire platform

**This transforms TG-2 from technical debt reduction into strategic architectural clarification.**

---

**See also:**
- [TG-2 Production Coverage](./TG2_PRODUCTION_COVERAGE_INTEGRITY.md)
- [TG-2.2A Services Ownership Decision](./TG2_2A_SERVICES_OWNERSHIP_DECISION.md)
- [Healthcare Decomposition Report](./.tg2-healthcare-decomposition.txt)
- [Gate 3 Overview](./GATE3_ARCHITECTURAL_HARDENING.md)
