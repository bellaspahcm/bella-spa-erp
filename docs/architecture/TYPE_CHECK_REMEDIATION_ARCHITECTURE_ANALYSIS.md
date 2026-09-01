# Type-check Remediation — Architecture Safety Analysis
**Date:** 2026-09-01
**Purpose:** Verify that type-check fixes do NOT violate Bella Development Principles or Kernel boundaries

---

## Architectural Review Checklist

Before fixing any type error, verify:

1. ✅ Does this modify frozen/sealed Kernel code? (H1-H12, E7, Finance, Spa)
2. ✅ Does this change Kernel boundaries or contracts?
3. ✅ Does this duplicate Kernel entities in Product layer?
4. ✅ Does this bypass Platform Core capabilities?
5. ✅ Does this violate Healthcare/Education Constitution?

---

## Error Cluster Analysis

### 1. Runtime/Security — RLS Verification (`rls-verification.ts`)

**Location:** `src/platform/migration-governance/verification/checks/rls-verification.ts`

**Error:** Policy command union missing `ALL`

**Layer:** Platform / Security (NOT Kernel)

**Architecture Impact:** ✅ SAFE
- Migration governance is Platform layer, not frozen Kernel
- This is a type contract mismatch, not a business logic change
- Fix: Add `ALL` to command union or handle separately

**Kernel Violation Risk:** 🟢 ZERO

---

### 2. Finance/Accounting — Schema Name Drift (`accounting.service.ts`)

**Location:** `src/platform/accounting/engines/accounting.service.ts`

**Error:** Code uses `code`/`debit`/`credit`, schema has `account_code`/`debit_amount`/`credit_amount`

**Layer:** Finance Kernel (🔒 BASELINE)

**Architecture Impact:** ⚠️ REQUIRES CAREFUL ANALYSIS
- Finance Kernel is FROZEN at baseline
- Schema drift suggests either:
  a) Code is stale and needs to match current schema
  b) Schema was changed without updating code
  c) Migration created new columns but code not updated

**Investigation Required:**
1. Check when `account_code`/`debit_amount`/`credit_amount` columns were created
2. Check if `code`/`debit`/`credit` columns still exist or were renamed
3. Verify if this is a migration drift or code drift

**Kernel Violation Risk:** 🟡 MEDIUM (need schema evidence first)

**Action:** READ schema migration history and current table structure before fixing

---

### 3. Core — Tenant/Module Types (`TenantContextProvider.tsx`, `TenantInfoExample.tsx`)

**Location:** `src/core/providers/TenantContextProvider.tsx`, `src/core/examples/TenantInfoExample.tsx`

**Error:**
- `enabledModules` treated as `unknown` instead of `readonly ModuleId[]`
- React props receiving `unknown` values

**Layer:** Platform Core (✅ ACTIVE - not frozen)

**Architecture Impact:** ✅ SAFE
- Platform Core evolves to support all Industries
- This is type safety improvement, not business logic change
- Fix: Type narrowing and guards

**Kernel Violation Risk:** 🟢 ZERO

---

### 4. Core — Nullable Booking IDs (`update-booking-action.ts`)

**Location:** `src/core/services/order/update-booking-action.ts`

**Error:** Nullable IDs passed into string-only helpers

**Layer:** Product / Spa (uses Spa Kernel but this is Product layer action)

**Architecture Impact:** ✅ SAFE
- This is Product layer server action, not Kernel
- Spa Kernel is baseline but this code is Product consumption
- Fix: Add null checks or use non-null assertions where guaranteed

**Kernel Violation Risk:** 🟢 ZERO

---

### 5. Healthcare — Export/Import Conflicts

**Location:** `src/platform/healthcare/contracts/index.ts`, `src/platform/healthcare/index.ts`

**Error:**
- Multiple barrel exports conflict
- Missing `shared-kernel/types` imports
- Event envelope drift (`eventId` mismatch)
- Repository never types (missing tables)
- Contract implementation gaps

**Layer:** Healthcare Kernel (🔒 BASELINE H1-H12 FROZEN)

**Architecture Impact:** 🔴 HIGH RISK
- Healthcare Kernel H1-H12 is FROZEN per Healthcare Constitution
- CANNOT modify Kernel engine responsibilities
- CANNOT add H13 or new Kernel capabilities
- CANNOT alter Kernel invariants

**However:**
- Export/import fixes are NOT business logic changes
- Type signature alignment is NOT architectural change
- Missing imports are technical debt, not functional drift

**Allowed Fixes:**
- ✅ Fix barrel export conflicts (rename, re-export properly)
- ✅ Add missing imports from correct locations
- ✅ Align event envelope types with actual contract
- ✅ Fix repository types to match schema reality

**Forbidden Fixes:**
- ❌ Change Kernel engine boundaries
- ❌ Add new Kernel engines or capabilities
- ❌ Bypass Kernel contracts in Product layer
- ❌ Duplicate Kernel entities

**Kernel Violation Risk:** 🟡 MEDIUM (need careful surgical fixes)

**Action:** Fix ONLY type signatures, imports, exports - NOT business logic

---

### 6. Logistics/Products — Compiler Hotspot

**Location:** `src/platform/logistics`, `src/products`, `src/modules`

**Error:** Compiler hangs, no diagnostics after 90-120 seconds

**Layer:** Mixed (Logistics E7 Kernel SEALED + various Products)

**Architecture Impact:** ⚠️ UNKNOWN
- E7 Logistics Kernel is SEALED (domain only, persistence not implemented)
- Products should NOT duplicate Kernel entities
- Compiler hang suggests circular dependencies or type recursion

**Investigation Required:**
1. Check for circular imports
2. Check for infinite type recursion
3. Check if Products duplicate E7 entities

**Kernel Violation Risk:** 🟡 MEDIUM (unknown until investigated)

**Action:** Investigate with dependency graph analysis BEFORE fixing

---

## Remediation Order (Architecture-Safe First)

Based on Architecture Guard principles:

### Phase 1: Zero-Risk Platform Core Fixes
1. ✅ Runtime/Security RLS command union
2. ✅ Core tenant/module type guards
3. ✅ Core nullable booking ID checks

### Phase 2: Evidence-Required Fixes
4. ⚠️ Finance schema drift (AFTER schema evidence)
5. ⚠️ Healthcare type signatures (surgical only, NO logic changes)

### Phase 3: Investigation-Required
6. ⚠️ Logistics/Products compiler hotspot

---

## Architecture Guard Verification

After each fix:
```bash
npm run arch:guard
```

Must remain: ✅ ALL CHECKS PASSED

---

## Kernel Freeze Compliance

### Finance Kernel
- Status: 🔒 BASELINE
- Allowed: Bug fixes, schema alignment
- Forbidden: New capabilities, boundary changes

### Healthcare Kernel (H1-H12)
- Status: 🔒 FROZEN per Healthcare Constitution
- Allowed: Type signature fixes, import corrections
- Forbidden: H13, engine modifications, invariant changes

### Logistics E7 Kernel
- Status: 🔒 SEALED (domain only)
- Allowed: Type fixes in existing domain layer
- Forbidden: New entities, persistence changes (not yet implemented)

### Spa Kernel
- Status: 🔒 BASELINE
- Note: `update-booking-action.ts` is Product layer, not Kernel

---

## Remediation Principles (MANDATORY)

### Core Principle
> **Fix the consumer before weakening the contract. Change the contract only when evidence proves the contract is wrong.**

### Forbidden Practices

❌ **DO NOT:**
- Use `as` type assertions to bypass compiler
- Use `any` to silence errors
- Use non-null assertion `!` without invariant proof
- Widen canonical contracts to fix consumer code
- Add optional fields to contracts just for one consumer
- Create duplicate types to match existing code
- Change Platform Core contracts without cross-Industry evidence

✅ **DO:**
- Read canonical contract first (`tenant.ts`, `module.ts`)
- Fix consumer code to match canonical contract
- Add explicit null checks at boundaries
- Validate invariants and fail clearly
- Preserve nullability semantics in downstream code
- Keep diffs minimal and surgical
- Run evidence gates after each cluster

### Evidence Gates for Task #1

After each fix cluster, run:
```bash
npm run type-check        # Must reduce Core errors
npm run arch:guard        # Must remain PASS
npm test <affected>       # No new failures
git diff --check          # Clean diff
```

Full regression only after ALL Task #1 fixes complete.

### Task #1 Forensic Analysis Order

1. **Read canonical contracts** (`tenant.ts`, `module.ts`)
2. **Identify contract vs consumer mismatch**
3. **Determine if contract is provably wrong** (requires evidence)
4. **Fix consumer to match contract** (default path)
5. **OR fix contract with evidence** (rare, requires justification)
6. **Verify with type-check + arch:guard**

---

## Success Criteria

Type-check remediation is architecturally safe if:

1. ✅ Architecture Guard remains PASS
2. ✅ No Kernel boundaries modified
3. ✅ No new Kernel engines or capabilities added
4. ✅ No Kernel entities duplicated in Product layer
5. ✅ Healthcare Constitution Laws 1-8 remain satisfied
6. ✅ Finance/Spa/E7 baselines remain stable
7. ✅ Type errors resolved WITHOUT architectural changes
8. ✅ No unsafe type assertions (`as`, `any`, `!`)
9. ✅ Canonical contracts unchanged unless proven wrong
10. ✅ Consumer code adapted to canonical contracts

---

**Principle:** This is forensic remediation, not "make it compile".
