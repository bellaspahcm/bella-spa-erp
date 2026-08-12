# Analysis: Existing hc_clinical_orders Table Schema Mismatch

## Discovery
Table `hc_clinical_orders` EXISTS on remote Supabase with DIFFERENT schema than migration 20260808000006.

## Evidence
From Query 4 (Show indexes), found index:
```
idx_hc_clinical_orders_customer
```

This index references column `customer_id` which:
- ❌ NOT in migration 20260808000006 (lines 212-260)
- ❌ NOT in migration 20260812030000 (Phase 0 extensions)
- ✅ WAS in Repository (line 88) but we removed it as "phantom column"

## Hypothesis
There are TWO different schemas competing:

### Schema A (Old/Unknown Source):
- Has `customer_id` column
- Has `status` column (NOT `order_status`)
- Unknown origin (not from our migrations)

### Schema B (Migration 20260808000006):
- Has `order_status` column (NOT `status`)
- Has `patient_party_id` via composite FK
- Has `request_id` for idempotency
- Has `version` for optimistic locking

## Root Cause
When we ran `CREATE TABLE IF NOT EXISTS`, it:
1. ✅ Detected table exists (Schema A)
2. ❌ Skipped creation (table not replaced)
3. ❌ Left old schema intact
4. ❌ Repository maps to Schema B, but DB has Schema A

## Impact on Tests
Repository maps:
- `order_status` → DB has `status` ❌
- `patient_party_id` → DB has `customer_id`? ❌
- `request_id` → DB has it? Unknown
- `version` → DB has it? Unknown

## Next Steps
1. Run Query 2 from check_existing_orders_table.sql to see ALL columns
2. Compare with migration 20260808000006 expected columns
3. Decide: DROP old table and recreate, OR ALTER to match migration

## Recommendation
**DROP and RECREATE** because:
- Old schema origin unknown (not from our migrations)
- Safer to start clean with known schema
- Test environment confirmed (no production data at risk)
- Fixes all column mismatches at once
