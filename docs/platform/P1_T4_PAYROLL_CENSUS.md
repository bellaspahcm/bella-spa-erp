# P1-T4: Payroll/Legacy TypeScript Hardening — Census

**Status:** Census Complete  
**Checkpoint:** `17b7bfb4`  
**Date:** 2026-09-16  
**Branch:** `hardening/platform-stability-20260916`

---

## Scope Definition

**Payroll/Legacy** = Legacy payroll calculation provider in `src/lib/decision-engine/providers/payroll/`:
- **payroll-provider.ts**: Complex multi-component salary calculations
- **types.ts**: PayrollDecisionInput/Output interfaces

**Context:** Legacy code predating Platform hardening standards. Isolated to payroll domain, minimal cross-domain dependencies.

**Priority:** MEDIUM — domain-isolated, but blocking Education compiler clean state.

---

## Current State @ 17b7bfb4

```
Payroll/Legacy: 49 diagnostics
File: payroll-provider.ts (100%)

Locked Scopes (Verified):
├─ Platform Core: 0 🔒
├─ Beauty OS: 0 🔒
├─ Real Estate: 0 🔒
├─ Education-owned: 0 🔒
└─ Platform Host: 0 🔒

Gates: ALL PASSED
├─ Education gate: PASSED
└─ Platform Host gate: PASSED
```

---

## ROOT CAUSE ANALYSIS

**Single Root Cause: `Record<string, unknown>` config params**

### Type Definition (types.ts)
```typescript
config?: {
  kpi?: {
    enabled: boolean;
    strategy: 'threshold' | 'linear' | 'tier';
    params: Record<string, unknown>;  // ← ROOT CAUSE
  };
  attendance?: {
    params: Record<string, unknown>;  // ← ROOT CAUSE
  };
  rating?: {
    params: Record<string, unknown>;  // ← ROOT CAUSE
  };
  commission?: {
    params: Record<string, unknown>;  // ← ROOT CAUSE
  };
};
```

### Cascade Effect
`Record<string, unknown>` → property access → `unknown` → TypeScript narrows to `{}` in complex expressions → 49 diagnostics.

---

## Diagnostic Classification

### By Error Code
```
TS2363 (arithmetic operations): 10 diagnostics
TS2339 (property access):        8 diagnostics
TS2365 (comparison operators):   8 diagnostics
TS18046 (unknown access):        6 diagnostics
TS2322 (type assignment):        6 diagnostics
TS2488 (iterator):               4 diagnostics
TS2345 (argument type):          3 diagnostics
TS2367 (comparison overlap):     3 diagnostics
TS7053 (index signature):        1 diagnostic
────────────────────────────────────────
Total:                          49 diagnostics
```

### By Pattern
```
Pattern A: params.property arithmetic (lines 411-567)      28 diagnostics
Pattern B: params spread (lines 156-159)                    4 diagnostics
Pattern C: tieredRates.find() (lines 464, 541, 577)        9 diagnostics
Pattern D: RuleCondition type mismatch (lines 750-788)     8 diagnostics
```

---

## Detailed Pattern Breakdown

### Pattern A: Params Property Arithmetic (28 diagnostics)

**Lines affected:** 411, 440, 448, 450-452, 491, 494, 497, 517, 525, 527-529, 567, 586, 599, 635

**Problem:** `params.target`, `params.bonus`, `params.rates` accessed as numbers but typed as `unknown`.

**Example:**
```typescript
private calculateKPIBonus(sessions: number, strategy: string, params: Record<string, unknown>): number {
  const target = params.target || 30;  // params.target is unknown
  const bonus = params.bonus || 1000000;  // params.bonus is unknown
  return sessions >= target ? bonus : 0;  // TS2365: Operator '>=' cannot apply
}
```

**Fix Strategy:** Define typed param interfaces per strategy, narrow Record to specific type.

---

### Pattern B: Params Spread (4 diagnostics)

**Lines affected:** 156-159

**Problem:** `metadata?.matchedRules` typed as `unknown` cannot be spread.

**Example:**
```typescript
matchedRules.push(...(kpiBonus.metadata?.matchedRules || []));
// TS2488: Type '{}' must have a '[Symbol.iterator]()' method
```

**Fix Strategy:** Type `metadata` with known structure or cast at boundary.

---

### Pattern C: TieredRates.find() (9 diagnostics)

**Lines affected:** 464-465, 541-542, 577-578

**Problem:** `params.tieredRates` typed as `unknown`, `.find()` fails, `t.min`/`t.max` unknown.

**Example:**
```typescript
const rates = params.tieredRates || [];
const tier = rates.find(t => sessions >= t.min && sessions <= t.max);
// TS2339: Property 'find' does not exist on type '{}'
// TS18046: 't.min' is of type 'unknown'
```

**Fix Strategy:** Define TieredRate interface, type params.tieredRates properly.

---

### Pattern D: RuleCondition Type Mismatch (8 diagnostics)

**Lines affected:** 750, 764, 767-769, 773, 777-778, 783, 787-788

**Problem:** `RuleCondition` type from legacy payroll rules incompatible with `Condition` type from newer rule engine.

**Example:**
```typescript
const convertCondition = (rc: RuleCondition): Condition => {
  if (rc.type === 'simple') {  // TS2367: no overlap between union types
    return { field: rc.field, ... };  // TS2339: Property 'field' on 'never'
  }
};
```

**Fix Strategy:** Align RuleCondition with Condition interface or create adapter.

---

## Fix Strategy

### Approach: Type Narrowing at Source (Recommended)

**Why:** All 49 diagnostics cascade from 4 `params: Record<string, unknown>` in types.ts. Fixing source eliminates cascade.

**Batches:**

#### Batch 1: Define Strategy Param Interfaces (0 diagnostics → types.ts change)
```typescript
// types.ts additions
interface KPIThresholdParams {
  target: number;
  bonus: number;
}

interface KPILinearParams {
  baseRate: number;
  bonusPerSession: number;
}

interface KPITierParams {
  tieredRates: Array<{ min: number; max: number; bonus: number }>;
}

type KPIParams = KPIThresholdParams | KPILinearParams | KPITierParams;

// Similar for Attendance, Rating, Commission
```

#### Batch 2: Update PayrollDecisionInput Config (49 → ~10 estimated)
```typescript
config?: {
  kpi?: {
    enabled: boolean;
    strategy: 'threshold' | 'linear' | 'tier';
    params: KPIParams;  // ← narrow from Record<string, unknown>
  };
  // Similar for other providers
};
```

#### Batch 3: Add Strategy Discriminators (10 → ~2 estimated)
```typescript
private calculateKPIBonus(sessions: number, config: KPIConfig): number {
  switch (config.strategy) {
    case 'threshold':
      return sessions >= config.params.target ? config.params.bonus : 0;
    // TypeScript narrows params based on strategy
  }
}
```

#### Batch 4: Fix RuleCondition Adapter (2 → 0)
```typescript
// Align RuleCondition with Condition or create type-safe adapter
```

**Expected commits:** 3-4 (excluding RuleCondition if separate issue)

---

## Alternative Approach: Type Assertions (NOT Recommended)

**Why not:** 49 individual assertions brittle, masks design flaw, no safety improvement.

**Example (what we avoid):**
```typescript
const target = (params.target as number) || 30;
const bonus = (params.bonus as number) || 1000000;
// Repeat 49 times...
```

---

## Risk Assessment

**Overall Risk: MEDIUM**

### Risks
1. **Config contract change** — if params structure used externally (tenant config), migration needed
2. **Strategy discriminated unions** — require careful type guards
3. **Test coverage** — payroll logic needs comprehensive validation

### Mitigations
1. **Check tenant config usage** — verify params structure before changing
2. **Incremental batches** — verify at each step
3. **Run payroll tests** — ensure calculations unchanged

---

## Verification Strategy

After each batch:
```bash
# 1. Payroll diagnostics progress
npx tsc --noEmit src/lib/decision-engine/providers/payroll/*.ts

# 2. Education compiler (contains payroll)
npx tsc --project tsconfig.education.json --noEmit
# Expected: 49 → ... → 0

# 3. All gates
npm run gate:education-no-new-debt
npm run gate:platform-host-no-new-debt

# 4. Locked scopes
npx tsc --project tsconfig.platform-core.json --noEmit   # Must = 0
npx tsc --project tsconfig.beauty.json --noEmit          # Must = 0
npx tsc --project tsconfig.real-estate.json --noEmit     # Must = 0

# 5. Payroll tests (if exist)
npm test -- payroll
```

**Success Criteria:**
- payroll-provider.ts: 49 → 0
- Education compiler: 49 → 0
- All locked scopes remain 0
- All gates PASS
- Payroll tests PASS (if exist)

---

## Expected Outcome

```
Payroll/Legacy: 49 → 0 🔒

Education Compiler: 49 → 0 (CLEAN)
├─ Payroll/Legacy: 0 ✅
├─ Platform Host: 0 ✅
└─ Education-owned: 0 ✅

Locked Scopes @ 0:
├─ Platform Core 🔒
├─ Beauty OS 🔒
├─ Real Estate 🔒
├─ Education-owned 🔒
├─ Platform Host 🔒
└─ Payroll/Legacy 🔒 (NEW)
```

**Milestone:** If achieved, Education compiler reaches **0 total diagnostics** without baseline exceptions.

---

## Next Steps

1. **Pre-fix check:** Verify params structure not externally consumed
2. **Batch 1:** Define strategy param interfaces (types.ts)
3. **Batch 2:** Update PayrollDecisionInput config types
4. **Batch 3:** Add strategy discriminators in calculations
5. **Batch 4:** Fix RuleCondition adapter (if still needed)
6. **Verification:** All tests + gates PASS
7. **Lock:** Create No-New-Debt gate for Payroll
8. **P1 Reconciliation:** Verify all scopes clean before declaring P1 complete

---

**Signed-off:** Platform Stability Workstream  
**Date:** 2026-09-16  
**Checkpoint:** 17b7bfb4  
**Status:** Census complete, root cause identified, ready for cleanup
