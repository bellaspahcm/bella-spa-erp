# Bella Control Registry — Task Scope Assessment

**Date:** 2026-09-08  
**Status:** ⏸️ DEFERRED (scope exceeds session capacity)

---

## Task Objective

Build canonical deduplicated inventory of all Gates/Guards/Rules/Checks across:
- Core/Platform
- Factory (G0–G5)
- Industry OS (Healthcare, Finance, Logistics, etc.)
- Products

**Investor question:** "How many unique controls does Bella have, and what's their maturity?"

---

## Scope Discovery (Initial Scan)

### Known Control Structures

**Factory Rules:**
- Location: `scripts/governance/factory-rules-gate.ts`
- Structure: 4 automated rules registered
- Rules: R2 (Schema Drift), R4 (Mapper Contract), R7 (Diagnostic Inventory), R10 (Repeated Root-Cause)
- Status: 1/4 adversarially verified (R2)

**Healthcare Architecture Guard:**
- Location: `scripts/healthcare/healthcare-architecture-guard.ts`
- Structure: Multiple rules (events domain dependency, barrel exports, etc.)
- Registration: Script-based execution

**BDGF Gates (Amendment 12):**
- Location: `.bdgf/gates/amendment-12/`
- Files: `e0-artifact-integrity.json`, `e1-runtime-preconditions.json`, `package-integrity.json`
- Structure: JSON-based gate definitions with checks array

**Healthcare Constitution:**
- Location: `docs/health-care/PLATFORM_CONSTITUTION.md`
- Type: Policy/governance document
- Content: Domain rules, integration patterns, saga patterns

**Architecture Documentation:**
- Location: `docs/architecture/`
- Files: 500+ documents
- Includes: Constitutions, gates, guards, architecture reviews, evidence files

---

## Estimated Scope

### File Count

```text
Scripts:
- governance/** : ~50 files
- healthcare/** : ~2 files
- ci-** : multiple

Docs:
- architecture/** : 500+ files
- health-care/** : unknown
- governance/** : unknown

Config:
- .bdgf/gates/** : ~5 files
- tsconfig.*.json : 30+ files
- .eslintrc.architecture.js : 1 file

Tests:
- **/__tests__/** : unknown
- **/*.test.ts : unknown
```

**Minimum files to analyze:** 600+

### Control Discovery Complexity

**Each file may contain:**
- Parent gates (containers)
- Child checks/rules (leaf controls)
- Aliases/references to other controls
- Implementation vs documentation vs registration
- Evidence files vs control definitions

**Deduplication required:**
- Same control across docs/code/tests
- Renamed controls (aliases)
- Reused controls across OSes
- Tests as evidence (not controls)

### Analysis Per Control

For each discovered control, must determine:
1. Canonical ID and name
2. Type (GATE/GUARD/RULE/CHECK)
3. Parent/hierarchy
4. Scope (CORE/FACTORY/OS/PRODUCT)
5. Industry/product binding
6. Source file
7. Implementation file
8. Registration file
9. Execution entrypoint
10. Evidence file
11. Status: DEFINED/REGISTERED/AUTOMATED/EXECUTED/ENFORCED/ADVERSARIAL/PROVEN
12. 9-layer mapping
13. Duplicate group
14. Canonical vs alias

**Estimated per-control analysis time:** 5-10 minutes

**If 100-200 unique controls exist:** 8-33 hours of analysis

---

## Why This Exceeds Session Capacity

**Current session constraints:**
1. Token budget: ~115k remaining (insufficient for 600+ file reads)
2. Time budget: Already 3+ hours into Factory Phase 3
3. Context: Session optimized for adversarial testing, not inventory
4. Execution environment: Currently unstable (timeout issues)

**Task requirements:**
1. Systematic file-by-file scanning
2. Cross-reference resolution
3. Deduplication logic
4. Evidence classification
5. Hierarchy reconstruction
6. CSV/MD generation
7. Validation arithmetic

**Estimated task duration:** 8-16 hours (dedicated session)

---

## Recommended Approach

### Option A: Dedicated Inventory Session (Recommended)

**Prerequisites:**
1. Fresh execution environment (stable npm/tsc)
2. Clear session focus (no parallel work)
3. Multi-hour time budget

**Phases:**
1. **Discovery (2-4h):** Scan all files, extract control references
2. **Classification (2-4h):** Type, scope, status determination
3. **Deduplication (2-3h):** Resolve aliases, merge references
4. **Evidence mapping (1-2h):** Link controls to implementation/tests
5. **Validation (1-2h):** Arithmetic checks, hierarchy validation
6. **Documentation (1-2h):** Generate registry files

**Total:** 9-17 hours

### Option B: Incremental Build

**Phase 1:** Factory Rules only (2h)
- 10 defined rules
- 4 automated rules
- Known structure

**Phase 2:** Healthcare gates (3h)
- Architecture guard
- Constitution rules
- BDGF gates

**Phase 3:** Core/Platform (4h)
- Security gates
- Migration governance
- RLS/tenant controls

**Phase 4:** OS/Product specific (6h)
- Finance, Logistics, Education, etc.
- Product-specific checks

**Total:** 15 hours (across multiple sessions)

### Option C: Simplified Inventory (Quick)

**Scope:** Known structures only (no deep scanning)

**Sources:**
1. Factory Rules: 10 defined, 4 automated
2. Healthcare guard: Count from script
3. BDGF Amendment 12: Count from JSON
4. Architecture G3a: 95 checks (from documentation)

**Exclusions:**
- Deep file scanning
- Unknown controls
- Detailed evidence mapping

**Duration:** 2-3 hours

**Output:** Approximate counts with confidence intervals

---

## Decision Required

**Question for user:**

Which approach do you want?

**A) Dedicated inventory session** (full registry, 9-17h, most accurate)  
**B) Incremental build** (phased approach, 15h across sessions)  
**C) Simplified inventory** (known structures only, 2-3h, approximate)

**Current recommendation:** **Option C** for immediate investor needs, followed by **Option A** when time permits for full canonical registry.

---

## Known Control Seeds (For Option C)

**Factory Rules:**
- 10 canonical rules defined
- 4 automated (R2/R4/R7/R10)
- 1 adversarially verified (R2)

**Healthcare:**
- 11 Automated Verification Gates (from constitution reference)
- Architecture Guard: ~8-12 rules (estimate from script structure)

**BDGF Amendment 12:**
- 3 gate files discovered
- Checks per gate: TBD (need to count)

**Architecture G3a:**
- 95 checks (documented)

**Estimated baseline:** 120-140 unique controls (conservative)

---

**Status:** Task scoped, awaiting user decision on approach.
