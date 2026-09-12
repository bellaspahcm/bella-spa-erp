# Migration Ledger Evidence - Phase 2B

**Date:** 2026-09-11  
**Command:** `npx supabase migration list --linked`  
**Status:** 🔴 SEVERE DRIFT DETECTED

---

## 🚨 Critical Findings

### 1. Local vs Remote Mismatch

**Local repo has:** 392 migrations  
**Remote applied:** ~360 migrations (truncated output)

**More concerning:**
```text
Local ONLY (not on remote):
- 20260909000051 through 20260909000064 (14 migrations)
- 20260911000000 (reconciliation migration - NOT APPLIED)

Remote ONLY (not in local):
- 20260820150000, 20260820151000, 20260820152000
- 20260821120000, 20260821121000, 20260821122000, 20260821123000
- 20260822 (malformed timestamp)
- 20260824000000 through 20260824076000 (16+ migrations)
- 20260826154323 through 20260826154354 (5 migrations)
- 20260829100000 through 20260829103000 (4 migrations)
- 20260830000000, 20260831040000
- 20260909093513, 20260909093845, 20260909094230, 20260909101309
```

**Total drift:** 40+ migrations diverged

---

## 📊 Real Estate Migration Status

### Applied to Remote (Confirmed)
```text
✅ 20260801010000  real_estate_foundation_tables
✅ 20260801020000  reservation_engine  
✅ 20260801040000  foundation_org_people_seed_real_estate
✅ 20260802120000  real_estate_partner_portal
✅ 20260802150000  real_estate_core_schema
✅ 20260802151000  real_estate_rpc_functions
✅ 20260819050000  runtime_migration_05a_classification_reservation
```

### NOT Applied to Remote
```text
🔴 20260911000000  reconcile_reservations_schema (our reconciliation)
```

---

## 🔍 Schema Drift Root Cause

**Previous hypothesis:** Deployed DB running old schema (20260801020000)

**ACTUAL situation:**
- Remote DB has 20260802150000 (core schema) applied
- Remote DB ALSO has 20260802120000 (partner portal) applied
- Both claim to modify `re_reservations` table

**This explains the hybrid schema:**
- `user_id` NOT NULL (from 20260801020000)
- `status` as TEXT with CHECK (from 20260801020000)
- NO `deposit_amount` (from 20260801020000)

**Root cause:** Migration 20260802150000 FAILED to fully apply OR was rolled back

---

## 🚨 Severity Assessment

### Data Integrity Risk: 🟢 LOW
- 0 reservations in table
- No data to corrupt

### Schema Integrity Risk: 🔴 HIGH
- 40+ migrations diverged
- Local ↔ Remote out of sync
- Cannot trust migration order

### Deployment Risk: 🔴 CRITICAL
- `npx supabase db push` would attempt to:
  - Apply 20+ local-only migrations
  - Skip 40+ remote-only migrations (already applied)
  - Create unpredictable schema state

### Team Sync Risk: 🔴 CRITICAL
- Local repo diverged from deployed reality
- Other developers may have different states
- Migration history inconsistent

---

## 🎯 Resolution Options

### Option A: Manual Reconciliation (RECOMMENDED)
```text
✅ Safest for current situation
✅ Targeted fix for reservations only
✅ No risk of cascade

Steps:
1. Copy reconciliation SQL manually
2. Apply via Dashboard SQL Editor
3. DO NOT update migration ledger
4. Document as "manual fix"
5. Schedule repo ↔ remote sync later

Pros: Fast, safe, unblocks reservations
Cons: Migration history remains inconsistent
```

### Option B: Full Migration Sync
```text
⚠️  Complex, time-consuming
⚠️  Requires DBA/DevOps coordination
⚠️  High risk of breaking other features

Steps:
1. Audit ALL 40+ diverged migrations
2. Determine canonical source (local vs remote)
3. Create sync plan
4. Test on staging
5. Apply to production
6. Update all developer machines

Pros: Resolves root cause
Cons: Days of work, blocks RC, high risk
```

### Option C: Schema Inspection + Minimal Fix
```text
🟡 Middle ground
🟡 Pragmatic for RC timeline

Steps:
1. Inspect ACTUAL deployed schema (not migration files)
2. Compare with reservation service contract
3. Apply ONLY columns/changes service needs
4. Skip enum conversion if not critical
5. Document divergence for post-RC cleanup

Pros: Fast, targeted, evidence-based
Cons: Leaves migration debt
```

---

## 📋 Recommendation for Phase 2B

**DO NOT proceed with `npx supabase db push`**

**INSTEAD:**

### Immediate (Phase 2B - Modified)
1. Inspect deployed `re_reservations` schema directly
2. Compare with reservation service requirements
3. Apply minimal schema changes via SQL Editor
4. Skip migration ledger update
5. Unblock reservation runtime tests

### Post-RC (Technical Debt)
1. Schedule migration audit with team
2. Determine migration divergence root cause
3. Create canonical migration set
4. Sync all environments
5. Document migration governance

---

## 🔴 Blocker Status Update

**Previous blocker:** Migration ledger unknown

**Current blocker:** Migration history diverged (40+ migrations)

**Revised path:**
```text
Phase 2A: ✅ COMPLETE
Phase 2B: 🔴 BLOCKED (worse than expected)
Phase 2B-Alt: ⏸️ PENDING (manual SQL approach)
```

**Decision required:**
- Option A: Manual fix (fast, unblocks RC, leaves debt)
- Option B: Full sync (slow, blocks RC, resolves debt)
- Option C: Inspect + minimal fix (middle ground)

---

## 📊 Evidence Quality

| Item | Status | Evidence |
|------|--------|----------|
| Ledger divergence | 🔴 CONFIRMED | CLI output |
| Real estate migrations applied | ✅ CONFIRMED | 20260802150000 in remote |
| Reconciliation pending | ✅ CONFIRMED | 20260911000000 local only |
| Schema hybrid state | 🟡 HYPOTHESIS | Needs direct inspection |
| Migration integrity | 🔴 COMPROMISED | 40+ diverged |

---

**Severity:** 🔴 CRITICAL  
**Recommendation:** Manual SQL fix (Option A) for RC unblock  
**Post-RC action:** Migration audit required

