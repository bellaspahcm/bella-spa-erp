# F2 M1–M4a DEPLOYMENT INSTRUCTIONS

**Date:** 2026-08-24  
**Status:** ⏸️ AWAITING MANUAL DEPLOYMENT  
**Migrations:** 20260824000000 through 20260824030000

---

## 🚨 CURRENT SITUATION

**Implementation:** ✅ COMPLETE  
**Deployment:** 🔴 BLOCKED (requires manual execution)

**Reason:** 
- Docker not running (cannot use local Supabase)
- Project not linked to remote Supabase (cannot use `supabase db push`)
- DATABASE_URL not set (cannot use `psql`)

---

## 🎯 DEPLOYMENT OPTIONS

### Option A: Link to Remote Supabase Project (RECOMMENDED)

```bash
# 1. Link to your Supabase project
supabase link --project-ref <your-project-ref>

# 2. Deploy migrations
supabase db push

# 3. Verify deployment
supabase migration list
```

**Advantages:**
- Automated migration tracking
- Built-in rollback support
- Integrated with Supabase dashboard

---

### Option B: Direct Database Connection

```bash
# 1. Set DATABASE_URL environment variable
# Get connection string from Supabase dashboard → Project Settings → Database
export DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# 2. Deploy migrations
psql "$DATABASE_URL" -f supabase/migrations/20260824000000_f2_cash_effective_date.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824010000_f2_fix_cash_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824020000_f2_opening_balance_contract.sql
psql "$DATABASE_URL" -f supabase/migrations/20260824030000_f2_opening_balance_provenance.sql

# 3. Verify deployment
psql "$DATABASE_URL" -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260824000000' ORDER BY version;"
```

**Advantages:**
- Works without Supabase CLI
- Direct control over execution

---

### Option C: Supabase Dashboard SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy-paste migration contents one by one:
   - `20260824000000_f2_cash_effective_date.sql`
   - `20260824010000_f2_fix_cash_contract.sql`
   - `20260824020000_f2_opening_balance_contract.sql`
   - `20260824030000_f2_opening_balance_provenance.sql`
4. Execute each migration
5. Verify in Table Editor

**Advantages:**
- No CLI required
- Visual feedback

**Disadvantages:**
- Manual process
- No automatic migration tracking

---

## 📋 STEP-BY-STEP DEPLOYMENT GUIDE

### Step 1: Prepare Environment

**Check Supabase CLI:**
```bash
supabase --version
```
Expected: `v2.107.0` or later

**Check Project Status:**
```bash
cd /path/to/BELLA_SPA_ERP
supabase status
```

---

### Step 2: Link Project (if not linked)

```bash
# Get your project reference from Supabase dashboard
# URL format: https://supabase.com/dashboard/project/[project-ref]

supabase link --project-ref <your-project-ref>
```

**You'll be prompted for:**
- Database password (from Project Settings → Database)

---

### Step 3: Review Migrations

```bash
# List pending migrations
supabase migration list

# Expected output should include:
# 20260824000000 (local only)
# 20260824010000 (local only)
# 20260824020000 (local only)
# 20260824030000 (local only)
```

---

### Step 4: Deploy Migrations

```bash
# Deploy all pending migrations
supabase db push

# Or deploy with confirmation
supabase db push --include-all
```

**During deployment, watch for:**
- ✅ Migration 20260824000000 applied successfully
- ✅ Migration 20260824010000 applied successfully
- ✅ Migration 20260824020000 applied successfully
- ✅ Migration 20260824030000 applied successfully
- ❌ Any errors or warnings

---

### Step 5: Verify Deployment

```bash
# Check migration status
supabase migration list

# Expected: All 4 migrations should show as applied (both columns filled)

# Connect to database
supabase db remote commit

# Or use psql
psql "$(supabase status | grep 'DB URL' | awk '{print $3}')"
```

---

### Step 6: Run Smoke Tests

```bash
# Get database URL
DB_URL=$(supabase status | grep 'DB URL' | awk '{print $3}')

# Run smoke tests
psql "$DB_URL" -f docs/architecture/F2_CONTRACT_SMOKE_TEST.sql
```

**Expected Output:**
```
=== F2 CONTRACT SMOKE TEST START ===

TEST 1: Verify effective_date column...
✅ TEST 1 PASSED: effective_date exists, NOT NULL, X rows populated

TEST 2: Verify effective_date backfill lineage...
✅ TEST 2 PASSED: All X movements have valid F1 lineage

[... 10 more tests ...]

=== F2 CONTRACT SMOKE TEST COMPLETE ===
All 12 smoke tests passed ✅
```

---

### Step 7: Run Full Verification

Execute all verification queries from:
`docs/architecture/F2_CONTRACT_IMPLEMENTATION_VERIFICATION.md`

**Critical Verifications:**

1. **Temporal Lineage:**
```sql
SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE fcm.effective_date = ft.posted_at) AS valid_lineage
FROM finance_cash_movements fcm
JOIN finance_transactions ft ON fcm.f1_transaction_id = ft.id;
```
Expected: `total = valid_lineage`

2. **baseline_found Semantics:**
```sql
SELECT baseline_found
FROM finance_cash_opening_balance_as_of(
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    NOW(),
    'F2_OPENING:v1'
);
```
Expected: `baseline_found = FALSE`

3. **No Data Seeding:**
```sql
SELECT COUNT(*) FROM finance_cash_opening_balances;
```
Expected: `0`

---

### Step 8: Generate Evidence Report

Fill in `docs/architecture/F2_M1_M4A_DEPLOYMENT_EVIDENCE.md` with actual results.

---

## ⚠️ TROUBLESHOOTING

### Issue: "duplicate key value violates unique constraint"

**Cause:** Migration already applied  
**Solution:** Check `supabase migration list` — if migration shows as applied, skip it

---

### Issue: "column effective_date already exists"

**Cause:** Migration 1 already partially applied  
**Solution:** 
```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'finance_cash_movements' AND column_name = 'effective_date';

-- If exists, skip Migration 1 or comment out ALTER TABLE line
```

---

### Issue: "ERROR: no such file or directory"

**Cause:** Wrong working directory  
**Solution:** `cd` to project root where `supabase/migrations/` exists

---

### Issue: Smoke test shows FAIL

**Action:** 
1. Review specific test failure
2. Check migration actually applied: `supabase migration list`
3. Review database logs: `supabase db logs`
4. DO NOT proceed to M4b until all tests PASS

---

## 🔒 POST-DEPLOYMENT CHECKLIST

- [ ] All 4 migrations applied successfully
- [ ] 12/12 smoke tests PASS
- [ ] Temporal lineage verified (effective_date = F1.posted_at)
- [ ] baseline_found = FALSE confirmed
- [ ] No unauthorized data seeding
- [ ] RLS policies active
- [ ] Immutability trigger functional
- [ ] Evidence report completed
- [ ] Human Architect review scheduled

---

## 🚫 DO NOT PROCEED UNTIL

✅ Deployment verified (12/12 smoke tests PASS)  
✅ Evidence report completed  
✅ Human Architect approves baseline provenance decision  

❌ DO NOT create M4b  
❌ DO NOT seed opening balances  
❌ DO NOT modify Worker/RPC  
❌ DO NOT implement F5.6  

---

## 📞 SUPPORT

If deployment fails or verification shows issues:

1. Capture error messages
2. Review `supabase db logs`
3. Check `F2_CONTRACT_IMPLEMENTATION_VERIFICATION.md` for specific test queries
4. DO NOT proceed past this gate without approval

---

**NEXT STEP:** Execute deployment using one of the 3 options above, then run smoke tests.
