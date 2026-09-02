# Compiler Governance Principle: Proven Through Real-Estate Case

**Date:** 2026-09-02  
**Event:** Platform Type-Check Remediation - Real-Estate Reconciliation  
**Commits:** e8be4a11 (Integration-Runtime), 33f6342c (Reconciliation)

## The Principle

> **Never trade semantic correctness for compiler GREEN.**

## Evidence: Real-Estate Case Study

### Initial State
- **9 TypeScript errors** in Real-Estate unit
- All errors showed domain/database enum mismatches
- Integration tests validated domain semantics (`held`, `completed`, `pending_deposit`)

### Incorrect Approach (Applied Initially)
**Strategy:** Map domain enums to database enums to eliminate compiler errors

**Changes Made:**
```typescript
// Domain → Database mappings (unproven)
'held' → 'booked'
'completed' → 'handed_over'
'pending_deposit' → 'active'
'cancelled' → 'released'

// Data model decision
duration_minutes, deposit_amount → stored in metadata JSON
```

**Result:**
- ✅ Compiler: 9 errors → 0 (GREEN)
- ❌ Tests: Integration tests BROKEN (expect domain enum values)
- ❌ Semantics: Domain lifecycle changed without evidence

### Reconciliation Evidence

**Test File:** `src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts`

```typescript
// Line 194: Test expects 'held' status
unit.reserve('cust-1');
expect(unit.status).toBe('held');

// Line 204: Test expects 'completed' status  
unit.complete();
expect(unit.status).toBe('completed');

// Line 237: Test uses 'pending_deposit' status
status: 'pending_deposit'
```

**Conclusion:** Tests are executable specification. Domain semantics were CORRECT. Compiler errors were HONEST - flagging real schema mismatch.

### Correct Approach (After Revert)

**Strategy:** Controlled revert - preserve evidence-backed corrections, restore domain semantics

**Preserved (Strong Evidence):**
- `real_estate_contracts` → `re_contracts` (database.types.ts confirms)
- `contract_no` → `contract_number` (database.types.ts confirms)
- `unit_code` → `product_code` (schema has no unit_code field)

**Reverted (No Evidence):**
- All domain → database enum mappings
- metadata storage for business attributes

**Result:**
- ⚠️ Compiler: 3 errors (HONEST state - real schema mismatch)
- ✅ Tests: Integration tests PASS (domain semantics preserved)
- ✅ Semantics: Domain correctness maintained

### Final State

**Real-Estate Status:**
- TypeScript: 3 errors (down from 9 via evidence-backed schema corrections)
- Tests: PASS
- Classification: UNDER INVESTIGATION (not FAIL, not PASS)
- Action: Requires schema alignment investigation before further fixes

**3 Honest Errors:**
1. `reservation.service.ts:55` - `'pending_deposit'` not in `re_reservation_status`
2. `reservation.service.ts:93` - `'cancelled'` not in `re_reservation_status`
3. `property-unit.repository.ts:52` - `PropertyUnitStatus` includes values not in `re_product_status`

**These errors correctly flag:** Domain model uses different enum values than database schema.

---

## Principle Application Rules

### When Fixing Type Errors

**✅ DO:**
1. Check tests first (executable specification)
2. Check migrations (schema evolution history)
3. Check domain documentation (business rules)
4. Verify database types (generated canonical schema)
5. Fix with evidence

**❌ DON'T:**
1. Map enums based on "seems reasonable"
2. Change domain semantics to match database
3. Store business attributes in metadata without design evidence
4. Assume compiler GREEN = correct
5. Break tests to fix compiler

### Evidence Strength Assessment

**Strong Evidence (Safe to Fix):**
- Generated database types from actual schema
- Migration files showing schema evolution
- Documented API contracts
- Canonical type definitions

**Medium Evidence (Verify First):**
- Domain documentation (may be outdated)
- Code comments (may be wrong)
- Variable names (may be misleading)

**Weak/No Evidence (STOP):**
- "Semantic interpretation" without docs
- "Reasonable mapping" guesses
- "Probably means X" assumptions
- Data model decisions without design docs

**Rule:** Weak/no evidence → mark as BLOCKED, don't guess.

### Conflict Resolution Priority

When different sources disagree:

**Priority Order:**
1. **Tests** (executable, verified behavior)
2. **Migrations** (database evolution record)
3. **Generated Types** (actual schema)
4. **Domain Docs** (may be outdated)
5. **Code Comments** (often wrong)
6. **Compiler Errors** (structural, not semantic)

**Critical Rule:** Tests > Compiler always. Breaking tests to fix compiler is WRONG.

---

## Governance Integration

### Bella Development Principles Compliance

**Principle 7: Minimal Complexity**
> Prefer: The simplest design that protects correctness, security, compliance, and reuse.

**Application:**
- Correctness: non-negotiable
- Compiler GREEN via semantic breakage: adds complexity by hiding real issues
- Honest errors: simpler than invented mappings

**Principle 9: The 4-Question Filter**

**Q1: Is it mandatory for correctness/security/compliance?**
- ✅ Preserving test semantics: YES (correctness)
- ❌ Compiler GREEN: NO (convenience)

**Decision:** Revert to preserve correctness.

### Architecture Governance

**Real-Estate is NOT frozen** (unlike Healthcare/Education Kernels)
- Changes are allowed
- BUT must preserve correctness
- Breaking tests without evidence violates governance

**Verdict:** Original Real-Estate fixes failed governance despite being "allowed" changes.

---

## Campaign-Wide Impact

### Integration-Runtime: Correct Approach Exemplar

**Changes:** 36 errors → 0

**All fixes had strong evidence:**
- ErrorContext: structural type compatibility (no semantic change)
- Nullability: database type contracts (generated types)
- Zod: library API migration (documented changes)
- Exports: deduplication using canonical definition

**Result:** ✅ Committed (e8be4a11) - no semantic issues

### Deployment + Integration-Hub: Also Correct

**Deployment:** 2 errors → 0 (explicit type annotation)
**Integration-Hub:** 3 errors → 0 (added missing export, fixed implicit any)

**Evidence:** All fixes were structural, no semantic changes.

### Education: Correctly Deferred

**Status:** 100 errors, not started

**Reason:** Platform inventory must be clean and reconciled before tackling large error clusters.

**Decision:** Defer until Real-Estate investigation complete.

---

## Lessons for Future Campaigns

### 1. "Compiler GREEN" is Not a Goal

**Wrong metric:** Number of TypeScript errors
**Right metric:** Semantic correctness with honest error state

**Real-Estate proved:**
- 0 errors with broken semantics < 3 honest errors with correct semantics
- TypeScript is a tool, not the objective

### 2. Tests are First-Class Citizens

**Tests aren't just for regression detection.**
Tests are **executable specification** of correct behavior.

**When compiler and tests disagree:**
- Default: tests are right
- Override only with evidence that tests are wrong
- Never break tests to fix compiler without proof

### 3. Evidence-Based Decisions Scale

**Small clusters (2-5 errors):** Evidence requirement may seem "overkill"
**Large clusters (36-100 errors):** Evidence requirement prevents disaster

**Real-Estate showed:** Even 9 errors can hide semantic complexity requiring domain knowledge.

### 4. Controlled Revert is Valid Strategy

**Reverting isn't failure.**
Discovering you need more evidence is PROGRESS.

**Real-Estate demonstrated:**
- Partial fixes can be preserved (schema corrections)
- Semantic changes can be reverted independently
- Honest error state is valuable diagnostic information

---

## Principle Codification

**Add to Bella Governance:**

### Compiler Remediation Governance Rule

**When fixing TypeScript errors:**

1. **Evidence First:** No fix without structural or semantic evidence
2. **Tests > Compiler:** Never break tests to eliminate compiler errors
3. **Honest Errors:** Better to have honest errors than false GREEN
4. **Controlled Revert:** When evidence insufficient, revert and investigate
5. **Semantic Preservation:** Type fixes must not change business logic

**Violation:** Any fix that changes semantics without evidence is governance failure, even if "technically allowed."

**Exception:** Only override when you have PROOF the original semantics were wrong (migration showing intentional change, business rule doc showing error, etc.)

---

## Final Status Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| Integration-Runtime | ✅ Committed | 36→0, semantic safe |
| Deployment | ✅ Earlier commit | 2→0, semantic safe |
| Integration-Hub | ✅ Earlier commit | 3→0, semantic safe |
| Real-Estate | ⚠️ Investigation | 9→3, honest errors |
| Education | ❌ Deferred | 100 errors, not started |
| 3 HOTSPOT | 🟠 Unchanged | No actionable diagnostics |

**Platform Inventory:**
- 37 units PASS (ready for commit or committed)
- 1 unit UNDER INVESTIGATION (Real-Estate)
- 1 unit DEFERRED (Education)
- 3 units HOTSPOT (unchanged)

---

## Conclusion

The Real-Estate case study **proved the principle through failure and recovery:**

1. Initial "fix" achieved compiler GREEN by breaking semantics
2. Tests revealed the semantic breakage
3. Controlled revert restored correctness at cost of 3 honest errors
4. Investigation requirements identified (schema alignment)

**The principle is now proven, not theoretical:**

> **Compiler GREEN achieved by trading semantic correctness is worse than honest compilation errors.**

This principle should guide all future type-checking remediation in Bella and serve as a canonical example of evidence-based governance.

---

**Commits:**
- e8be4a11: Integration-Runtime closure (correct approach)
- 33f6342c: Real-Estate reconciliation documentation (principle applied)

**Governance Status:** ✅ Principle proven and codified
