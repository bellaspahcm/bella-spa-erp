# Metrics Dashboard Verification Checklist

**Purpose**: Step-by-step guide to verify Platform Metrics Instrumentation works correctly

**Estimated Time**: 30 minutes

---

## Step 1: Find Your Tenant ID

```sql
-- Run in Supabase SQL Editor
SELECT id, name, created_at 
FROM tenants 
ORDER BY created_at DESC 
LIMIT 5;
```

**Copy the `id` value** (UUID format like `550e8400-e29b-41d4-a716-446655440000`)

---

## Step 2: Replace Tenant ID in Test Script

1. Open file: `supabase/TEST_METRICS_SAMPLE_DATA.sql`
2. Find all occurrences of `'YOUR_TENANT_ID'`
3. Replace with your actual tenant ID: `'550e8400-e29b-41d4-a716-446655440000'`
4. Save the file

**Quick Replace** (in SQL Editor):
```sql
-- At the top of the file, set variable
\set TENANT_ID '550e8400-e29b-41d4-a716-446655440000'

-- Then use :TENANT_ID in queries (PostgreSQL psql only)
-- OR manually replace all 'YOUR_TENANT_ID' strings
```

---

## Step 3: Run Sample Data Script

1. Copy entire contents of `TEST_METRICS_SAMPLE_DATA.sql`
2. Open Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
3. Paste and execute script
4. Verify success message (no errors)

**Expected Result**:
```
INSERT 0 28
-- (28 rows inserted: 9 capacity + 10 conflict + 9 assignment)
```

---

## Step 4: Verify Data Insertion

Run verification queries from the script:

### Query 1: Count by Provider Type
```sql
SELECT 
  provider_type,
  COUNT(*) AS total,
  AVG(execution_time_ms) AS avg_time,
  COUNT(*) FILTER (WHERE success = true) AS successful
FROM decision_engine_metrics
WHERE tenant_id = 'YOUR_TENANT_ID'
GROUP BY provider_type;
```

**Expected Output**:
| provider_type | total | avg_time | successful |
|---------------|-------|----------|------------|
| auto_assignment | 9 | 1.4 | 8 |
| capacity_management | 9 | 0.5 | 7 |
| conflict_detection | 10 | 0.8 | 6 |

✅ **Pass Criteria**: 3 rows, totals match above

---

### Query 2: Assignment Stats
```sql
SELECT 
  COUNT(*) AS total_assignments,
  COUNT(*) FILTER (WHERE outcome = 'assigned') AS auto_assigned,
  COUNT(*) FILTER (WHERE outcome = 'manual') AS manual_assigned,
  ROUND(AVG((metadata->>'confidence')::NUMERIC), 2) AS avg_confidence
FROM decision_engine_metrics
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND provider_type = 'auto_assignment';
```

**Expected Output**:
| total_assignments | auto_assigned | manual_assigned | avg_confidence |
|-------------------|---------------|-----------------|----------------|
| 9 | 6 | 2 | 0.86 |

✅ **Pass Criteria**: 6 auto, 2 manual, confidence ~0.85

---

### Query 3: Conflict Stats
```sql
SELECT 
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE outcome = 'no_conflicts') AS no_conflicts,
  COUNT(*) FILTER (WHERE outcome LIKE '%blocking%') AS blocking_conflicts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome LIKE '%blocking%') / COUNT(*), 1) AS blocking_rate
FROM decision_engine_metrics
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND provider_type = 'conflict_detection';
```

**Expected Output**:
| total_checks | no_conflicts | blocking_conflicts | blocking_rate |
|--------------|--------------|--------------------|--------------------|
| 10 | 5 | 3 | 30.0 |

✅ **Pass Criteria**: 10 total, 3 blocking, 30% rate

---

### Query 4: Override Stats
```sql
SELECT 
  COUNT(*) FILTER (WHERE was_capacity_skipped = true) AS capacity_skipped,
  COUNT(*) FILTER (WHERE was_conflict_skipped = true) AS conflict_skipped,
  COUNT(*) FILTER (WHERE was_assignment_skipped = true) AS assignment_skipped
FROM decision_engine_metrics
WHERE tenant_id = 'YOUR_TENANT_ID';
```

**Expected Output**:
| capacity_skipped | conflict_skipped | assignment_skipped |
|------------------|------------------|--------------------|
| 1 | 1 | 2 |

✅ **Pass Criteria**: 1, 1, 2 (total 4 overrides)

---

## Step 5: Open Dashboard

1. Start development server (if not running):
   ```bash
   npm run dev
   ```

2. Open browser: http://localhost:3000/dashboard/admin/booking-engine

3. Login with admin credentials

---

## Step 6: Verify Dashboard UI

### KPI Cards (Top Row)

**Assignment Success Rate**:
- ✅ Should show: **88.9%** (8 successful / 9 total)
- ✅ Should show: "8/9 successful" below

**Auto-Assignment Rate**:
- ✅ Should show: **66.7%** (6 auto / 9 total)
- ✅ Should show: "6 auto / 3 manual" below

**Conflict Rate**:
- ✅ Should show: **40.0%** (4 conflicts / 10 checks)
- ✅ Should show: "3 blocking / 2 warnings" below

**Capacity Full**:
- ✅ Should show: **22.2%** (2 full / 9 checks)
- ✅ Should show: "2/9 times full" below

---

### Performance Breakdown Card

**Overall Performance**:
- ✅ Average: ~0.9ms
- ✅ Median: ~0.7ms
- ✅ P95: ~2.0ms
- ✅ P99: ~2.3ms

**By Provider**:
- ✅ Capacity Management: 9 operations, ~0.5ms avg, ~0.7ms p95
- ✅ Conflict Detection: 10 operations, ~0.8ms avg, ~1.2ms p95
- ✅ Auto Assignment: 9 operations, ~1.4ms avg, ~2.3ms p95

---

### Top Conflict Types Card

Should show:
1. ✅ **customer_double_booking**: 1 occurrence, 33.3%
2. ✅ **room_unavailable**: 1 occurrence, 33.3%
3. ✅ **customer_close_bookings**: 1 occurrence, 16.7%
4. ✅ **room_turnover_time**: 1 occurrence, 16.7%

*(May vary based on JSON parsing in RPC)*

---

### Manager Overrides Card

**Override Rate**:
- ✅ Should show: **14.3%** (4 overrides / 28 total)

**Breakdown**:
- ✅ Capacity Skipped: 1
- ✅ Conflict Skipped: 1
- ✅ Assignment Skipped: 2

---

### Detail Cards (Bottom Row)

**Assignment Details**:
- ✅ Avg Confidence: 0.86
- ✅ Avg Time: 1.4ms
- ✅ P95 Time: 2.3ms
- ✅ P99 Time: 2.3ms

**Conflict Details**:
- ✅ Total Checks: 10
- ✅ Conflicts Found: 4
- ✅ Blocking Rate: 30.0%
- ✅ Avg Time: 0.8ms

**Capacity Details**:
- ✅ Avg Utilization: ~75.6%
- ✅ Avg Buffer Used: ~26.1%
- ✅ Available: 7
- ✅ Avg Time: 0.5ms

---

## Step 7: Test Auto-Refresh

1. ✅ Verify "Auto-refresh ON" button is active (green)
2. ✅ Wait 30 seconds
3. ✅ Check "Last updated" timestamp updates automatically
4. ✅ Toggle "Auto-refresh OFF" button
5. ✅ Verify auto-refresh stops

---

## Step 8: Test Date Range Selector

1. ✅ Click "24 Hours" button
2. ✅ Verify all metrics update (may show fewer records)
3. ✅ Click "7 Days" button (default)
4. ✅ Verify metrics return to original values
5. ✅ Click "30 Days" button
6. ✅ Verify metrics include all data

---

## Step 9: Test Manual Refresh

1. ✅ Click "Refresh" button
2. ✅ Verify spinning icon appears briefly
3. ✅ Verify "Last updated" timestamp updates
4. ✅ Verify metrics remain consistent

---

## Step 10: Verify Error Handling

### Simulate API Failure (optional)
1. Open browser DevTools → Network tab
2. Right-click on `/api/admin/booking-engine/metrics` request
3. Select "Block request URL"
4. Click "Refresh" button
5. ✅ Verify error alert appears with message
6. ✅ Verify "Retry" button appears
7. Unblock URL and retry
8. ✅ Verify dashboard loads successfully

---

## Troubleshooting

### Issue: Dashboard shows all zeros

**Cause**: No data or wrong tenant ID

**Fix**:
1. Re-run Query 1 to verify data exists
2. Check tenant ID matches in both:
   - SQL script (`WHERE tenant_id = '...'`)
   - User metadata (check `auth.users` table)

---

### Issue: Dashboard shows error "Failed to fetch metrics"

**Cause**: API route not working or RPC function missing

**Fix**:
1. Check RPC function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_booking_engine_metrics';
   ```
2. Check API route accessible:
   ```bash
   curl http://localhost:3000/api/admin/booking-engine/metrics?startDate=2026-07-01&endDate=2026-07-10
   ```
3. Check server logs for errors

---

### Issue: "Top Conflict Types" card is empty

**Cause**: JSON parsing issue in RPC or no conflicts with `metadata->'conflicts'` structure

**Fix**:
1. Check conflict metadata structure:
   ```sql
   SELECT metadata->'conflicts' 
   FROM decision_engine_metrics 
   WHERE provider_type = 'conflict_detection' 
   LIMIT 1;
   ```
2. Should return array: `[{"type": "...", "severity": "..."}]`

---

### Issue: Percentages don't match expected

**Cause**: Rounding differences or additional data in table

**Fix**:
1. Check total count:
   ```sql
   SELECT COUNT(*) FROM decision_engine_metrics WHERE tenant_id = 'YOUR_TENANT_ID';
   ```
2. If count > 28, clean up old data:
   ```sql
   DELETE FROM decision_engine_metrics WHERE tenant_id = 'YOUR_TENANT_ID' AND created_at < NOW() - INTERVAL '1 hour';
   ```

---

## Success Criteria Summary

✅ All SQL queries return expected results  
✅ Dashboard loads without errors  
✅ All 4 KPI cards show correct percentages  
✅ Performance breakdown shows 3 providers  
✅ Top conflict types chart displays  
✅ Manager overrides shows correct counts  
✅ Auto-refresh works (30s interval)  
✅ Date range selector updates metrics  
✅ Manual refresh button works  
✅ Error handling displays retry button  

**If all criteria pass**: Platform Metrics Instrumentation is working correctly! ✨

---

## Next: Real Booking Test

After verification with sample data, test with real booking creation:

1. Create a booking via UI or API
2. Check `decision_engine_metrics` table for 3 new records:
   - `capacity_management | checkCapacity`
   - `conflict_detection | detectConflicts`
   - `auto_assignment | assignKtv`
3. Verify metrics appear in dashboard immediately (within 30s)

**If real booking metrics appear**: End-to-end flow is working! 🎉

---

**Completion Time**: 2026-07-09  
**Status**: ✅ VERIFICATION READY  
**Estimated Duration**: 30 minutes
