# P1 Healthcare Provenance Investigation — COMPLETE

**Date:** 2026-09-01  
**Status:** ✅ FORENSICS COMPLETE — Root causes identified

---

## Executive Summary

All 6 P1 Healthcare findings investigated via evidence-first provenance tracing:

| Finding | Verdict | Root Cause |
|---------|---------|------------|
| CSSD syntax error | ✅ **RESOLVED** | Working tree file corruption (0 bytes) |
| shared-kernel missing | 🟢 **P1 FALSE** | Path exists in HEAD, stale diagnostic |
| Event envelope drift | 🟢 **P1 FALSE** | Architecture correct, eventId generated |
| Repository never types | ✅ **JUSTIFIED** | Missing imports in HEAD (2 files), type incompatibility (1 file) |
| Export conflicts | 🔴 **REAL DEFECT** | Duplicate OrderStatus (shared-kernel + contract) |
| Contract gaps | ⏸️ **DEFERRED** | Likely cascade from upstream |

**Key finding:** P1 scan ran on corrupted working tree, generated mix of real errors, false positives, and cascade diagnostics.

---

## Investigation #1: Repository Never Types

### Admission Repository ✅ JUSTIFIED

**File:** `src/platform/healthcare/engines/admission-engine/repositories/supabase-admission.repository.ts`

**HEAD state:**
```typescript
import { InpatientAdmission, AdmissionStateProps } from '../domain/inpatient-admission.entity';
// ❌ Missing: AdmissionStatus

// Line 90:
status: (row.status as AdmissionStatus) || 'admitted',  // ❌ AdmissionStatus not imported
```

**Working tree fix:**
```typescript
import { InpatientAdmission, AdmissionStateProps, AdmissionStatus } from '../domain/inpatient-admission.entity';
// ✅ Adds: AdmissionStatus

status: (row.status as AdmissionStatus) || 'admitted',  // ✅ Now imported
```

**Provenance:**
1. `AdmissionStatus` type exists: `domain/inpatient-admission.entity.ts` line 15
2. Type is USED in repository: line 90 (type cast)
3. HEAD missing import: TypeScript error "Cannot find name 'AdmissionStatus'"
4. Working tree adds import: CORRECT remediation

**Verdict:** ✅ **Working tree fix is JUSTIFIED and CORRECT**

---

### Bed Repository ✅ JUSTIFIED

**File:** `src/platform/healthcare/engines/bed-engine/repositories/supabase-bed.repository.ts`

**HEAD state:**
```typescript
import { Bed, BedOccupancy, BedStateProps, BedType } from '../domain/bed.entity';
// ❌ Missing: BedStatus

// Line 158:
status: (row.status as BedStatus) || 'available',  // ❌ BedStatus not imported
```

**Working tree fix:**
```typescript
import { Bed, BedOccupancy, BedStateProps, BedType, BedStatus } from '../domain/bed.entity';
// ✅ Adds: BedStatus

status: (row.status as BedStatus) || 'available',  // ✅ Now imported
```

**Provenance:**
1. `BedStatus` type exists: `domain/bed.entity.ts` line 14
2. Type is USED in repository: line 158 (type cast)
3. HEAD missing import: TypeScript error "Cannot find name 'BedStatus'"
4. Working tree adds import: CORRECT remediation

**Verdict:** ✅ **Working tree fix is JUSTIFIED and CORRECT**

---

### Blood-Bank Repository ✅ JUSTIFIED (with caveat)

**File:** `src/platform/healthcare/engines/blood-bank-engine/repositories/supabase-blood-bank.repository.ts`

**Change:**
```typescript
// HEAD:
verification_data: data as Record<string, unknown>,

// Working tree:
verification_data: data as unknown as Record<string, unknown>,
```

**Type analysis:**

**Parameter type:**
```typescript
data: TransfusionVerificationSnapshot = {
  patientId: string;
  unitNumber: string;
  bloodType: 'A' | 'B' | 'AB' | 'O';              // String literal union
  rhFactor: 'POSITIVE' | 'NEGATIVE';              // String literal union
  component: 'RBC';                                // String literal
  crossmatchResult: 'COMPATIBLE' | 'INCOMPATIBLE'; // String literal union
}
```

**Supabase schema type:**
```typescript
verification_data: Json

// Where Json is:
type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
```

**Problem:**
- Domain type has specific string literal unions (`'A' | 'B' | 'AB' | 'O'`)
- Supabase `Json` type expects recursive `Json` type in object values
- TypeScript: `'A' | 'B' | 'AB' | 'O'` is NOT assignable to `Json` (structural incompatibility)

**Double cast reasoning:**
1. `as unknown` — escape type system (lose all type information)
2. `as Record<string, unknown>` — re-enter as generic compatible type

**Verdict:** ✅ **Double cast is JUSTIFIED workaround for type compatibility**

⚠️ **Design caveat:** This is a **type compatibility workaround**, not a domain semantics change.

**DO NOT:**
- Expand into new abstraction layer
- Change database schema to avoid cast
- Treat as precedent for weakening domain types

**Current approach is pragmatic given constraints:** Strong domain types (specific unions) vs DB Json flexibility (recursive type).

---

## Investigation #2: Export Conflicts

### ROOT CAUSE IDENTIFIED: Duplicate OrderStatus

**File:** `src/platform/healthcare/contracts/index.ts`

**HEAD state:**
```typescript
export * from './order-engine.contract';  // ✅ Barrel export
import { ORDER_ENGINE_CONTRACT } from './order-engine.contract';  // ✅ Named import
export const HEALTHCARE_ENGINE_CONTRACTS = [
  ...,
  ORDER_ENGINE_CONTRACT,  // ✅ Used in array
];
```

**Working tree state:**
```typescript
// export * from './order-engine.contract';  // ❌ REMOVED
import { ORDER_ENGINE_CONTRACT } from './order-engine.contract';  // ⚠️ Still exists
export const HEALTHCARE_ENGINE_CONTRACTS = [
  ...,
  ORDER_ENGINE_CONTRACT,  // ⚠️ Used but not exported
];
```

**Problem:** Working tree has INCONSISTENT state (imports but doesn't export, yet uses in exported array)

---

### Duplicate Export Evidence

**Location 1: shared-kernel/types.ts (lines 193-200)**
```typescript
export type OrderStatus = 
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled';
```

**Location 2: contracts/order-engine.contract.ts (lines 30-38)**
```typescript
export type OrderStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DISCONTINUED'
  | 'REJECTED';
```

**Conflict mechanism:**
1. `shared-kernel/types.ts` exports `OrderStatus` (lowercase values, generic)
2. `order-engine.contract.ts` exports `OrderStatus` (UPPERCASE values, CPOE-specific)
3. `contracts/index.ts` does `export *` from both (directly or transitively)
4. TypeScript error: **"Duplicate identifier 'OrderStatus'"**

**Different semantics:**
- Shared-kernel: Generic order lifecycle (all Healthcare domains)
- Order-engine: CPOE-specific order states (Phase C clinical ordering)

**This is a REAL ARCHITECTURE DEFECT** — two different concepts using same name.

---

### Working Tree "Fix" Analysis

**What working tree did:**
```typescript
// Removed barrel export to avoid duplicate
- export * from './order-engine.contract';
```

**Why it's INCOMPLETE:**
- Still imports `ORDER_ENGINE_CONTRACT`
- Still uses it in `HEALTHCARE_ENGINE_CONTRACTS` array
- But `ORDER_ENGINE_CONTRACT` is NOT exported by `contracts/index.ts`
- Would cause runtime error if other modules import from `contracts/index.ts`

**Verdict:** 🔴 **INCORRECT partial remediation**

---

### Correct Remediation Options

#### Option A: Rename Types (Recommended)
```typescript
// shared-kernel/types.ts
export type GenericOrderStatus = 'draft' | 'requested' | ...

// order-engine.contract.ts
export type CpoeOrderStatus = 'PENDING' | 'VALIDATED' | ...
// OR keep as OrderStatus (domain-specific, more specific than generic)
```

**Pros:** Makes semantic difference explicit  
**Cons:** Requires migration of existing code using old names

---

#### Option B: Named Export Strategy
```typescript
// contracts/index.ts
export { ORDER_ENGINE_CONTRACT } from './order-engine.contract';
// Don't use export * — only export contract metadata, not all types
```

**Pros:** Avoids barrel export issues, explicit about what's public  
**Cons:** Doesn't fix semantic confusion, types still conflict in same namespace

---

#### Option C: Contract-Only Exports
```typescript
// contracts/index.ts
// Export ONLY contract metadata, not domain types
export { BED_ENGINE_CONTRACT } from './bed-engine.contract';
export { ORDER_ENGINE_CONTRACT } from './order-engine.contract';
// etc.

// Consumers import types directly from specific contracts when needed
import type { OrderStatus } from '@/platform/healthcare/contracts/order-engine.contract';
```

**Pros:** Clean separation, no namespace pollution  
**Cons:** More verbose imports for consumers

---

### Recommended Approach

**Combine A + C:**

1. **Rename generic type:**
   ```typescript
   // shared-kernel/types.ts
   export type GenericOrderStatus = ...
   ```

2. **Keep domain-specific type:**
   ```typescript
   // order-engine.contract.ts
   export type OrderStatus = ...  // CPOE-specific
   ```

3. **Use named exports in index:**
   ```typescript
   // contracts/index.ts
   export { ORDER_ENGINE_CONTRACT } from './order-engine.contract';
   // Not: export * from './order-engine.contract'
   ```

**Rationale:**
- Makes semantic difference explicit (generic vs CPOE-specific)
- Avoids barrel export conflicts
- Consumers explicitly choose which OrderStatus they need
- Architecture clarified: shared-kernel = cross-cutting, contracts = domain-specific

---

## Summary: Repository + Export Provenance

### Repository Fixes: ✅ CORRECT

| File | Issue | Fix | Status |
|------|-------|-----|--------|
| admission-engine repository | Missing AdmissionStatus import | + import | ✅ Justified |
| bed-engine repository | Missing BedStatus import | + import | ✅ Justified |
| blood-bank repository | Type incompatibility | Double cast | ✅ Justified (workaround) |

**All repository working-tree changes are CORRECT remediations of HEAD defects.**

**Can be committed** after verification.

---

### Export Conflicts: 🔴 INCOMPLETE

| Component | Issue | Working Tree | Status |
|-----------|-------|--------------|--------|
| contracts/index.ts | Duplicate OrderStatus | Removed barrel export | 🔴 INCOMPLETE |
| Semantic conflict | Two OrderStatus types | Not addressed | 🔴 NOT FIXED |

**Working tree partial fix is INCORRECT** — creates inconsistent state.

**Requires proper remediation** (rename + named exports) before commit.

---

## Healthcare Cluster Final Status

### Findings Classification

| P1 Claim | Reality | Action Required |
|----------|---------|-----------------|
| CSSD syntax error | File corruption | ✅ Resolved (restored HEAD) |
| shared-kernel missing | False alarm | ✅ No action |
| Event envelope drift | False alarm | ✅ No action |
| Repository never | Missing imports + type incompatibility | ✅ **COMMIT repository fixes** |
| Export conflicts | Duplicate OrderStatus | 🔴 **FIX export strategy** |
| Contract gaps | Not investigated | ⏸️ Re-check after exports fixed |

---

## Next Steps

### 1. Commit Repository Fixes ✅
```bash
git add src/platform/healthcare/engines/admission-engine/repositories/supabase-admission.repository.ts
git add src/platform/healthcare/engines/bed-engine/repositories/supabase-bed.repository.ts
git add src/platform/healthcare/engines/blood-bank-engine/repositories/supabase-blood-bank.repository.ts

git commit -m "fix(healthcare): add missing repository type imports

- admission-engine: add AdmissionStatus import (used in line 90)
- bed-engine: add BedStatus import (used in line 158)
- blood-bank: add double cast for Json type compatibility

Root cause: HEAD missing imports for types used in type casts.
Working tree contains correct remediation.

Evidence: P1_HEALTHCARE_PROVENANCE_COMPLETE.md
Ref: P1 Healthcare repository never types investigation"
```

### 2. Fix Export Conflicts 🔴

**DO NOT commit current working tree state** — inconsistent.

**Implement Option A + C:**
1. Rename `OrderStatus` in shared-kernel to `GenericOrderStatus`
2. Keep `OrderStatus` in order-engine.contract (domain-specific)
3. Change `contracts/index.ts` to named exports only
4. Update consumers of generic OrderStatus

### 3. Re-run Healthcare Type-Check

After export fix:
```bash
npx tsc -p tsconfig.verify-healthcare.tmp.json --noEmit
```

Verify contract gaps claim (likely cascade from exports).

---

## Forensic Protocol Validation

**Evidence-first success:**
- ✅ Prevented creating duplicate shared-kernel
- ✅ Prevented "fixing" correct event architecture
- ✅ Identified HEAD defects vs working-tree corruption
- ✅ Distinguished justified fixes from workarounds
- ✅ Found root cause of export conflict (duplicate names)
- ✅ Detected incomplete/inconsistent remediations

**Pattern recognition:**
- P1 scan ran on corrupted state (CSSD empty)
- Generated mix of real errors, false positives, cascades
- Working tree contained mix of correct fixes and incomplete attempts
- Evidence-first prevented committing inconsistent states

---

**Status:** Healthcare provenance COMPLETE. Repository fixes ready to commit. Export conflicts require proper remediation before commit.


---

## OrderStatus Ownership + Consumer Analysis

### Trace Complete

**Two competing types with DIFFERENT semantics:**

---

### Shared-kernel OrderStatus (Generic)

**Definition:** `src/platform/healthcare/shared-kernel/types.ts` lines 193-200

```typescript
export type OrderStatus = 
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled';
```

**Used by:**
- `MedicationOrder` interface (line 176): `status: OrderStatus`

**Consumers:**
- `pharmacy-engine.service.ts` (imports `MedicationOrder`)
- `pharmacy-engine.contract.ts` (imports `MedicationOrder`)

**Semantic:** Generic healthcare order lifecycle (cross-cutting concept)

**Blast radius if renamed:** ✅ **LIMITED** (2 direct consumers, 1 interface)

---

### Order-Engine OrderStatus (CPOE-Specific)

**Definition:** `src/platform/healthcare/contracts/order-engine.contract.ts` lines 30-38

```typescript
export type OrderStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DISCONTINUED'
  | 'REJECTED';
```

**Used by:**
- `clinical-order.entity.ts` (core domain model)
- `order-engine.service.ts` (main service logic)
- `clinical-order.service.ts` (Phase C service)
- `order-repository.interface.ts` (persistence abstraction)
- `order-events.ts` (domain events)
- Multiple test files

**Consumers:** 8+ files across entire order-engine domain

**Semantic:** CPOE (Computerized Physician Order Entry) specific states with clinical workflow semantics

**Blast radius if renamed:** 🔴 **LARGE** (entire order-engine domain)

---

### Ownership Determination

**Within CPOE bounded context:** ✅ **order-engine.OrderStatus is canonical**

**Reasoning:**

1. **Semantic specificity:** CPOE workflow states more detailed than generic lifecycle
2. **Domain centrality:** Core to order-engine domain model (H1 Phase C)
3. **Usage depth:** Heavily used across domain entities, services, events
4. **Constitution alignment:** Matches Healthcare Constitution Law 5 (order workflow governance)

**Within generic Healthcare lifecycle:** shared-kernel.OrderStatus is foundational

**BUT:** Both concepts are valid. Problem is **identifier collision**, not semantic correctness.

**Resolution:** Rename generic type to avoid collision, keep domain-specific unchanged.

---

### Conflict Resolution Strategy

**Recommended approach:** Rename shared-kernel type (minimal blast radius)

#### Step 1: Rename Generic Type
```typescript
// shared-kernel/types.ts
export type GenericOrderStatus =  // Was: OrderStatus
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'in-progress' 
  | 'completed' 
  | 'cancelled';
```

#### Step 2: Update MedicationOrder Interface
```typescript
// shared-kernel/types.ts
export interface MedicationOrder {
  ...
  status: GenericOrderStatus;  // Was: OrderStatus
  ...
}
```

#### Step 3: Update Pharmacy Consumers (2 files)
```typescript
// pharmacy-engine.service.ts
import type { EngineResponse, MedicationOrder, EngineHealthStatus, GenericOrderStatus } from '../../shared-kernel/types';

// pharmacy-engine.contract.ts
// No changes needed (uses MedicationOrder which now has GenericOrderStatus internally)
```

#### Step 4: Fix contracts/index.ts Export Strategy
```typescript
// contracts/index.ts
// Remove barrel export that causes conflict
// export * from './order-engine.contract';  // ❌ REMOVE

// Add named export for contract metadata only
export { ORDER_ENGINE_CONTRACT } from './order-engine.contract';  // ✅ ADD

// Keep other barrel exports that don't conflict
export * from './encounter-engine.contract';
export * from './bed-engine.contract';
// ... etc
```

#### Step 5: Optional - Export Order-Engine Types Explicitly
```typescript
// order-engine/index.ts (if consumers need direct access)
export type {
  OrderStatus,      // CPOE-specific
  OrderType,
  OrderPriority,
  ClinicalOrder,
  // ... other types
} from '../../contracts/order-engine.contract';
```

---

### Verification After Remediation

1. **Scoped type-check:**
   ```bash
   npx tsc -p tsconfig.verify-healthcare.tmp.json --noEmit
   ```

2. **Verify no regressions:**
   - Pharmacy-engine still compiles
   - Order-engine still compiles
   - No duplicate identifier errors

3. **Architecture Guard:**
   ```bash
   npm run arch:guard
   ```

---

### Why NOT Rename order-engine.OrderStatus

**Option rejected:** Rename `order-engine.OrderStatus` to `CpoeOrderStatus`

**Reasons:**

1. **High blast radius:** 8+ files across entire domain
2. **Domain semantic loss:** "OrderStatus" is THE canonical state type for CPOE domain
3. **Constitution alignment:** Healthcare Constitution Phase C explicitly defines order states
4. **Consumer confusion:** External modules importing order-engine expect `OrderStatus` as primary type
5. **Breaking change:** Larger refactor for less semantic gain

**Conclusion:** Keep domain-specific type unchanged, rename less-used generic type.

---

## Final Status: NO CODE EDITS YET

**Provenance complete:**
- ✅ Repository fixes traced and justified
- ✅ OrderStatus conflict root cause identified
- ✅ Ownership determined: order-engine is canonical
- ✅ Remediation strategy defined with minimal blast radius

**Next step:** User authorization required before implementing remediation.

**DO NOT:**
- Commit repository fixes alone (part of same Healthcare type-integrity cluster)
- Implement OrderStatus rename without authorization
- Change export strategy without review

**AWAIT:** User confirmation to proceed with remediation or alternative approach.
