# CONFIGURATION SYSTEM MIGRATION GUIDE

**Last Updated:** 22/06/2026  
**Status:** Phase 1 - Step 3  
**Purpose:** Guide for running configuration system migrations

---

## 📋 OVERVIEW

This guide covers how to:
1. Run database migrations for configuration system
2. Insert default configs for all tenants
3. Verify migration success
4. Troubleshoot common issues

---

## 🎯 PREREQUISITES

Before running migrations, ensure you have:

- ✅ Supabase project set up
- ✅ `.env.local` with correct credentials:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
  ```
- ✅ At least one tenant created in `tenants` table
- ✅ Node.js and npm installed

---

## 🚀 METHOD 1: Using Supabase Dashboard (Recommended)

### Step 1: Run Schema Migration

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy contents of `supabase/migrations/20260622_create_tenant_payroll_config.sql`
6. Paste into SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for success message

**Expected output:**
```
Success. No rows returned
```

**What it does:**
- Creates `tenant_payroll_config` table
- Creates `tenant_payroll_config_history` table
- Sets up triggers for auto-versioning and audit
- Sets up RLS policies
- Creates helper views

---

### Step 2: Insert Default Configs

1. In same SQL Editor
2. Click **New Query**
3. Copy contents of `supabase/migrations/20260622_insert_default_payroll_configs.sql`
4. Paste into SQL Editor
5. Click **Run**
6. Check console output for verification logs

**Expected output:**
```
NOTICE:  Commission configs inserted/existing: 3
NOTICE:  KPI configs inserted/existing: 3
NOTICE:  Attendance configs inserted/existing: 3
NOTICE:  Rating configs inserted/existing: 3
NOTICE:  Bonus configs inserted/existing: 3
NOTICE:  ==================================================
NOTICE:  FINAL VERIFICATION
NOTICE:  ==================================================
NOTICE:  Total tenants: 3
NOTICE:  Total configs: 15
NOTICE:  Expected configs: 15
NOTICE:  Status: ✅ ALL CONFIGS PRESENT
NOTICE:  ==================================================
NOTICE:  Config breakdown by provider:
NOTICE:    attendance : 3 total (3 enabled)
NOTICE:    bonus : 3 total (0 enabled)
NOTICE:    commission : 3 total (3 enabled)
NOTICE:    kpi : 3 total (0 enabled)
NOTICE:    rating : 3 total (0 enabled)
Success. No rows returned
```

---

### Step 3: Verify Setup

1. In SQL Editor, click **New Query**
2. Copy contents of `scripts/verify-config-setup.sql`
3. Paste and run
4. Review results

**What to check:**
- ✅ Tables exist
- ✅ Total configs = 5 × number of tenants
- ✅ Commission and Attendance are enabled by default
- ✅ KPI, Rating, Bonus are disabled by default
- ✅ RLS policies are active
- ✅ Triggers are installed

---

## 🚀 METHOD 2: Using TypeScript Script

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Run Migration Script

```bash
npm run config:migrate
```

Or with ts-node:
```bash
npx ts-node scripts/run-config-migrations.ts
```

**Expected output:**
```
╔══════════════════════════════════════════════════════╗
║  BELLA PAYROLL CONFIGURATION SYSTEM MIGRATION        ║
╚══════════════════════════════════════════════════════╝

🔌 Step 1: Checking Supabase connection...
   ✅ Connection successful

📊 Step 2: Checking if tenant_payroll_config table exists...
   ✅ Table already exists
   ℹ️  Skipping schema creation (safe to re-run)

👥 Step 3: Counting tenants...
   📊 Found 3 tenant(s)

⚙️  Step 4: Inserting default configs...
   📄 Reading migration: 20260622_insert_default_payroll_configs.sql
   Size: 10.5 KB
   Running...
   ✅ Migration completed

✅ Step 5: Verifying results...

╔══════════════════════════════════════════════════════╗
║  MIGRATION RESULTS                                   ║
╚══════════════════════════════════════════════════════╝

   Tenants: 3
   Total configs: 15
   Expected: 15 (5 providers × 3 tenants)

   Config breakdown by provider:
     ✅ commission    : 3/3
     ✅ kpi           : 3/3
     ✅ attendance    : 3/3
     ✅ rating        : 3/3
     ✅ bonus         : 3/3

╔══════════════════════════════════════════════════════╗
║  ✅ MIGRATION SUCCESSFUL                             ║
╚══════════════════════════════════════════════════════╝

Next steps:
  1. Build Settings UI for admin to manage configs
  2. Refactor providers to use PayrollConfigService
  3. Test with different tenant configs
```

---

## 🚀 METHOD 3: Using Supabase CLI

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Link to Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Run Migrations

```bash
supabase db push
```

This will run all migrations in `supabase/migrations/` folder in order.

---

## ✅ VERIFICATION CHECKLIST

After running migrations, verify:

- [ ] `tenant_payroll_config` table exists
- [ ] `tenant_payroll_config_history` table exists
- [ ] Total configs = 5 × number of tenants
- [ ] Commission configs: enabled=true, strategy='fixed', rate=120000
- [ ] KPI configs: enabled=false, strategy='threshold', target=30
- [ ] Attendance configs: enabled=true, strategy='late_deduction'
- [ ] Rating configs: enabled=false, strategy='threshold'
- [ ] Bonus configs: enabled=false, strategy=null
- [ ] RLS policies active (4 policies per table)
- [ ] Triggers active (2 triggers on tenant_payroll_config)

**Quick verification query:**
```sql
SELECT 
  COUNT(*) as config_count,
  (SELECT COUNT(*) * 5 FROM tenants) as expected_count
FROM tenant_payroll_config;
```

**Expected result:**
```
config_count | expected_count
-------------+---------------
15           | 15
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Table already exists"

**Symptom:**
```
ERROR:  relation "tenant_payroll_config" already exists
```

**Solution:**
- This is OK! The migration uses `CREATE TABLE IF NOT EXISTS`
- Re-running is safe and idempotent
- Skip to Step 2 (insert configs)

---

### Issue: "No tenants found"

**Symptom:**
```
NOTICE:  Total tenants: 0
NOTICE:  Expected configs: 0
```

**Solution:**
1. Create at least one tenant first:
```sql
INSERT INTO tenants (name, created_at)
VALUES ('Demo Spa', NOW());
```
2. Re-run config migration

---

### Issue: "PGRST301: JWT secret is missing"

**Symptom:**
```
Error: PGRST301: JWT secret is missing
```

**Solution:**
- Check `.env.local` has correct `SUPABASE_SERVICE_ROLE_KEY`
- Make sure it's the **service role key**, not anon key
- Find in Supabase Dashboard → Settings → API

---

### Issue: "Some configs missing"

**Symptom:**
```
⚠️  commission    : 2/3
✅ kpi           : 3/3
✅ attendance    : 3/3
...
```

**Solution:**
1. Check which provider is missing:
```sql
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  c.provider_key
FROM tenants t
LEFT JOIN tenant_payroll_config c ON c.tenant_id = t.id
WHERE c.id IS NULL;
```

2. Manually insert missing config:
```sql
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config)
VALUES ('TENANT_UUID', 'commission', true, 'fixed', '{"rate": 120000}'::jsonb);
```

3. Or re-run insert migration (safe, uses ON CONFLICT DO NOTHING)

---

### Issue: "Permission denied for table tenant_payroll_config"

**Symptom:**
```
ERROR:  permission denied for table tenant_payroll_config
```

**Solution:**
- Make sure you're using **service role key**, not anon key
- RLS policies block anon access
- Only service role can insert system configs

---

## 📊 MONITORING QUERIES

### Check config coverage per tenant

```sql
SELECT 
  t.name as tenant_name,
  COUNT(c.id) as config_count,
  ARRAY_AGG(c.provider_key ORDER BY c.provider_key) as providers,
  ARRAY_AGG(c.enabled ORDER BY c.provider_key) as enabled_status
FROM tenants t
LEFT JOIN tenant_payroll_config c ON c.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY t.name;
```

### Check recent config changes

```sql
SELECT 
  h.changed_at,
  t.name as tenant_name,
  h.provider_key,
  h.change_type,
  h.reason,
  u.email as changed_by
FROM tenant_payroll_config_history h
LEFT JOIN tenants t ON t.id = h.tenant_id
LEFT JOIN auth.users u ON u.id = h.changed_by
ORDER BY h.changed_at DESC
LIMIT 20;
```

### Check enabled providers per tenant

```sql
SELECT 
  t.name as tenant_name,
  ARRAY_AGG(c.provider_key) FILTER (WHERE c.enabled = true) as enabled_providers,
  ARRAY_AGG(c.provider_key) FILTER (WHERE c.enabled = false) as disabled_providers
FROM tenants t
LEFT JOIN tenant_payroll_config c ON c.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY t.name;
```

---

## 🔄 ROLLBACK INSTRUCTIONS

If you need to rollback migrations:

### Rollback Step 2 (Delete configs only)

```sql
-- Delete auto-generated configs
DELETE FROM tenant_payroll_config
WHERE notes LIKE '%(auto-generated)%';
```

### Rollback Step 1 (Delete tables - DANGEROUS!)

```sql
-- Drop tables (WARNING: This deletes ALL configs!)
DROP TABLE IF EXISTS tenant_payroll_config_history CASCADE;
DROP TABLE IF EXISTS tenant_payroll_config CASCADE;
```

**⚠️ Warning:** This will delete ALL configurations. Only do this in dev/staging!

---

## 📝 POST-MIGRATION TASKS

After successful migration:

1. ✅ **Document default configs**
   - Commission: 120k/session
   - KPI: 30 sessions → 1M (disabled)
   - Attendance: 50k late, 200k absent
   - Rating: ≥4.5 stars → 50k (disabled)
   - Bonus: Manual only (disabled)

2. ✅ **Test PayrollConfigService**
   ```typescript
   const configService = PayrollConfigService.getInstance();
   const config = await configService.getProviderConfig(tenantId, 'commission');
   console.log(config); // { enabled: true, strategy: 'fixed', config: { rate: 120000 } }
   ```

3. ✅ **Build Settings UI** (Phase 1 - Week 2)
   - Page: `/dashboard/settings/payroll`
   - Enable/disable providers
   - Select strategies
   - Edit parameters

4. ✅ **Refactor providers** (Phase 1 - Week 2)
   - CommissionProvider ✅ (already done)
   - KPIProvider (TODO)
   - AttendanceProvider (TODO - create new)
   - RatingProvider (TODO - create new)

---

## 🎯 SUCCESS CRITERIA

Migration is successful when:

- ✅ All queries in `verify-config-setup.sql` return expected results
- ✅ Config count = 5 × tenant count
- ✅ All tenants have commission + attendance enabled by default
- ✅ History table is empty (no manual changes yet)
- ✅ `PayrollConfigService.getProviderConfig()` works
- ✅ No errors in Supabase logs

---

## 🔗 RELATED FILES

- Schema migration: `supabase/migrations/20260622_create_tenant_payroll_config.sql`
- Config migration: `supabase/migrations/20260622_insert_default_payroll_configs.sql`
- Verification: `scripts/verify-config-setup.sql`
- Types: `src/types/payroll-config.ts`
- Service: `src/services/payroll-config.service.ts`
- Audit: `docs/config/HARDCODED_VALUES_AUDIT.md`

---

**Questions?** Check `HARDCODED_VALUES_AUDIT.md` or ask in #dev-backend channel.
