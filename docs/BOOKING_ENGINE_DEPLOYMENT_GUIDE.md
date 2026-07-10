# Booking Engine - Deployment Guide

**Created**: 2026-07-09  
**Migration File**: `supabase/migrations/20260709140000_booking_engine_schema.sql`

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Prerequisites

- [ ] Docker Desktop đang chạy (for local testing)
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Database backup (production)
- [ ] Review migration file

### 2. Environment Check

```bash
# Check Docker
docker --version
docker ps

# Check Supabase CLI
npx supabase --version

# Check current status
npx supabase status
```

---

## 🚀 DEPLOYMENT STEPS

### Option 1: Local Development (Recommended first)

#### Step 1: Start Supabase Local

```bash
# Start local Supabase
npx supabase start

# Verify running
npx supabase status
```

**Expected output**:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
```

---

#### Step 2: Apply Migration

```bash
# Apply all pending migrations
npx supabase db push

# Or apply specific migration
npx supabase migration up --file 20260709140000_booking_engine_schema.sql
```

**Expected output**:
```
Applying migration 20260709140000_booking_engine_schema.sql...
✓ Migration applied successfully
```

---

#### Step 3: Verify Tables Created

```bash
# Connect to local DB
npx supabase db shell

# Then run SQL
\dt  -- List tables

# Should see:
# - waitlist
# - pricing_rules
# - capacity_snapshots
# - booking_events
```

**Or check in Supabase Studio**: http://localhost:54323

---

#### Step 4: Verify Functions Created

```sql
-- In DB shell
\df  -- List functions

-- Should see:
-- - expire_old_waitlist_entries()
-- - calculate_waitlist_priority()
-- - get_available_capacity()
```

---

#### Step 5: Test Helper Function

```sql
-- Test capacity calculation
SELECT * FROM get_available_capacity(
  'your-tenant-id'::uuid,
  CURRENT_DATE,
  'morning'
);

-- Expected result:
-- total_capacity | booked_capacity | available_capacity | buffer_reserved | utilization_rate
```

---

#### Step 6: Generate TypeScript Types

```bash
# Generate types from local DB
npx supabase gen types typescript --local > src/types/supabase-generated.ts

# Check types generated
grep -A 5 "waitlist" src/types/supabase-generated.ts
```

---

#### Step 7: Seed Test Data (Optional)

Create file `supabase/seed-booking-engine.sql`:

```sql
-- Insert test pricing rules
INSERT INTO pricing_rules (tenant_id, rule_name, rule_type, condition, multiplier, priority, enabled)
VALUES
  (current_setting('app.current_tenant_id')::uuid, 'Peak Morning', 'peak_hour', '{"hour_range": [10, 12]}'::jsonb, 1.15, 100, true),
  (current_setting('app.current_tenant_id')::uuid, 'Weekend Premium', 'weekend', '{"days": ["Sat", "Sun"]}'::jsonb, 1.15, 90, true);

-- Verify
SELECT * FROM pricing_rules;
```

Run seed:
```bash
npx supabase db execute -f supabase/seed-booking-engine.sql
```

---

### Option 2: Staging Environment

#### Step 1: Link to Staging Project

```bash
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
```

---

#### Step 2: Apply Migration

```bash
# Push migration to staging
npx supabase db push --project-ref YOUR_STAGING_PROJECT_REF

# Or via Dashboard: Settings > Database > Migrations > Upload
```

---

#### Step 3: Verify & Test

```bash
# Generate types from staging
npx supabase gen types typescript --project-ref YOUR_STAGING_PROJECT_REF > src/types/supabase-generated.ts

# Test queries in Supabase Studio
```

---

### Option 3: Production Deployment

⚠️ **CRITICAL: Always test in staging first!**

#### Step 1: Backup Database

```bash
# Via Supabase Dashboard: Settings > Database > Backups > Create Backup

# Or via CLI (if setup)
npx supabase db dump -f backup-$(date +%Y%m%d).sql
```

---

#### Step 2: Schedule Maintenance Window

- [ ] Notify users (if downtime expected)
- [ ] Choose low-traffic period
- [ ] Prepare rollback plan

---

#### Step 3: Apply Migration

```bash
# Link to production
npx supabase link --project-ref YOUR_PROD_PROJECT_REF

# Apply migration
npx supabase db push --project-ref YOUR_PROD_PROJECT_REF
```

**Or via Dashboard**:
1. Go to SQL Editor
2. Paste migration content
3. Run

---

#### Step 4: Verify Production

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events');

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('expire_old_waitlist_entries', 'calculate_waitlist_priority', 'get_available_capacity');

-- Check RLS
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events');
```

---

#### Step 5: Monitor

- [ ] Check error logs (Supabase Dashboard > Logs)
- [ ] Test basic queries
- [ ] Monitor performance
- [ ] Test RLS policies

---

## 🔧 TROUBLESHOOTING

### Issue 1: Docker not running

**Error**: `failed to inspect container health`

**Solution**:
```bash
# Start Docker Desktop (Windows)
# Then:
npx supabase start
```

---

### Issue 2: Migration fails due to existing table

**Error**: `relation "waitlist" already exists`

**Solution**:
```bash
# Drop tables (local dev only!)
npx supabase db reset

# Re-apply all migrations
npx supabase db push
```

---

### Issue 3: RLS prevents queries

**Error**: `new row violates row-level security policy`

**Solution**: Set tenant context before queries:
```typescript
await supabase.rpc('set_config', {
  setting: 'app.current_tenant_id',
  value: tenantId,
  is_local: false,
});
```

---

### Issue 4: Function not found

**Error**: `function get_available_capacity(...) does not exist`

**Solution**: Check function created:
```sql
-- List functions
SELECT * FROM pg_proc WHERE proname LIKE '%capacity%';

-- Re-create if needed (copy from migration)
```

---

### Issue 5: Types not generated correctly

**Error**: Type definitions missing or incorrect

**Solution**:
```bash
# Clear cache
rm -rf node_modules/.cache

# Re-generate
npx supabase gen types typescript --local > src/types/supabase-generated.ts

# Restart TypeScript server (VSCode)
Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### 1. Table Structure

```sql
-- Verify waitlist
\d waitlist

-- Should see:
-- - All columns
-- - All indexes
-- - RLS enabled
```

---

### 2. Sample Queries

```sql
-- Test insert waitlist
INSERT INTO waitlist (tenant_id, customer_id, package_id, preferred_date, priority_score, status, expires_at)
VALUES (
  current_setting('app.current_tenant_id')::uuid,
  'customer-uuid'::uuid,
  'package-uuid'::uuid,
  CURRENT_DATE + 1,
  50,
  'active',
  NOW() + INTERVAL '7 days'
);

-- Test capacity function
SELECT * FROM get_available_capacity(
  current_setting('app.current_tenant_id')::uuid,
  CURRENT_DATE,
  'morning'
);

-- Test pricing rules query
SELECT * FROM pricing_rules WHERE enabled = true ORDER BY priority DESC;
```

---

### 3. TypeScript Compilation

```bash
npm run build

# Should complete without TypeScript errors
```

---

### 4. Provider Tests

```bash
# Run existing tests (should still pass)
npm test

# Run new provider tests (when implemented)
npm test -- booking-engine
```

---

## 📊 ROLLBACK PLAN

### If Migration Fails

#### Option 1: Rollback via Supabase

```bash
# List migrations
npx supabase migration list

# Rollback last migration
npx supabase migration down
```

---

#### Option 2: Manual Rollback (Production)

```sql
-- Drop tables (reverses migration)
DROP TABLE IF EXISTS booking_events CASCADE;
DROP TABLE IF EXISTS capacity_snapshots CASCADE;
DROP TABLE IF EXISTS pricing_rules CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_available_capacity(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS calculate_waitlist_priority(UUID, UUID);
DROP FUNCTION IF EXISTS expire_old_waitlist_entries();
```

---

#### Option 3: Restore from Backup

```bash
# Via Supabase Dashboard: Settings > Database > Backups > Restore

# Or via CLI
psql $DATABASE_URL < backup-20260709.sql
```

---

## 📅 SCHEDULED JOBS

### Setup Cron Job (Expire Waitlist)

**Via pg_cron extension** (if available):

```sql
-- Run daily at 2 AM
SELECT cron.schedule(
  'expire-waitlist-entries',
  '0 2 * * *',
  'SELECT expire_old_waitlist_entries();'
);
```

**Or via external cron** (recommended):

```bash
# Crontab entry
0 2 * * * curl -X POST https://your-api.com/api/cron/expire-waitlist
```

---

## 🎯 SUCCESS CRITERIA

Deployment successful if:

- [ ] All 4 tables created
- [ ] All indexes created
- [ ] All 3 functions created
- [ ] RLS policies active
- [ ] TypeScript types generated
- [ ] No errors in logs
- [ ] Sample queries work
- [ ] Build passes

---

## 📞 SUPPORT

**If deployment fails**:
1. Check troubleshooting section above
2. Review Supabase logs
3. Check Discord/Slack for team support
4. Rollback if necessary

---

**Last Updated**: 2026-07-09  
**Status**: Ready for deployment  
**Next**: Deploy locally → Test → Deploy staging → Deploy production
