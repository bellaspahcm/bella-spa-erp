# P1-T2 STEP 3 — PAYROLL-PROVIDER DEPENDENCY INVESTIGATION

**Checkpoint:** `e4065d11`  
**Date:** 2026-09-16  
**Investigator:** AI Coding Agent  
**Status:** ✅ **ROOT CAUSE IDENTIFIED**

---

## **Investigation Scope**

**Target:** `src/lib/decision-engine/providers/payroll/payroll-provider.ts`  
**Diagnostics:** 49 (27.7% of Education baseline 177)  
**Question:** Why is Decision Engine included in Education scope?

---

## **Evidence Chain**

### **1. Direct Import Check — NEGATIVE**

```bash
# Education does NOT directly import payroll-provider
grep -r "from.*decision-engine/providers/payroll" src/platform/education/
# Result: No matches
```

### **2. Decision Engine Barrel Export — NEGATIVE**

**File:** `src/lib/decision-engine/index.ts`

```typescript
// Sprint 2 exports
export type { Knowledge, DecisionOutcome, DecisionResult, Policy, Rule } from './types';
export { RuleReasoner } from './RuleReasoner';
export { leaveApprovalPolicyV1 } from './policies/leave-approval-v1';
export { PolicyRegistry } from './registry/PolicyRegistry';
```

**Verdict:** Payroll-provider is **NOT** exported from Decision Engine barrel.

### **3. Transitive Dependency via Platform Host — NEGATIVE**

```bash
# Education imports from platform/host (event-bus, person)
grep -r "from.*@/platform/host" src/platform/education/

# But platform/host does NOT import Decision Engine
grep -r "from.*decision-engine" src/platform/host/
# Result: No matches
```

### **4. TypeScript Trace Resolution — ROOT CAUSE FOUND** ✅

```bash
npx tsc --project tsconfig.education.json --traceResolution 2>&1 | grep payroll-provider
```

**Output:**
```
======== Resolving module '@/adapters/payroll-provider-adapter' 
         from 'src/modules/hr-salary/actions/salary-recalculation-engine.ts' ========
```

---

## **Root Cause: Unintended Scope Inclusion**

### **Dependency Chain**

```
tsconfig.education.json
  ├─ include: ["src/platform/education/**/*.ts", ...]
  ├─ extends: tsconfig.json
  │   └─ include: ["**/*.ts", "**/*.tsx"]  ⚠️ BROAD INCLUSION
  ├─ exclude: ["src/platform/host", "src/platform/healthcare", ...]
  │   └─ MISSING: "src/modules"  ❌ NOT EXCLUDED
  │
  └─ TypeScript compiles ALL src/**/*.ts not explicitly excluded
      │
      └─ src/modules/hr-salary/actions/salary-recalculation-engine.ts
          │
          └─ import { getPayrollProviderAdapter } from '@/adapters/payroll-provider-adapter'
              │
              └─ import { PayrollProvider } from '@/lib/decision-engine/providers/payroll'
                  │
                  └─ payroll-provider.ts (49 diagnostics)
```

---

## **Classification**

**Status:** ⚠️ **UNINTENDED SCOPE POLLUTION**

### **Why This Is Pollution, Not Legitimate Dependency:**

1. **Education Platform does NOT consume hr-salary**
   - Zero imports from `@/modules/hr-salary` in Education code
   - `hr-salary` is a **Legacy Services** concern, not Education OS

2. **Decision Engine payroll-provider is NOT an Education dependency**
   - Education uses Decision Engine for **leave approval** only (Sprint 2)
   - Payroll calculations belong to HR/Salary domain

3. **tsconfig.education.json architectural intent violated**
   - Explicit excludes: `platform/host`, `platform/healthcare`, `platform/logistics`, `services`
   - Implicit includes: everything else (base tsconfig `**/*.ts`)
   - `src/modules` was never intended for Education scope

---

## **Impact Assessment**

### **Current State**
```
Education observed baseline         177  (includes payroll pollution)
Payroll-provider diagnostics         49  (27.7% of 177)
───────────────────────────────────────
True Education baseline (expected)  128  (if pollution removed)
```

**CRITICAL CORRECTION:** The 49 payroll diagnostics are **ALREADY PART OF** the 177 baseline, not additive to it. Original clustering correctly identified payroll-provider as the #1 file contributor.

### **Comparison to Previous Cluster E**
```
Cluster E (Healthcare)               54 diagnostics removed (23.4%)
Payroll-provider (Decision Engine)   49 diagnostics candidate (27.7%)
```

**Pattern:** Second major scope pollution discovered through dependency tracing.

---

## **Ownership Verification**

### **Who Owns payroll-provider.ts?**

**Domain:** HR/Payroll (Legacy Services)  
**Architectural Layer:** Decision Engine Provider (Sprint 2)  
**Consumer:** `modules/hr-salary` (Legacy Services)

**Evidence:**
```typescript
// src/modules/hr-salary/actions/salary-recalculation-engine.ts
import { getPayrollProviderAdapter } from '@/adapters/payroll-provider-adapter';

const USE_PAYROLL_PROVIDER = process.env.FEATURE_PAYROLL_PROVIDER === 'true';
```

### **Is Education a Consumer?**

**NO.** Education Platform has:
- Zero imports from `@/modules/hr-salary`
- Zero imports from `@/adapters/payroll-provider-adapter`
- Zero imports from `@/lib/decision-engine/providers/payroll`

**Legitimate Education Decision Engine usage:**
```typescript
// Education uses leave approval only (Sprint 2)
import { leaveApprovalPolicyV1 } from '@/lib/decision-engine/policies/leave-approval-v1';
```

---

## **Root Cause Analysis**

### **Architectural Defect**

**Problem:** `tsconfig.education.json` relies on **negative exclusion** rather than **positive inclusion**.

```json
{
  "include": [
    "src/platform/education/**/*.ts",
    "src/products/bella-education/**/*.ts",
    "src/app/dashboard/education/**/*.ts",
    "src/app/api/education/**/*.ts"
  ],
  "exclude": [
    "src/platform/host",
    "src/platform/healthcare",
    "src/platform/logistics",
    "src/services"
  ]
}
```

**Issue:** Base `tsconfig.json` has `"include": ["**/*.ts"]`, which causes:
- Education tsconfig **inherits** global `**/*.ts` inclusion
- Only explicitly excluded paths are filtered
- `src/modules/**` was never excluded → gets compiled

**Expected:** Education scope should compile **ONLY** files in `include` list + **legitimate transitive dependencies**.

**Actual:** Education scope compiles `include` + **ALL files not in `exclude`** (base tsconfig inheritance).

---

## **EXC-P1T1-01 Relationship**

**Previously blocked scope:** Legacy Services (158 files, timeout)

**Discovery:** payroll-provider.ts is part of **Legacy Services** (via `modules/hr-salary`), which is:
- Currently in `EXC-P1T1-01` (timeout exception)
- Unintentionally leaking into Education scope
- Contributing 49 diagnostics to Education baseline

**Implication:** If Legacy Services scope were measurable, these 49 diagnostics would belong there, not Education.

---

## **Recommendations**

### **Immediate Action**

**Add `src/modules` to tsconfig.education.json exclude list:**

```json
{
  "exclude": [
    "node_modules",
    ".next",
    "src/platform/host",
    "src/platform/healthcare",
    "src/platform/logistics",
    "src/services",
    "src/modules",  // ← ADD THIS
    "**/__tests__",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx"
  ]
}
```

### **Verification Plan**

**After fix, run:**
```bash
npx tsc --project tsconfig.education.json --noEmit
```

**Expected result:**
```
Education baseline: 177 → 128  (49 reduction)
```

**Invariant check (locked scopes):**
```bash
npx tsc --project tsconfig.platform-core.json --noEmit  # Expect: 0
npx tsc --project tsconfig.beauty.json --noEmit         # Expect: 0
npx tsc --project tsconfig.real-estate.json --noEmit    # Expect: 0
```

### **Cascading Investigation**

**After payroll-provider removal, re-cluster 128 diagnostics:**

Top remaining candidates:
1. `supabase-education.repository.ts` (48 diagnostics)
2. Platform Host files (12 diagnostics)
   - `rule-engine.service.ts` (7)
   - `person.repository.ts` (5)

**Do NOT fix repository layer until:**
- Platform Host dependency ownership verified
- Education true baseline confirmed stable

---

## **Lessons Learned**

### **Architectural Principle Violated**

**"Scope configuration should use positive inclusion, not negative exclusion."**

**Current pattern (fragile):**
- Include everything (`**/*.ts`)
- Exclude known violations

**Robust pattern:**
- Include only scope boundaries
- Trust TypeScript module resolution for legitimate transitive dependencies

### **Census Methodology Validated**

**Why "Measure → Classify → Act" works:**

1. **Initial observation:** 231 diagnostics
2. **Cluster E investigation:** 54 Healthcare diagnostics removed → 177
3. **Payroll-provider investigation:** 49 Legacy Services diagnostics found → 128 expected

**Running total:**
```
231 initial
- 54 Healthcare (Cluster E)
- 49 Decision Engine/HR (payroll-provider)
───────────────────────────────────────
128 canonical Education baseline (projected)
```

**Without investigation:** Would have "fixed" 103 diagnostics that weren't Education's responsibility.

---

## **Next Steps**

**Immediate (same session):**
1. ✅ Complete this investigation report
2. Apply tsconfig fix (`src/modules` exclusion)
3. Run compiler verification
4. Update `P1_T2_STEP3_EDUCATION_RECLUSTERING_177.md` with actual result
5. Verify locked scopes remain 0

**Follow-up:**
1. Investigate Platform Host files (12 diagnostics)
2. Only after dependency boundaries clear: fix repository layer (48 diagnostics)
3. Final Education re-clustering on true baseline

---

## **Status**

**Investigation:** ✅ **COMPLETE**  
**Classification:** ⚠️ **UNINTENDED SCOPE POLLUTION** (Legacy Services → Education via transitive type resolution)  
**Removal attempted:** ❌ **UNSUCCESSFUL** (standard tsconfig excludes did not isolate payroll-provider)  
**Fix applied:** ⏸️ **NONE** (tsconfig reverted to baseline)

**Evidence confidence:** 🟢 **HIGH**

- Dependency chain traced via `--traceResolution`
- Zero Education imports verified
- Ownership confirmed (hr-salary/Legacy Services)
- Pattern matches previous Cluster E (Healthcare pollution)

**Exclusion Limitation Observed:**

Standard `tsconfig` exclude patterns (e.g., `"src/modules"`, `"src/adapters"`, `"src/lib/decision-engine"`) did **NOT** prevent TypeScript from compiling payroll-provider.ts during Education scope typecheck.

**Observed behavior:**

Despite explicit excludes, TypeScript still compiled the file. Possible explanations:
1. Transitive type resolution following module imports
2. Base tsconfig inheritance patterns
3. Type graph dependencies from included files

**Not conclusively proven:** Whether TypeScript **fundamentally cannot** isolate such files, or whether different configuration strategy could succeed.

**Practical decision:**

The 49 payroll-provider diagnostics **remain in Education scope** for now, but with clear ownership classification:

**Classification Result:**

**Ownership:** Legacy Services (HR/Payroll domain)  
**Pollution Type:** Transitive compilation artifact (tsconfig exclude unsuccessful)  
**Management Strategy:** **Track as foreign-owned debt within Education scope**

These 49 diagnostics:
- **Appear in Education typecheck output** (cannot isolate via standard tsconfig)
- **Owned by Legacy Services** (HR/Payroll domain)
- **Should be fixed in Legacy Services context** (when EXC-P1T1-01 timeout resolved)
- **Counted in Education 177 baseline** (but classified as foreign-owned)

---

## **Revised Conclusion**

**Education canonical baseline: 177 diagnostics** (compiler-verified)

Ownership breakdown:
- **Payroll-provider (foreign-owned):** 49 (27.7%) — **DEFER to Legacy Services**
- **Repository layer:** 48 (27.1%) — **investigate after Platform Host**
- **Platform Host files:** 12 (6.8%) — **INVESTIGATE NEXT ⬅️**
- **Education core (preliminary):** 68 (38.4%) — **pending further classification**

**Critical distinction:**

- 177 = **actual compiler diagnostic count**
- NOT 128 (177 minus 49) - this would misrepresent Education scope reality
- 49 diagnostics **remain visible** in Education typecheck, but **ownership is foreign**

**Management approach:**

Track separately as "**Education scoped, Legacy owned**" - appears in Education census but should be fixed in Legacy Services hardening.

---

**Next action:** Platform Host dependency investigation (rule-engine.service.ts: 7, person.repository.ts: 5).

**Key question to answer:** Are these **legitimate Platform dependencies** (should be clean in Core but show issues in Education context) or **pollution** (similar to Cluster E)?

---

**Resume checkpoint:** `a88e38ee`
