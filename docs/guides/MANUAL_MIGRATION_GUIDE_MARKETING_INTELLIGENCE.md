# Manual Migration Guide: Marketing Intelligence (Phase 3)

**Purpose**: Push Marketing Intelligence migrations manually via Supabase SQL Editor  
**Reason**: Blocked by pre-existing migration errors in API Gateway Phase 1  
**Date**: 2026-06-22  
**Status**: Ready to execute  

---

## 🎯 Overview

This guide provides step-by-step instructions to manually apply 5 Marketing Intelligence migrations using the Supabase Dashboard SQL Editor.

**Migrations to Apply**:
1. ✅ `20260622200000_create_external_ads_data.sql` - External ads data table
2. ✅ `20260622201000_create_marketing_campaigns.sql` - Marketing campaigns table
3. ✅ `20260622202000_create_mv_campaign_performance.sql` - Campaign performance MV
4. ✅ `20260622203000_create_mv_channel_performance.sql` - Channel performance MV
5. ✅ `20260622204000_create_mv_marketing_refresh_jobs.sql` - Auto-refresh jobs

**Estimated Time**: 15-20 minutes  
**Prerequisites**: 
- Supabase Dashboard access with admin privileges
- Database connection available
- No blocking transactions running

---

## 📋 Pre-Flight Checklist

Before starting, verify:

- [ ] You have access to Supabase Dashboard
- [ ] Current database is accessible (no downtime)
- [ ] You have backed up database (optional but recommended)
- [ ] No critical operations running (check active connections)

**Check Database Health**:
```sql
-- Run this in SQL Editor to check current connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE datname = current_database();

-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

---

## 🚀 Migration Steps

### Step 1: Access Supabase SQL Editor


1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (Bella SPA ERP)
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query** button

---

### Step 2: Migration #1 - External Ads Data Table

**File**: `supabase/migrations/20260622200000_create_external_ads_data.sql`

**What it does**:
- Creates `external_ads_data` table with 19 columns
- Adds 6 indexes for performance
- Enables RLS with tenant isolation
- Creates trigger for `updated_at` auto-update

**Instructions**:
1. Copy the entire content of `supabase/migrations/20260622200000_create_external_ads_data.sql`
2. Paste into SQL Editor
3. Click **Run** (or press Ctrl+Enter)
4. Verify: "Success. No rows returned"

**Verification Query**:
```sql
-- Check table was created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'external_ads_data'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'external_ads_data';
```

**Expected Result**: 19 columns, 6 indexes

---

### Step 3: Migration #2 - Marketing Campaigns Table

**File**: `supabase/migrations/20260622201000_create_marketing_campaigns.sql`


**What it does**:
- Creates `marketing_campaigns` table with JSONB mappings
- Adds 5 indexes (including GIN for JSONB)
- Creates 2 helper functions: `has_external_mapping()`, `get_external_campaign_id()`
- Adds foreign key from `external_ads_data` to `marketing_campaigns`

**Instructions**:
1. Copy the entire content of `supabase/migrations/20260622201000_create_marketing_campaigns.sql`
2. Paste into SQL Editor
3. Click **Run**
4. Verify success

**Verification Query**:
```sql
-- Check table and functions
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'marketing_campaigns';

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('has_external_mapping', 'get_external_campaign_id');

-- Test helper functions (should return false and null since no data yet)
SELECT has_external_mapping(gen_random_uuid(), 'facebook');
SELECT get_external_campaign_id(gen_random_uuid(), 'facebook');
```

**Expected Result**: Table created, 2 functions available, test queries return false/null

---

### Step 4: Migration #3 - Campaign Performance Materialized View

**File**: `supabase/migrations/20260622202000_create_mv_campaign_performance.sql`

**What it does**:
- Creates `mv_campaign_performance` materialized view
- Aggregates metrics across all platforms per campaign
- Adds 6 indexes for fast queries


**Instructions**:
1. Copy the entire content of `supabase/migrations/20260622202000_create_mv_campaign_performance.sql`
2. Paste into SQL Editor
3. Click **Run**
4. Verify success

**Verification Query**:
```sql
-- Check materialized view was created
SELECT schemaname, matviewname, ispopulated 
FROM pg_matviews 
WHERE matviewname = 'mv_campaign_performance';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'mv_campaign_performance';

-- Test query (should return 0 rows since no data yet)
SELECT COUNT(*) FROM mv_campaign_performance;
```

**Expected Result**: Materialized view created, populated=true, 6 indexes, 0 rows

---

### Step 5: Migration #4 - Channel Performance Materialized View

**File**: `supabase/migrations/20260622203000_create_mv_channel_performance.sql`

**What it does**:
- Creates `mv_channel_performance` materialized view
- Monthly aggregation by platform
- Adds 6 indexes (including partial index for recent 6 months)

**Instructions**:
1. Copy the entire content of `supabase/migrations/20260622203000_create_mv_channel_performance.sql`
2. Paste into SQL Editor
3. Click **Run**
4. Verify success


**Verification Query**:
```sql
-- Check materialized view
SELECT schemaname, matviewname, ispopulated 
FROM pg_matviews 
WHERE matviewname = 'mv_channel_performance';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'mv_channel_performance';

-- Test query
SELECT COUNT(*) FROM mv_channel_performance;
```

**Expected Result**: Materialized view created, populated=true, 6 indexes, 0 rows

---

### Step 6: Migration #5 - Auto-Refresh Jobs

**File**: `supabase/migrations/20260622204000_create_mv_marketing_refresh_jobs.sql`

**What it does**:
- Schedules 2 hourly cron jobs to refresh materialized views
- Creates 3 helper functions for manual refresh
- Extends monitoring views (`v_mv_refresh_status`, `v_cron_jobs_status`)

**⚠️ IMPORTANT**: This migration requires `pg_cron` extension. Verify it's enabled first:

```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- If not enabled, run this first:
CREATE EXTENSION IF NOT EXISTS pg_cron;
```


**Instructions**:
1. Verify `pg_cron` is enabled (run query above)
2. Copy the entire content of `supabase/migrations/20260622204000_create_mv_marketing_refresh_jobs.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Verify success

**Verification Query**:
```sql
-- Check cron jobs were created
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname IN ('refresh-mv-campaign-performance', 'refresh-mv-channel-performance');

-- Check helper functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'refresh_marketing_materialized_views',
  'refresh_all_intelligence_materialized_views'
);

-- Check monitoring views
SELECT * FROM v_mv_refresh_status;
SELECT * FROM v_cron_jobs_status WHERE jobname LIKE '%marketing%';
```

**Expected Result**: 
- 2 cron jobs scheduled (hourly at :00 and :05)
- 3 functions available
- Monitoring views show all materialized views
- v_cron_jobs_status shows active=true

---

## ✅ Post-Migration Verification

After completing all 5 migrations, run this comprehensive verification:

```sql
-- 1. Check all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('external_ads_data', 'marketing_campaigns')
ORDER BY table_name;

-- 2. Check all materialized views created
SELECT matviewname, ispopulated 
FROM pg_matviews 
WHERE matviewname IN ('mv_campaign_performance', 'mv_channel_performance')
ORDER BY matviewname;


-- 3. Check all indexes (should be 29 total)
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE tablename IN ('external_ads_data', 'marketing_campaigns', 
                    'mv_campaign_performance', 'mv_channel_performance')
GROUP BY tablename
ORDER BY tablename;

-- 4. Check all functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'has_external_mapping',
  'get_external_campaign_id',
  'refresh_marketing_materialized_views',
  'refresh_all_intelligence_materialized_views'
)
ORDER BY routine_name;

-- 5. Check cron jobs
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE '%marketing%' OR jobname LIKE '%campaign%' OR jobname LIKE '%channel%'
ORDER BY jobname;

-- 6. Check RLS policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('external_ads_data', 'marketing_campaigns')
ORDER BY tablename, policyname;
```

**Expected Results**:
- ✅ 2 tables created
- ✅ 2 materialized views created (populated=true)
- ✅ 29 indexes total (external_ads_data: 6, marketing_campaigns: 5, mv_campaign_performance: 6, mv_channel_performance: 6, plus system indexes)
- ✅ 4 functions created
- ✅ 2 cron jobs scheduled (active=true)
- ✅ RLS policies enabled on both tables

---

## 🧪 Test Manual Refresh

After migrations complete, test manual refresh:

```sql
-- Test marketing views refresh
SELECT refresh_marketing_materialized_views();
-- Expected: Success message

-- Test all views refresh with timing
SELECT * FROM refresh_all_intelligence_materialized_views();
-- Expected: 5 rows with view names, status=SUCCESS, duration in milliseconds

-- Check refresh status
SELECT * FROM v_mv_refresh_status 
WHERE matviewname IN ('mv_campaign_performance', 'mv_channel_performance');
-- Expected: 2 rows, ispopulated=true
```

---

## 🚨 Troubleshooting

### Issue: pg_cron extension not available
**Symptom**: Error "extension 'pg_cron' is not available"  
**Solution**: Contact Supabase support or enable via Dashboard → Database → Extensions

### Issue: Permission denied on cron.schedule
**Symptom**: Error "permission denied for schema cron"  
**Solution**: Run migrations as service_role or superuser, not as authenticated user

### Issue: Materialized view is not populated
**Symptom**: `ispopulated = false` in pg_matviews  
**Solution**: Run manual refresh:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_performance;
```

### Issue: Foreign key constraint violation
**Symptom**: Error referencing `tenants` table  
**Solution**: Ensure base schema migrations are applied first (tenants table exists)

---

## 📝 Record Migration in Supabase

After successful manual migration, record it in Supabase's migration history:

```sql
-- Insert migration records into supabase_migrations table
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES 
  ('20260622200000', ARRAY['-- Applied manually via SQL Editor'], 'create_external_ads_data'),
  ('20260622201000', ARRAY['-- Applied manually via SQL Editor'], 'create_marketing_campaigns'),
  ('20260622202000', ARRAY['-- Applied manually via SQL Editor'], 'create_mv_campaign_performance'),
  ('20260622203000', ARRAY['-- Applied manually via SQL Editor'], 'create_mv_channel_performance'),
  ('20260622204000', ARRAY['-- Applied manually via SQL Editor'], 'create_mv_marketing_refresh_jobs')
ON CONFLICT DO NOTHING;
```

---

## 🎉 Success Checklist

- [ ] All 5 migrations executed successfully
- [ ] 2 tables created with indexes and RLS
- [ ] 2 materialized views created and populated
- [ ] 4 functions available
- [ ] 2 cron jobs scheduled and active
- [ ] Verification queries all pass
- [ ] Manual refresh test successful
- [ ] Migration records inserted

---

## 📚 Next Steps

After successful migration:

1. **Update local migration tracker**:
   ```bash
   npx supabase db pull
   ```

2. **Test with sample data**: Insert test ad data and verify aggregations

3. **Proceed to Task #2**: Implement Marketing Intelligence Queries Module

4. **Proceed to Task #3**: Implement Facebook Ads Connector

---

**Migration Guide Created**: 2026-06-22  
**Last Updated**: 2026-06-22  
**Status**: Ready for execution  
