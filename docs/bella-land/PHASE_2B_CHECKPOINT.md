# Phase 2B Checkpoint - Live Schema Inspection

**Date:** 2026-09-11  
**Status:** ⏸️ AWAITING LIVE SCHEMA EVIDENCE  
**Option Selected:** C - Inspect first, then decide

---

## 🎯 Phase 2B Entry Status

**Migration Ledger Evidence:** ✅ OBTAINED

**Finding:** OUTCOME D - Severe Drift
- 40+ migrations diverged (local ↔ remote)
- Real estate migrations applied to remote
- Live schema state UNKNOWN (hybrid suspected)
- Cannot use `npx supabase db push` (cascade risk CRITICAL)

**Decision:** Option C - Inspect live schema before any fix

---

## 📋 Option C Selected

### Why Not Option A (Manual full reconciliation)?
```text
❌ Too early
Reason: Ledger says migrations applied, but schema still hybrid
Risk: Manual SQL patch without live evidence = another drift layer
```

### Why Not Option B (Full migration audit)?
```text
⏸️ Defer to post-RC
Reason: 40+ migration divergence is governance debt
Risk: Blocks RC unnecessarily if reservation workflow fixable independently
```

### Why Option C (Inspect live → minimal fix)?
```text
✅ Evidence-driven
✅ Separates concerns (workflow vs governance)
✅ Smallest fix to unblock RC
✅ Defers migration debt without ignoring it
```

---

## ✅ Phase 2B Progress

```text
Option C selected                     ✅
Inspection SQL prepared               ✅
Live schema evidence                  ⏸️ PENDING (human required)
Evidence matrix                       ⏸️
Minimal forward fix identified        ⏸️
Targeted SQL patch                    ⏸️
Reservation runtime retest            ⏸️
```

---

## 📄 Deliverables

### 1. Migration Ledger Evidence
**File:** `docs/bella-land/MIGRATION_LEDGER_EVIDENCE.md`

**Key findings:**
- 392 migrations in local repo
- ~360 applied to remote
- 14 local-only Sept 9 migrations
- 40+ remote-only migrations
- Reconciliation migration (20260911000000) NOT applied

### 2. Live Schema Inspection Script
**File:** `scripts/bella-land/INSPECT_LIVE_SCHEMA.sql`

**Purpose:** Query live re_reservations schema directly

**Queries:**
1. Column list (types, nullability, defaults)
2. Enum types (reservation_status)
3. CHECK constraints (if status is TEXT)
4. Foreign keys
5. Indexes
6. Record count

**Run via:** Supabase Dashboard > SQL Editor

---

## ⏸️ Current Blocker

**Awaiting:** Live schema inspection results

**Human action required:**
1. Open Supabase Dashboard
2. Navigate: SQL Editor
3. Copy/paste: `scripts/bella-land/INSPECT_LIVE_SCHEMA.sql`
4. Run queries
5. Provide results

---

## 🎯 Next Steps (After Evidence)

### Step 1: Build Evidence Matrix
```text
Column/Rule         Live DB          Service Needs      Action
-----------------------------------------------------------------
deposit_amount      [RESULT]         NUMERIC DEFAULT 0  [DECISION]
status type         [RESULT]         reservation_status [DECISION]
status values       [RESULT]         [enum values]      [DECISION]
user_id nullable    [RESULT]         YES                [DECISION]
created_by          [RESULT]         UUID nullable      [DECISION]
updated_by          [RESULT]         UUID nullable      [DECISION]
deposited_at        [RESULT]         TIMESTAMPTZ null   [DECISION]
converted_at        [RESULT]         TIMESTAMPTZ null   [DECISION]
cancelled_at        [RESULT]         TIMESTAMPTZ null   [DECISION]
notes               [RESULT]         TEXT null          [DECISION]
metadata            [RESULT]         JSONB null         [DECISION]
```

### Step 2: Identify Blocking Mismatches
```text
MUST FIX (blocks runtime):
  - Missing columns used by ReservationService.create()
  - Status type/value mismatch preventing INSERT
  - NOT NULL constraints that break service logic

CAN DEFER (doesn't block first test):
  - Optional columns not used yet
  - Index optimizations
  - Constraint renaming
```

### Step 3: Generate Targeted Forward Patch
```text
NOT: Full reconciliation migration (20260911000000)
YES: Minimal SQL patch for identified blockers only

Example:
  - If deposit_amount missing: ADD COLUMN
  - If status is TEXT: Keep TEXT, map values
  - If user_id NOT NULL: ALTER to nullable
  - If created_by missing: ADD COLUMN (if service uses it)
```

### Step 4: Apply Patch
```text
Method: Supabase Dashboard SQL Editor (manual, visible)
NOT: npx supabase db push (cascade risk)
NOT: Migration ledger update (track as manual fix)
```

### Step 5: Verify & Test
```text
1. Re-inspect schema (confirm changes applied)
2. Regenerate types: npx supabase gen types typescript
3. Rerun: npx tsx scripts/bella-land/test-reservation-creation.ts
4. Expected: Reservation created successfully
5. Verify: npx tsx scripts/bella-land/verify-reservations-workflow.ts
```

---

## 🔒 Principles

### Evidence Boundary
```text
Live schema output ≠ Assumed from migrations
Service needs ≠ Perfect normalized schema
Minimal fix ≠ Full reconciliation
```

### Concern Separation
```text
WORKFLOW BLOCKER (this phase):
  Reservation creation cannot run

GOVERNANCE DEBT (separate tracking):
  40+ migration divergence
  Local ↔ remote sync
  Migration history integrity
```

### RC Priority
```text
Goal: Unblock reservation workflow for RC evidence
NOT: Normalize entire migration history
NOT: Resolve all technical debt before RC
```

---

## 📊 Governance Debt Tracking

### Identified Debt
```text
🔴 Migration Divergence
├─ 40+ migrations out of sync
├─ Local-only: 14 Sept 9 migrations + reconciliation
├─ Remote-only: 40+ migrations
└─ Root cause: Unknown (requires investigation)

Status: TRACKED
Priority: Post-RC resolution
Blocks RC: NO (if reservation workflow fixable independently)
```

### Resolution Path (Post-RC)
```text
1. Team migration audit meeting
2. Determine canonical source (local vs remote)
3. Identify divergence root cause
4. Create sync strategy
5. Test on staging
6. Apply to production
7. Update all developer environments
8. Document migration governance policy
```

---

## 🚦 Phase 2B Status

**Current State:** ⏸️ AWAITING EVIDENCE

**Next Action:** Human runs inspection SQL

**Unblocks:** Evidence matrix → Minimal fix → Runtime test

**Estimated Time After Evidence:**
- Matrix analysis: 15 min
- Targeted patch generation: 15 min
- Application + verification: 15 min
- Runtime test: 5 min
- **Total: ~1 hour**

---

**Quality:** ✅ Evidence boundaries maintained, concerns separated

**Recommendation:** Proceed with targeted fix after live evidence obtained

**Critical:** Do NOT apply full reconciliation without live schema confirmation
