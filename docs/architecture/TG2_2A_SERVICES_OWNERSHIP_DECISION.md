# TG-2.2A — Services Ownership Decision Framework

**Date:** September 7, 2026  
**Status:** 🟡 **DECISION CHECKPOINT**  
**Scope:** `src/services/**` ownership mapping

---

## Context

**Current State:**
- 161 services-layer files uncovered by TG-2
- Healthcare services: Primary cluster in `src/services/healthcare/**`
- No governed typecheck scope currently protects services layer

**TG-2 Finding:**
```text
src/services/healthcare/**
  - appointments-actions.ts
  - healthcare-service.ts
  - emergency-service.ts
  - laboratory-service.ts
  ... (161 total service files)
```

**Question to resolve:**
> What is the architectural ownership model for `src/services/**`?

---

## Decision Framework

### Option A: Domain-Owned Services

**Model:** Each service cluster belongs to its domain owner

```text
src/services/healthcare/**    → Healthcare domain
src/services/accounting/**    → Finance/Accounting domain
src/services/payroll/**       → HR/Payroll domain
src/services/inventory/**     → Inventory domain
...
```

**Governed scope strategy:**
```text
tsconfig.services-healthcare.json
  → covers src/services/healthcare/**
  → owned by Healthcare architecture
  → part of Healthcare governance

tsconfig.services-accounting.json
  → covers src/services/accounting/**
  → owned by Finance architecture
  → part of Finance governance
```

**Pros:**
- ✅ Clear ownership per domain
- ✅ Aligns with existing Platform domain scopes
- ✅ Scales naturally (new domain = new service scope)
- ✅ Domain team responsible for their services

**Cons:**
- ⚠️ Multiple service scopes to maintain
- ⚠️ Shared service utilities need classification

**Alignment with Bella architecture:** ✅ HIGH

---

### Option B: Unified Services Layer

**Model:** All services are shared infrastructure

```text
src/services/**
  → Unified services layer
  → Shared infrastructure scope
  → Cross-domain service orchestration
```

**Governed scope strategy:**
```text
tsconfig.services.json
  → covers src/services/**
  → owned by Platform/Integration team
  → shared service governance
```

**Pros:**
- ✅ Single scope for all services
- ✅ Simpler governance structure
- ✅ Easier to manage shared utilities

**Cons:**
- ❌ No clear domain ownership
- ❌ Healthcare services mixed with unrelated domains
- ❌ Architectural boundary violation (services should belong to domains)

**Alignment with Bella architecture:** ❌ LOW

---

### Option C: Hybrid Model

**Model:** Domain services separate, shared utilities separate

```text
src/services/healthcare/**     → Healthcare Services scope
src/services/accounting/**     → Accounting Services scope
src/services/shared/**         → Shared Services scope
src/services/integration/**    → Integration Services scope
```

**Governed scope strategy:**
```text
Domain-specific scopes for domain services
+ Shared scope for cross-domain utilities
```

**Pros:**
- ✅ Clear domain ownership where applicable
- ✅ Explicit shared infrastructure layer
- ✅ Flexible for both domain and shared code

**Cons:**
- ⚠️ Requires classification: domain vs shared
- ⚠️ More scopes to maintain

**Alignment with Bella architecture:** ✅ MEDIUM-HIGH

---

## Recommendation: Option A (Domain-Owned Services)

**Rationale:**

1. **Architectural consistency:** Services layer should follow domain boundaries like Platform layer does
2. **Ownership clarity:** Healthcare team owns Healthcare services end-to-end
3. **Governance alignment:** Healthcare services governed by Healthcare scope
4. **Factory understanding:** Product/Domain model already established

**Healthcare Services specifically:**
```text
src/services/healthcare/**
  ↓
Healthcare domain ownership
  ↓
tsconfig.services-healthcare.json (NEW)
OR
Extend tsconfig.platform-healthcare.json (EXTEND EXISTING)
  ↓
Healthcare governance protection
```

---

## Healthcare Services Decision

### Sub-Question: New Scope or Extend Existing?

**Option 1: Create `tsconfig.services-healthcare.json`**

**Pros:**
- ✅ Clear separation: Platform vs Services layer
- ✅ Independent governance per layer
- ✅ Easier to scope individual layers

**Cons:**
- ⚠️ More scopes to maintain
- ⚠️ Healthcare now split across 2 scopes

**Option 2: Extend `tsconfig.platform-healthcare.json`**

```json
{
  "include": [
    "src/platform/healthcare/**",
    "src/services/healthcare/**"  // ADD THIS
  ]
}
```

**Pros:**
- ✅ Unified Healthcare governance
- ✅ Healthcare team owns all Healthcare code in one scope
- ✅ Fewer scopes to maintain

**Cons:**
- ⚠️ Platform + Services in same scope (layering mixed)

**Recommendation:** **Option 2 (Extend existing)**

**Rationale:**
- Healthcare should govern all Healthcare code (Platform + Services)
- Simplifies governance (one scope per domain)
- Services layer is already domain-aligned, not separate architecture

---

## Implementation Proposal (Healthcare Services)

### Step 1: Inventory Healthcare Services

```bash
npm run governance:tg2:classify
# Review src/services/healthcare/** cluster
```

**Expected files:**
- appointments-actions.ts
- healthcare-service.ts
- emergency-service.ts
- laboratory-service.ts
- bhyt-actions.ts
- billing-actions.ts
- clinical-alerts-service.ts
- icu-service.ts
- ... (~161 files)

### Step 2: Extend Healthcare Scope

**File:** `tsconfig.platform-healthcare.json`

**Current:**
```json
{
  "extends": "./tsconfig.json",
  "include": [
    "src/platform/healthcare/**"
  ]
}
```

**Proposed:**
```json
{
  "extends": "./tsconfig.json",
  "include": [
    "src/platform/healthcare/**",
    "src/services/healthcare/**"  // ADD services layer
  ]
}
```

### Step 3: Verify Scope Compiles

```bash
npx tsc --project tsconfig.platform-healthcare.json --noEmit
```

**Expected:** Diagnostics from Healthcare services now visible

**Important:** DO NOT fix diagnostics yet — first establish coverage, then address root causes

### Step 4: Rerun TG-2

```bash
npm run governance:tg2
```

**Expected result:**
- Healthcare services now COVERED
- Coverage increases from 345 → 345+161 = 506/2200 (23%)
- Healthcare T5 recovery demonstrated

### Step 5: Document Coverage Restoration

Update TG-2 docs with Healthcare services coverage restored

---

## Classification for Other Services

**After Healthcare decision, classify remaining services:**

```text
src/services/accounting/**     → Finance/Accounting domain?
src/services/payroll/**        → HR/Payroll domain?
src/services/inventory/**      → Inventory domain?
src/services/booking/**        → Booking domain?
src/services/waitlist/**       → Waitlist domain?
...
```

**For each cluster:**
1. Identify architectural owner
2. Determine if existing scope can be extended
3. Create new scope if no owner exists
4. Document ownership decision

---

## Principle Reinforced

> **Do not expand scopes to optimize coverage. Expand scopes to reflect correct architectural ownership.**

**Right:**
```text
Healthcare services → Healthcare owns them → Extend Healthcare scope
```

**Wrong:**
```text
Services uncovered → Create services.json → Cover all services → Architecture unclear
```

---

## Exit Criteria (TG-2.2A)

**Cannot proceed to TG-2.2B until:**

1. ✅ Healthcare services ownership decided
2. ✅ Healthcare scope extended (or new scope created)
3. ✅ Healthcare services coverage verified
4. ✅ Remaining `src/services/**` clusters classified by owner
5. ✅ Ownership decisions documented

**After TG-2.2A complete:** Proceed to TG-2.2B (App Routes Ownership)

---

## Decision Record Template

**For each service cluster, document:**

```text
Cluster: src/services/[domain]/**
Files: [count]
Architectural Owner: [Platform Domain / Product / Shared]
Governed Scope: [scope name]
Action: [EXTEND existing / CREATE new]
Rationale: [why this ownership model]
Status: [DECIDED / PENDING / BLOCKED]
```

---

**Next bounded action:** Healthcare Services Ownership Decision

**Decision maker:** Human (architectural judgment required)

**After decision:** Implement scope change, verify coverage, document

---

**See also:**
- [TG-2 Production Coverage](./TG2_PRODUCTION_COVERAGE_INTEGRITY.md)
- [TG-2.1 Classification Report](./.tg2-coverage-classification.txt)
- [Gate 3 Overview](./GATE3_ARCHITECTURAL_HARDENING.md)
