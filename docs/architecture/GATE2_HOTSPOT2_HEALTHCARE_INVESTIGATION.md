# Gate 2 — Hotspot #2: Healthcare Actions Investigation

**Status:** 🟡 INCONCLUSIVE — Scope architecture limitation discovered  
**Date:** September 7, 2026  
**Workstream:** BELLA TYPE-SYSTEM ROOT-CAUSE & HARDENING — Gate 2

**Result:** Healthcare in unscoped services/** layer. Cross-validation blocked. Skip to AutoMove Hotspot #3.

---

## Hotspot Selection

**Files:**
- `src/platform/healthcare/actions/healthcare-actions.ts` (primary)
- Related Healthcare action files

**Why this hotspot:**
- Highest diagnostic count in Gate 1 canonical diagnosis
- Healthcare Kernel = FROZEN baseline (H1-H12)
- Cross-validation opportunity: Test if generator-drift pattern repeats
- Different domain from Preschool (Kernel vs Product layer)

**Cross-validation hypothesis:**
If database.types.ts regeneration (Sept 7) reduces Healthcare diagnostics WITHOUT Healthcare code changes, this provides evidence that generator-drift is a **systemic cross-product failure mechanism**, not isolated to Preschool.

---

## Experiment Design

### Context

**Preschool (Hotspot #1) result:**
```text
BEFORE:  29 diagnostics
AFTER:    5 diagnostics (83% reduction)
CAUSE:   Generated-schema drift (types regenerated)
CHANGES: 0 consumer code modifications
```

**Healthcare opportunity:**
Database types just regenerated (commit `86d705a`) with preschool schema.

**Question:**
Does Healthcare diagnostic count change as side-effect of type regeneration?

### Protocol

```text
1. Capture Healthcare baseline diagnostics (current state)
2. NO Healthcare code modifications
3. Run Healthcare-scoped typecheck
4. Compare with known historical count
5. Classify result
```

### Decision Matrix

```text
SIGNIFICANT REDUCTION (>50%)
→ ✅ Generator-drift pattern CROSS-VALIDATED
→ Systemic failure mechanism proven

MINOR REDUCTION (10-50%)
→ 🟡 Mixed causes indicated
→ Further investigation required

NO REDUCTION (~0%)
→ ⚪ Healthcare has INDEPENDENT root causes
→ Multiple failure families confirmed
```

---

## Baseline Capture

**Method:** Targeted typecheck on Healthcare scope



---

## Investigation Results

### Finding #1: Scope Mismatch

**Gate 1 claimed:** 65 diagnostics in `healthcare-actions.ts`

**Gate 2 discovery:**
```text
File location:     src/services/healthcare/healthcare-actions.ts
Platform scope:    src/platform/healthcare/** (tsconfig.platform-healthcare.json)
Services NOT in scope: src/services/** excluded

Scoped check result:
  tsconfig.platform-healthcare.json → ✅ PASS (0 diagnostics)
```

**Implication:** The 65 diagnostics reported in Gate 1 were from **unscoped full-program check**, NOT from Platform Healthcare governance scope.

---

### Finding #2: Healthcare Isolated Check

**Attempted:** Isolated typecheck of healthcare-actions.ts

**Result:**
```text
Errors: 16 (mostly TS2307 module resolution)
Dominated by: Cannot find module '@/...' declarations
Real diagnostics: ~3 (TS2367 comparison, TS2322 type assignment)
```

**Module resolution failures:**
- `@/types/database.types` ✅ EXISTS (just regenerated)
- `@/platform/healthcare/engines/**` → relative path issues in isolated check
- `@/lib/**`, `@/services/**` → relative path issues

**Classification:** Module resolution artifacts of isolated check, NOT real diagnostics.

---

### Finding #3: Cross-Validation Inconclusive

**Hypothesis:** Generator-drift pattern would repeat in Healthcare after type regeneration.

**Test design flaw identified:**
```text
Preschool:
  ✅ In Product scope (testable)
  ✅ Uses preschool_* tables (regenerated types include them)
  ✅ Diagnostics directly mapped to missing types

Healthcare:
  ❌ NOT in Platform Healthcare governance scope
  ❌ Services layer excluded from scoped gates
  ❌ Full-program timeout prevents baseline measurement
```

**Conclusion:** Cannot execute controlled cross-validation on Healthcare due to:
1. Scope boundary mismatch (services vs platform)
2. Full-program scalability barrier
3. Gate 1 baseline unreliable (from timeout-affected run)

---

## Hotspot #2 Status

**Investigation:** 🟡 INCONCLUSIVE  
**Root Cause:** ⚪ NOT TESTABLE with current scope architecture  
**Cross-validation:** ❌ BLOCKED

**Reason:** Healthcare-actions.ts is in `src/services/**`, which is:
- NOT covered by 45 Platform scoped typechecks
- NOT accessible via isolated typecheck (module resolution breaks)
- NOT measurable in full-program check (timeout)

---

## Gate 2 Decision

**Options:**

### Option A: Skip Healthcare, Move to AutoMove Hotspot #3
- AutoMove is Product-layer (like Preschool)
- Uses generated DB types directly
- Testable with scoped/isolated typecheck
- Can validate generator-drift cross-product pattern

### Option B: Create services-healthcare scope config
- Add new tsconfig for services layer
- Include in governance typecheck
- Measure Healthcare diagnostics properly
- Required for comprehensive coverage (but out of Gate 2 scope)

### Option C: Mark Healthcare as "Unscoped Technical Debt"
- Accept that services/** layer lacks governance coverage
- Focus Gate 2 on Product + Platform layers only
- Defer services hardening to separate workstream

**Recommendation:** **Option A** — Skip to AutoMove Hotspot #3

**Rationale:**
1. Gate 2 objective: Prove generator-drift is systemic vs isolated
2. AutoMove provides clean cross-validation opportunity
3. Healthcare services/** scope gap is architectural issue (separate from Gate 2)
4. 3 Product hotspots (Preschool, AutoMove, Business Truth) sufficient for pattern proof

---

## Lessons Learned

**Governance scope architecture limitation discovered:**

```text
45 Platform scopes:     ✅ Covered
Product scopes:         ✅ Covered (partially)
Services layer:         ❌ NOT COVERED
```

**Impact:**
- Gate 1 full-program diagnostics included unscoped files
- **Note:** 251 diagnostics = full-repo inventory (partial), NOT directly interpretable as "251 diagnostics in governed scoped coverage" due to coverage model differences
- Services/** technical debt invisible to governance gates

**Future work:** Services layer governance (post-Gate 2)
