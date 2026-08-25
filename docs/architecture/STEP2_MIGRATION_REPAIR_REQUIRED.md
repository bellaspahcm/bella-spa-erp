# Step 2: Migration Repair Required

**Date:** 2026-08-24  
**Status:** 🛑 BLOCKED — CLI detected remote migrations not in local repo  
**Cause:** Step 1 recorded history for migrations whose files don't exist locally

---

## Issue

```
Remote migration versions not found in local migrations directory.
```

**Remote-only migrations (17):**
- 20260820_r4_3_gate_tokens
- 20260820_r4_4_monitoring_audit
- 20260820_r4_approval_contract
- 20260820000000 through 20260820140000 (multiple)
- 20260821_create_accessorial_rates_table
- 20260821_create_carrier_rates_table
- 20260821_create_discrepancies_table
- 20260821_create_freight_audit_tables
- 20260821000000
- 20260821115404

---

## Root Cause

**Step 1 reconciliation:**
- Recorded 16 migrations in `schema_migrations` table ✅
- But local `.sql` files don't exist for all of them
- CLI detects mismatch between remote history and local files

**This is EXPECTED** — we recorded history for migrations with applied DDL but missing/renamed files.

---

## Decision Required

### ❓ How to proceed?

**Option A: Skip migration repair, deploy RPC directly**
- Use Supabase Dashboard SQL Editor
- Execute: `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
- Manually record in `schema_migrations`
- Bypass CLI conflict

**Option B: Repair migration history**
- Mark remote-only migrations as "applied" locally
- Allows CLI `db push` to work
- Cleaner long-term

**Option C: Create placeholder files**
- Create empty/stub `.sql` files for missing migrations
- NOT RECOMMENDED (content mismatch risk)

---

## Recommendation: Option A (Dashboard Deploy)

**Rationale:**
1. RPC is self-contained (no dependencies on conflicting migrations)
2. Faster than migration repair (5 min vs 30 min)
3. Lower risk (no repair command complexity)
4. Same end result (RPC deployed + history recorded)

**Steps:**
1. Copy: `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
2. Supabase Dashboard → SQL Editor
3. Execute RPC migration
4. Manually record in `schema_migrations`:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
   VALUES ('20260824000000', 'finance_test_cleanup_rpc', ARRAY['CREATE FUNCTION', 'REVOKE', 'GRANT']::text[])
   ON CONFLICT (version) DO NOTHING;
   ```
5. Verify RPC: `npx tsx scripts/verify_cleanup_rpc.ts`

---

## Alternative: Option B (Migration Repair)

**If prefer CLI deployment:**

```bash
supabase migration repair --status applied \
  20260820_r4_3_gate_tokens \
  20260820_r4_4_monitoring_audit \
  20260820_r4_approval_contract \
  20260820000000 \
  20260820010000 \
  20260820100000 \
  20260820110000 \
  20260820120000 \
  20260820130000 \
  20260820140000 \
  20260821_create_accessorial_rates_table \
  20260821_create_carrier_rates_table \
  20260821_create_discrepancies_table \
  20260821_create_freight_audit_tables \
  20260821000000 \
  20260821115404
```

Then retry: `npx supabase db push`

---

## Frozen Boundary (Maintained)

Regardless of method chosen:
- ✅ Deploy RPC function only
- ✅ Verify 4/4 tests
- ❌ NO cleanup execution
- ❌ NO Finance modifications
- ❌ NO SPA modifications
- 🛑 STOP after RPC verification

---

**Status:** Step 2 blocked by CLI migration mismatch  
**Recommended:** Option A (Dashboard deploy)  
**Alternative:** Option B (Migration repair)  
**Awaiting:** Human Architect decision
