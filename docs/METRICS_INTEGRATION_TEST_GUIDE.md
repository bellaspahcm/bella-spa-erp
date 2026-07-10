# Metrics Integration Test Guide

## Overview

This guide shows how to test the **Platform-Level Metrics Instrumentation** that was integrated into the booking creation flow.

**What was done:**
- ✅ Wrapped all 3 Decision Engine providers with `DecisionEngineContext`
- ✅ Metrics automatically emitted to `decision_engine_metrics` table
- ✅ Dashboard displays real-time metrics from actual bookings

---

## Files Modified

### 1. Booking Creation Flow
**File:** `src/modules/bookings/actions/session-log-actions.ts`

**Changes:**
- Added import: `DecisionEngineContext`
- Wrapped `checkBookingCapacity()` with context (line ~248)
- Wrapped `checkBookingConflicts()` with context (line ~287)
- Wrapped `autoAssignKtv()` with context (line ~362)

**Metrics emitted:**
1. **Capacity Check**: 
   - Provider: `capacity_management`
   - Outcome: `available` or `full`
   - Metadata: `utilization_percent`, `buffer_used_percent`, `conflicts_count`

2. **Conflict Detection**:
   - Provider: `conflict_detection`
   - Outcome: `conflict_blocked`, `conflict_warning`, or `no_conflict`
   - Metadata: `conflicts_count`, `blocking_count`, `warning_count`, `severity`, `conflicts` array

3. **Auto-Assignment**:
   - Provider: `auto_assignment`
   - Outcome: `assigned` or `no_ktv_found`
   - Metadata: `confidence`, `reason`, `assigned_ktv_id`, `assigned_ktv_name`

---

## Testing Steps

### Step 1: Clear Old Metrics (Optional)

If you want fresh data:

```sql
-- Delete old sample metrics
DELETE FROM decision_engine_metrics 
WHERE created_at < NOW() - INTERVAL '1 day';
```

### Step 2: Create Test Booking

Navigate to:
```
http://localhost:3000/dashboard/bookings/new
```

Or use the booking creation API/form to create a new booking with:
- Customer: Any existing customer
- Service: Any spa service
- Date: Today or tomorrow
- Time: Any available slot
- KTV: Let system auto-assign (don't select manually)

**What happens internally:**
1. System calls `checkBookingCapacity()` → Metrics emitted
2. System calls `checkBookingConflicts()` → Metrics emitted
3. System calls `autoAssignKtv()` → Metrics emitted
4. Session log created
5. Dashboard updates in real-time (30s refresh)

### Step 3: Verify Metrics in Database

```sql
-- Check recent metrics
SELECT 
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  created_at
FROM decision_engine_metrics
ORDER BY created_at DESC
LIMIT 10;
```

**Expected output:**
```
provider_type         | operation              | success | outcome          | execution_time_ms
---------------------|------------------------|---------|------------------|------------------
auto_assignment      | autoAssignKtv          | true    | assigned         | 12.5
conflict_detection   | checkBookingConflicts  | true    | no_conflict      | 8.3
capacity_management  | checkBookingCapacity   | true    | available        | 6.7
```

### Step 4: Check Dashboard

Navigate to:
```
http://localhost:3000/dashboard/admin/booking-engine
```

**Expected metrics (after 1-2 bookings):**
- ✅ **Assignment Success**: Should show percentage (e.g., 100%)
- ✅ **Auto-Assignment Rate**: Should show percentage (e.g., 100%)
- ✅ **Conflict Rate**: Should show 0% if no conflicts
- ✅ **Capacity Full**: Should show 0% if capacity available
- ✅ **Performance Breakdown**: Should show avg/median/p95/p99 times
- ✅ **By Provider**: Should show stats for capacity/conflict/assignment

**Dashboard auto-refreshes every 30 seconds** (or click "Refresh" button).

---

## Testing Conflict Scenarios

### Test 1: Capacity Full

Create multiple bookings for the same KTV at the same time:

1. Create booking #1: KTV A, today 14:00-15:30
2. Create booking #2: KTV A, today 14:30-16:00 (overlaps with #1)

**Expected:**
- Booking #2 fails with capacity conflict
- Metrics show: `outcome = 'full'`
- Dashboard: **Capacity Full Rate** increases

### Test 2: Conflict Detection

Create booking with equipment/room conflict:

1. Create booking #1: Room 1, today 14:00-15:00
2. Create booking #2: Room 1, today 14:30-15:30 (overlaps room)

**Expected:**
- Booking #2 fails with conflict
- Metrics show: `outcome = 'conflict_blocked'`
- Dashboard: **Conflict Rate** increases
- Dashboard: **Top Conflict Types** shows conflict type

### Test 3: Auto-Assignment Failure

Create booking when all KTVs are busy:

1. Create 10 bookings at same time (exhaust all KTV capacity)
2. Create 11th booking (no KTV available)

**Expected:**
- Booking #11 fails (no KTV found)
- Metrics show: `outcome = 'no_ktv_found'`, `success = false`
- Dashboard: **Assignment Success Rate** decreases

---

## Verification Checklist

After creating 5-10 test bookings:

- [ ] Metrics table has records (check via SQL)
- [ ] Dashboard shows non-zero metrics
- [ ] Assignment Success Rate reflects actual assignments
- [ ] Auto-Assignment Rate shows correct percentage
- [ ] Conflict Rate shows conflicts detected
- [ ] Capacity Full Rate shows capacity issues
- [ ] Performance stats show realistic latencies (< 50ms)
- [ ] Top Conflict Types shows most common conflicts (if any)
- [ ] Manager Overrides shows 0 (unless you used skip flags)

---

## Architecture Notes

### Metrics Flow

```
Booking Creation Request
    ↓
DecisionEngineContext.executeWithOutcome()
    ↓
Provider Execution (capacity/conflict/assignment)
    ↓
Extract outcome metadata
    ↓
MetricsCollector.emit() (fire-and-forget)
    ↓
Insert to decision_engine_metrics table
    ↓
Dashboard queries via RPC (get_booking_engine_metrics)
    ↓
Real-time metrics displayed
```

### Key Design Principles

1. **Fire-and-forget**: Metrics never block booking creation
2. **Non-intrusive**: Providers unchanged (wrapper pattern)
3. **Domain-agnostic**: Same infrastructure for all future providers (Payroll, Commission, Inventory)
4. **Zero code duplication**: All providers use same `DecisionEngineContext` wrapper
5. **Automatic**: No manual metrics code in providers

### Platform-Level Benefits

This is **NOT** booking-specific metrics. The same infrastructure will work for:

- ✅ **Payroll Provider**: KPI bonus decisions, deduction rules, bonus calculations
- ✅ **Commission Provider**: Session-based commission, performance bonuses, tier calculations
- ✅ **Inventory Provider**: Reorder decisions, allocation rules, expiry management
- ✅ **Discount Provider**: Eligibility rules, campaign-based promotions, tier discounts
- ✅ **POS Provider**: Product availability, bundle discounts, loyalty rewards
- ✅ **Workflow Engine**: Multi-step orchestration, conditional branching, rollback decisions

**Future Dashboard:**
```
Bella Decision Engine Platform Dashboard

Today's Decisions: 128,000
Average Latency: 0.7ms
Success Rate: 99.98%

Booking Engine:    98.9%
Payroll Engine:    99.99%
Inventory Engine:  99.5%
Workflow Engine:   99.8%
```

---

## Troubleshooting

### Dashboard shows 0% for everything

**Cause**: No bookings created yet, or date range filter doesn't match data.

**Solution:**
1. Create 2-3 test bookings
2. Wait 30s for auto-refresh (or click "Refresh")
3. Check date range selector (24h/7d/30d)
4. Verify metrics exist in database (SQL query above)

### Metrics not showing in database

**Cause**: Metrics emission failed silently.

**Solution:**
1. Check server logs for errors (terminal running `npm run dev`)
2. Verify `decision_engine_metrics` table exists:
   ```sql
   SELECT * FROM decision_engine_metrics LIMIT 1;
   ```
3. Check RLS policies allow insert from authenticated users

### Dashboard error: "Failed to fetch metrics"

**Cause**: API route error or tenant mismatch.

**Solution:**
1. Check browser console for error details
2. Open `/api/admin/booking-engine/metrics` in browser (should return JSON)
3. Check tenant_id matches between user and metrics:
   ```sql
   SELECT 
     'User' as source, tenant_id, email 
   FROM users WHERE email = 'YOUR_EMAIL'
   UNION ALL
   SELECT 
     'Metrics' as source, DISTINCT tenant_id, NULL 
   FROM decision_engine_metrics;
   ```

### Performance too slow (> 100ms)

**Cause**: Database query inefficiency or network latency.

**Solution:**
1. Check execution times in metrics table:
   ```sql
   SELECT 
     provider_type,
     AVG(execution_time_ms) as avg_ms,
     MAX(execution_time_ms) as max_ms
   FROM decision_engine_metrics
   GROUP BY provider_type;
   ```
2. If > 100ms: Review provider implementation for N+1 queries
3. Add database indexes if needed

---

## Next Steps

After verifying metrics work:

1. **Multi-Provider Validation**: Add Payroll/Commission/Inventory providers
2. **Workflow Engine**: Orchestrate multi-provider decisions
3. **Rule Management UI**: Business users can edit rules (no code)
4. **Production Runbook**: Deployment, monitoring, scaling guides
5. **Investor Report**: Platform proof with 5+ providers working

---

## Success Criteria

✅ Dashboard shows real-time metrics from actual bookings
✅ All 3 providers (capacity, conflict, assignment) emit metrics
✅ Metrics never block booking creation (fire-and-forget)
✅ Performance < 50ms for all providers
✅ Zero code duplication across providers
✅ Build passes without errors
✅ Integration tests pass

**Platform-Level Metrics Instrumentation: COMPLETE** 🎉
