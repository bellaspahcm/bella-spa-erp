# Phase 7 Migration Guide - Forecast & Recommendation Engine

**Date**: 2026-06-22  
**Phase**: Intelligence Layer Phase 7  
**Status**: READY TO APPLY  
**Risk Level**: LOW (read-only materialized views, no data modification)

---

## ⚠️ PRE-FLIGHT CHECKLIST

Before applying these migrations, verify:

- [ ] Database backup completed (automatic daily backup should exist)
- [ ] Current production is stable (no active incidents)
- [ ] Off-peak hours (recommended: after 23:00 or before 06:00 VN time)
- [ ] Supabase Dashboard access available
- [ ] ~15 minutes available for migration + verification

---

## 📋 MIGRATION OVERVIEW

### Files to Apply (in order):

1. `20260622270000_create_forecast_results.sql` (7KB)
   - Creates `forecast_results` table
   - Stores forecast outputs (revenue, churn, demand)
   - **Impact**: None (new table, empty)

2. `20260622271000_create_recommendation_cache.sql` (8KB)
   - Creates `recommendation_cache` table
   - Stores computed recommendations
   - Schedules daily cache cleanup job (2:00 AM)
   - **Impact**: None (new table, empty)

3. `20260622272000_create_mv_forecast_accuracy.sql` (12KB)
   - Creates `mv_forecast_accuracy` materialized view
   - Tracks model accuracy over time
   - Schedules daily refresh job (3:00 AM)
   - **Impact**: None (depends on forecast_results which is empty)

4. `20260622273000_create_mv_customer_item_interactions.sql` (15KB)
   - Creates `mv_customer_item_interactions` materialized view
   - Pre-computes customer-item interaction matrix
   - Schedules 6-hourly refresh job (:30 past the hour)
   - **Impact**: ~3-5 minutes initial materialization (depends on sessions data)
   - **Resource**: Medium query (uses sessions, bookings, reviews)

5. `20260622274000_create_demand_history_rpcs.sql` (10KB)
   - Creates 3 RPC functions for demand history
   - `get_service_demand_history()`
   - `get_package_demand_history()`
   - `get_item_demand_summary()`
   - **Impact**: None (read-only functions)

6. `20260622275000_create_recommendation_rpcs.sql` (12KB)
   - Creates 8 RPC functions for recommendations
   - `get_similar_customers()`, `get_co_purchased_items()`, etc.
   - **Impact**: None (read-only functions)

### Total Migration Time: ~5-10 minutes

---

## 🚀 MIGRATION STEPS

### Option A: Supabase Dashboard (RECOMMENDED)

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select project: `bella-spa-erp` (qwvcumabkftxzptsvtlw)

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query" button

3. **Apply Migration 1: forecast_results**
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622270000_create_forecast_results.sql
   -- Paste and click "Run"
   ```
   - **Expected result**: "Success. No rows returned"
   - **Verify**: 
     ```sql
     SELECT COUNT(*) FROM public.forecast_results;
     -- Should return: 0
     ```

4. **Apply Migration 2: recommendation_cache**
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622271000_create_recommendation_cache.sql
   -- Paste and click "Run"
   ```
   - **Expected result**: "Success. No rows returned"
   - **Verify**:
     ```sql
     SELECT COUNT(*) FROM public.recommendation_cache;
     -- Should return: 0
     
     SELECT COUNT(*) FROM cron.job WHERE jobname = 'cleanup-expired-recommendation-cache';
     -- Should return: 1
     ```

5. **Apply Migration 3: mv_forecast_accuracy**
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622272000_create_mv_forecast_accuracy.sql
   -- Paste and click "Run"
   ```
   - **Expected result**: "Success. No rows returned"
   - **Verify**:
     ```sql
     SELECT COUNT(*) FROM public.mv_forecast_accuracy;
     -- Should return: 0 (no forecasts yet)
     
     SELECT COUNT(*) FROM cron.job WHERE jobname = 'refresh-mv-forecast-accuracy';
     -- Should return: 1
     ```

6. **Apply Migration 4: mv_customer_item_interactions** ⚠️ LONGEST
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622273000_create_mv_customer_item_interactions.sql
   -- Paste and click "Run"
   ```
   - **Expected time**: 3-5 minutes
   - **Expected result**: "Success. Materialized view created"
   - **Verify**:
     ```sql
     SELECT COUNT(*) FROM public.mv_customer_item_interactions;
     -- Should return: > 0 (depends on sessions/bookings data)
     
     SELECT COUNT(*) FROM cron.job WHERE jobname = 'refresh-mv-customer-item-interactions';
     -- Should return: 1
     ```

7. **Apply Migration 5: demand_history_rpcs**
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622274000_create_demand_history_rpcs.sql
   -- Paste and click "Run"
   ```
   - **Expected result**: "Success. No rows returned"
   - **Verify**:
     ```sql
     SELECT COUNT(*) FROM pg_proc 
     WHERE proname IN (
       'get_service_demand_history',
       'get_package_demand_history',
       'get_item_demand_summary'
     );
     -- Should return: 3
     ```

8. **Apply Migration 6: recommendation_rpcs**
   ```sql
   -- Copy entire content from:
   -- supabase/migrations/20260622275000_create_recommendation_rpcs.sql
   -- Paste and click "Run"
   ```
   - **Expected result**: "Success. No rows returned"
   - **Verify**:
     ```sql
     SELECT COUNT(*) FROM pg_proc 
     WHERE proname IN (
       'get_service_ratings',
       'get_popular_services',
       'get_popular_services_by_segment',
       'get_popular_packages',
       'get_popular_packages_by_segment',
       'get_similar_customers',
       'get_co_purchased_items',
       'get_customer_transactions'
     );
     -- Should return: 8
     ```

---

### Option B: Command Line (If DATABASE_URL is configured)

```bash
# Set DATABASE_URL environment variable first
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Apply all pending migrations
npx supabase migration up --db-url "$DATABASE_URL"
```

---

## ✅ POST-MIGRATION VERIFICATION

### 1. Check All Tables Created

```sql
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN (
  'forecast_results',
  'recommendation_cache',
  'mv_forecast_accuracy_refresh_jobs',
  'mv_customer_item_interactions_refresh_jobs'
)
ORDER BY tablename;

-- Expected: 4 rows
```

### 2. Check All Materialized Views Created

```sql
SELECT 
  schemaname,
  matviewname,
  matviewowner
FROM pg_matviews
WHERE matviewname IN (
  'mv_forecast_accuracy',
  'mv_customer_item_interactions'
)
ORDER BY matviewname;

-- Expected: 2 rows
```

### 3. Check All Cron Jobs Scheduled

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname IN (
  'cleanup-expired-recommendation-cache',
  'refresh-mv-forecast-accuracy',
  'refresh-mv-customer-item-interactions'
)
ORDER BY jobname;

-- Expected: 3 rows, all active=true
```

### 4. Check All RPC Functions Created

```sql
SELECT 
  proname AS function_name,
  pronargs AS num_args,
  provolatile AS volatility
FROM pg_proc
WHERE proname IN (
  'get_cached_recommendations',
  'cleanup_expired_recommendation_cache',
  'get_best_forecast_model',
  'compare_forecast_models',
  'update_forecast_accuracy',
  'get_similar_customers',
  'get_co_purchased_items',
  'get_service_demand_history',
  'get_package_demand_history',
  'get_item_demand_summary',
  'get_service_ratings',
  'get_popular_services',
  'get_popular_services_by_segment',
  'get_popular_packages',
  'get_popular_packages_by_segment',
  'get_customer_transactions'
)
ORDER BY proname;

-- Expected: 16 rows
```

### 5. Test Sample API Call

Once migrations are applied, test the APIs:

```bash
# Test forecast accuracy API (should return empty array initially)
curl -X GET "https://[YOUR-PROJECT].supabase.co/rest/v1/rpc/get_best_forecast_model?p_tenant_id=YOUR_TENANT_ID&p_forecast_type=revenue&p_forecast_horizon=12" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT"

# Test recommendation cache (should work but return null initially)
curl -X GET "https://[YOUR-PROJECT].supabase.co/rest/v1/rpc/get_cached_recommendations?p_tenant_id=YOUR_TENANT_ID&p_cache_key=test" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 🔄 REGENERATE DATABASE TYPES

After migrations are applied, regenerate TypeScript types:

```bash
# Method 1: Using Supabase CLI
npx supabase gen types typescript --db-url "$DATABASE_URL" > src/types/database.types.ts

# Method 2: Using Supabase Dashboard
# 1. Go to "Settings" → "API"
# 2. Copy generated TypeScript types
# 3. Replace content of src/types/database.types.ts
```

**Verify types generated:**
```bash
grep -E "forecast_results|recommendation_cache|mv_forecast_accuracy|mv_customer_item_interactions" src/types/database.types.ts

# Should find all 4 table/view names
```

---

## 🚨 ROLLBACK PROCEDURE (If needed)

If anything goes wrong, rollback in reverse order:

```sql
-- 1. Drop RPC functions
DROP FUNCTION IF EXISTS public.get_customer_transactions CASCADE;
DROP FUNCTION IF EXISTS public.get_popular_packages_by_segment CASCADE;
DROP FUNCTION IF EXISTS public.get_popular_packages CASCADE;
DROP FUNCTION IF EXISTS public.get_popular_services_by_segment CASCADE;
DROP FUNCTION IF EXISTS public.get_popular_services CASCADE;
DROP FUNCTION IF EXISTS public.get_service_ratings CASCADE;
DROP FUNCTION IF EXISTS public.get_item_demand_summary CASCADE;
DROP FUNCTION IF EXISTS public.get_package_demand_history CASCADE;
DROP FUNCTION IF EXISTS public.get_service_demand_history CASCADE;
DROP FUNCTION IF EXISTS public.get_co_purchased_items CASCADE;
DROP FUNCTION IF EXISTS public.get_similar_customers CASCADE;
DROP FUNCTION IF EXISTS public.update_forecast_accuracy CASCADE;
DROP FUNCTION IF EXISTS public.compare_forecast_models CASCADE;
DROP FUNCTION IF EXISTS public.get_best_forecast_model CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_recommendation_cache CASCADE;
DROP FUNCTION IF EXISTS public.get_cached_recommendations CASCADE;

-- 2. Drop cron jobs
SELECT cron.unschedule('refresh-mv-customer-item-interactions');
SELECT cron.unschedule('refresh-mv-forecast-accuracy');
SELECT cron.unschedule('cleanup-expired-recommendation-cache');

-- 3. Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS public.mv_customer_item_interactions CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_forecast_accuracy CASCADE;

-- 4. Drop job tracking tables
DROP TABLE IF EXISTS public.mv_customer_item_interactions_refresh_jobs CASCADE;
DROP TABLE IF EXISTS public.mv_forecast_accuracy_refresh_jobs CASCADE;

-- 5. Drop main tables
DROP TABLE IF EXISTS public.recommendation_cache CASCADE;
DROP TABLE IF EXISTS public.forecast_results CASCADE;
```

---

## 📊 EXPECTED PRODUCTION STATE AFTER MIGRATION

| Component | Count | Status |
|-----------|-------|--------|
| **Tables** | 4 | forecast_results, recommendation_cache, 2 job tracking tables |
| **Materialized Views** | 2 | mv_forecast_accuracy, mv_customer_item_interactions |
| **Cron Jobs** | 3 | 1 daily (2AM, 3AM), 1 every 6h (:30) |
| **RPC Functions** | 16 | All read-only, SECURITY DEFINER |
| **Indexes** | 18 | Optimized for query patterns |
| **RLS Policies** | 6 | Tenant isolation enforced |

---

## 🔍 MONITORING CHECKLIST (Post-Migration)

### Day 1 (First 24 hours):
- [ ] Check cron job logs at 2:00 AM (cleanup)
- [ ] Check cron job logs at 3:00 AM (forecast accuracy refresh)
- [ ] Check cron job logs at 6:30 AM/PM (customer interactions refresh)
- [ ] Verify no errors in Supabase logs

### Day 2-7:
- [ ] Monitor materialized view refresh duration
- [ ] Monitor query performance on new tables/views
- [ ] Check recommendation cache hit rates
- [ ] Verify forecast APIs returning correct data

### Week 2:
- [ ] Review forecast accuracy metrics (once actuals are populated)
- [ ] Analyze recommendation relevance scores
- [ ] Optimize indexes if needed

---

## 📞 SUPPORT

If migration fails or issues arise:

1. **Check Supabase Logs**:
   - Dashboard → Logs → Postgres Logs
   - Look for errors related to Phase 7 tables/views

2. **Check Cron Jobs**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid IN (
     SELECT jobid FROM cron.job 
     WHERE jobname LIKE '%forecast%' OR jobname LIKE '%recommendation%'
   )
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

3. **Contact Team**:
   - Technical Lead: Solution Architect
   - Documentation: `/docs/INTELLIGENCE_LAYER_PHASE_7_README.md`

---

## ✅ COMPLETION CHECKLIST

After successful migration:

- [ ] All 6 migrations applied successfully
- [ ] All verification queries passed
- [ ] database.types.ts regenerated
- [ ] No errors in Supabase logs
- [ ] Cron jobs scheduled and running
- [ ] APIs responding correctly
- [ ] Team notified of completion
- [ ] This guide archived with completion date

**Completed by**: _________________  
**Completion date**: _________________  
**Time taken**: _________________  
**Issues encountered**: _________________

---

**End of Migration Guide**
