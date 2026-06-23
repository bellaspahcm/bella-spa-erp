# Week 2 Bug Fixes — Known Issues Resolution
**Date:** 2026-06-22
**Priority:** High (must fix before production)

---

## 🐛 KNOWN ISSUES SUMMARY

| # | Issue | Severity | ETA | Status |
|---|-------|----------|-----|--------|
| 1 | KTV Stats Query Incorrect | 🔴 High | Week 3 | ⏸️ Pending |
| 2 | Fallback Client-Side Filter | 🔴 High | Week 3 | ⏸️ Pending |
| 3 | Error Handling in Hooks | 🟡 Medium | Week 3 | ⏸️ Pending |
| 4 | Optimistic Realtime Update | 🟢 Low | Week 4-5 | 📝 Planned |

---

## 🔴 ISSUE #1: KTV Stats Query Incorrect

### Problem

**Location:** `apps/mobile/src/services/dashboard/fetchDashboardStats.ts` line 38-50

**Current behavior:**
```typescript
// KTV queries
const [totalRes, completedRes] = await Promise.all([
  supabase
    .from('session_logs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('scheduled_date', today),
    // ❌ NO FILTER for assigned_ktv_id!
  // ...
]);
```

**Impact:**
- KTV sees stats for ALL spa sessions
- Should only see stats for sessions assigned to them
- Misleading numbers (e.g., shows 50 total when KTV only has 5)

---

### Solution A: Use RPC (RECOMMENDED)

**After RPC deployed:**

```typescript
// New service: fetchKtvDashboardStats.ts
export async function fetchKtvDashboardStats(params: {
  tenantId: string;
  userId: string;
}): Promise<TechnicianKpiData> {
  const supabase = getMobileSupabase();
  const { tenantId, userId } = params;
  const today = getTodayLocal();

  // Use RPC to get KTV-specific stats
  const { data, error } = await supabase.rpc('rpc_ktv_dashboard_stats', {
    p_tenant_id: tenantId,
    p_ktv_id: userId,
    p_today: today,
  });

  if (error || !data) {
    throw new Error('Failed to fetch KTV stats');
  }

  return {
    todayTotal: data.total_sessions,
    completed: data.completed_sessions,
    remaining: data.total_sessions - data.completed_sessions,
  };
}
```

**Add new RPC to migration:**
```sql
-- Add to supabase/migrations/20260621_mobile_rpc.sql

CREATE OR REPLACE FUNCTION rpc_ktv_dashboard_stats(
  p_tenant_id UUID,
  p_ktv_id UUID,
  p_today DATE
)
RETURNS TABLE (
  total_sessions INT,
  completed_sessions INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INT AS total_sessions,
    COUNT(*) FILTER (WHERE sl.status = 'completed')::INT AS completed_sessions
  FROM session_logs sl
  JOIN bookings b ON b.id = sl.booking_id
  WHERE
    sl.tenant_id = p_tenant_id
    AND sl.scheduled_date = p_today
    AND b.assigned_ktv_id = p_ktv_id;
$$;

GRANT EXECUTE ON FUNCTION rpc_ktv_dashboard_stats TO authenticated;
```

---

### Solution B: Direct Join (Fallback)

**If RPC not available:**

```typescript
const [totalRes, completedRes] = await Promise.all([
  // Total sessions assigned to KTV
  supabase
    .from('session_logs')
    .select(`
      id,
      bookings!inner(assigned_ktv_id)
    `, { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('scheduled_date', today)
    .eq('bookings.assigned_ktv_id', userId),
  
  // Completed sessions assigned to KTV
  supabase
    .from('session_logs')
    .select(`
      id,
      bookings!inner(assigned_ktv_id)
    `, { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('scheduled_date', today)
    .eq('status', 'completed')
    .eq('bookings.assigned_ktv_id', userId),
]);
```

**Note:** `!inner` forces inner join, ensuring only sessions with assigned_ktv_id match.

---

### Testing

**Test case:**
1. Create 10 sessions total for Tenant A
2. Assign 3 sessions to KTV User X
3. Assign 7 sessions to KTV User Y
4. Login as User X
5. **Expected:** Stats show "3 total, X completed, Y remaining"
6. **Before fix:** Stats show "10 total" (incorrect)
7. **After fix:** Stats show "3 total" (correct)

---

## 🔴 ISSUE #2: Fallback Client-Side Filter

### Problem

**Location:** `apps/mobile/src/services/dashboard/fetchTodaySessions.ts` line 95-120

**Current behavior:**
```typescript
// Fallback function
.filter((s) => {
  // ❌ Client-side filter — trust client to send correct userId
  if (!isTechnicianRole(role)) return true;
  return s._ktvId === userId;
});
```

**Impact:**
- Security risk: Client can tamper userId parameter
- Performance: Fetch all sessions then filter client-side
- Not scalable: Will fetch 100+ sessions just to show 5

---

### Solution: Remove Fallback After RPC Deployed

**Step 1: Deploy RPC** (see Issue #1 solution)

**Step 2: Update service to RPC-only**

```typescript
export async function fetchTodaySessions(params: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<TodaySession[]> {
  const supabase = getMobileSupabase();
  const { tenantId, userId, role } = params;
  const today = getTodayLocal();

  const ktvId = isTechnicianRole(role) ? userId : null;

  const { data, error } = await supabase.rpc('rpc_mobile_today_sessions', {
    p_tenant_id: tenantId,
    p_today: today,
    p_ktv_id: ktvId,
  });

  if (error) {
    // ❌ REMOVE fallback, throw error instead
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return (data ?? []).map((row: RpcRow) => ({
    id: row.session_id,
    bookingId: row.booking_id,
    status: row.status,
    assignedTime: row.assigned_time,
    customerName: row.customer_name ?? 'Khách',
    babyName: row.baby_name,
    packageName: row.package_name,
    completedSessions: row.completed_sessions ?? 0,
    totalSessions: row.total_sessions ?? 0,
    ktvName: row.ktv_name,
  }));
}
```

**Step 3: Update useTodaySessions hook to handle error**

```typescript
export function useTodaySessions(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [sessions, setSessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ NEW

  const load = useCallback(async () => {
    if (!tenantId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }
    
    try {
      const data = await fetchTodaySessions({ tenantId, userId, role });
      setSessions(data);
      setError(null); // ✅ Clear error on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSessions([]); // ✅ Clear sessions on error
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId, role]);

  // ... rest of hook

  return { sessions, isLoading, error, refresh: load }; // ✅ Expose error
}
```

---

### Testing

**Test security:**
1. Login as KTV User X
2. Open DevTools → Network
3. Find RPC call to `rpc_mobile_today_sessions`
4. Note the `p_ktv_id` parameter
5. Try to modify request to use different KTV ID
6. **Expected:** Server-side filter still applies (can't see other KTV's sessions)

---

## 🟡 ISSUE #3: Error Handling in Hooks

### Problem

**Location:** Multiple hooks lack error handling

**Files affected:**
- `apps/mobile/src/hooks/useDashboardStats.ts`
- `apps/mobile/src/hooks/useTodaySessions.ts` (already fixed above)

**Current behavior:**
```typescript
fetchDashboardStats({ tenantId, userId, role }).then((data) => {
  // ✅ Success path handled
  setKpi(...);
}).catch((error) => {
  // ❌ NO error handling!
  // Hook crashes, UI shows blank
});
```

---

### Solution: Add Error State

**Update useDashboardStats:**

```typescript
export function useDashboardStats(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [kpi, setKpi] = useState<KpiConfig>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ NEW

  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null); // ✅ Clear previous error

    fetchDashboardStats({ tenantId, userId, role })
      .then((data) => {
        if (isTechnicianRole(role)) {
          setKpi({ type: 'technician', data: data as TechnicianKpiData });
        } else {
          setKpi({ type: 'admin', data: data as AdminKpiData });
        }
        setError(null);
      })
      .catch((err) => {
        // ✅ Handle error
        setError(err instanceof Error ? err.message : 'Failed to load stats');
        setKpi(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [tenantId, userId, role]);

  return { kpi, isLoading, error }; // ✅ Expose error
}
```

**Update home.tsx to show error:**

```typescript
const { kpi, isLoading, error } = useDashboardStats({
  tenantId,
  userId: user.id,
  role: user.role,
});

// In render:
{statsLoading ? (
  <Text>Đang tải...</Text>
) : error ? (
  <DashboardErrorState
    message={error}
    onRetry={() => {
      // Re-mount hook to retry
      router.replace('/home');
    }}
  />
) : kpi ? (
  // ... show KPI cards
) : null}
```

---

### Testing

**Test error recovery:**
1. Turn off WiFi/data
2. Open dashboard
3. **Expected:** Error message shown with retry button
4. Turn on WiFi/data
5. Press retry button
6. **Expected:** Dashboard loads successfully

---

## 🟢 ISSUE #4: Optimistic Realtime Update

### Problem

**Location:** `apps/mobile/src/hooks/useTodaySessions.ts` line 47-58

**Current behavior:**
```typescript
.on('postgres_changes', { ... }, () => {
  // ❌ Refetch ALL sessions on ANY change
  debounceRef.current = setTimeout(() => {
    void load(); // Full refetch
  }, 500);
})
```

**Impact:**
- With 50 KTVs working simultaneously
- Each INSERT triggers 50 refetches (request storm)
- Even with debounce, still fetches all data

---

### Solution: Optimistic Update Pattern

**Planned for Week 4-5:**

```typescript
.on('postgres_changes', { event: '*', ... }, (payload) => {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  setSessions((prev) => {
    switch (eventType) {
      case 'INSERT':
        // ✅ Append new session (if matches filter)
        if (shouldShow(newRecord)) {
          return [...prev, mapToTodaySession(newRecord)];
        }
        return prev;

      case 'UPDATE':
        // ✅ Update existing session
        return prev.map((s) =>
          s.id === newRecord.id ? mapToTodaySession(newRecord) : s
        );

      case 'DELETE':
        // ✅ Remove session
        return prev.filter((s) => s.id !== oldRecord.id);

      default:
        return prev;
    }
  });
})
```

**Benefits:**
- No refetch needed
- Instant UI update
- Scalable to 1000+ KTVs

**Complexity:**
- Need to handle filter logic client-side
- Need to handle partial data (some fields may be null in realtime payload)
- Need to handle race conditions

---

## 📋 IMPLEMENTATION CHECKLIST

### Issue #1: KTV Stats Query
- [ ] Add `rpc_ktv_dashboard_stats` to migration
- [ ] Deploy migration
- [ ] Test RPC with sample data
- [ ] Update `fetchDashboardStats.ts`
- [ ] Test with multiple KTVs
- [ ] Verify numbers are correct
- [ ] Remove TODO comment

### Issue #2: Fallback Filter
- [ ] Verify RPC `rpc_mobile_today_sessions` deployed
- [ ] Update `fetchTodaySessions.ts` to remove fallback
- [ ] Update `useTodaySessions.ts` to handle error
- [ ] Update `home.tsx` to show error state
- [ ] Test error recovery
- [ ] Test security (can't tamper userId)
- [ ] Remove fallback function code

### Issue #3: Error Handling
- [ ] Update `useDashboardStats.ts` with error state
- [ ] Update `useTodaySessions.ts` with error state (done with Issue #2)
- [ ] Update `home.tsx` to show error UI
- [ ] Test error scenarios
- [ ] Test retry functionality
- [ ] Add error logging (Sentry/etc)

### Issue #4: Optimistic Update
- [ ] Design optimistic update pattern
- [ ] Handle INSERT events
- [ ] Handle UPDATE events
- [ ] Handle DELETE events
- [ ] Test with multiple concurrent changes
- [ ] Test race conditions
- [ ] Performance test with 1000+ events

---

## 🧪 TESTING MATRIX

| Test Case | Issue #1 | Issue #2 | Issue #3 | Issue #4 |
|-----------|----------|----------|----------|----------|
| KTV sees only own stats | ✅ | - | - | - |
| Admin sees all stats | ✅ | - | - | - |
| Security: Can't tamper userId | - | ✅ | - | - |
| Error shown on network fail | - | - | ✅ | - |
| Retry button works | - | - | ✅ | - |
| Optimistic insert | - | - | - | ✅ |
| Optimistic update | - | - | - | ✅ |
| Optimistic delete | - | - | - | ✅ |
| Race condition handled | - | - | - | ✅ |
| Performance (1000+ events) | - | - | - | ✅ |

---

## ⏱️ ESTIMATED TIME

| Issue | Complexity | Time | Priority |
|-------|------------|------|----------|
| #1 KTV Stats | Medium | 1 hour | 🔴 High |
| #2 Fallback | Low | 30 min | 🔴 High |
| #3 Error Handling | Low | 30 min | 🟡 Medium |
| #4 Optimistic Update | High | 4 hours | 🟢 Low |

**Total (High Priority):** ~2 hours
**Total (All Issues):** ~6 hours

---

## 📅 SCHEDULE

**Week 3 Sprint 1 (Day 1-2):**
- Fix Issue #1 (KTV Stats)
- Fix Issue #2 (Fallback)
- Deploy to staging
- Test with real data

**Week 3 Sprint 2 (Day 3-4):**
- Fix Issue #3 (Error Handling)
- Deploy to production
- Monitor for 48 hours

**Week 4-5:**
- Implement Issue #4 (Optimistic Update)
- Performance testing
- Production rollout

---

## ✅ SUCCESS CRITERIA

**Issue #1 fixed when:**
- KTV dashboard shows only assigned session stats
- Admin dashboard shows all session stats
- Numbers match database reality
- No TODO comments left

**Issue #2 fixed when:**
- Fallback code removed entirely
- RPC used exclusively
- Security verified (can't tamper)
- Error handling works

**Issue #3 fixed when:**
- Error states shown in UI
- Retry button works
- User not stuck on blank screen
- Error logging in place

**Issue #4 fixed when:**
- No refetch on realtime events
- UI updates instantly
- Handles 1000+ events/min
- No race conditions

---

**Owner:** Mobile Team
**Reviewer:** Backend Team + QA
**Approval:** Product Manager

**Completion Target:** Week 3 (Issue #1-3), Week 4-5 (Issue #4)
