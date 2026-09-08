# TG-2 — Production Coverage Integrity Gate

**Status:** 🟡 **ARCHITECTURE PENDING**  
**Date:** September 7, 2026  
**Workstream:** BELLA TYPE-SYSTEM ROOT-CAUSE & HARDENING — Gate 3

**Current Phase:** TG-2.2 Architectural Ownership Mapping (human decision required)

---

## Objective

**Prevent uncovered production source from escaping typecheck governance.**

Enforce invariant: **Every production TypeScript source must be governed by at least one canonical typecheck scope.**

---

## Problem Statement

**Finding from Gate 2 (Healthcare):**

```text
src/platform/healthcare/**     ✅ Covered by Platform tsconfig
src/services/healthcare/**     ❌ NOT covered by any tsconfig
                               ↓
Platform typecheck: PASS
                               ↓
FALSE CONFIDENCE
(services-layer errors undetected)
```

**Root cause:** Coverage gap, not code quality

**Impact:** Gate can PASS while production code remains ungoverned

---

## Scope

**IN SCOPE:**
- ✅ Enumerate all production TS/TSX files
- ✅ Map to governed typecheck scopes
- ✅ Detect uncovered production source
- ✅ Block construction when gaps exist

**OUT OF SCOPE:**
- ❌ Fixing Healthcare diagnostics (separate workstream)
- ❌ Creating new tsconfig scopes (TG-2 detects, humans decide architecture)
- ❌ Auto-adding files to nearest scope (violates ownership boundaries)

---

## Mechanism

### 1. Production Source Inventory

Enumerate all production TypeScript source:

```text
src/**/*.{ts,tsx}
kernels/**/*.{ts,tsx}
products/**/*.{ts,tsx}
services/**/*.{ts,tsx}
packages/**/*.{ts,tsx}
```

### 2. Explicit Exclusion Policy

**Intentionally excluded (non-production):**
```text
**/*.test.ts
**/*.test.tsx
**/*.spec.ts
**/*.spec.tsx
e2e/**
scripts/**
.next/**
dist/**
node_modules/**
```

### 3. Governed Scope Resolution

For each tsconfig in governance:
- Resolve effective TypeScript program
- Compute actual files included (after exclude/include/references)
- NOT just glob matching (must verify effective program membership)

### 4. Coverage Registry

Build mapping:

```text
Production File → [Scope A, Scope B, ...]

Example:
src/platform/auth/auth.service.ts → [platform-core]
src/services/healthcare/patient.ts → [] ← UNCOVERED
```

### 5. Gate Logic

```text
For each production file:
  coverage count ≥ 1 → file OK
  coverage count = 0 → file UNCOVERED

Any UNCOVERED files?
  NO  → PASS
  YES → BLOCK with diagnostic listing uncovered files/clusters
```

---

## Critical Design Principle

> **TG-2 checks effective TypeScript program membership, NOT glob pattern matching.**

**Why:**

A file can match `include` pattern but still be excluded by:
- `exclude` overriding `include`
- Project references limiting scope
- `paths` config redirecting resolution
- Type-only imports being stripped

**Canonical check:**

```typescript
const program = ts.createProgram({
  rootNames: [...],
  options: tsconfig.compilerOptions
});

const sourceFiles = program.getSourceFiles();
// A file is covered IFF it appears in sourceFiles
```

---

## Acceptance Tests (T1-T6)

### T1 — All Production Covered
```text
Precondition: All production files governed
Gate execution: PASS
Validation: No uncovered files detected
```

### T2 — Uncovered Production Detected
```text
Precondition: Add isolated uncovered production file
Gate execution: BLOCK
Validation: Diagnostic lists exact uncovered file
```

### T3 — Coverage Restored
```text
Precondition: Add uncovered file to governed scope
Gate execution: PASS
Validation: Recovery proven, file now covered
```

### T4 — Intentional Exclusions Respected
```text
Precondition: Test/script/E2E files present
Gate execution: PASS
Validation: Non-production exclusions work correctly
```

### T5 — Healthcare Gap (Field-Derived Negative Fixture)
```text
Precondition: src/services/healthcare/** exists
Initial state: UNCOVERED
Gate execution: BLOCK
Action: Add to canonical governed scope
Rerun: PASS
Validation: Real coverage gap detected and resolved
```

### T6 — Deterministic Repeated Runs
```text
Precondition: Same codebase state
Run 1: Result A
Run 2: Result B
Validation: A === B (deterministic)
```

---

## Healthcare Services-Layer Case

**TG-2 responsibility:** Detect that `src/services/healthcare/**` is uncovered

**NOT TG-2 responsibility:** Fix Healthcare diagnostics

**Workflow:**

```text
TG-2 detects uncovered
        ↓
Add src/services/healthcare to governed scope
        ↓
TG-2 PASS (coverage established)
        ↓
Healthcare diagnostics now visible canonically
        ↓
Separate workstream handles diagnostics
```

**TG-2 does NOT claim "Healthcare PASS"** — it only ensures Healthcare is no longer invisible to governance.

---

## Anti-Patterns to Avoid

### ❌ Blind Addition to Nearest Scope

```text
WRONG:
  Find uncovered files
  → Add all to nearest tsconfig
  → Coverage numbers go to 100%
  → Architecture boundaries violated
```

**Correct approach:** Each uncovered cluster must be mapped to **correct ownership/scope architecture**

### ❌ Glob-Only Matching

```text
WRONG:
  Check if file matches tsconfig include pattern
  → Assume covered

CORRECT:
  Resolve effective TypeScript program
  → Check if file ∈ program.getSourceFiles()
```

### ❌ Creating Mega-Scope

```text
WRONG:
  Make one tsconfig with include: ["**/*"]
  → Everything covered
  → >300s compilation time
  → Scalability problem

CORRECT:
  Multiple scoped tsconfigs
  → Each production file ∈ ≥1 scope
  → Scalable architecture
```

---

## Exit Criteria

**CANNOT claim TG-2 COMPLETE until:**

1. ✅ Production inventory deterministic
2. ✅ Exclusion policy explicit and documented
3. ✅ Effective tsconfig coverage resolution implemented
4. ✅ T1 covered state → PASS
5. ✅ T2 uncovered fixture → BLOCK
6. ✅ T3 fixture coverage restored → PASS
7. ✅ T4 intentional exclusions → PASS
8. ✅ T5 Healthcare gap detected + coverage restored → PASS then PASS
9. ✅ T6 repeated runs deterministic
10. ✅ Failure output lists exact uncovered files/clusters
11. ✅ Factory eligibility path wired to TG-2

---

## Enforced Invariant

> **Every production TypeScript source must be governed by at least one canonical typecheck scope. Uncovered production code is construction-ineligible.**

---

## Implementation Strategy

### Phase 1: Design & Tooling
- [ ] TG-2 design doc (this document)
- [ ] TypeScript program resolver utility
- [ ] Production source enumerator
- [ ] Coverage registry builder

### Phase 2: Gate Implementation
- [ ] TG-2 gate logic (scripts/governance/tg2-production-coverage.ts)
- [ ] Exclusion policy codification
- [ ] Diagnostic formatter

### Phase 3: Validation
- [ ] T1-T6 test suite
- [ ] Healthcare field fixture validation
- [ ] npm script integration

### Phase 4: Documentation & Closure
- [ ] Evidence documentation
- [ ] Gate 3 status update
- [ ] TG-2 COMPLETE claim with evidence

---

**Next:** Phase 1 implementation (design complete, begin tooling)

---

**See also:**
- [Gate 3 Overview](./GATE3_ARCHITECTURAL_HARDENING.md)
- [TG-1 Schema-Type Sync](./TG1_SCHEMA_TYPE_SYNC_GATE.md)
- [Gate 2 Root-Cause Proof](./GATE2_ROOT_CAUSE_PROOF_CLOSURE.md)


---

## Current Status (September 7, 2026)

### Phase Summary

```text
TG-2 Production Coverage Integrity Gate
────────────────────────────────────────

Phase 1: Implementation              ✅ COMPLETE
  - Gate logic implementation
  - Production source enumeration
  - Coverage registry builder
  - Effective tsconfig resolution

Phase 2: Scope Qualification         ✅ COMPLETE
  - False confidence eliminated
  - Root tsconfig excluded (timeout >300s)
  - Governed scope qualification criteria
  - Healthcare gap reproduced

Phase 3: Classification Inventory    ✅ COMPLETE (TG-2.1)
  - Cluster-level analysis
  - 1855 uncovered files classified by architecture
  - Coverage reality: 345/2200 (16% governed)
  - Top gaps identified

Phase 4: Ownership Mapping           ⏸️ PENDING (TG-2.2)
  - Architectural decisions required
  - Scope registry expansion
  - Ownership → Coverage mapping

Phase 5: T1-T6 Validation            ⏸️ BLOCKED
  - Awaiting architectural decisions
```

### Coverage Reality

**Qualified Governed Coverage:** 345/2200 files (16%)

**NOT "Bella has 84% bad code"**

**Correct interpretation:**
> 84% of production TypeScript source has not yet been mapped to qualified governed typecheck scopes under current TG-2 registry.

### Cluster Analysis Results

| Cluster | Total Files | Covered | Gap | Coverage % | Has Scope? |
|---------|-------------|---------|-----|------------|------------|
| **Next.js App Routes** | 649 | 0 | 649 | 0% | ❌ |
| **UI Components** | 219 | 0 | 219 | 0% | ❌ |
| **Library/Utilities** | 213 | 0 | 213 | 0% | ❌ |
| **Modules** | 175 | 0 | 175 | 0% | ❌ |
| **Other src/** | 173 | 0 | 173 | 0% | ❌ |
| **Services Layer** | 161 | 0 | 161 | 0% | ❌ |
| **Platform Core** | 500 | 344 | 156 | 69% | ✅ |
| **Products** | 65 | 0 | 65 | 0% | ❌ |
| **Type Definitions** | 20 | 1 | 19 | 5% | ✅ |

**Key Finding:** Only Platform Core has meaningful governed coverage.

### Healthcare Services (T5 Field Validation)

**Status:** ✅ **GAP REPRODUCED**

```text
src/services/healthcare/**
  - 161 files uncovered
  - appointments-actions.ts
  - healthcare-service.ts
  - emergency-service.ts
  - laboratory-service.ts
  ... (all services-layer Healthcare files)
```

**T5 negative fixture proven:** Gate 2 Healthcare finding successfully reproduced by TG-2.

---

## TG-2.2 — Architectural Ownership Mapping

**Status:** ⏸️ **PENDING HUMAN DECISION**

### Objective

Map 1855 uncovered files to architectural ownership before creating governed scopes.

**Principle:**
> Coverage remediation must follow ownership architecture, not optimize coverage percentage.

### High-Priority Clusters (by risk density)

#### 1. Services Layer (161 files)

**Question:** Is `src/services/**` a unified shared layer, or domain-owned service clusters?

**Options:**
- **A:** Create domain-specific service scopes (healthcare-services, accounting-services, etc.)
- **B:** Create unified services scope (if truly shared infrastructure)
- **C:** Merge services into corresponding domain Platform scopes

**Decision required before:** Creating any services-related tsconfig

**Healthcare subset:**
- `src/services/healthcare/**` — 161 files
- Clear domain ownership (Healthcare)
- Should belong to Healthcare governed scope (extend existing or create new)

#### 2. Next.js App Routes (649 files)

**Question:** Should routes be governed by route structure or product ownership?

**Options:**
- **A:** Product ownership (Preschool routes + actions → Preschool scope)
- **B:** Technical layer (all routes → app-routes scope)
- **C:** Mixed (shared routes separate from product routes)

**Recommendation:** Product ownership (aligns with Factory Product understanding)

**Rationale:** Routes are product interface layer, should be governed with product code

#### 3. UI Components (219 files)

**Question:** Shared design system or product-specific components?

**Options:**
- **A:** Unified components scope (if truly shared design system)
- **B:** Product-owned components (component belongs to product using it)
- **C:** Split (design-system components separate from domain components)

**Decision required:** Component ownership classification

---

## Blocked Items

**Cannot proceed with:**
- ❌ Creating new governed tsconfigs (until ownership decided)
- ❌ Expanding existing scopes (until boundaries clear)
- ❌ T1-T6 validation protocol (requires stable coverage baseline)
- ❌ TG-2 COMPLETE claim (acceptance criteria not met)

**Can proceed with:**
- ✅ Documentation of findings
- ✅ Architecture discussion/decision
- ✅ Scope registry design (pending decisions)

---

## Value Discovery

**Original TG-2 goal:** Detect uncovered production source

**Actual TG-2 value:**
> **Production code ownership map of entire Bella platform**

**Questions TG-2 now forces:**
1. What architectural owner does this code belong to?
2. Which governance scope is responsible for it?
3. How do Product/Platform/Kernel boundaries map to typecheck scopes?
4. Is ownership clear, or is this an architectural orphan?

**This is more valuable than just coverage metrics.**

---

## Exit Criteria (Updated)

**TG-2 cannot claim COMPLETE until:**

1. ✅ Implementation complete
2. ✅ Scope qualification hardened
3. ✅ Coverage classification inventory complete
4. ⏸️ **Architectural ownership decisions made** ← BLOCKED HERE
5. ⏸️ Governed scope registry expanded per ownership
6. ⏸️ T1-T6 validation protocol executed
7. ⏸️ All production files have verdict: GOVERNED / EXCLUDED / RELOCATED / ORPHAN
8. ⏸️ No files in UNKNOWN ownership state

**Current progress:** 3/8 criteria met

---

## Principle Reinforced

> **Do not optimize coverage percentage. Optimize ownership clarity.**

**Wrong approach:**
```text
16% → create mega-scope → 100% ✅ → bad architecture
```

**Correct approach:**
```text
UNKNOWN ownership → classify → map to correct scope → coverage increases as byproduct
```

---

## Next Bounded Action

**TG-2.2 Architectural Ownership Decision Checkpoint**

**NOT an implementation task** — this is architectural design requiring human judgment.

**Deliverable:** Ownership map for Services, App Routes, Components clusters

**After decisions made:** TG-2 can proceed with scope registry expansion and T1-T6 validation.

---

**See also:**
- [TG-2 Scope Qualification Finding](./TG2_SCOPE_QUALIFICATION_FINDING.md)
- [TG-2.1 Classification Report](./.tg2-coverage-classification.txt)
- [Gate 3 Overview](./GATE3_ARCHITECTURAL_HARDENING.md)
