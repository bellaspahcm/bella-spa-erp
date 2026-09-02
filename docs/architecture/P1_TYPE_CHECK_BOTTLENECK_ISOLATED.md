# P1: TypeScript Bottleneck Investigation - Evidence Summary

**Date:** 2026-09-02  
**Status:** INVESTIGATION PAUSED - Hypothesis identified, not proven  
**Direction identified:** Type instantiation in full graph checking phase

---

## Critical Breakthrough

### Test Evolution

| Test | Config | Syntax Error | Result | Duration |
|------|--------|--------------|---------|----------|
| Baseline | Main tsconfig | N/A (present) | TIMEOUT | >180s |
| No test excludes | Clean config | Present | PASS | 6.4s ✅ |
| No test excludes | Clean config | **Fixed** | **TIMEOUT** | >45s ❌ |
| Platform only | Clean config | Present | PASS | 5.4s ✅ |
| Platform only | Clean config | **Fixed** | **TIMEOUT** | >20s ❌ |
| Types dir only | Isolated | Fixed | PASS | 4.6s ✅ |
| No types dir | Excluded types | Fixed | TIMEOUT | >45s ❌ |
| No database.types.ts | Excluded single file | Fixed | TIMEOUT | >30s ❌ |

### Key Finding

**Syntax error was circuit-breaking type checking for ENTIRE graph, not just test file.**

When syntax error fixed:
- Platform-only: 5.4s → >20s timeout
- Full repo: 6.4s → >45s timeout
- Types alone: Still fast (4.6s)
- Everything except types: Timeout

**Interpretation:** The bottleneck is NOT in database.types.ts itself, but in **how that type is used across the codebase**.

---

## Evidence: Type Instantiation Pattern

### Database Type Usage Pattern

```typescript
// Pattern found in ~50+ files across platform:
import type { Database } from '@/types/database.types';

type SomeRow = Database['public']['Tables']['some_table']['Row'];
type SomeInsert = Database['public']['Tables']['some_table']['Insert'];
```

### Why This May Be Expensive

1. **Indexed access types:** `Database['public']['Tables'][...]` requires TypeScript to:
   - Resolve `Database` type (30k lines)
   - Index into `public` schema
   - Index into `Tables` union
   - Index into specific table
   - Extract `Row`/`Insert`/`Update` type

2. **Cross-file instantiation:** Every file importing Database triggers this resolution

3. **Type checking phase:** With syntax error, TypeScript never reaches type instantiation phase. When fixed, it attempts to instantiate these types across ALL files simultaneously.

### Extended Diagnostics Evidence

**With syntax error (fast):**
```
Types:                          89
Instantiations:                  0  ← NO TYPE CHECKING
Total time:                  6.84s
```

**Without syntax error (expected if completed):**
```
Types:                     ~50,000+
Instantiations:            ~100,000+  ← EXPENSIVE
Total time:                      ???
```

---

## Source Cluster Analysis

### What Was Tested

✅ Bella Auto excluded: Still timeout  
✅ src/lib excluded: Still timeout  
✅ src/app excluded: Still timeout  
✅ First half alphabet: Timeout  
✅ Second half alphabet: Timeout  
✅ database.types.ts excluded: Still timeout  
✅ Types directory excluded: Timeout  
✅ Types directory alone: Fast (4.6s)  
✅ Platform alone (with error): Fast (5.4s)  
❌ Platform alone (error fixed): Timeout (>20s)

### Conclusion

**No single source cluster is the bottleneck.** The issue is in **type instantiation across clusters** when Database indexed access types are resolved.

---

## Root Cause Hypothesis (NOT PROVEN)

**Hypothesis:** Database type indexed access pattern may contribute to timeout

**Observation:** ~50+ files use pattern:
```typescript
import type { Database } from '@/types/database.types';
type SomeRow = Database['public']['Tables']['some_table']['Row'];
```

**Evidence supporting hypothesis:**
- Types directory alone: 4.6s PASS
- Platform using those types: >20s timeout when syntax error fixed

**Evidence DOES NOT prove:**
- That indexed access is the causal factor
- That this pattern is the bottleneck vs other type checking operations
- That remediation of this pattern would resolve timeout

**Status:** Directional signal, not causal proof. Further investigation (--generateTrace, stub testing) would be needed to validate, but investigation cost exceeds value at this stage.

---

## Confirming Evidence Needed

To prove this hypothesis, need:

1. **Profile TypeScript compilation** with `--generateTrace`
2. **Count actual type instantiations** in real run
3. **Test with simplified Database type** (stub) to see if timeout vanishes
4. **Measure time per indexed access** resolution

---

## Potential Remediations (NOT YET VALIDATED)

### Option 1: Type Aliases at Import Site
```typescript
// Instead of:
type Row = Database['public']['Tables']['users']['Row'];

// Use:
type TablesPublic = Database['public']['Tables'];
type UsersRow = TablesPublic['users']['Row'];
```
May reduce repeated indexed access depth.

### Option 2: Separate Type Files Per Table
```typescript
// generated/types/users.types.ts
export type UsersRow = Database['public']['Tables']['users']['Row'];

// usage
import type { UsersRow } from '@/generated/types/users.types';
```
Pre-instantiate types, avoid repeated resolution.

### Option 3: Use Supabase Type Generation Differently
Generate flattened types instead of nested Database union.

### Option 4: Incremental Type Checking
Use project references to isolate platform/modules type checking.

**⚠️ WARNING:** These are hypotheses. Do NOT implement without:
1. Confirming root cause with --generateTrace
2. Testing remediation in isolation
3. Measuring actual improvement
4. Architecture Guard approval

---

## Current Status

**TypeScript Gate:** 🔴 BLOCKED - Timeout >45s

**Evidence quality:** HIGH - controlled experiments, reproducible

**Root cause confidence:** LOW - hypothesis only, lacks causal proof

**Syntax error:** ✅ FIXED (line 59 comma removed)

**Next action:** Fix actual type errors using scoped type checks, defer compiler profiling

---

## Investigation Closure

**Why stopping here:**
- Sufficient evidence that full graph type checking triggers timeout
- Hypothesis about Database indexed access is directional, not proven
- Further compiler profiling has diminishing returns
- Actual type errors in codebase need remediation first
- After error remediation, can reassess if timeout persists

**What was learned:**
- Test exclude patterns affect compiler path materially
- Syntax error prevented full type checking, hiding bottleneck
- No single source cluster causes timeout in isolation
- Types directory itself is not expensive (4.6s)
- Bottleneck manifests when types are used across full graph

**What was NOT proven:**
- That Database indexed access is root cause
- That any specific remediation would resolve timeout
- That "cross-module type resolution" is the bottleneck

**Next phase:** Actual error remediation using scoped type checks

---

## Decisions Made

✅ Investigation paused - hypothesis documented  
✅ Syntax error fixed (test file line 59)  
✅ No production config changes  
✅ No code refactoring based on hypothesis  
✅ Evidence preserved in experiment configs

**Path forward:** Use scoped tsconfig experiments (platform-only, healthcare-only, types-only) to fix actual type errors, then retry full graph when cleaner.

---

**User goal:** "type check xanh hết trước pilot"

**Status:** Investigation complete enough for next phase. Switch to actual error remediation.
