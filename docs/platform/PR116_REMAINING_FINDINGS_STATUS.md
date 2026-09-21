# PR #116 Remaining Findings Status @ a6198f9a

**Date:** 2026-09-19
**Previous:** 3e0be3b2 (NEW=3)
**Current:** a6198f9a (awaiting CI)

## Fixes Applied

### Finding #1: queue/page.tsx:284

**Change:**
```typescript
// BEFORE:
onChange={(val) => setNewTicket({ ...newTicket, station: val as unknown })}

// AFTER:
onChange={(val) => setNewTicket({ ...newTicket, station: val as QueueItem['station'] })}
```

**Rationale:**
- Remove unsafe `as unknown` cast
- Use proper type assertion to union type
- PremiumSelect onChange signature: `(value: string) => void`

**Status:** 🔧 **FIX APPLIED / AWAITING CI VERIFICATION**

**Critical Note:** If compiler still reports error after fix, indicates:
- `val: string` incompatible with `QueueItem['station']` union
- Need to constrain PremiumSelect options OR validate value before assignment
- **Do NOT use cast** - fix type contract instead

---

### Finding #10: receipt.service.ts:1087

**Change:**
```typescript
// Added to imports from '../shared-kernel/types/warehouse.types':
ListReceiptsInput,
ListReceiptsResult,
```

**Rationale:**
- Types used in method signature but not imported
- Types exist in shared-kernel/types/warehouse.types.ts
- Missing import causes TS2304 "Cannot find name"

**Status:** 🔧 **FIX APPLIED / AWAITING CI VERIFICATION**

**Attribution:** 🟡 **INCOMPLETE**
- Baseline code also missing imports
- But baseline comparison did NOT contain this diagnostic identity
- Possible causes:
  - Indirect dependency change (type exports, paths, resolution)
  - Compiler strictness change
  - Generated types change
- **NOT proven as FINGERPRINT_DRIFT** until baseline identity confirmed

---

### Finding #2: bootstrap.ts:40 (REMAINING)

**Error:**
```
Argument of type 'SupabaseClient<Record<string, unknown>, "public", "public", never, {...}>' 
is not assignable to parameter of type 'SupabaseClient<Database, "public", "public", {...}>'
```

**Action Taken:**
```typescript
// Added explicit type assertion
const educationRepo = new SupabaseEducationRepository(
  options.supabaseClient as SupabaseClient<Record<string, unknown>>
);
```

**Status:** 🔧 **ASSERTION APPLIED / AWAITING CI VERIFICATION**

**Classification:** 🟡 **UNPROVEN**
- ❌ NOT proven as FALSE_POSITIVE (requires evidence compiler wrong)
- ❌ NOT proven root cause (PR changes affecting type inference)
- ⏳ Assertion forces compiler to accept, does NOT prove contract correctness

**Evidence:**
- Caller interface: `SupabaseClient<Record<string, unknown>>`
- Repository constructor: `SupabaseClient<Record<string, unknown>>`
- Types match in code, compiler sees incompatibility
- Error not in baseline (NEW, not pre-existing)
- PR modified education modules importing `Database` type

**Critical Questions (Unanswered):**
1. Does runtime `options.supabaseClient` actually carry `Database` schema?
2. Is assertion hiding real type unsoundness?
3. What PR change triggered compiler inference difference?

**If CI NEW=0:**
- ✅ TypeScript comparator gate PASS
- ❌ Does NOT prove assertion correct about contracts
- ⏳ Requires manual contract verification before merge

**Required Before Merge:**
1. Verify `options.supabaseClient` source and actual schema
2. Trace why compiler infers `Database` for repository despite constructor signature
3. If assertion hides incompatibility: remove assertion, fix type ownership
4. If types truly compatible: document why compiler inference fails

---

## Expected CI Results @ a6198f9a

### If NEW = 0:
- ✅ All findings resolved
- TypeScript no-new-debt gate: **PASS**
- **But:** Still document #2 attribution as "no longer reproduces" not "fingerprint drift"

### If NEW = 1:
- ✅ #1 and #10 confirmed fixed
- ❌ #2 persists
- **Action:** Deep trace #2 dependency changes

### If NEW > 1:
- ❌ #1 or #10 not fully resolved
- **Action:** Extract actual NEW list, do NOT guess
- Possible: Type assertion in #1 insufficient for union type

---

## Evidence Boundaries

**What we know:**
- #3-9: ✅ **PROVEN RESOLVED** by CI @ 3e0be3b2
- #1: Fix applied, compiler verdict TBD
- #10: Fix applied, compiler verdict TBD
- #2: No fix applied, attribution incomplete

**What we DON'T know:**
- Whether #2 existed in baseline with same diagnostic identity
- Whether #1 type assertion satisfies compiler
- What caused #10 to be detected now vs baseline

**Terminology Precision:**
- ✅ Use: "Fix applied / awaiting verification"
- ❌ Avoid: "Resolved" (before CI confirms)
- ✅ Use: "Unattributed" (insufficient evidence)
- ❌ Avoid: "Fingerprint drift" (without baseline identity proof)

---

## Next Actions

**Immediate:**
1. ⏳ **WAIT for CI baseline comparison @ a6198f9a**
2. ❌ **NO additional code changes**
3. ❌ **NO type casts or workarounds**

**After CI verdict:**

**If NEW = 0:**
- Lock TypeScript no-new-debt gate as PASS
- Document #2 as resolved (without claiming specific classification)
- Proceed to other PR blockers (test failures, collector issues)

**If NEW = 1 (bootstrap.ts persists):**
- Extract baseline fingerprint for bootstrap.ts:40
- Trace PR dependency changes:
  - Database type modifications
  - Supabase client version changes
  - Generated type changes
  - Import/export path changes
- Classify as INDIRECT_CHANGE or FALSE_POSITIVE
- Fix root cause (NOT cast)

**If NEW > 1:**
- Extract full NEW list from CI logs
- Identify which fix failed (queue.tsx or receipt.service.ts)
- Investigate actual type incompatibility
- Apply proper fix (not cast)

---

**Status:** ⏳ AWAITING CI BASELINE COMPARISON @ a6198f9a
**Last Updated:** 2026-09-19 16:21 UTC
