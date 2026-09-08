# Phase 3: Argument Transport Fix

**Date:** 2026-09-08  
**Status:** ✅ INFRASTRUCTURE FIXED, FIXTURES DESIGN ISSUE DISCOVERED

---

## Summary

Infrastructure fix successful: Windows path-with-spaces issue resolved. However, adversarial test revealed fundamental fixture design issue preventing proper rule validation.

---

## Problem Identified

**Original Error:**
```text
'D:\Antigravity\Projects\BELLA' is not recognized as an internal or external command
```

**Root Cause:** Windows `.cmd` files require `shell: true` in `spawn()`, but shell was parsing paths with spaces incorrectly.

---

## Fix Applied

### orchestrator: `factory-rules-gate.ts`

**Executable Path Quoting (Windows):**
```typescript
const tsxBin = platform() === 'win32' ? 'tsx.cmd' : 'tsx';
const tsxPathRaw = path.resolve(__dirname, '../../node_modules/.bin', tsxBin);
const tsxPath = platform() === 'win32' ? `"${tsxPathRaw}"` : tsxPathRaw;

spawn(tsxPath, args, {
  shell: platform() === 'win32',
});
```

**Argument Parsing (Both Formats):**
```typescript
// Orchestrator main()
const scope = args.find((arg) => arg.startsWith('--scope='))?.split('=')[1]
  || (args.includes('--scope') ? args[args.indexOf('--scope') + 1] : undefined);
```

**Argument Passing (Separate argv):**
```typescript
if (scope && rule.script.includes('g4-rule7')) {
  args.push('--scope', scope); // NOT --scope=${scope}
}
```

### Rule 7: `g4-rule7-diagnostic-inventory.ts`

```typescript
const scopeArg = args.find(arg => arg.startsWith('--scope='))?.split('=')[1]
  || args[args.indexOf('--scope') + 1];
```

---

## Validation Results

### Test 1: ALLOW Fixture (allow1-correct-snake-case.ts)

**Expected:** exit 0 (ALLOW)  
**Actual:** exit 0 (ALLOW) ✅

```text
G2: 2/2 rules passed
G3: 1/1 rules passed  
G4: 1/1 rules passed
SUMMARY: 4/4 rules PASSED
```

### Test 2: BLOCK Fixture (block1-camelcase-field.ts)

**Expected:** exit 2 (BLOCK)  
**Actual:** exit 0 (ALLOW) ❌ **FALSE NEGATIVE**

```text
G2: 2/2 rules passed
SUMMARY: 4/4 rules PASSED
```

---

## Critical Discovery: Fixture Design Issue

**Problem:** Mock fixtures compile without TypeScript errors.

**Example:**
```typescript
// This compiles fine - no schema drift detected
type PatientRow = { first_name: string };
interface PatientViewModel { firstName: string; } // camelCase OK here

function map(row: PatientRow): PatientViewModel {
  return { firstName: row.first_name }; // No TS error
}
```

**Real Dental incident:**
```typescript
// Schema has tube_color
type TreatmentInsert = { tube_color: string };

// Code tried to use tubeColor (doesn't exist)
const data: TreatmentInsert = { tubeColor: value }; 
// ❌ TS2322: Type '{ tubeColor: string }' is not assignable to type 'never'
```

**Key Difference:** Real incident had **property mismatch** (accessing non-existent field), not just naming convention difference.

---

## Fixture Requirements (Corrected Understanding)

BLOCK fixtures must create **actual TypeScript compiler errors** matching rule patterns:

**Rule 2 (Schema Drift):** Assign to property that doesn't exist in schema type
```typescript
type PatientRow = { first_name: string };
const patient: PatientRow = {
  firstName: "John" // ❌ TS2322: not assignable to type 'never'
};
```

**Rule 4 (Mapper Contract):** Return object missing required fields
```typescript
interface PatientDTO { id: string; name: string; }
function map(): PatientDTO {
  return { id: "123" }; // ❌ TS2741: Property 'name' is missing
}
```

**Rule 7 (Diagnostic Inventory):** Count of actual TS errors in scope
**Rule 10 (Repeated Pattern):** Same error pattern ≥4 times in one file

---

## Status Classification

```text
INFRASTRUCTURE FIX
  Windows path handling     ✅ COMPLETE
  Argument transport       ✅ VERIFIED
  ALLOW fixture reaches    ✅ PASS (exit 0)
  BLOCK fixture reaches    ✅ PASS (no ERROR)

FIXTURE DESIGN
  Mock types valid         ⚠️ ISSUE
  No actual TS errors      ❌ BLOCKS TESTING
  Comments ≠ violations    ❌ FALSE NEGATIVES

PHASE 3 STATUS             🟡 BLOCKED
  Reason: Fixtures need redesign with real TS errors
  False negative rate      NOT MEASURABLE (fixtures invalid)
  False positive rate      NOT MEASURABLE (fixtures invalid)
```

---

## Next Steps

### Option A: Real Type Errors (Preferred)

Redesign 24 fixtures to create actual TypeScript compiler diagnostics:

1. BLOCK fixtures must fail `tsc --noEmit`
2. ALLOW fixtures must pass `tsc --noEmit`
3. Each BLOCK fixture must trigger the specific rule pattern

**Example BLOCK fixture:**
```typescript
type SchemaType = { tube_color: string };
const data: SchemaType = { tubeColor: "blue" }; // Real TS error
```

### Option B: Simplified Smoke Test (Alternative)

Instead of 24 fixtures, test with **real production code**:

1. healthcare-actions.ts (known BLOCK from Dental)
2. One clean file (known ALLOW)
3. Measure actual FN/FP on real codebase

---

## Lessons

1. **Infrastructure vs Semantic:**  
   Path error was infrastructure failure (ERROR), not rule failure (BLOCK).  
   Fixed infrastructure allows measuring rule accuracy.

2. **Fixture Validity:**  
   Comments saying "❌ BLOCK" don't create violations.  
   Rules detect **compiler errors**, not comments.

3. **Platform Portability:**  
   Windows path-with-spaces requires explicit quoting at spawn boundary.  
   `shell: true` + quoted executable path = safe transport.

4. **Test Design:**  
   Adversarial tests require fixtures that actually violate the rules,  
   not just look like they do.

---

## Decision Required

**Before proceeding with Phase 3:**

User must decide:
- **Option A:** Redesign all 24 fixtures with real TypeScript errors (significant work)
- **Option B:** Simplified smoke test with real codebase files (faster validation)
- **Option C:** Defer adversarial testing, proceed to production field validation

**Current Recommendation:** Option B (smoke test with healthcare-actions.ts)

---

**Files Changed:**
- `scripts/governance/factory-rules-gate.ts` (Windows quoting, argv parsing)
- `scripts/governance/rules/g4-rule7-diagnostic-inventory.ts` (argv parsing)

**Test Evidence:**
- ALLOW fixture: ✅ exit 0 (infrastructure working)
- BLOCK fixture: ❌ exit 0 (fixture design issue, not infrastructure)

---

**Last Updated:** 2026-09-08
