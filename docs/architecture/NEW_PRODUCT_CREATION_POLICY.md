# New OS/Product Creation Policy

**Version:** 1.0  
**Date:** 2026-09-05  
**Status:** CANONICAL  
**Scope:** All new Industry OS and Product development

---

## Purpose

Define **mandatory invariants** for new OS/Product creation while preserving developer autonomy.

**Not:** Approval gate for every step  
**Yes:** Protect architecture boundaries, guide decisions, enable Factory automation

---

## Three-Layer Governance

```text
                 NEW PRODUCT
                     │
          ┌──────────┴──────────┐
          │                     │
       RULES                  GATES
          │                     │
   guide decisions        protect invariants
          │                     │
          └──────────┬──────────┘
                     ↓
                  FACTORY
                     ↓
                VERIFICATION
                     ↓
                 QUALIFY
```

### 1. Mandatory Gates (Protect Invariants)

**Five gates protect architecture correctness:**

```text
NEW OS / PRODUCT
       │
       ▼
[G1] Definition & Boundary
       │
       ▼
[G2] Architecture / Contract Compliance
       │
       ▼
[G3] Verification
       │
       ▼
[G4] Evidence
       │
       ▼
[G5] Human Qualification
       │
       ▼
   QUALIFIED
```

### 2. Decision Rules (Guide, Not Block)

**Reuse-first logic, not approval steps:**

```text
New capability
      ↓
Existing Kernel có chưa?
      │
   ┌──┴──┐
  YES    NO
   ↓      ↓
 reuse   assess
          │
      Reusable industry
      capability?
        │
     ┌──┴──┐
    NO     YES
     ↓       ↓
 Product   Kernel
```

### 3. Factory Automation (Support, Not Gate)

**P1/P2 assist manufacturing, not control it:**

```text
Human decision
      ↓
Factory
 ├── P1 schema generation (optional)
 ├── Verification (automated)
 ├── Tests (automated)
 └── P2 evidence (optional)
      ↓
Human qualification
```

---

## Mandatory Gates (Detail)

### G1: Definition & Boundary

**Invariant:** Every Product must have clear identity and scope

**Required:**
- [ ] Product name and purpose defined
- [ ] Industry/Kernel dependency identified
- [ ] Product vs. Kernel boundary justified
- [ ] No Platform Core bypass

**Example:**
- ✅ "Bella Dental — Healthcare Product using H1-H12 Kernel"
- ❌ "New feature" (undefined scope)

**Verification:** Product manifest file exists

---

### G2: Architecture / Contract Compliance

**Invariant:** Products extend Kernels via contracts, never mutate them

**Required:**
- [ ] Dependency direction correct (Product → Contract → Kernel)
- [ ] No direct internal Kernel imports (`engines/`, `repositories/`)
- [ ] No direct Kernel DB access (only via contracts)
- [ ] Tenant isolation preserved (RLS, `tenant_id` validation)
- [ ] Security invariants preserved (auth, audit, encryption)
- [ ] Additive schema only (no ALTER/DROP on Kernel tables)

**Example:**
- ✅ `import { IEncounterEngine } from 'platform/healthcare/contracts/encounter-engine.contract'`
- ❌ `import { EncounterRepository } from 'platform/healthcare/repositories/encounter.repository'`

**Verification:**
- Architecture Guard tests PASS
- Static analysis detects forbidden imports

---

### G3: Verification

**Invariant:** Code correctness proven by automated checks

**Required:**
- [ ] TypeScript compilation PASS (relevant scopes)
- [ ] Architecture Guard PASS
- [ ] Product tests PASS
- [ ] Conformance tests PASS (if applicable)
- [ ] Relevant regression tests PASS

**NOT required:**
- Full platform regression (only relevant scopes)
- Perfect test coverage (functional correctness sufficient)

**Verification:**
```bash
# TypeScript (relevant scope only)
npm run governance:typecheck -- --scope=<product-scope>

# Architecture Guard
npm run arch:guard

# Product tests
npm test -- src/products/<product>/__tests__/

# Conformance (if Industry Kernel)
npm test -- src/products/<product>/__tests__/*-conformance.*
```

---

### G4: Evidence

**Invariant:** Verification claims have supporting evidence

**Required:**
- [ ] Test execution results available
- [ ] Architecture Guard output available
- [ ] TypeScript diagnostics available (if issues)
- [ ] Evidence reproducible (can re-run verification)

**Optional (P2 support):**
- [ ] Evidence bundle generated via P2 collector
- [ ] Evidence deterministic and timestamped

**NOT required:**
- Historical evidence reconstruction
- Evidence for every development step
- Comprehensive documentation before qualification

**Verification:**
- Test logs exist OR can be generated
- P2 can collect evidence (if workflow uses Factory)

---

### G5: Human Qualification

**Invariant:** Architecture + business + security review before release

**Required:**
- [ ] Architecture review: Boundaries respected, contracts used correctly
- [ ] Business review: Meets requirements, delivers value
- [ ] Security review: Tenant isolation, RLS, audit trails verified
- [ ] Readiness review: Evidence sufficient for production

**Reviewer checks:**
1. Definition clear? (G1)
2. Architecture compliant? (G2)
3. Verification passed? (G3)
4. Evidence available? (G4)
5. Ready for production? (judgment)

**NOT required:**
- Approval for every development decision
- Perfect documentation
- Zero technical debt

**Verification:** Human sign-off

---

## Decision Rules (Not Gates)

### Rule 1: Reuse Before Extend

**Before building new capability, check:**

1. **Platform Core provides it?** → Use Platform
2. **Existing Kernel provides it?** → Use Kernel
3. **Existing Kernel extendable?** → Extend Kernel
4. **Reusable across industries?** → New Kernel capability
5. **Product-specific?** → Build in Product

**Example:**
- New "patient encounter" capability → ✅ Use Healthcare Kernel H2 Encounter Engine
- New "dental tooth chart" capability → ✅ Product-specific (Dental Product)
- New "clinical decision support" → ✅ Extend H8 CDS Kernel (if reusable)

**Not a gate:** Developer decision, reviewed in G5

---

### Rule 2: Minimal Capability

**Build smallest capability that solves proven need**

- ✅ Solve concrete problem with evidence
- ❌ Build framework for future flexibility
- ❌ Add abstraction "just in case"
- ❌ Create capability before proven bottleneck

**Example:**
- P1 Schema Generator: Built after manual SQL proven bottleneck
- P3 Kernel Binding: Deferred until binding proven bottleneck

**Not a gate:** Capability scope decision, validated by evidence

---

### Rule 3: Additive Extension

**Products extend Kernels, never mutate them**

**Allowed:**
- CREATE new Product tables
- CREATE new Product indexes
- CREATE new Product services
- CONSUME Kernel via public contracts

**Forbidden:**
- ALTER Kernel tables
- DROP Kernel tables
- PATCH Kernel logic
- BYPASS Kernel contracts

**Example:**
- ✅ `CREATE TABLE dental_odontograms (...)`
- ❌ `ALTER TABLE hc_encounters ADD COLUMN dental_notes TEXT`

**Enforcement:** Architecture Guard (automated), G2 review

---

## Factory Automation (Not Gates)

### P1: Schema Generation (Optional)

**Use when:** Product needs database schema

**Provides:**
- Deterministic SQL generation
- Auto-apply Bella patterns (tenant isolation, RLS, audit fields)
- ~70-80% manual effort reduction (pilot evidence)

**Does NOT:**
- Replace domain design
- Generate complex business logic
- Mandate usage (manual SQL still valid)

**Verification:** Generated schema matches canonical patterns (G2)

---

### P2: Evidence Collection (Optional)

**Use when:** Need reproducible evidence bundle

**Provides:**
- Automated evidence aggregation from tool outputs
- Structured manufacturing trail
- ~70% manual evidence assembly reduction (pilot evidence)

**Does NOT:**
- Make qualification decisions
- Replace human review
- Mandate usage (manual evidence still valid)

**Verification:** Evidence bundle complete (G4)

---

### P3/P4: Deferred Capabilities

**P3 Kernel Binding, P4 Test Scaffolding currently DEFERRED**

**Will implement only if:**
- 3+ Products demonstrate consistent bottleneck
- Manual effort >10 hours per Product measured
- Clear evidence that automation provides value

**Not gates:** Optional capabilities when proven necessary

---

## MUST / MUST NOT Summary

### MUST

1. **Define** Product/Industry boundary clearly (G1)
2. **Reuse before extend** — check existing capabilities (Rule 1)
3. **Respect architecture contracts** — no boundary bypass (G2)
4. **Verify** with guards/tests/regression (G3)
5. **Produce evidence** for verification claims (G4)
6. **Human qualification** before release (G5)

### MUST NOT

1. ❌ Bypass Platform Core
2. ❌ Product → internal Kernel imports
3. ❌ Direct DB access to bypass contracts
4. ❌ Product-specific capability in Kernel (premature abstraction)
5. ❌ Create Factory capability without bottleneck evidence
6. ❌ Convert every development step into approval gate

---

## Anti-Patterns

### ❌ Gate Proliferation

**Wrong:**
```text
P1 Approval Gate → P2 Approval Gate → P3 Gate → P4 Gate → ...
```

**Right:**
```text
5 Mandatory Gates protect invariants
Decision Rules guide choices
Factory Automation assists (optional)
```

### ❌ Framework-First Development

**Wrong:**
```text
Build generic framework → Hope Products use it
```

**Right:**
```text
Build Product → Extract proven patterns → Reuse in next Product
```

### ❌ Premature Abstraction

**Wrong:**
```text
"This might be reusable" → Put in Kernel
```

**Right:**
```text
Build in Product → Prove reuse in 2+ Products → Extract to Kernel
```

### ❌ Qualification Automation

**Wrong:**
```text
Automated system decides: QUALIFIED / NOT QUALIFIED
```

**Right:**
```text
Evidence Collection (P2) → Human Qualification (G5)
```

---

## Governance Balance

```text
              GOVERNANCE SPECTRUM
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
TOO LOOSE         BALANCED          TOO STRICT
    │                 │                 │
No invariants     5 Gates          15 Approval Gates
No verification   + Rules          Every step blocked
Chaos             + Automation     Paralysis
    │                 │                 │
    └─────────────────┼─────────────────┘
                      ↓
                  BELLA
                (balanced)
```

**Bella governance:**
- Few gates (5) protecting critical invariants
- Clear rules guiding decisions (not blocking)
- Factory automation assisting (not controlling)
- Human judgment preserved (qualification, not every step)

---

## Workflow Example

### Scenario: Building "Bella Pharmacy" Product

**Developer workflow:**

```text
1. Define scope (G1)
   - Product: Bella Pharmacy
   - Kernel: Healthcare H1-H12
   - Purpose: Pharmacy inventory + dispensing

2. Check reuse (Rule 1)
   - Patient management → Use H1 Person Engine ✅
   - Prescriptions → Use H4 Pharmacy Engine ✅
   - Inventory → Product-specific (build in Product) ✅

3. Implement
   - Schema: Use P1 or write manual SQL
   - Services: Product layer using Kernel contracts
   - Tests: Conformance + architecture tests

4. Verify (G3)
   - npm run governance:typecheck
   - npm run arch:guard
   - npm test -- src/products/bella-pharmacy/

5. Evidence (G4)
   - Optional: Use P2 to generate evidence bundle
   - OR: Capture test logs manually

6. Qualification (G5)
   - Architecture review: Contracts used correctly? ✅
   - Business review: Meets pharmacy needs? ✅
   - Security review: Tenant isolation? RLS? ✅
   - Readiness review: Evidence sufficient? ✅
   - Decision: QUALIFIED → Release
```

**No approval needed for:**
- Schema design decisions
- Service implementation approach
- Test structure
- Using P1 or manual SQL
- Using P2 or manual evidence

**Approval needed for:**
- Final qualification (G5) before production release

---

## Summary

**New OS/Product Creation Policy:**

- ✅ **5 Mandatory Gates** protect invariants
- ✅ **Decision Rules** guide choices (not block)
- ✅ **Factory Automation** assists (optional)
- ✅ **Human Qualification** preserves judgment
- ❌ **No gate proliferation**
- ❌ **No framework mandates**
- ❌ **No approval for every step**

**Philosophy:**

> **Ít gate, invariant mạnh, automation hỗ trợ, human giữ judgment.**

**Result:** Clear boundaries, developer autonomy, architecture protection.

---

**Policy Status:** ✅ CANONICAL  
**Effective Date:** 2026-09-05  
**Review:** After 5+ Product manufacturing cycles (evidence-based adjustment)
