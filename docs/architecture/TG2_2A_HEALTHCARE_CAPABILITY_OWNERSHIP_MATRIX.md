# TG-2.2A — Healthcare Capability Ownership Matrix

**Date:** September 7, 2026  
**Status:** 🟡 **OWNERSHIP MAPPING REQUIRED**  
**Purpose:** Map Healthcare capabilities to architectural owners before creating governed scopes

---

## Principle: Industry OS Organization Model

**Locked pattern for ALL Bella Industry OSes:**

```text
INDUSTRY OS
│
├── Shared Domain Kernel / Capabilities
│   └── Proven cross-product reusable logic
│
├── Product A
│   └── Product-specific capabilities
│
├── Product B
│   └── Product-specific capabilities
│
├── Product C
│   └── Product-specific capabilities
│
└── Governance
    ├── Ownership
    ├── Typecheck Scope
    ├── Contracts
    └── Evidence
```

**Applied to Healthcare:**

```text
HEALTHCARE OS
│
├── Healthcare Shared Kernel
│   └── Proven cross-product capabilities
│
├── Hospital Product
│   └── Hospital-specific capabilities
│
├── Medical Clinic Product
│   └── Medical Clinic-specific capabilities
│
└── Dental Product
    └── Dental-specific capabilities
```

---

## Ownership Decision Rules

**Rule 1: Single-Product Usage**
```text
Capability used by 1 product only
→ Product owns it
→ Product-specific capability
```

**Rule 2: Multi-Product Different Semantics**
```text
Capability used by multiple products
BUT semantics differ per product
→ Keep product-specific
→ NOT shared (avoid premature abstraction)
```

**Rule 3: Proven Cross-Product Reuse**
```text
Capability used by multiple products
AND semantics identical
AND reuse proven in practice
→ Healthcare Shared owns it
→ Shared Kernel capability
```

**Rule 4: Unclear Ownership**
```text
Cannot determine owner
→ BLOCK
→ Architectural decision required
```

**These rules prevent:**
- ❌ Giant shared layer (everything in Shared)
- ❌ Duplicated domain logic (copy everything per product)

---

## Capability Ownership Matrix Template

**For each capability cluster, document:**

| Capability | Current Source | Products Using | Semantics | Canonical Owner | Target Scope | Confidence |
|------------|----------------|----------------|-----------|-----------------|--------------|------------|
| ... | src/services/healthcare/... | Hospital, Clinic | Same/Different | Hospital/Clinic/Dental/Shared | tsconfig.* | High/Med/Low |

---

## Healthcare Services Analysis (from TG-2 decomposition)

### Initial Classification (13 files)

**Hospital-Associated (4 files):**
- `emergency-service.ts`
- `icu-service.ts`
- `nursing-actions.ts`
- `cssd-actions.ts`

**Medical Clinic-Associated (1 file):**
- `appointments-actions.ts`

**Shared Healthcare-Associated (8 files):**
- `pharmacy-actions.ts`
- `laboratory-service.ts`
- `billing-actions.ts`
- `bhyt-actions.ts` (Vietnamese health insurance)
- `clinical-alerts-service.ts`
- `healthcare-service.ts`
- `healthcare-actions.ts`
- `lis-ris-actions.ts` (Lab/Radiology information systems)

**Dental-Associated (0 files in services layer)**

---

## Ownership Matrix (Preliminary — Requires Human Confirmation)

### Hospital-Owned Capabilities

| Capability | Source | Used By | Semantics | Owner | Scope | Confidence |
|------------|--------|---------|-----------|-------|-------|------------|
| **Emergency Services** | `emergency-service.ts` | Hospital | Hospital ED/ER specific | Hospital | `tsconfig.hospital.json` | High |
| **ICU Services** | `icu-service.ts` | Hospital | Intensive care (Hospital-specific) | Hospital | `tsconfig.hospital.json` | High |
| **Nursing Actions** | `nursing-actions.ts` | Hospital | Inpatient nursing (Hospital context) | Hospital | `tsconfig.hospital.json` | Medium |
| **CSSD Actions** | `cssd-actions.ts` | Hospital | Central Sterile Services (Hospital infrastructure) | Hospital | `tsconfig.hospital.json` | Medium |

**Rationale:** These capabilities are inherently Hospital inpatient operations

---

### Medical Clinic-Owned Capabilities

| Capability | Source | Used By | Semantics | Owner | Scope | Confidence |
|------------|--------|---------|-----------|-------|-------|------------|
| **Appointment Management** | `appointments-actions.ts` | Medical Clinic, Dental? | Outpatient scheduling | Shared? | TBD | **Low** |

**Question:** Is appointments used by Dental? If yes, is semantic same?

**Action required:** Confirm appointment semantics across products

---

### Shared Healthcare Kernel Capabilities

| Capability | Source | Used By | Semantics | Owner | Scope | Confidence |
|------------|--------|---------|-----------|-------|-------|------------|
| **Pharmacy** | `pharmacy-actions.ts` | Hospital, Medical Clinic, Dental | Medication dispensing (cross-product) | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |
| **Laboratory** | `laboratory-service.ts` | Hospital, Medical Clinic | Lab tests/results (cross-product) | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |
| **Billing** | `billing-actions.ts` | Hospital, Medical Clinic, Dental | Invoice/payment (cross-product) | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |
| **BHYT (Health Insurance)** | `bhyt-actions.ts` | Hospital, Medical Clinic | Vietnamese insurance claims | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |
| **Clinical Alerts** | `clinical-alerts-service.ts` | Hospital, Medical Clinic | Patient safety alerts | Shared Healthcare | `tsconfig.healthcare-shared.json` | Medium |
| **Patient Services** | `healthcare-service.ts` | All products | Patient identity/demographics | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |
| **Healthcare Actions** | `healthcare-actions.ts` | All products | Common healthcare operations | Shared Healthcare | `tsconfig.healthcare-shared.json` | Medium |
| **LIS/RIS Integration** | `lis-ris-actions.ts` | Hospital, Medical Clinic | Lab/Radiology systems | Shared Healthcare | `tsconfig.healthcare-shared.json` | High |

**Rationale:** These capabilities have identical semantics across products and proven reuse

---

### Dental-Owned Capabilities

| Capability | Source | Used By | Semantics | Owner | Scope | Confidence |
|------------|--------|---------|-----------|-------|-------|------------|
| *(No service-layer files detected in decomposition)* | - | - | - | - | - | - |

**Note:** Dental may have product-specific capabilities elsewhere (not in `src/services/healthcare/`)

---

## Open Questions Requiring Human Decision

### Q1: Appointment Semantics

**Question:** Is appointment scheduling used by Dental? If yes, same semantics as Medical Clinic?

**Options:**
- **A:** Appointments = Shared Healthcare (if semantics identical across Clinic/Dental)
- **B:** Appointments = Medical Clinic-owned (if Dental uses different scheduling model)

**Decision:** [PENDING]

### Q2: Nursing Actions Scope

**Question:** Are nursing actions Hospital-specific or used by Medical Clinic outpatient nursing?

**Options:**
- **A:** Hospital-owned (inpatient nursing only)
- **B:** Shared Healthcare (if outpatient clinics have nursing workflows)

**Decision:** [PENDING]

### Q3: Clinical Alerts Ownership

**Question:** Do all products use clinical alerts with same semantics?

**Current classification:** Shared Healthcare (Medium confidence)

**Validation:** Confirm alert types/workflows identical across Hospital/Clinic/Dental

**Decision:** [PENDING]

---

## Recommended Governed Scope Architecture

**Based on preliminary matrix:**

### Option A: 4-Scope Model (Recommended)

```text
1. tsconfig.hospital.json
   Covers: Hospital product + Hospital-specific capabilities
   
2. tsconfig.medical-clinic.json
   Covers: Medical Clinic product + Clinic-specific capabilities
   
3. tsconfig.dental.json
   Covers: Dental product + Dental-specific capabilities
   
4. tsconfig.healthcare-shared.json
   Covers: Proven cross-product Healthcare Kernel capabilities
```

**Pros:**
- ✅ Clear Product/Kernel separation
- ✅ Explicit ownership boundaries
- ✅ Factory can understand Product vs Shared distinction
- ✅ Scales naturally (add new Healthcare product = new scope)

**Cons:**
- ⚠️ More scopes to maintain (4 vs 1)

### Option B: 2-Scope Model

```text
1. tsconfig.healthcare-products.json
   Covers: Hospital + Medical Clinic + Dental products
   
2. tsconfig.healthcare-shared.json
   Covers: Shared Healthcare Kernel
```

**Pros:**
- ✅ Fewer scopes

**Cons:**
- ❌ Hospital/Clinic/Dental boundaries not represented
- ❌ Factory cannot distinguish products

### Option C: Extend Existing Platform Scope

```text
tsconfig.platform-healthcare.json (EXTEND)
  Include: Platform + Products + Services
```

**Pros:**
- ✅ Single Healthcare scope

**Cons:**
- ❌ No Product/Kernel distinction
- ❌ Giant monolithic scope

**Recommendation:** **Option A (4-Scope Model)**

**Rationale:** Best represents Industry OS architecture, clear ownership, Factory-compatible

---

## Next Actions

### 1. Human Review & Decision

**For each capability in matrix:**
- [ ] Confirm ownership classification
- [ ] Resolve open questions (Q1-Q3)
- [ ] Validate semantics across products
- [ ] Finalize Canonical Owner column

### 2. Scope Architecture Decision

**Choose scope model:**
- [ ] Option A: 4-Scope (Recommended)
- [ ] Option B: 2-Scope
- [ ] Option C: Extend existing
- [ ] Option D: Different model

### 3. Implementation Plan

**After ownership + scope decisions:**
- [ ] Create/extend tsconfig files per architecture
- [ ] Map source files to scopes
- [ ] Verify compilation
- [ ] Rerun TG-2
- [ ] Validate coverage restored

### 4. Documentation

**Document:**
- [ ] Ownership rationale per capability
- [ ] Scope architecture reasoning
- [ ] Product/Kernel boundary definitions

---

## Success Criteria

**TG-2.2A complete when:**

1. ✅ Every Healthcare capability has confirmed owner
2. ✅ Ownership rules applied consistently
3. ✅ Open questions resolved
4. ✅ Scope architecture decided
5. ✅ Matrix approved by architectural authority
6. ✅ No UNKNOWN ownership remains

**After TG-2.2A:** Proceed to implementation (TG-2.2B)

---

## Principle Reinforced

> **Do not create scopes to optimize coverage. Create scopes to reflect correct architectural ownership.**

**Coverage is byproduct of correct architecture, not primary goal.**

---

## Factory Impact

**After Healthcare ownership model proven:**

**Factory gains understanding:**
```text
Healthcare capability X
    ↓
Is it Shared Kernel? → Reuse across products
Is it Product-specific? → Don't copy to other products
Is it unclear? → BLOCK (ask human)
```

**This enables governed reuse model:**
```text
New Product requirements
    ↓
Check existing Shared Kernel
    ↓
Reuse what exists
    ↓
Build only product-specific
    ↓
Observe reuse patterns
    ↓
Promote to Shared when proven (Rule-of-Three)
```

---

**Status:** ⏸️ **AWAITING HUMAN ARCHITECTURAL DECISIONS**

**Blocked on:** Healthcare capability ownership confirmation + scope architecture selection

**After decisions:** TG-2 can proceed to implementation phase

---

**See also:**
- [Industry OS Organization Model](./TG2_ARCHITECTURAL_DISCOVERY_INDUSTRY_OS_MODEL.md)
- [Healthcare Decomposition Report](./.tg2-healthcare-decomposition.txt)
- [TG-2 Production Coverage](./TG2_PRODUCTION_COVERAGE_INTEGRITY.md)
