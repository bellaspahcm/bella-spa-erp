# STEP 6 — Scope Boundary Configuration Finding

**Date:** 2026-09-08  
**Status:** 🔍 INVESTIGATION COMPLETE

---

## Executive Summary

29 app routes scopes execute successfully for **coverage governance** but produce TS6307 diagnostics when run for **isolated type-checking**.

**Root cause:** Scopes designed for route ownership mapping, not type-checking isolation.

**Impact:** Does NOT indicate code quality issues. Indicates architectural decision needed on scope purpose.

---

## Diagnostic Pattern Discovered

### TS6307: File Not Listed in Project

**All diagnostics follow same pattern:**

```text
packages/shared/src/index.ts(13,45): error TS6307: 
File 'packages/shared/src/types/auth.ts' is not listed 
within the file list of project. Projects must list all 
files or use an 'include' pattern.
```

**Cause:**
- App routes import platform dependencies (`@bella/shared`, `@/lib/*`, `@/services/*`)
- Scope includes ONLY route files (`src/app/**/workforce/**/*`)
- Dependencies outside scope → TS6307

### Sample Scope Configuration

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": true
  },
  "include": [
    "src/app/**/workforce/**/*"
  ],
  "exclude": [
    "**/*.test.ts",
    "**/*.test.tsx"
  ]
}
```

**Problem:** Routes import 50+ platform files not in include patterns.

---

## Non-Deterministic Behavior Explained

**Lần 1 (600s timeout):** 18/18 scopes PASS (0 diagnostics)  
**Lần 2 (180s timeout):** Same scopes HAS_DIAGNOSTICS (1000+ diagnostics)

**Root cause:** TypeScript compiler cache behavior

- Cold start with cache: May skip full dependency resolution → PASS
- Forced recompile: Full resolution → TS6307 diagnostics surface

**After cache clear:** Consistent TS6307 pattern across all scopes

---

## Scope Purpose Clarification

**Current Design:** App routes scopes govern **route ownership**, not **type isolation**

| Aspect | Current Capability | Type Isolation Requires |
|--------|-------------------|------------------------|
| **Coverage governance** | ✅ Working (TG-2: 973 files) | N/A |
| **Owner mapping** | ✅ Complete (409 routes → 29 owners) | N/A |
| **Isolated typechecking** | ❌ TS6307 (missing dependencies) | Include transitive deps |

---

## Architectural Options

### Option A: Expand Include Patterns (Transitive Dependencies)

**Approach:** Add all platform dependencies to each scope

```json
{
  "include": [
    "src/app/**/workforce/**/*",
    "packages/shared/src/**/*",
    "src/lib/**/*",
    "src/adapters/**/*",
    "src/services/**/*",
    "src/modules/**/*",
    "src/kernels/**/*",
    "src/products/**/*"
  ]
}
```

**Pros:**
- Scopes self-contained
- Isolated type-checking possible

**Cons:**
- Massive overlap (all 29 scopes include same platform files)
- Defeats scope isolation purpose
- 29 scopes × ~1500 platform files = redundant checking

### Option B: Project References (TypeScript Composite)

**Approach:** Create platform reference scopes, app routes reference them

```json
{
  "references": [
    { "path": "./tsconfig.platform-shared.json" },
    { "path": "./tsconfig.platform-services.json" },
    { "path": "./tsconfig.platform-core.json" }
  ],
  "include": [
    "src/app/**/workforce/**/*"
  ]
}
```

**Pros:**
- Clean TypeScript architecture
- Proper dependency graph
- No redundant checking

**Cons:**
- Requires platform reference scopes first
- Additional governance complexity
- May not align with current Bella scope model

### Option C: Dual-Purpose Model (RECOMMENDED)

**Approach:** Scopes serve governance, full tsconfig serves diagnostics

**App routes scopes:**
- Purpose: **Coverage governance** (TG-2 gate)
- Scope: Route files only
- Include: Narrow (route patterns)
- Usage: `npm run governance:tg2` (coverage measurement)

**Platform scopes:**
- Purpose: **Type-checking quality**
- Scope: Complete with dependencies
- Include: Broad (routes + platform + dependencies)
- Usage: `npm run governance:typecheck` (diagnostic measurement)

**Pros:**
- Clean separation of concerns
- Current scopes serve governance purpose (already working)
- Diagnostic measurement uses proper comprehensive scopes
- No redundant overlap

**Cons:**
- Requires documentation of dual-purpose model
- May confuse "scope" concept initially

---

## Evidence

### TG-2 Coverage Measurement (Working)

```bash
npm run governance:tg2
```

**Result:**
- ✅ 973 files covered (44%)
- ✅ 29 scopes registered
- ✅ Coverage governance operational

**Why it works:** TG-2 uses file enumeration + scope patterns, NOT isolated type-checking

### Isolated Type-Checking (TS6307)

```bash
npx tsc --project tsconfig.app-routes-workforce-management.json --noEmit
```

**Result:**
- ⚠️ 114 TS6307 diagnostics
- All: "File not listed in project"
- Pattern: Platform dependencies outside scope

**Why it fails:** Isolated compilation requires transitive dependencies in scope

---

## Recommendation

**Accept Option C: Dual-Purpose Model**

**Rationale:**
1. App routes scopes **already serve their governance purpose** (TG-2 coverage)
2. TS6307 is **configuration architecture**, not code quality
3. Diagnostic measurement should use **comprehensive platform scopes** that include dependencies
4. Expanding 29 scopes to include all dependencies defeats isolation purpose

**Implementation:**
1. Document scope purpose: **governance (ownership/coverage), NOT isolated type-checking**
2. Use app routes scopes for TG-2 coverage gate (current usage)
3. Use platform scopes (or root tsconfig) for diagnostic measurement
4. STEP 6 diagnostic baseline runs against **platform scopes**, not narrow app routes scopes

---

## STEP 6 Protocol Revision

**Original Plan:**
```text
6A: Run all 29 app routes scopes
6B: Freeze diagnostic inventory
6C-6G: Cluster + remediate
```

**Revised Plan:**
```text
6A: Document scope boundary finding ✅
6B: Run diagnostic measurement on PLATFORM scopes (comprehensive)
6C: Freeze diagnostic inventory
6D-6G: Cluster + remediate
```

**Key change:** Diagnostic measurement uses scopes with proper dependency inclusion, not narrow route-only scopes.

---

## Status

✅ **STEP 6A: Investigation Complete**

**Finding:** App routes scopes serve governance (ownership/coverage), not isolated type-checking

**Evidence:** TS6307 pattern across all 29 scopes when run in isolation

**Decision Required:** Accept dual-purpose model OR redesign scopes for type isolation

**Recommendation:** Option C (Dual-Purpose Model)

📋 **Next:** Await architectural decision on scope purpose before continuing STEP 6B-6G

