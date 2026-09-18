# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-001  
**Date Submitted:** 2026-09-16  
**Submitted By:** AI Agent (P1 TypeScript Hardening)  
**Status:** DRAFT

---

## Summary

Correct Domain type contract in Logistics E7.1 Domain Kernel to align with canonical Domain/Repository pattern: Domain entities should use `camelCase` properties, not `snake_case`.

---

## Affected Layer(s)

- [x] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [ ] Other: ___________

---

## Affected Artifacts

Minimum scope (Batch L1 - Inventory only):

```
src/platform/logistics/domain/inventory.types.ts
src/platform/logistics/domain/inventory.domain.ts
src/platform/logistics/domain/__tests__/inventory.domain.test.ts
```

Potential expansion scope (if same defect found in investigation):

```
src/platform/logistics/domain/movement.types.ts
src/platform/logistics/domain/item.types.ts
src/platform/logistics/domain/location.types.ts
src/platform/logistics/domain/traceability.types.ts
(and corresponding .domain.ts files)
```

---

## Reason for Change

### Business Context

P1 TypeScript Hardening initiative requires zero compiler diagnostics across Platform scopes. Logistics Domain currently has 282 diagnostics blocking P1 closure.

### Technical Context

**Defect:** Domain type definitions use `snake_case` (e.g., `tenant_id`, `quantity_on_hand`) but:
- Domain implementation code uses `camelCase` (e.g., `tenantId`, `quantityOnHand`)
- Repository mapper expects `camelCase` from Domain and handles `snake_case ↔ camelCase` conversion

**Canonical pattern:**
```
Database Layer        Repository Mapper       Domain Layer
─────────────────    ─────────────────────   ────────────────
tenant_id            row.tenant_id      →    tenantId
(snake_case)         snake → camel           (camelCase)
                     
                     inventory.tenantId →    tenant_id
                     camel → snake           
```

**Current state (WRONG):**
```typescript
// inventory.types.ts (TYPE DEFINITION)
export interface Inventory {
  tenant_id: string;        // ❌ snake_case
  quantity_on_hand: number; // ❌ snake_case
}

// inventory.repository.ts (MAPPER - CORRECT)
private mapToDomain(row: LogisticsInventory): Inventory {
  return {
    tenantId: row.tenant_id,  // DB snake → Domain camel ✅
  };
}

// inventory.domain.ts (IMPLEMENTATION - CORRECT)
const inventory: Inventory = {
  tenantId: props.tenantId,  // ✅ camelCase
};
```

**Result:** 71+ TypeScript diagnostics from contract mismatch.

### Priority

- [x] P1 - High (blocks P1 closure, 282 diagnostics in frozen kernel)
- [ ] P0 - Critical (production outage, data loss, security)
- [ ] P2 - Medium (minor issue, workaround available)
- [ ] P3 - Low (enhancement, nice-to-have)

---

## Proposed Changes

### Implementation Plan

**Batch L1 (Inventory - already validated):**

1. Update `inventory.types.ts`:
   - `Inventory` interface: all properties `snake_case` → `camelCase`
   - `CreateInventoryProps`: all properties → `camelCase`
   - `UpdateInventoryQuantityProps`: `quantity_delta` → `quantityDelta`, add `quantityOnHand`, `quantityReserved`
   - `ReserveInventoryProps`: `reference_id` → `referenceId`, `reference_type` → `referenceType`
   - `InventoryFilters`: all properties → `camelCase`
   - `InventoryBalanceSummary`: all properties → `camelCase`

2. Update `inventory.domain.ts`:
   - Wrap `ItemId`, `LocationId`, `LotNumber`, `SerialNumber` in value objects (`{ value: string }`)
   - Update `undefined` vs `null` handling to match type definitions

3. Update `inventory.domain.test.ts`:
   - Change assertions from `.lotNumber` to `.lotNumber?.value`
   - Change `.toBeNull()` to `.toBeUndefined()` where appropriate

**Evidence (already measured):**
```
Before:  282 diagnostics
After:   211 diagnostics
Reduction: 71 (25%)

inventory.domain.ts: 64 → 0 ✅
Architecture Guard: PASS ✅
Regression: 547/547 PASS ✅
No new any types ✅
No suppressions ✅
No as unknown as casts ✅
```

**Future batches (if evidence supports):**
- Batch L2: `movement.types.ts` + `movement.domain.ts` (58 diagnostics)
- Batch L3: `item.types.ts` + `item.domain.ts` (49 diagnostics)
- Batch L4: `location.types.ts` + others (remaining diagnostics)

### API Impact

- [x] No - Internal implementation only

Domain types are internal to Logistics Kernel. Repository mapper already handles DB ↔ Domain conversion. No external API change.

---

## Impact Analysis

### Blast Radius

**Direct consumers:** 
- E7.1 Domain Kernel internal files only
- Repository mapper already expects `camelCase` (no change needed)
- Tests need assertion updates (value object wrapping)

**Indirect consumers:** 
- None (Domain types are internal)

**Test impact:** 
- 3 test assertions updated (Batch L1)
- 547 tests PASS after changes

### Migration Path

No migration needed. This is a correction of internal type contract to match existing implementation.

### Risk Assessment

**Low Risk:**
- Internal type correction only
- Repository mapper already correct
- All 547 regression tests PASS
- Architecture Guard PASS
- No new suppressions or unsafe casts

**Risk Level:** LOW

---

## Alternatives Considered

### Alternative 1: Change Domain code to use snake_case

**Pros:**
- Match current type definitions

**Cons:**
- Violates canonical Domain pattern (Domain should use camelCase)
- Repository mapper already correct (expects camelCase)
- Would propagate database naming into Domain layer
- Breaks architectural boundary responsibility

**Why not chosen:** Architecturally incorrect. Domain layer should use language-idiomatic naming (camelCase for TypeScript).

### Alternative 2: Suppress errors with `@ts-ignore` or `any`

**Pros:**
- No frozen kernel modification

**Cons:**
- Masks real defect
- Violates P1 hardening rules (zero suppressions)
- Creates technical debt
- Hides contract mismatch from future developers

**Why not chosen:** Against P1 hardening principles and architectural standards.

### Alternative 3: Do Nothing

**Impact of not making this change:**
- Logistics remains blocked at 282 diagnostics
- P1 cannot close with clean Platform status
- Contract mismatch remains in frozen kernel
- Future development confused by type vs implementation mismatch

---

## Testing Strategy

### Regression Testing

- [x] All existing tests must pass (547/547 for Logistics)
- [x] Test assertions updated for value object wrapping
- [x] Architecture Guard PASS

### Test Plan

**Already validated (Batch L1):**
1. ✅ Compile Logistics Domain: 282 → 211
2. ✅ inventory.domain.ts specific: 64 → 0
3. ✅ Architecture Guard: PASS
4. ✅ Logistics regression: 547/547 PASS
5. ✅ No new `any` types
6. ✅ No new suppressions
7. ✅ No `as unknown as` casts

**Future batches:** Same verification for each domain file.

---

## Documentation Updates

Which documentation will need updates?

- [ ] API documentation (no change - internal types)
- [x] Architecture documentation (this ACR)
- [ ] Product documentation (no impact)
- [ ] Migration guides (no migration needed)
- [x] ADR (required - will create after approval)

---

## Timeline

**Estimated Duration:** 1-2 days (Batch L1 already complete, pending approval)

**Milestones:**
- Day 1: ACR review & approval
- Day 1: Unlock E7.1 inventory artifacts
- Day 1: Apply Batch L1 changes (already validated)
- Day 1: Final verification & commit
- Day 1: Update baseline, re-seal E7.1
- Day 2: Evaluate remaining 211 diagnostics for future batches

---

## Dependencies

Does this change depend on or block other work?

**Depends on:**
- ACR approval
- E7.1 unlock for inventory artifacts

**Blocks:**
- P1 TypeScript Hardening completion
- Logistics remaining diagnostic resolution (211 remaining)

---

## Rollback Plan

If this change causes problems, rollback is simple:

1. `git revert <commit-hash>` (single commit)
2. Re-run 547 regression tests (should still pass - reverting to previously tested state)
3. Re-seal E7.1 with previous baseline

**Risk:** Very low. Changes are type corrections with 547/547 tests passing.

---

## Approval

### Architecture Review

**Reviewed by:** ___________  
**Date:** ___________  
**Decision:** [ APPROVED | REJECTED | DEFER ]  
**Comments:**

### Technical Lead Review

**Reviewed by:** ___________  
**Date:** ___________  
**Decision:** [ APPROVED | REJECTED | DEFER ]  
**Comments:**

---

## Implementation Tracking

**ADR Created:** (pending approval)  
**Branch:** hardening/platform-stability-20260916 (existing)  
**PR:** (pending)  
**Merged:** (pending)  
**Released:** (pending)

---

## Evidence Summary

**Pre-change state:**
- Logistics Domain: 282 diagnostics
- inventory.domain.ts: 64 diagnostics
- Root cause: snake_case type definitions vs camelCase implementation

**Post-change validation (Batch L1):**
- Logistics Domain: 211 diagnostics (-71, 25% reduction)
- inventory.domain.ts: 0 diagnostics (-64, 100% reduction)
- Architecture Guard: PASS
- Logistics regression: 547/547 PASS
- Code quality: No new `any`, no suppressions, no unsafe casts
- Freeze Gate: BLOCKED (expected - awaiting ACR approval)

**Remaining work:**
- 211 diagnostics (barrel exports + other domains)
- Will investigate after Batch L1 approved

---

## Post-Implementation Review

(To be completed after implementation)

**Date:** ___________

**Metrics:**
- Test pass rate: ___/547
- Diagnostic reduction: 282 → ___
- Bug reports: ___

**Lessons Learned:**
- What went well:
- What could be improved:
- Future recommendations:
