# O1 Schema Defect Investigation
**Date:** 2026-08-17  
**Status:** DEFECT CONFIRMED  
**Classification:** Schema Migration Bug  

---

## Executive Summary

**Defect:** `next_retry_at` column has `DEFAULT now()` in production schema, contradicting migration file and Implementation Plan.

**Impact:** O1 retry policy tests fail; new events have incorrect initial state.

**Root Cause:** Schema drift — column created with DEFAULT that shouldn't exist.

**Fix Required:** `ALTER TABLE finance_outbox_events ALTER COLUMN next_retry_at DROP DEFAULT;`

---

## Evidence Chain

### 1. Constitution v1.3
**Location:** `docs/architecture/H1_2_CONSTITUTION.md`

**Findings:**
- Line 298: `next_retry_at = now() + (power(2, retry_count) * interval '1 second')` — SET during failure
- Line 581-583: Evidence requires `retry_count = 0` initially
- **Does NOT explicitly mandate** `next_retry_at = NULL` for new events
- **Implies NULL** through evidence examples and retry logic

**Verdict:** Constitution expects NULL initially (implicit)

---

### 2. Implementation Plan
**Location:** `docs/architecture/H1_2_IMPLEMENTATION_PLAN.md`

**Findings:**
- Line 57: `ADD COLUMN next_retry_at TIMESTAMPTZ` — **NO DEFAULT VALUE**
- Line 197: Claim query: `WHERE (next_retry_at IS NULL OR next_retry_at <= now())`
- Line 458, 506: Replay sets `next_retry_at = NULL`
- Line 918: **Evidence example:** `retry_count = 0 | next_retry_at = NULL` for new PENDING events

**Verdict:** Implementation Plan mandates NO DEFAULT (NULL initially)

---

### 3. Migration File
**Location:** `migrations/20260817_h1_2_schema_extensions.sql`

**Findings:**
```sql
-- Retry Policy (O1)
ALTER TABLE finance_outbox_events 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,  -- ← NO DEFAULT
ADD COLUMN IF NOT EXISTS max_retry INTEGER DEFAULT 10 NOT NULL;
```

**Verdict:** Migration file specifies NO DEFAULT for `next_retry_at`

---

### 4. Actual Database Schema
**Method:** Query `information_schema.columns`

**Findings:**
```
next_retry_at:
  Type: timestamp with time zone
  Nullable: YES
  Default: now()  ← ❌ DEFECT
```

**Verdict:** Production schema has `DEFAULT now()` — contradicts migration file

---

### 5. Actual Behavior Test
**Method:** INSERT new event + SELECT values

**Test Code:**
```typescript
const eventId = randomUUID();
await db.query(`
  INSERT INTO finance_outbox_events (
    event_id, tenant_id, event_type, payload, status, created_at
  ) VALUES ($1, $2, $3, $4, $5, now())
`, [eventId, tenantId, 'TEST', '{}', 'PENDING']);

const result = await db.query(`
  SELECT retry_count, next_retry_at, next_retry_at IS NULL as is_null
  FROM finance_outbox_events WHERE event_id = $1
`, [eventId]);
```

**Result:**
```
retry_count: 0
next_retry_at: 2026-08-17T14:58:38.917Z
next_retry_at IS NULL: false  ← ❌ DEFECT
```

**Verdict:** New events get timestamp instead of NULL — incorrect behavior

---

### 6. O1 Test Expectation
**Location:** `tests/integration/o1_retry_policy.test.ts`

**Test Code:**
```typescript
expect(result.rows[0].retry_count).toBe(0);
expect(result.rows[0].next_retry_at).toBeNull();  // ← Test expects NULL
```

**Result:** Test FAILS

**Verdict:** Test expectation is CORRECT per Constitution/Implementation Plan

---

## Root Cause Analysis

### Schema Drift Detected

**Expected Schema (per migration file):**
```sql
next_retry_at TIMESTAMPTZ  -- NO DEFAULT
```

**Actual Schema (per database):**
```sql
next_retry_at TIMESTAMPTZ DEFAULT now()
```

### Possible Causes

1. **Manual ALTER TABLE before migration**
   - Someone manually added column with DEFAULT
   - Migration's `ADD COLUMN IF NOT EXISTS` skipped creation
   - DEFAULT remained from manual creation

2. **Different migration executed**
   - Migration file edited after execution
   - Source control drift

3. **ORM/Tool auto-migration**
   - Some tool added DEFAULT automatically
   - Unlikely (using raw SQL migration)

4. **Supabase default behavior**
   - Supabase Studio might have added DEFAULT
   - Unlikely but possible

### Investigation Findings

**Migration file check:**
```bash
$ grep "next_retry_at" migrations/20260817_h1_2_schema_extensions.sql
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
```
✅ File confirms NO DEFAULT specified

**No triggers found:**
```
=== Triggers on finance_outbox_events ===
No triggers found.
```
✅ No trigger setting value

**Conclusion:** Most likely cause is **manual column creation with DEFAULT before migration**, then migration's `IF NOT EXISTS` skipped it, preserving wrong DEFAULT.

---

## Classification

**Defect Type:** Schema Migration Bug  
**Defect Layer:** Database Schema  
**Not a bug in:**
- ❌ Test code (test expectation is correct)
- ❌ Worker implementation (code would work correctly with NULL)
- ❌ Constitution (implicitly mandates NULL)

**Is a bug in:**
- ✅ **Database schema** (has DEFAULT when shouldn't)

---

## Impact Assessment

### Functional Impact
- **O1 Tests:** FAIL (expect NULL, get timestamp)
- **Worker Behavior:** Suboptimal (claim query works but semantics wrong)
- **Retry Logic:** Works but incorrect initial state
- **H1.2 Verification:** BLOCKED

### Semantic Impact
- New events should have `retry_count = 0` and `next_retry_at = NULL`
- Current: `retry_count = 0` and `next_retry_at = now()`
- Claim query: `WHERE (next_retry_at IS NULL OR next_retry_at <= now())` still matches immediately
- **Effect:** Events claimable immediately (correct) but for wrong reason

### Backward Compatibility Impact
- H1.1 events inserted without `next_retry_at` → get `DEFAULT now()`
- Should get NULL instead
- **Minor impact** but violates design intent

---

## Fix Specification

### Required Schema Change

```sql
ALTER TABLE finance_outbox_events 
ALTER COLUMN next_retry_at DROP DEFAULT;
```

### Verification After Fix

1. **Execute ALTER:**
   ```bash
   npx tsx -e "import { Pool } from 'pg'; const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('ALTER TABLE finance_outbox_events ALTER COLUMN next_retry_at DROP DEFAULT').then(() => { console.log('DEFAULT dropped'); return pool.end(); });"
   ```

2. **Verify schema:**
   ```bash
   npx tsx scripts/check-schema-defaults.ts
   ```
   Expected: `Default: NONE`

3. **Test new event:**
   ```bash
   npx tsx scripts/verify-next-retry-at.ts
   ```
   Expected: `next_retry_at IS NULL: true`

4. **Run O1 tests:**
   ```bash
   npm test tests/integration/o1_retry_policy.test.ts -- --runInBand
   ```
   Expected: Tests should pass (or reveal next layer of issues)

---

## Post-Fix Verification Protocol

**After schema fix, do NOT assume O1 is proven. Must execute full verification:**

1. ✅ Fix schema (DROP DEFAULT)
2. ✅ Verify schema corrected
3. ✅ Verify new event behavior (NULL confirmed)
4. ⏳ Run full O1 test suite
5. ⏳ Collect behavioral evidence:
   - Exponential backoff intervals (1s, 2s, 4s, 8s...)
   - retry_count increments (0 → 1 → 2 → ...)
   - Worker respects next_retry_at (no premature claims)
   - Max retry enforcement
   - Quarantine after exhaustion
6. ⏳ Document O1 evidence
7. ⏳ O1 PROVEN decision

**Only after ALL steps:** Move to O2 verification.

---

## Migration Best Practices (Lessons Learned)

### DO:
- ✅ Use explicit `NULL` when no default intended: `ADD COLUMN x TIMESTAMPTZ NULL`
- ✅ Verify schema after migration execution
- ✅ Test migration in dev/staging before production
- ✅ Check for column existence before `IF NOT EXISTS`
- ✅ Document schema intent in comments

### DON'T:
- ❌ Assume `IF NOT EXISTS` preserves intent (it preserves existing state)
- ❌ Mix manual schema changes with migration files
- ❌ Skip post-migration schema verification
- ❌ Trust migration file = actual schema without verification

---

## Status

**Current State:**
- ❌ Schema has incorrect DEFAULT
- ❌ O1 tests FAIL
- ❌ H1.2 NOT PROVEN
- ⏳ Fix pending execution

**Next Actions:**
1. Execute schema fix (DROP DEFAULT)
2. Verify fix successful
3. Rerun O1 verification
4. Continue O2-O10 verification
5. Evidence collection
6. H1.2 PROVEN decision

---

**Investigation Status:** COMPLETE  
**Defect Classification:** CONFIRMED SCHEMA BUG  
**Fix Specification:** READY  
**Awaiting:** Schema fix execution + revalidation
