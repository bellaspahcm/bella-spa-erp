# P1-T5: Healthcare TypeScript Census

**Date:** 2026-09-16  
**Checkpoint:** `ecc4dcc0`  
**Status:** CENSUS ONLY (no fixes applied)

---

## Executive Summary

**Total Diagnostics:** 211 (from tsconfig.healthcare.json)  
**Distinct Error Lines:** 157

**Top Error Patterns:**
1. **TS2339 (Property does not exist):** 48 occurrences - largest cluster
2. **TS2484 (Export conflicts):** 24 occurrences - contract/index issues  
3. **TS2345 (Argument type mismatch):** 19 occurrences - DB/contract boundary
4. **TS2307 (Cannot find module):** 18 occurrences - missing imports/contracts
5. **TS2353 (Unknown properties):** 10 occurrences - object literal issues

**These 5 patterns account for ~119/211 diagnostics (56%).**

---

## Error Classification

### Pattern A: Property Access Errors (TS2339) - 48 diagnostics

**Symptom:** `Property 'X' does not exist on type 'Y'`

**Examples:**
```
- Property 'userId' does not exist on type 'BedAllocationRequest'
- Property 'status' does not exist on type 'clinical_order'
- Property 'id' does not exist on type 'never'
- Property 'transaction_id' does not exist on type 'FinanceOutboxWriteResult'
```

**Affected files:**
- `bed-engine.service.ts` (userId, BedStatus)
- `surgical-engine.service.ts` (multiple 'never' type issues)
- `clinical-order-reader.ts` (status field)
- `finance-integration/example-usage.ts` (transaction_id)
- `cssd-engine.service.ts` (name, serial_number, etc.)

**Root causes:**
1. **DB type mismatch:** Supabase generated types vs application types
2. **Never type inference:** Type narrowing failures causing 'never'
3. **Contract gaps:** Missing fields in interface definitions
4. **Optional chaining:** Fields typed as possibly undefined

**Ownership:**
- Healthcare Kernel (H1-H12): Some engines
- Finance Integration: Shared boundary
- Contract definitions: Mixed (some frozen, some not)

---

### Pattern B: Export Conflicts (TS2484) - 24 diagnostics

**Symptom:** `Export declaration conflicts with exported declaration`

**Examples:**
```
- Module './contracts' has already exported 'ContractMetadata'
- Module './contracts' has already exported 'OrderStatus'
- Module './contracts' has already exported 'ClinicalCalculationRow'
```

**Affected files:**
- `platform/host/contract-registry/types.ts` (20+ conflicts)
- `platform/healthcare/index.ts` (4 conflicts: OrderStatus, OrderType, etc.)
- `platform/healthcare/contracts/index.ts` (ClinicalCalculationRow)

**Root cause:**
- Duplicate re-exports in index files
- Type definitions exported multiple times through different paths
- Contract registry types re-exported at end of file

**Fix approach:**
- Remove duplicate exports
- Use explicit re-export to avoid ambiguity
- Consolidate type definitions

**Ownership:**
- Platform Host (contract-registry)
- Healthcare contracts (index organization)

---

### Pattern C: Argument Type Mismatch (TS2345) - 19 diagnostics

**Symptom:** `Argument of type 'X' is not assignable to parameter of type 'Y'`

**Examples:**
```
- Type 'CreateOrderResult' not assignable to 'Record<string, unknown>'
- Type 'PostgrestError' not assignable to 'Record<string, unknown>'
- Type 'Partial<lab_result>' not assignable to Supabase insert type
- Type 'string | undefined' not assignable to 'string'
```

**Affected files:**
- `order-engine.service.ts` (CreateOrderResult, ClinicalOrder, CdsOverrideRecord)
- `surgical-engine/repositories/*.ts` (surgical case, checklist types)
- `laboratory-engine/repositories/*.ts` (lab_result insert)
- `bed-engine.service.ts` (string | undefined)

**Root causes:**
1. **DB boundary:** Application types vs Supabase generated types
2. **Wide contracts:** `Record<string, unknown>` at boundaries (similar to Payroll issue)
3. **Null handling:** Optional fields not properly typed
4. **Payload narrowing:** Event payloads need explicit typing

**Ownership:**
- Healthcare engines (H1-H12)
- Repository layer (Supabase boundary)

---

### Pattern D: Cannot Find Module (TS2307) - 18 diagnostics

**Symptom:** `Cannot find module 'X' or its corresponding type declarations`

**Examples:**
```
- Cannot find module '../../shared-kernel/types'
- Cannot find module '@/types/supabase'
- Cannot find module './contracts/admission-engine.contract'
- Cannot find module './contracts/billing-engine.contract'
```

**Affected files:**
- `admission-engine/*` (shared-kernel/types)
- `icu-engine/*` (shared-kernel/types)
- `order-engine/order-engine.factory.ts` (@/types/supabase)
- `pharmacy-engine/repositories/*` (@/types/supabase)
- `service-locator.ts` (multiple contract modules)

**Root causes:**
1. **Missing files:** Contract files not created or moved
2. **Path resolution:** Incorrect module paths after refactoring
3. **Shared kernel:** Missing shared-kernel/types module
4. **Supabase types:** Path alias issue (@/types/supabase)

**Ownership:**
- Healthcare Kernel contract organization
- Platform Host (shared types)

---

### Pattern E: Unknown Properties (TS2353) - 10 diagnostics

**Symptom:** `Object literal may only specify known properties`

**Examples:**
```
- 'eventId' does not exist in type (Audit, Temporal, Rule engines)
- 'tenant_id' does not exist in type 'never[]'
- 'created_at' does not exist in type 'never[]'
- 'labOrderId' does not exist (should be 'orderId')
```

**Affected files:**
- `audit-compliance-engine.service.ts` (eventId)
- `temporal-engine.service.ts` (eventId)
- `rule-engine.service.ts` (eventId)
- `surgical-engine.service.ts` (tenant_id, created_at)
- `laboratory-engine.service.ts` (labOrderId)

**Root causes:**
1. **Event payload mismatch:** eventId not in event type definition
2. **Never type inference:** Database query returns 'never[]'
3. **Field naming:** labOrderId vs orderId inconsistency

**Ownership:**
- Healthcare engines (event emission)
- Repository layer (DB query types)

---

### Pattern F: Interface Implementation (TS2420) - 3 diagnostics

**Symptom:** `Class 'X' incorrectly implements interface 'Y'`

**Examples:**
```
- BedEngineService incorrectly implements BedEngineContract
- HostEventBusBridge incorrectly implements EventBus
- DefaultSterilizationContract incorrectly implements ISterilizationContract
```

**Affected files:**
- `bed-engine/bed-engine.service.ts`
- `order-engine/contracts/host-event-bus-bridge.ts`
- `surgical-engine/surgical-engine.service.ts`

**Root cause:**
- Contract method signatures changed but implementations not updated
- Missing required methods or incorrect signatures
- Interface definition mismatch with implementation

**Ownership:**
- Healthcare Kernel (engine implementations)

---

### Pattern G: Type Narrowing Failures (TS2459, TS2724) - 12 diagnostics

**Symptom:** Module declares type locally but not exported, or member name mismatch

**Examples:**
```
- Module declares 'OrderType' locally but not exported
- 'OrderRepository' did you mean 'IOrderRepository'?
- 'EncounterEngineContract' did you mean 'ENCOUNTER_ENGINE_CONTRACT'?
```

**Affected files:**
- `order-engine/events/order-events.ts` (OrderType, OrderStatus, OrderPriority)
- `clinical-order.service.ts` (OrderRepository naming)
- `service-locator.ts` (contract naming)

**Root cause:**
- Types defined in entity but not exported
- Interface naming inconsistency (I-prefix vs no prefix)
- Contract naming (PascalCase vs CONSTANT_CASE)

**Ownership:**
- Healthcare Kernel (contract naming conventions)

---

### Pattern H: Never Type Issues - ~15 diagnostics

**Symptom:** Operations on type 'never' or type narrowed to never

**Examples:**
```
- Property 'id' does not exist on type 'never'
- Argument of type 'X' not assignable to type 'never'
- Type 'never[]' issues in surgical engine queries
```

**Affected files:**
- `surgical-engine/repositories/supabase-surgery.repository.ts` (heavy)
- `surgical-engine/surgical-engine.service.ts`
- `bed-engine/bed-engine.service.ts`

**Root cause:**
- Database query returns inferred as 'never[]' due to type narrowing failure
- Supabase select/insert type inference problems
- Empty union types collapsing to never

**Ownership:**
- Repository layer (Supabase boundary)
- May indicate DB schema vs TypeScript type mismatch

---

## Files with Most Errors

| File | Errors (est) | Primary Patterns |
|------|-------------|------------------|
| **platform/host/contract-registry/types.ts** | 24 | TS2484 (export conflicts) |
| **surgical-engine/surgical-engine.service.ts** | 20+ | TS2339, TS2353, Never types |
| **surgical-engine/repositories/supabase-surgery.repository.ts** | 15+ | TS2345, Never types |
| **finance-integration/example-usage.ts** | 12+ | TS2339, TS2554 |
| **service-locator.ts** | 10+ | TS2307, TS2724 |
| **bed-engine/bed-engine.service.ts** | 8+ | TS2339, TS2420, TS2345 |
| **cssd-engine/cssd-engine.service.ts** | 7+ | TS2339, TS2322 |
| **order-engine/order-engine.service.ts** | 6+ | TS2345 |
| **laboratory-engine/laboratory-engine.service.ts** | 6+ | TS2322, TS2353, TS2561 |
| **healthcare/index.ts** | 4 | TS2308 (export conflicts) |

---

## Ownership Analysis

### Platform Host (Shared Infrastructure)
- **contract-registry/types.ts:** 24 export conflicts
- **Total:** ~24 diagnostics

**Status:** NOT Healthcare-owned, shared platform debt

---

### Healthcare Kernel (H1-H12 Engines)

**Frozen Engines (cannot modify logic, can fix contracts):**
- H1-H12 implementations are sealed
- Can fix: contract definitions, type exports, interfaces
- Cannot fix: frozen engine logic/calculations

**Breakdown by engine:**
- **Surgical Engine (H?):** 35+ errors (largest)
- **Order Engine:** 10+ errors
- **Bed Engine:** 8+ errors
- **CSSD Engine:** 7+ errors
- **Laboratory Engine:** 6+ errors
- **Audit/Compliance:** 3+ errors
- **Temporal Engine:** 1+ error
- **Rule Engine:** 2+ errors
- **ICU Engine:** 3+ errors
- **Admission Engine:** 2+ errors

**Total:** ~77 diagnostics in engines

---

### Healthcare Contracts & Integration
- **contracts/index.ts:** 1 export conflict
- **service-locator.ts:** 10+ module/naming issues
- **finance-integration/example-usage.ts:** 12+ integration errors
- **healthcare/index.ts:** 4 export conflicts

**Total:** ~27 diagnostics

---

### Repository Layer (DB Boundary)
- **surgical-engine/repositories:** 15+ never types, insert errors
- **laboratory-engine/repositories:** 2+ insert errors
- **order-engine/repositories:** 3+ module/type errors

**Total:** ~20 diagnostics

---

## Root Cause Clusters

### Cluster 1: Contract Organization (48 diagnostics)
- **Pattern B:** Export conflicts (24)
- **Pattern D:** Missing modules (18)
- **Pattern G:** Type not exported / naming (6)

**Fix approach:**
- Clean up index.ts exports (remove duplicates)
- Create missing contract files
- Export types from entity files
- Standardize naming conventions

**Estimated reduction:** 48 → 0 if fixed at contract level

---

### Cluster 2: DB Boundary Types (40 diagnostics)
- **Pattern C:** Argument type mismatch (19)
- **Pattern H:** Never type issues (15)
- **Pattern E partial:** Object literal (6)

**Fix approach:**
- Define typed wrappers for Supabase operations
- Add explicit return types to queries
- Use discriminated unions instead of wide contracts
- Similar to Payroll config fix (Record<string,unknown> → typed)

**Estimated reduction:** 40 → ~10 (some DB complexity may remain)

---

### Cluster 3: Property Access (48 diagnostics)
- **Pattern A:** Property does not exist (48)

**Sub-clusters:**
- **userId missing:** 3-4 errors (add to request types)
- **status field:** 2-3 errors (DB type sync)
- **Finance integration:** 12 errors (transaction_id, etc.)
- **Never type cascade:** 15-20 errors (from Cluster 2)
- **Optional chaining:** 8-10 errors (proper typing)

**Fix approach:**
- Add missing fields to contract interfaces
- Fix never type issues (feeds from Cluster 2)
- Sync DB types with application types
- Type optional fields properly

**Estimated reduction:** 48 → 10-15 (after Cluster 1-2 fixes reduce cascade)

---

### Cluster 4: Event Payload Mismatch (10 diagnostics)
- **Pattern E partial:** eventId not in type (10)

**Fix approach:**
- Add eventId to event type definition OR
- Remove eventId from emitted events
- Single contract fix may eliminate all 10

**Estimated reduction:** 10 → 0

---

### Cluster 5: Interface Implementation (3 diagnostics)
- **Pattern F:** Class incorrectly implements interface (3)

**Fix approach:**
- Update implementations to match contracts
- Or update contracts to match implementations
- Verify against tests

**Estimated reduction:** 3 → 0

---

## Recommended Fix Strategy

### Phase 1: Contract Cleanup (48 → 0)
**Target:** Cluster 1 (Contract Organization)
- Remove duplicate exports in contract-registry/types.ts (24)
- Create missing contract modules (18)
- Export types from entities (6)

**Impact:** 48 diagnostics eliminated
**Risk:** Low (no logic changes)
**Frozen Kernel:** Safe (contract boundary only)

---

### Phase 2: DB Boundary Typing (40 → 10)
**Target:** Cluster 2 (DB Boundary Types)
- Define typed repository wrappers
- Add explicit query return types
- Replace Record<string,unknown> with typed unions

**Impact:** ~30 diagnostics eliminated
**Risk:** Medium (boundary changes)
**Frozen Kernel:** Safe (repository layer, not kernel logic)

---

### Phase 3: Property & Event Fix (58 → 15)
**Target:** Cluster 3 (Property Access) + Cluster 4 (Events)
- Add missing interface fields
- Fix event payload types
- Resolve cascade from Phase 2

**Impact:** ~43 diagnostics eliminated
**Risk:** Low-Medium
**Frozen Kernel:** Safe (contract/interface only)

---

### Phase 4: Implementation Sync (3 → 0)
**Target:** Cluster 5 (Interface Implementation)
- Update engine implementations to match contracts

**Impact:** 3 diagnostics eliminated
**Risk:** Medium (engine modifications)
**Frozen Kernel:** VERIFY - may need ACR if frozen engine affected

---

### Phase 5: Residual Cleanup (15 → 0)
**Target:** Remaining complex cases
- Finance integration boundary
- Complex never type inference
- Edge cases

**Impact:** ~15 diagnostics eliminated
**Risk:** Variable

---

## Expected Trajectory

```
Phase 1: 211 → 163 (contract cleanup)
Phase 2: 163 → 133 (DB boundary)
Phase 3: 133 →  90 (properties + events)
Phase 4:  90 →  87 (implementations)
Phase 5:  87 →   0 (residual)
```

**Total estimated:** 5 phases, similar to Education (4 tasks)

**Key difference from Education:**
- Education: mostly property access + nullability
- Healthcare: heavy contract/boundary issues + frozen kernel constraint

---

## Frozen Kernel Impact

**H1-H12 engines are FROZEN:**
- Cannot modify calculation logic
- Can fix: contracts, interfaces, type definitions
- Cannot fix: engine service implementations IF frozen

**Phases 1-3: SAFE** (contract/boundary only)  
**Phase 4: VERIFY** (may touch frozen implementations)  
**Phase 5: CASE-BY-CASE**

**If frozen engine modification required:**
1. Create Architecture Change Request (ACR)
2. Document why contract fix insufficient
3. Get Human Architect approval
4. Update ADR

---

## Platform Host Finding

**24 diagnostics in `contract-registry/types.ts` are NOT Healthcare-owned.**

This is shared Platform Host infrastructure. Should these be:
1. Fixed in P1-T3 Platform Host scope? (already locked at 0)
2. Excluded from Healthcare census?
3. Counted separately as "Healthcare depends on Platform Host debt"?

**Governance question:** Platform Host gate enforces 0 in Education compiler but does NOT catch errors in Healthcare compiler pulling same shared code.

---

## Comparison to Education

| Metric | Education | Healthcare |
|--------|-----------|------------|
| **Total diagnostics** | 127 | 211 |
| **Locked scopes** | Yes | No |
| **Top error pattern** | TS2322 (35%) | TS2339 (23%) |
| **Root cause concentration** | High (config + nullability) | Medium (scattered) |
| **Frozen constraint** | None | H1-H12 sealed |
| **Shared dependency debt** | 12 (Platform Host) | 24 (contract-registry) |
| **DB boundary issues** | Minor | Heavy (~40) |
| **Estimated phases** | 4 tasks | 5 phases |

---

## Next Steps

**DO NOT fix yet. Decisions needed:**

1. **Platform Host 24 errors:**
   - Should Healthcare fix shared contract-registry?
   - Or wait for Platform Host to clean?
   - Or exclude from Healthcare scope?

2. **Frozen Kernel verification:**
   - Audit which errors touch frozen H1-H12 implementations
   - Identify ACR requirements upfront

3. **Prioritization:**
   - Start with Cluster 1 (contract cleanup, 48 errors)?
   - Or Cluster 2 (DB boundary, high impact on cascade)?

4. **Gate strategy:**
   - Create Healthcare No-New-Debt gate after cleanup?
   - Or create now to track progress?

---

**Census complete:** 2026-09-16  
**Checkpoint:** `ecc4dcc0`  
**Status:** READY FOR PLANNING (no code changes yet)
