# Minimal Canonical Forward Patch - Decision Record

**Date:** 2026-09-11  
**Decision:** Apply canonical forward fix (NOT temporary service adaptation)  
**Rationale:** 0 rows + enum exists = cheapest path to canonical contract

---

## 🎯 Decision: Canonical Forward Patch

### Rejected: Option C (Temporary Service Adaptation)

**Why rejected:**
```text
Option C would create INTENTIONAL drift:

Service (new contract)
    ↓
 Mapping layer (temporary)
    ↓
Database (old contract)

Then post-RC:
    ↓
Service update (remove mapping)
    ↓
Migration (enum conversion)
    ↓
Database (finally canonical)

= 2 changes instead of 1
= Technical debt added before RC
= Service maintains backward compatibility unnecessarily
```

### Chosen: Minimal Canonical Forward Patch

**Why chosen:**
```text
Preconditions favorable:
✅ Table has 0 rows (enum conversion safe)
✅ New enum (reservation_status) already exists
✅ Service already expects canonical contract
✅ Repo target schema matches canonical contract

Forward path:
Database (hybrid old)
    ↓
Targeted patch (5 blockers)
    ↓
Database (canonical)
    ↓
Service works immediately
    ↓
RC continues

= 1 change, no drift added
= Service uses intended contract
= No post-RC cleanup for this specific issue
```

---

## 📋 Patch Scope

### ONLY These 5 Changes

1. **status enum conversion**
   ```text
   FROM: re_reservation_status (active, released, expired, converted)
   TO:   reservation_status (pending_deposit, deposited, converted_to_contract, cancelled)
   
   Safe: 0 rows, no data to migrate
   ```

2. **ADD deposit_amount**
   ```text
   Type: NUMERIC(15,2) DEFAULT 0
   Safe: Additive, no existing data affected
   ```

3. **ADD notes**
   ```text
   Type: TEXT nullable
   Safe: Additive, no existing data affected
   ```

4. **user_id nullability**
   ```text
   FROM: NOT NULL
   TO:   nullable
   
   Safe: Relaxing constraint, no data affected
   ```

5. **customer_id nullability**
   ```text
   FROM: nullable
   TO:   NOT NULL
   
   Safe: 0 rows, no NULL values to violate constraint
   ```

### NOT Included

- ❌ Other tables
- ❌ Migration history updates
- ❌ Old enum cleanup (re_reservation_status)
- ❌ Index optimizations
- ❌ RLS policy updates
- ❌ Service code changes (except type regen)

---

## ✅ Preconditions Verified

```text
re_reservations record count: 0              ✅
reservation_status enum exists: YES          ✅
Service expects canonical contract: YES      ✅
Repo target schema canonical: YES            ✅
```

**All preconditions met → Canonical patch is safest path**

---

## 🔧 Application Method

**File:** `scripts/bella-land/MINIMAL_CANONICAL_PATCH.sql`

**Apply via:**
1. Supabase Dashboard > SQL Editor
2. Copy/paste entire file
3. Run (includes precondition check + verification)

**Precondition check:**
```sql
-- Script automatically verifies 0 rows
-- Will abort if precondition not met
```

**Post-patch verification:**
```sql
-- Script automatically verifies:
-- - deposit_amount exists
-- - notes exists
-- - user_id nullable
-- - customer_id NOT NULL
-- - status uses reservation_status enum
```

---

## 📊 Risk Assessment

| Risk Type | Level | Mitigation |
|-----------|-------|------------|
| Data loss | 🟢 NONE | 0 rows in table |
| Enum conversion | 🟢 LOW | 0 rows, enum exists, mapping defined |
| NOT NULL constraint | 🟢 LOW | 0 rows, no NULL values |
| Column addition | 🟢 NONE | Additive, safe |
| Nullability relaxation | 🟢 NONE | Always safe |
| Service compatibility | 🟢 NONE | Service already expects this schema |

**Overall risk:** 🟢 LOW (all conditions favorable)

---

## 🎯 Post-Patch Actions

### 1. Verify Live Schema
```bash
# Rerun inspection (Step 1 from INSPECT_LIVE_SCHEMA.sql)
# Confirm changes applied
```

### 2. Regenerate Types
```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

### 3. Test Reservation Creation
```bash
npx tsx scripts/bella-land/test-reservation-creation.ts
```

**Expected:** Reservation created successfully

### 4. Verify Persisted Data
```bash
npx tsx scripts/bella-land/verify-reservations-workflow.ts
```

**Expected:** 1 reservation with:
- status: 'pending_deposit' (new enum value)
- deposit_amount: 0 (default)
- user_id: NULL (allowed)
- customer_id: <valid UUID> (required)
- notes: NULL (allowed)

### 5. Check Apartment State
```bash
# Verify apartment reserved_at updated
# Verify apartment reservation_id linked
```

---

## 📝 Governance Debt Tracking

### NOT Fixed by This Patch

**Migration History Divergence (40+ migrations)**
```text
Status: TRACKED
Priority: Post-RC
Impact: Does not block RC if reservation workflow works
Resolution: Separate migration audit + sync
```

**Old Enum Cleanup (re_reservation_status)**
```text
Status: DEFERRED
Priority: Low
Impact: None (orphan enum, may be used elsewhere)
Resolution: Drop after confirming no dependencies
```

---

## 🎉 Success Criteria

After patch applied:

- [ ] Precondition check passed (0 rows)
- [ ] All 5 changes applied successfully
- [ ] Post-patch verification passed
- [ ] Schema inspection shows canonical state
- [ ] Types regenerated
- [ ] Reservation creation test passes
- [ ] Persisted reservation has correct schema
- [ ] Service works without modification

---

## 📊 Comparison: Temporary vs Canonical

| Aspect | Option C (Temporary) | Canonical Patch |
|--------|---------------------|-----------------|
| Schema changes | 4 (skip enum) | 5 (include enum) |
| Service changes | Map to old enum | None (use as-is) |
| Post-RC work | Enum migration needed | None for this issue |
| Technical debt | Added | Not added |
| Risk level | 🟢 LOW | 🟢 LOW |
| Time to implement | 15 min | 15 min |
| Alignment | ❌ Deferred | ✅ Immediate |

**Winner:** Canonical Patch (equal risk, better alignment, no debt added)

---

**Decision:** ✅ APPROVED - Apply minimal canonical forward patch

**Estimated time:** 15 minutes (apply + verify + test)

**Risk:** 🟢 LOW

**Blocks RC:** NO (unblocks reservation workflow)

**Adds debt:** NO (reduces drift instead)
