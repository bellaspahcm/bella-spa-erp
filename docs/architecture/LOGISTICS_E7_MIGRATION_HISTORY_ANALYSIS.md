# E7 Migration History Investigation

**Date:** 2026-09-03  
**Target Database:** bella-spa-erp-e2e (dev/E2E)  
**Issue:** E7 migration blocked by migration history mismatch

---

## Root Cause Analysis

### Problem

`npx supabase db push --linked` reports success (exit code 0) but refuses to apply E7 migration due to migration history conflict:

```
Remote migration versions not found in local migrations directory.

Suggested repair:
supabase migration repair --status reverted 20260713080545 20260713083242 
20260714032120 20260714032905 20260731065630 20260810161119 
20260810161130 20260813031545
```

---

## Investigation Results

### 8 Missing Versions

Remote database expects these versions:
1. 20260713080545
2. 20260713083242
3. 20260714032120
4. 20260714032905
5. 20260731065630
6. 20260810161119
7. 20260810161130
8. 20260813031545

### Local Repository State

**Found:** Placeholder files with **similar but not identical timestamps:**

| Remote Expects | Local Has | Difference | Status |
|---------------|-----------|------------|--------|
| 20260713080545 | 20260713080542_remote_applied_placeholder.sql | -3 sec | Placeholder |
| 20260713083242 | 20260713083239_remote_applied_placeholder.sql | -3 sec | Placeholder |
| 20260714032120 | 20260714032101_remote_applied_placeholder.sql | -19 sec | Placeholder |
| 20260714032905 | 20260714032901_remote_applied_placeholder.sql | -4 sec | Placeholder |
| 20260731065630 | NOT FOUND | N/A | Missing |
| 20260810161119 | NOT FOUND | N/A | Missing |
| 20260810161130 | NOT FOUND | N/A | Missing |
| 20260813031545 | NOT FOUND | N/A | Missing |

**Placeholder file content:**
```sql
-- Placeholder for a migration version already applied on the linked Supabase project.
-- The original SQL is not present in this repository snapshot.
```

---

## Root Cause

**Migration timestamp mismatch between remote database and local placeholders.**

**Cause:** Migrations were applied directly to remote database (bypassing local migration files), and placeholder files were created with slightly different timestamps (off by seconds).

**Effect:** Supabase CLI's migration history validator detects mismatch and refuses to push any new migrations (including E7) to prevent corrupting migration history.

---

## Analysis

### Are These Legitimate Migrations?

**YES - These are legitimate remote-applied migrations:**
- Placeholder files exist in repository acknowledging them
- Pattern indicates migrations applied directly to database during development
- Not stale/incorrect history - just timestamp precision mismatch

### Why Timestamp Mismatch?

**Likely cause:** 
- Migration applied to remote database at timestamp X
- Placeholder file created locally with slightly different timestamp (clock skew, rounding, or manual creation)
- Supabase expects exact timestamp match for migration history validation

---

## Recommended Resolution

### Option A: Repair Migration History (RECOMMENDED)

**Mark the 8 versions as "reverted" in remote history:**

```bash
npx supabase migration repair --linked --status reverted \
  20260713080545 20260713083242 20260714032120 20260714032905 \
  20260731065630 20260810161119 20260810161130 20260813031545
```

**What this does:**
- Updates remote migration history table to mark these versions as "not applied"
- Does NOT delete any database schema or data
- Allows CLI to proceed with pushing new migrations (E7)

**Why safe:**
- These are placeholder acknowledgments, not actual local migration files
- Timestamp mismatch is bookkeeping issue, not schema issue
- Dev database (not production) - low risk

**After repair:**
- `db push --linked` will succeed
- E7 migration will be applied
- Migration history will be consistent

---

### Option B: Manual SQL (NOT RECOMMENDED)

**Manually execute E7 SQL in Supabase dashboard.**

**Why NOT recommended:**
- Bypasses migration provenance
- E7 schema created "by hand" outside migration history
- Future migrations may have provenance issues
- Violates canonical truth principle

---

## Decision

**User choice:** **Option A - Repair migration history**

**Rationale:**
> **E7 exists as canonical migration in repository. Database should reach state where migration history and schema are both consistent, not create schema "by hand" outside migration provenance.**

---

## Execution Plan

1. ✅ Investigation complete (this document)
2. ⏸️ Execute migration repair command
3. ⏸️ Verify migration history consistent
4. ⏸️ Push E7 migration via `db push --linked`
5. ⏸️ Verify logistics schema + 6 tables exist
6. ⏸️ Generate database.types.ts
7. ⏸️ Re-run G0.5

---

## Safety Verification

**Target:** bella-spa-erp-e2e (dev/E2E database)  
**NOT production:** ✅ Confirmed  
**Operation:** Bookkeeping adjustment (migration history table)  
**Schema impact:** NONE (repair only affects migration tracking)  
**Data impact:** NONE  
**Reversibility:** Yes (can re-mark if needed)

---

**Status:** Investigation complete - Ready for repair execution  
**Next:** Execute repair command → Verify → Push E7
