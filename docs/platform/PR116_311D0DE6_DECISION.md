# PR#116 @ 311d0de6 — Merge Decision

**Date:** 2026-09-19  
**Commit:** 311d0de6  
**Finding:** #2 (bootstrap.ts type assertion)  
**Status:** ⚠️ TYPE CONTRACT MISMATCH CONFIRMED

---

## Summary

**Verification Result:**
- SupabaseEducationRepository constructor requires `SupabaseClient<Database>`
- PlatformBootstrapOptions provides `SupabaseClient<Record<string, unknown>>`
- Type assertion @ line 45 masks this mismatch

**Root cause document:** `PR116_FINDING2_ROOT_CAUSE.md`

---

## TypeScript Gate Status

**Actual state @ 311d0de6:**
```
NEW violations: 0 (assertion silences error)
Gate status: ✅ PASS (comparator sees no violations)
```

**But:**
- Assertion hides real type contract violation
- NOT a FALSE_POSITIVE as claimed in commit message
- Proper fix requires type ownership resolution

---

## Merge Decision Framework

### Option A: MERGE AS-IS + Document Debt

**Reasoning:**
1. TypeScript gate technically passes (NEW=0)
2. Runtime safety unaffected (Database type erased at runtime)
3. Repository uses hardcoded table/column names (no type-driven queries)
4. No immediate breakage risk

**Consequences:**
- ✅ Unblocks PR#116 merge
- ✅ Preserves NEW=0 achievement
- ❌ Technical debt created (assertion becomes maintenance burden)
- ❌ Loses compile-time database type safety at bootstrap layer
- ⚠️ Future changes to repository contract may break silently

**Required actions:**
- Add `KNOWN_TECHNICAL_DEBT` marker to assertion comment
- Document in PR description
- Create follow-up issue: "Resolve bootstrap.ts type contract mismatch"

### Option B: PROPER FIX (Update PlatformBootstrapOptions)

**Reasoning:**
1. Correct the contract mismatch at source
2. Restore type safety
3. Align caller and callee contracts

**Implementation:**
```typescript
// bootstrap.ts
import type { Database } from '@/types/database.types';

export interface PlatformBootstrapOptions {
  supabaseClient: SupabaseClient<Database>;  // Changed from Record<string, unknown>
  contractRegistry?: PlatformContractRegistry;
  eventBus?: EventBus;
}

// Line 45 — remove assertion
const educationRepo = new SupabaseEducationRepository(
  options.supabaseClient  // Now correctly typed, no assertion needed
);
```

**Impact assessment:**
- **Caller:** `architecture-boundary.test.ts` creates generic client
- **Fix:** Test must use typed client or mock

**Test fix:**
```typescript
import type { Database } from '@/types/database.types';

const dummySupabase = createClient<Database>(
  'https://example.supabase.co',
  'dummy-key'
);
```

**Consequences:**
- ✅ Type contract correctly aligned
- ✅ Restores compile-time safety
- ✅ No technical debt
- ⏳ Requires additional commit
- ⏳ Must verify test still passes

### Option C: BLOCK MERGE

**Reasoning:**
1. Type assertion is architecturally incorrect
2. Should not merge with known contract violation
3. Gate passing doesn't mean fix is correct

**Consequences:**
- ❌ Delays PR#116 closure
- ✅ Enforces architectural correctness
- ⏳ Requires proper fix before proceeding

---

## Recommendation

**OPTION B — Apply proper fix before merge**

**Justification:**
1. Fix is straightforward (change generic type in one interface)
2. Impact is minimal (one test file to update)
3. Preserves type safety (principle of least surprise)
4. Avoids technical debt (no future cleanup burden)
5. NEW remains 0 (fix doesn't introduce new violations)

**Estimated effort:** 10 minutes
- Change `PlatformBootstrapOptions.supabaseClient` type
- Update test to use typed client
- Verify TypeScript still passes (NEW=0)
- Commit as 311d0de6+1

---

## Alternative: If Option A Chosen

**Justification required:**
- Why is type safety being sacrificed?
- Is there a caller that genuinely cannot provide Database type?
- Document architectural reason, not just "to make gate pass"

**Debt documentation:**
```typescript
// KNOWN_TECHNICAL_DEBT: Type assertion masks contract mismatch
// - Repository expects SupabaseClient<Database>
// - Bootstrap provides SupabaseClient<Record<string, unknown>>
// - Runtime safe (types erased) but loses compile-time safety
// - Proper fix: Update PlatformBootstrapOptions to require Database type
// - Tracked: Issue #XXX
const educationRepo = new SupabaseEducationRepository(
  options.supabaseClient as SupabaseClient<Record<string, unknown>>
);
```

---

## Decision Record

**Decision:** [TO BE FILLED]

**Chosen option:** A / B / C

**Reasoning:** [TO BE FILLED]

**Commit:** [TO BE FILLED if Option B]

**Debt tracking:** [TO BE FILLED if Option A]

**Signoff:** [TO BE FILLED]

---

**Status:** ⏳ AWAITING USER DECISION  
**Gate:** ✅ PASS (NEW=0 achieved)  
**Correctness:** ⚠️ TYPE CONTRACT MISMATCH CONFIRMED  
**Recommendation:** Option B (proper fix)
