# Bella Land - Schema Drift Analysis

**Date:** 2026-09-10  
**Component:** `re_reservations` table  
**Severity:** 🔴 CRITICAL - Blocks reservation runtime testing

---

## 🔴 Finding: Repo Schema ↔ Deployed Database Drift

**Evidence:** Runtime insertion attempts reveal deployed schema differs from migration files.

### Deployed Database Schema (Evidence-backed)

**Source:** Error messages from actual INSERT attempts

```text
CONFIRMED FIELDS:
- tenant_id         (implicit from working queries)
- product_id        NOT NULL (error: 23502)
- customer_id       (implicit from FK in migrations)
- user_id           NOT NULL (error: 23502 in minimal insert)
- status            USES re_reservation_status enum (error: 22P02 "invalid input value")

CONFIRMED NOT PRESENT:
- deposit_amount    (error: PGRST204 "column not found in schema cache")

ENUM VALUES (deployed):
- re_reservation_status (inferred from error rejecting 'pending_deposit')
- Likely values: 'active' | 'released' | 'expired' | 'converted'
  (from partner_portal migration 20260802120000)
```

### Migration Files Schema (Repo)

**Source:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

```sql
CREATE TABLE re_reservations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- NOT in deployed
  status reservation_status NOT NULL,                 -- Different enum
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  deposited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,                                    -- Optional in repo
  updated_by UUID,                                    -- Optional in repo
  deleted_at TIMESTAMPTZ
);

CREATE TYPE reservation_status AS ENUM (
  'pending_deposit',
  'deposited',
  'converted_to_contract',
  'cancelled'
);
```

### Earlier Migration (Partner Portal)

**Source:** `supabase/migrations/20260802120000_real_estate_partner_portal.sql`

```sql
CREATE TYPE re_reservation_status AS ENUM (
  'active',
  'released',
  'expired',
  'converted'
);

CREATE TABLE re_reservations (
  id UUID,
  tenant_id UUID,
  product_id UUID,
  customer_id UUID,
  user_id UUID,              -- Required in this schema
  duration_minutes INTEGER,
  status re_reservation_status,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🔍 Schema Comparison Matrix

| Field | Deployed (Evidence) | Core Schema (Repo) | Partner Portal (Earlier) |
|-------|--------------------|--------------------|-------------------------|
| `tenant_id` | ✅ Present | ✅ NOT NULL | ✅ Present |
| `product_id` | ✅ NOT NULL | ✅ NOT NULL | ✅ Present |
| `customer_id` | ✅ Present | ✅ NOT NULL | ✅ Present |
| `user_id` | ✅ NOT NULL | ❌ Not in schema | ✅ Present |
| `deposit_amount` | ❌ NOT PRESENT | ✅ NUMERIC(15,2) | ❌ Not in schema |
| `duration_minutes` | ❓ Unknown | ❌ Not in schema | ✅ INTEGER |
| `expires_at` | ❓ Unknown | ❌ Not in schema | ✅ TIMESTAMPTZ |
| `status` enum | `re_reservation_status` | `reservation_status` | `re_reservation_status` |
| `reserved_at` | ❓ Unknown | ✅ TIMESTAMPTZ | ❌ Not in schema |
| `deposited_at` | ❓ Unknown | ✅ TIMESTAMPTZ | ❌ Not in schema |
| `created_by` | ❓ Unknown | ✅ UUID (optional) | ❌ Not in schema |
| `updated_by` | ❓ Unknown | ✅ UUID (optional) | ❌ Not in schema |

---

## 📊 Evidence Quality

| Item | Confidence | Source |
|------|-----------|---------|
| `product_id` NOT NULL | ✅ HIGH | Direct error 23502 |
| `user_id` NOT NULL | ✅ HIGH | Direct error 23502 |
| `deposit_amount` absent | ✅ HIGH | Schema cache error PGRST204 |
| `status` enum type | ✅ HIGH | Enum validation error 22P02 |
| Enum uses `re_reservation_status` | ✅ MEDIUM | Rejects 'pending_deposit' |
| Enum values include 'active' | ⏸️ INFERRED | Partner portal migration |

**Cannot confirm without direct schema query:**
- Exact enum values deployed
- Presence of `duration_minutes`, `expires_at`
- Presence of `reserved_at`, `deposited_at`, timestamp fields
- Column defaults
- Index definitions

---

## ❓ Root Cause Hypotheses

### Hypothesis A: Partner Portal Schema Still Deployed
```text
Database running: 20260802120000_real_estate_partner_portal.sql
Not yet applied: 20260802150000_real_estate_core_schema.sql

Evidence FOR:
✅ user_id required (matches partner portal)
✅ deposit_amount absent (matches partner portal)
✅ re_reservation_status enum (matches partner portal)

Evidence AGAINST:
⏸️ Need to check if duration_minutes, expires_at exist
```

### Hypothesis B: Incomplete Migration
```text
Core schema partially applied, but:
- Old enum not dropped
- New columns not added
- Constraints not updated

Evidence FOR:
⏸️ Would explain mixed state

Evidence AGAINST:
⏸️ Migrations typically atomic
```

### Hypothesis C: Branch/Environment Drift
```text
Repo diverged from deployed migrations
Deployed DB may have different migration history

Evidence FOR:
⏸️ Common in multi-environment setups

Evidence AGAINST:
⏸️ Would need migration history comparison
```

---

## 🎯 Canonical Schema Decision Required

**Cannot proceed with runtime testing until decision made:**

### Option 1: Deployed Schema is Canonical
```text
Action: Revert engine code changes
        Adapt to user_id, re_reservation_status, no deposit_amount
        Update repo migrations to match deployed
Risk: Repo becomes outdated
```

### Option 2: Core Schema is Canonical
```text
Action: Create forward migration
        Partner portal schema → Core schema
        Test carefully (may affect existing data)
Risk: May break existing workflows if any
```

### Option 3: Hybrid / New Canonical
```text
Action: Define new canonical schema
        Create comprehensive migration
        Update repo + deploy
Risk: Most work, but cleanest outcome
```

---

## 🚫 Do NOT Do (Without Analysis)

❌ Run `20260802150000_real_estate_core_schema.sql` directly on database  
❌ Assume repo is source of truth without confirming  
❌ Drop and recreate table (data loss risk)  
❌ Change code to match deployed without documenting canonical intent  

---

## ✅ Recommended Next Steps

1. **Query migration history:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE name LIKE '%reservation%' OR name LIKE '%2026080%'
   ORDER BY inserted_at;
   ```

2. **Direct schema inspection** (if Supabase dashboard accessible):
   - Check actual `re_reservations` columns
   - Check actual enum definitions
   - Export current schema DDL

3. **Determine canonical intent:**
   - Which schema does business logic expect?
   - Are there existing reservations in production?
   - What does current Bella Land product requirement say?

4. **Create forward migration** (if core schema is canonical):
   ```sql
   -- Add new columns
   ALTER TABLE re_reservations ADD COLUMN deposit_amount NUMERIC(15,2) DEFAULT 0;
   ALTER TABLE re_reservations ADD COLUMN reserved_at TIMESTAMPTZ DEFAULT NOW();
   
   -- Change enum (complex - requires careful migration)
   -- Drop old constraint, add new enum, update values
   
   -- Make user_id optional
   ALTER TABLE re_reservations ALTER COLUMN user_id DROP NOT NULL;
   ```

5. **Regenerate types:**
   ```bash
   npx supabase gen types typescript > src/types/database.types.ts
   ```

6. **Rerun reservation test**

---

## 📈 Impact Assessment

**Blocking:**
- ✅ Customers backend workflow (VERIFIED - used deployed schema correctly)
- 🔴 Reservations runtime testing (BLOCKED by schema drift)
- 🔴 Reservations UI workflow (BLOCKED)
- 🔴 End-to-end booking flow (BLOCKED)

**Fixed (Provisionally):**
- ✅ Engine code aligned to *core schema* (may need re-alignment if partner portal is canonical)

**Evidence Complete:**
- ✅ Schema drift confirmed
- ✅ Three possible root causes identified
- ⏸️ Canonical schema not yet determined

---

## 🎓 Lessons Learned

1. **Migration files ≠ deployed schema** without verification
2. **Schema introspection required** before runtime testing
3. **Error-driven discovery works** when direct queries unavailable
4. **Multiple migration files** require history reconciliation
5. **Enum changes** are particularly complex (cannot just ALTER)

---

**Status:** ANALYSIS COMPLETE - AWAITING CANONICAL SCHEMA DECISION

**Next Owner:** Human (DBA / Architect) to determine canonical schema

**Estimated Time to Resolution:** 1-2 hours (including careful migration + testing)
