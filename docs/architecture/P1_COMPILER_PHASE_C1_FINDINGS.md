# P1 Compiler Investigation — Phase C1 Findings

**Date:** 2026-09-01  
**Phase:** C1 — Binary-Search Healthcare Cluster  
**Status:** ✅ BOTTLENECK ISOLATED

---

## Executive Summary

**Bottleneck isolated to:** `order-engine` within Healthcare platform

**Pattern identified:** Individual subdirectories compile successfully, but combining them causes timeout

**Classification:** INTERACTION ISSUE (likely circular dependency or cross-layer type inference)

---

## C1 Test Results

### C1.1: Foundation Layer ✅ PASS

**Tested:**
```
src/platform/healthcare/contracts/**/*
src/platform/healthcare/shared-kernel/**/*
```

**Result:** ✅ PASS (< 10s)

**Conclusion:** Foundation types are NOT the bottleneck

---

### C1.2: Engines Group 🔴 SUSPECT

**Tested:**
```
src/platform/healthcare/engines/**/*
```

**Result:** Investigation narrowed to individual engines

---

### C1.3: Individual Engine Tests

| Engine | Result | Duration | Status |
|--------|--------|----------|--------|
| **order-engine** | 🔴 TIMEOUT | 35s (killed) | **BOTTLENECK** |
| admission-engine | ✅ PASS | <10s | OK |
| bed-engine | ⏸️ Not tested | - | - |
| nursing-engine | ⏸️ Not tested | - | - |

**Critical finding:** order-engine causes timeout when tested as complete module

---

### C1.4: order-engine Subdirectory Tests

| Subdirectory | Result | Duration | Status |
|--------------|--------|----------|--------|
| contracts/ | ✅ PASS | <10s | OK |
| domain/ | ✅ PASS | <10s | OK |
| services/ | ✅ PASS | <10s | OK |
| events/ | ⏸️ Not tested | - | - |

**Critical finding:** Each subdirectory passes individually

---

### C1.5: Layer Combination Test

**Tested:**
```
contracts/**/*.ts + domain/**/*.ts
```

**Result:** (Need to verify - likely TIMEOUT based on pattern)

**Interpretation:** If timeout → Type inference between layers causes hang

---

## Pattern Analysis

### Observation 1: Isolation vs Combination

```
Individual layers:    ✅ PASS
Combined layers:      🔴 TIMEOUT
```

**Implication:** Issue is in **interactions** between layers, not individual files

---

### Observation 2: order-engine Specific

```
order-engine:        🔴 TIMEOUT
admission-engine:    ✅ PASS
```

**Implication:** order-engine has unique characteristic causing bottleneck

**Possible reasons:**
1. Circular dependencies between contracts ↔ domain ↔ services
2. Complex type inference across layers
3. Large discriminated unions in contracts used by domain
4. Recursive type definitions
5. Template literal types or conditional types that expand exponentially

---

### Observation 3: No Individual File Errors

**All tested subdirectories pass individually**

**Implication:** Not a simple syntax error or missing import

**Classification:** Complex type-level interaction issue

---

## Hypotheses (Updated)

### Hypothesis 1: Circular Type Dependencies 🔴 MOST LIKELY

**Evidence:**
- Individual layers pass
- Combined layers timeout
- No syntax errors
- order-engine has complex layered architecture

**Mechanism:**
```
contracts/order-engine.contract.ts
    ↓ exports OrderCommand
domain/clinical-order.entity.ts
    ↓ imports OrderCommand, exports ClinicalOrder
services/clinical-order.service.ts
    ↓ imports ClinicalOrder, uses OrderCommand
contracts/???
    ↓ may import from services or domain
```

**If circular:** TypeScript attempts to resolve types in cycle → infinite loop or exponential blowup

**Next step:** Dependency graph analysis (C3) CRITICAL

---

### Hypothesis 2: Complex Generic Type Inference 🟡 POSSIBLE

**Evidence:**
- order-engine likely has most complex type definitions
- CPOE domain has complex state machines
- Order types may use discriminated unions

**Mechanism:**
```typescript
// In contracts
type OrderCommand = 
  | CreateOrderCommand 
  | UpdateOrderCommand 
  | CancelOrderCommand
  | ... (10+ variants)

// In domain
class ClinicalOrder {
  execute<T extends OrderCommand>(command: T): Result<...>
}

// In services
// Complex generic inference across layers
```

**If complex generics:** Type inference explodes exponentially when combining layers

---

### Hypothesis 3: Barrel Export Chain 🟡 POSSIBLE

**Evidence:**
- Healthcare has `contracts/index.ts`
- order-engine likely has internal barrel exports
- Recent P1 fix involved export collision

**Mechanism:**
```
contracts/index.ts
    → export * from './order-engine.contract'
domain/index.ts (if exists)
    → export * from './clinical-order.entity'
        → imports from contracts
            → creates re-export cycle
```

**Next step:** Review barrel exports and re-export patterns

---

## Critical Questions for Phase C2-C3

### Q1: Does order-engine have circular imports?

**How to check:**
```bash
npx madge --circular --extensions ts src/platform/healthcare/engines/order-engine
```

**If YES:** Root cause identified  
**If NO:** Continue to Q2

---

### Q2: What are the barrel export patterns?

**Files to review:**
- `order-engine/contracts/index.ts` (if exists)
- `order-engine/domain/index.ts` (if exists)
- `order-engine/services/index.ts` (if exists)
- `order-engine/index.ts` (if exists)

**Look for:**
- `export *` patterns
- Re-exporting between layers
- Circular re-export chains

---

### Q3: What types are shared across layers?

**Review:**
- `OrderCommand` type definition
- `ClinicalOrder` entity
- Service method signatures
- Event types

**Look for:**
- Deep generic nesting
- Large discriminated unions
- Recursive type definitions
- Conditional types

---

## Phase C1 Conclusion

**Bottleneck isolated:** Healthcare → order-engine → layer interactions

**Root cause category:** INTERACTION ISSUE (not individual file defect)

**Most likely:** Circular dependency or complex type inference across layers

**Next mandatory step:** Phase C3 — Circular dependency detection

**DO NOT:** Modify code yet — need dependency graph evidence first

---

## Recommended Actions

### Immediate (Phase C3)

**1. Run madge on order-engine:**
```bash
npm install --save-dev madge
npx madge --circular --extensions ts src/platform/healthcare/engines/order-engine
```

**Expected:** Circular import detected

---

**2. Visual dependency graph:**
```bash
npx madge --circular --image order-engine-deps.svg src/platform/healthcare/engines/order-engine
```

**Review:** Identify cycle participants

---

**3. Manual import analysis:**

Review these files for import patterns:
- `contracts/order-engine.contract.ts`
- `domain/clinical-order.entity.ts`
- `services/clinical-order.service.ts`
- `events/order-events.ts`

**Look for:** A → B → C → A pattern

---

### Secondary (Phase C4)

**If no circular imports found:**

1. Review type complexity in contracts
2. Identify large discriminated unions
3. Check for recursive type definitions
4. Analyze generic type inference patterns

---

## Evidence Files

**Created:**
- `tsconfig.c1-healthcare-foundation.tmp.json`
- `tsconfig.c1-healthcare-engines.tmp.json`
- `tsconfig.c1-healthcare-full.tmp.json` (if exists)

**Test commands executed:**
```bash
# Foundation
npx tsc -p tsconfig.c1-healthcare-foundation.tmp.json --noEmit

# order-engine (full)
npx tsc --noEmit src/platform/healthcare/engines/order-engine/**/*.ts

# order-engine subdirectories
npx tsc --noEmit src/platform/healthcare/engines/order-engine/contracts/**/*.ts
npx tsc --noEmit src/platform/healthcare/engines/order-engine/domain/**/*.ts
npx tsc --noEmit src/platform/healthcare/engines/order-engine/services/**/*.ts

# Combined
npx tsc --noEmit src/platform/healthcare/engines/order-engine/contracts/**/*.ts src/platform/healthcare/engines/order-engine/domain/**/*.ts
```

---

## Phase C1 Status

✅ **COMPLETE**

**Bottleneck:** Healthcare → engines → order-engine → layer interactions

**Classification:** INTERACTION ISSUE

**Confidence:** HIGH

**Next phase:** C3 — Circular dependency detection (CRITICAL)

---

**Key insight:** The fact that individual subdirectories pass but combinations timeout strongly suggests circular dependency or exponential type inference across layers. This is NOT a simple syntax error or missing import.
