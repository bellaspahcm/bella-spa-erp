# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-001  
**Date Submitted:** 2026-09-18  
**Submitted By:** AI Agent (P1 TypeScript Hardening)  
**Status:** APPROVED

---

## Summary

Correct systematic Domain type contract defect in Logistics E7.1 Domain Kernel affecting all 5 core entities (inventory, movement, item, location, traceability). Domain type definitions incorrectly use `snake_case` while implementations and repository mappers correctly use `camelCase`.

---

## Affected Layer(s)

- [x] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [ ] Other: ___________

---

## Affected Artifacts

**Systematic defect scope (all 5 E7.1 core entities):**

```
src/platform/logistics/domain/inventory.types.ts
src/platform/logistics/domain/inventory.domain.ts
src/platform/logistics/domain/__tests__/inventory.domain.test.ts

src/platform/logistics/domain/movement.types.ts
src/platform/logistics/domain/movement.domain.ts
src/platform/logistics/domain/__tests__/movement.domain.test.ts

src/platform/logistics/domain/item.types.ts
src/platform/logistics/domain/item.domain.ts
src/platform/logistics/domain/__tests__/item.domain.test.ts

src/platform/logistics/domain/location.types.ts
src/platform/logistics/domain/location.domain.ts
src/platform/logistics/domain/__tests__/location.domain.test.ts

src/platform/logistics/domain/traceability.types.ts
src/platform/logistics/domain/traceability.domain.ts
src/platform/logistics/domain/__tests__/traceability.domain.test.ts
```

**NOT in scope:**
- `index.ts` (barrel exports) - not frozen, will fix separately after source contracts corrected
- Other domain files not exhibiting this pattern

---

## Reason for Change

### Business Context

P1 TypeScript Hardening initiative requires zero compiler diagnostics across Platform scopes. Logistics Domain currently has 282 diagnostics blocking P1 closure.

### Technical Context

**Defect:** ALL 5 E7.1 Domain core entities have type definitions using `snake_case` but:
- Domain implementation code uses `camelCase` 
- Repository mappers expect `camelCase` from Domain and handle `snake_case ↔ camelCase` conversion

**Diagnostic distribution:**
```
Total Domain baseline: 282 diagnostics

Concentrated in 5 core entities: 222/282 (79%)
- inventory:      64 diagnostics
- movement:       58 diagnostics  
- item:           49 diagnostics
- location:       26 diagnostics
- traceability:   25 diagnostics

All 5 confirmed with TS2551 errors suggesting snake_case alternatives
```

**Root cause:** Systematic architectural defect - E7.1 was frozen/sealed with incorrect naming convention in type contracts, contradicting both implementation and repository boundary design.

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

**Systematic correction across 5 E7.1 core entities:**

**Batch L1 - Inventory (already validated):**
1. Update `inventory.types.ts`: all interface properties `snake_case` → `camelCase`
2. Update `inventory.domain.ts`: wrap IDs and traceability in value objects (required by types)
3. Update `inventory.domain.test.ts`: update assertions for value object wrapping

**Evidence (already measured):**
```
Before:  282 diagnostics
After:   211 diagnostics  
Reduction: 71 (25%)

inventory.domain.ts: 64 → 0 ✅
Architecture Guard: PASS ✅
Regression: 547/547 PASS ✅
```

**Batch L2-L5 - Movement, Item, Location, Traceability:**

**Core change (approved):**
- Update `.types.ts`: properties `snake_case` → `camelCase`

**Associated changes (only if compiler requires):**
- Update `.domain.ts`: ONLY changes directly required to satisfy type contract
- Value object wrapping: ONLY if compiler proves necessary (not automatic from L1)
- Update `.domain.test.ts`: ONLY if domain changes require test updates

**NOT approved:**
- Automatic value object wrapping across all entities
- Refactoring beyond contract correction
- Behavior changes

**Verification after each batch:**
1. Compile Domain → measure diagnostic reduction
2. If errors remain, apply MINIMAL changes to satisfy compiler
3. Architecture Guard: must PASS
4. Regression: 547/547 must PASS

**Execution order:**
```
L1 Inventory    → apply stashed changes → verify → commit L1
L2 Movement     → fix → compile → verify → commit L2
L3 Item         → fix → compile → verify → commit L3
L4 Location     → fix → compile → verify → commit L4
L5 Traceability → fix → compile → verify → commit L5
                       ↓
              Full Domain compile
                       ↓
              Architecture Guard
                       ↓
              547 regression tests
                       ↓
              Evidence summary commit
                       ↓
              Re-seal E7.1
```

**Commit strategy:** Individual commits per batch (better traceability/rollback) + final evidence commit.

**Diagnostic projection:**
```
Baseline: 282

222/282 concentrated in 5 core entities
L1 proven: 64 → 0 (Inventory)

Expected pattern (NOT guaranteed):
Movement, item, location, traceability 
may follow similar reduction when fixed.

Actual reduction confirmed by compiler only.
```

**Constraints:**
- ✅ Type contract corrections (snake_case → camelCase)
- ✅ Minimal domain changes to satisfy corrected contracts
- ✅ Value object wrapping ONLY if compiler requires (not automatic)
- ✅ No business behavior changes
- ✅ No refactoring outside scope  
- ✅ No new `any` types
- ✅ No new `as unknown as` casts
- ✅ No new suppressions
- ❌ No DB schema changes
- ❌ No persistence convention changes

### API Impact

- [x] No - Internal implementation only

**Dependency verification completed:**
- Domain types imported by: E7.1 repositories, E7.1 tests only
- No external product/service imports found
- Repository boundary correctly isolates Domain types
- Type changes do not affect external API surface

**Verified imports:**
```
✅ src/platform/logistics/repositories/**  (internal)
✅ src/platform/logistics/domain/__tests__  (internal)
❌ No external product imports detected
```

---

## Impact Analysis

### Blast Radius

**Direct consumers:** 
- E7.1 Domain Kernel internal files (5 entities + tests)
- Repository mappers already expect `camelCase` (no change needed)
- Tests need assertion updates for value object wrapping

**Indirect consumers:** 
- None (Domain types are internal to E7.1)

**Test impact:** 
- L1: 3 test assertions updated (inventory)
- L2-L5: May need similar assertion updates
- 547 total tests must PASS

**Diagnostic impact:**
- 222/282 diagnostics concentrated in affected files
- L1 proven: 64 → 0
- L2-L5: Actual reduction measured by compiler

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
- [x] Test assertions updated for value object wrapping where needed
- [x] Architecture Guard PASS (validates E7.1-E7.3 integrity)
- [x] Compile verification after each batch

### Test Plan

**Batch-by-batch verification (L1 already complete):**

1. ✅ **L1 Inventory:**
   - Compile Domain: 282 → 211
   - inventory.domain.ts: 64 → 0
   - Architecture Guard: PASS
   - Logistics regression: 547/547 PASS
   - No new `any`, suppressions, or unsafe casts

2. **L2 Movement:**
   - Fix movement.types.ts + movement.domain.ts
   - Compile Domain → measure diagnostic reduction
   - Architecture Guard: must PASS
   - Regression: 547/547 must PASS

3. **L3 Item:**
   - Same pattern as L2

4. **L4 Location:**
   - Same pattern as L2

5. **L5 Traceability:**
   - Same pattern as L2

6. **Final verification:**
   - Full Domain compile
   - Measure total: 282 → actual (compiler determines)
   - Architecture Guard: PASS
   - Logistics regression: 547/547 PASS
   - Code quality: zero new suppressions/unsafe casts

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

**Estimated Duration:** 1-2 days (L1 complete, L2-L5 follow proven pattern)

**Milestones:**
- Day 1 AM: ACR review & approval
- Day 1 AM: Unlock E7.1 artifacts (all 5 entities)
- Day 1 PM: Execute L1-L5 batches with verification
- Day 1 PM: Final Architecture Guard + regression
- Day 1 PM: Single commit with full evidence
- Day 1 PM: Update baseline, re-seal E7.1
- Day 2: Address remaining diagnostics (barrel exports, non-frozen)

---

## Dependencies

Does this change depend on or block other work?

**Depends on:**
- ACR approval
- E7.1 unlock for all 5 core entity artifacts

**Blocks:**
- P1 TypeScript Hardening completion
- Logistics diagnostic resolution (222/282 concentrated in affected entities)

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

**Reviewed by:** Human Architect (P1 Hardening)  
**Date:** 2026-09-18  
**Decision:** ✅ APPROVED  
**Comments:**

Systematic E7.1 Domain contract defect confirmed across all 5 core entities. Evidence from L1 proof-of-concept demonstrates:
- Clear root cause (snake_case types vs camelCase implementation)
- Technical feasibility (282 → 211, 547/547 PASS)
- Low risk (mechanical changes, strong test coverage)

**Approved scope:**
- All 5 E7.1 core entity type contracts (inventory, movement, item, location, traceability)
- Associated minimal domain/test changes required by corrected contracts
- Batch execution with per-batch verification and commits

**Authorization:**
- Unlock specified E7.1 frozen artifacts
- Execute L1-L5 sequentially with full verification
- Individual batch commits for traceability
- Re-seal E7.1 after completion

### Technical Lead Review

**Reviewed by:** (same as Architecture Review)  
**Date:** 2026-09-18  
**Decision:** ✅ APPROVED  
**Comments:** Concur with Architecture Review. Proceed with implementation.

---

## Implementation Tracking

**ADR Created:** (pending approval)  
**Branch:** hardening/platform-stability-20260916 (existing)  
**PR:** (pending)  
**Merged:** (pending)  
**Released:** (pending)

---

## Evidence Summary

**Systematic defect confirmed:**
```
Investigation: 5/5 E7.1 Domain entities affected
Pattern: snake_case types vs camelCase implementation
Diagnostic concentration: 222/282 (79%) in 5 entities

Entity diagnostics:
- inventory:      64 ✅ L1 PROVEN (64 → 0)
- movement:       58 ✅ PATTERN CONFIRMED
- item:           49 ✅ PATTERN CONFIRMED
- location:       26 ✅ PATTERN CONFIRMED
- traceability:   25 ✅ PATTERN CONFIRMED
```

**L1 proof-of-concept (Inventory):**
```
Changes applied (in stash):
- inventory.types.ts: 14 properties snake→camel
- inventory.domain.ts: value object wrapping
- inventory.domain.test.ts: 3 assertions updated

Results:
- Domain compile: 282 → 211 ✅
- inventory.domain.ts: 64 → 0 ✅ (100% clean)
- Architecture Guard: PASS ✅
- Logistics regression: 547/547 PASS ✅
- Code quality: No new any/suppressions/unsafe casts ✅
- Freeze Gate: BLOCKED (expected - awaiting ACR) ✅
```

**L2-L5 evidence:**
```
Read-only investigation confirmed:
- All 4 entities show TS2551 errors with snake_case suggestions
- Same defect pattern as L1
- Estimated total impact: 222/282 diagnostics
- Actual reduction: confirmed by compiler after implementation
```

**Rationale for systematic approach:**
```
✅ Single governance cycle (not 5 separate ACRs)
✅ L1 pattern already proven with full verification
✅ All entities have identical architectural defect
✅ Comprehensive solution addresses root cause
✅ Efficient use of Architecture Review time
```

**Remaining work post-ACR:**
```
- Barrel exports (index.ts): 26 errors, NOT frozen
- Misc diagnostics: ~34 estimated
- Will address after source contracts corrected
```

---

## Architectural Lesson

**Pre-Freeze Gate Observation:**

E7.1 was frozen/sealed with Domain implementations and type contracts using **two different naming conventions** (implementation: camelCase, types: snake_case). Freeze Gate correctly blocked modification attempt, but defect existed before sealing.

**Root cause:** No architectural contract validation gate enforced **before freeze** to detect:
- Type contract vs implementation naming mismatches
- Domain convention vs persistence convention leakage
- Repository boundary contract violations

**Recommendation for post-P1:**
Add pre-freeze validation that enforces Domain layer uses idiomatic TypeScript naming (camelCase), regardless of database convention, and that type contracts match implementation.

This is **NOT blocking P1** - issue was already frozen. But should be addressed in future freeze procedures to prevent sealing defects into "production baseline."

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
