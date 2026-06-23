# Week 3 Revised Plan — Fix Week 2 Technical Debt FIRST
**Created:** 2026-06-22
**Based on:** User feedback from Week 2 review
**Priority:** Fix foundation before adding features

---

## 🎯 Management Decision

**KHÔNG** làm QR Check-in/GPS/Camera trong Week 3.

**Thay vào đó:** Hoàn thiện nền tảng Week 2 trước.

---

## 📊 Week 2 Assessment Summary

| Category | Score | Note |
|----------|-------|------|
| Architecture | 9.5/10 | Excellent structure |
| Tenant Design | 10/10 | Perfect isolation |
| Service Layer | 9/10 | Clean separation |
| Performance | 9/10 | Promise.all, cache working |
| Realtime | 9/10 | Debounce implemented |
| **Security** | **8/10** | ⚠️ Fallback có risk |
| **Error Handling** | **7/10** | ⚠️ Chưa đầy đủ |
| **Business Logic** | **7/10** | ⚠️ KTV stats sai |
| Maintainability | 9/10 | Good docs |

**Overall:** 8.8/10 → **Target: 9.4/10**

---

## ❌ 4 Technical Debts PHẢI FIX

### 1. 🔴 Deploy RPC + Remove Fallback (Security Risk)

**Current State:**
```typescript
// RPC call
const { data, error } = await supabase.rpc('rpc_mobile_today_sessions', ...);

if (error) {
  // ❌ FALLBACK TO CLIENT-SIDE FILTER
  return fetchTodaySessionsFallback(params);
}
```

**Problem:**
- Client-side filter = chuyển authorization xuống mobile
- Security risk: client có thể tamper
- Không được phép tồn tại lâu

**Solution:**
- Deploy RPC migration to staging
- Deploy RPC migration to production
- Remove fallback code completely
- Throw error if RPC fails

**Priority:** 🔴 P0 (BLOCKER)

---

### 2. 🔴 Fix KTV Stats Bug (Business Logic)

**Current State:**
```typescript
// ❌ WRONG: Count ALL spa sessions
const [totalRes] = await Promise.all([
  supabase
    .from('session_logs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('scheduled_date', today),
    // NO FILTER FOR assigned_ktv_id!
]);
```

**Problem:**
- 10 ca toàn spa → KTV A có 2 ca
- App hiển thị: "10 ca" (SAI)
- Should display: "2 ca" (ĐÚNG)

**Impact:**
- KTV mất niềm tin vào hệ thống
- Không thể pilot với KTV thật

**Solution:**
```typescript
// ✅ CORRECT: Filter by assigned_ktv_id
const [totalRes] = await Promise.all([
  supabase.rpc('rpc_ktv_dashboard_stats', {
    p_tenant_id: tenantId,
    p_ktv_id: userId,
    p_today: today,
  }),
]);
```

**Priority:** 🔴 P1 (BLOCKER for pilot)

---

### 3. 🟡 Complete Error Handling

**Current State:**
```typescript
// ❌ NO ERROR HANDLING
fetchDashboardStats({ tenantId, userId, role }).then((data) => {
  setKpi(...);
}); // If error → hook crash → blank screen
```

**Problem:**
- Service throw → hook crash
- Dashboard trắng → user bối rối

**Requirement:**
```
States needed:
- Loading
- Error (with retry)
- Offline (with cache)
- Empty (no data)
- Success
```

**Solution:**
```typescript
// ✅ COMPLETE ERROR HANDLING
const [state, setState] = useState<State>('loading');
const [error, setError] = useState<string | null>(null);

try {
  const data = await fetchDashboardStats(...);
  setState('success');
} catch (err) {
  setError(err.message);
  setState('error');
}
```

**Priority:** 🟡 P2 (Important for UX)

---

### 4. 🟢 Polish & Documentation

**Items:**
- Update AGENTS.md với lessons learned
- Document RPC deployment process
- Add error scenarios to testing guide
- Clean up TODO comments

**Priority:** 🟢 P3 (Good to have)

---

## 📅 Week 3 Revised Schedule

### Day 1: Deploy & Fix Security Risk

**Morning (2-3 hours):**
1. Review RPC migration SQL
2. Deploy to staging
3. Test thoroughly
4. Deploy to production
5. Verify RPC works

**Afternoon (2-3 hours):**
1. Remove fallback code from `fetchTodaySessions.ts`
2. Update hooks to handle RPC errors properly
3. Test error scenarios
4. Commit & push

**Deliverable:** ✅ No more client-side filtering

---

### Day 2: Fix KTV Stats Bug

**Morning (2-3 hours):**
1. Create `rpc_ktv_dashboard_stats` migration
2. Test RPC with sample data
3. Deploy to staging
4. Verify counts are correct

**Afternoon (2-3 hours):**
1. Update `fetchDashboardStats.ts` to use RPC
2. Update `useDashboardStats.ts` error handling
3. Test with multiple KTVs
4. Verify each KTV sees only their stats

**Deliverable:** ✅ KTV stats show correct numbers

---

### Day 3: Complete Error Handling

**Morning (2-3 hours):**
1. Add error state to all hooks
2. Create error UI components
3. Add retry functionality
4. Test offline scenarios

**Afternoon (2-3 hours):**
1. Update all screens with error states
2. Add loading skeletons
3. Add empty states
4. Polish UI feedback

**Deliverable:** ✅ Full error handling coverage

---

### Day 4 (Optional): Polish & Test

**If time permits:**
1. Update documentation
2. Add screenshots to docs
3. Test on real devices
4. Fix minor UI issues

**Deliverable:** ✅ Production-ready quality

---

## 🎯 Success Criteria

**Week 3 is complete when:**

### MUST HAVE (Blockers)
- [ ] RPC deployed to production
- [ ] Fallback code removed entirely
- [ ] KTV stats show correct numbers (filtered by assigned_ktv_id)
- [ ] All hooks have error handling
- [ ] Dashboard shows error states properly
- [ ] Retry button works
- [ ] Offline mode shows cached data

### SHOULD HAVE
- [ ] Loading skeletons for all async states
- [ ] Empty states for all lists
- [ ] Error logging (Sentry/etc)
- [ ] Documentation updated

### NICE TO HAVE (Deferred)
- [ ] Optimistic UI updates
- [ ] Performance monitoring
- [ ] Analytics events

---

## 📊 Expected Improvement

**Before (Week 2 end):**
- Overall: 8.8/10
- Security: 8/10 (fallback risk)
- Error Handling: 7/10 (incomplete)
- Business Logic: 7/10 (KTV stats wrong)

**After (Week 3 end):**
- Overall: **9.4/10** ⬆️
- Security: **10/10** ⬆️ (no fallback)
- Error Handling: **9/10** ⬆️ (complete)
- Business Logic: **10/10** ⬆️ (correct)

**Improvement:** +0.6 points overall

---

## 🚫 OUT OF SCOPE (Deferred to Week 4+)

**NOT doing in Week 3:**
- ❌ QR Check-in/Check-out
- ❌ GPS tracking
- ❌ Camera/Photo upload
- ❌ Push notifications
- ❌ Session actions (complete, reschedule)
- ❌ Customer profile view

**Reason:** Foundation must be solid first

**Quote from user:**
> "Nếu nền dashboard chưa ổn định:
> Check-in → Thống kê sai → KTV mất niềm tin"

---

## 🔧 Technical Details

### Issue #1 Solution: RPC Deployment

**Files to modify:**
```
supabase/migrations/20260621_mobile_rpc.sql (already exists)
apps/mobile/src/services/dashboard/fetchTodaySessions.ts (remove fallback)
apps/mobile/src/hooks/useTodaySessions.ts (handle RPC errors)
```

**Deployment steps:**
```bash
# 1. Review migration
cat supabase/migrations/20260621_mobile_rpc.sql

# 2. Deploy to staging
supabase db push --project-ref STAGING_REF

# 3. Test
npm run mobile:dev
# Verify no fallback warnings in console

# 4. Deploy to production
supabase db push --project-ref PROD_REF

# 5. Monitor logs
# Check for RPC errors
```

---

### Issue #2 Solution: KTV Stats RPC

**New migration needed:**
```sql
-- supabase/migrations/20260622_ktv_dashboard_stats.sql

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
    AND b.assigned_ktv_id = p_ktv_id;  -- ✅ FILTER HERE
$$;

GRANT EXECUTE ON FUNCTION rpc_ktv_dashboard_stats TO authenticated;
```

**Service update:**
```typescript
// apps/mobile/src/services/dashboard/fetchDashboardStats.ts

if (isTechnicianRole(role)) {
  // ✅ Use RPC with KTV filter
  const { data, error } = await supabase.rpc('rpc_ktv_dashboard_stats', {
    p_tenant_id: tenantId,
    p_ktv_id: userId,
    p_today: today,
  });

  if (error) throw new Error(error.message);

  return {
    todayTotal: data.total_sessions,
    completed: data.completed_sessions,
    remaining: data.total_sessions - data.completed_sessions,
  };
}
```

---

### Issue #3 Solution: Error Handling Pattern

**Hook pattern:**
```typescript
export function useDashboardStats(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [kpi, setKpi] = useState<KpiConfig>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchDashboardStats({ tenantId, userId, role });
      
      if (isTechnicianRole(role)) {
        setKpi({ type: 'technician', data: data as TechnicianKpiData });
      } else {
        setKpi({ type: 'admin', data: data as AdminKpiData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setKpi(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return { kpi, isLoading, error, retry: load };
}
```

**UI pattern:**
```typescript
const { kpi, isLoading, error, retry } = useDashboardStats(...);

if (isLoading) return <LoadingSkeleton />;
if (error) return <ErrorState message={error} onRetry={retry} />;
if (!kpi) return <EmptyState />;

return <KpiCards kpi={kpi} />;
```

---

## 📝 Verification Checklist

**After Week 3, verify:**

### RPC Deployment
- [ ] `rpc_mobile_today_sessions` exists in production
- [ ] Function returns correct data
- [ ] No fallback warnings in mobile console
- [ ] Fallback code removed from codebase
- [ ] Error thrown if RPC fails

### KTV Stats Fix
- [ ] `rpc_ktv_dashboard_stats` exists in production
- [ ] KTV A sees only their sessions (not all spa sessions)
- [ ] Admin sees all spa sessions
- [ ] Numbers match reality
- [ ] Test with 3+ KTVs to verify isolation

### Error Handling
- [ ] All hooks have error state
- [ ] Dashboard shows error UI when fetch fails
- [ ] Retry button works
- [ ] Offline shows cached data
- [ ] Loading states show skeleton
- [ ] Empty states show when no data

### Regression
- [ ] Web app still works
- [ ] `npm run build` passes
- [ ] `npm run test:critical` passes
- [ ] No new console errors

---

## 📚 Documentation Updates

**Files to update:**
1. `docs/mobile-app/WEEK_2_BUG_FIXES.md` — Mark issues as RESOLVED
2. `docs/mobile-app/WEEK_3_COMPLETION_REPORT.md` — New report
3. `AGENTS.md` — Add RPC deployment lessons
4. `docs/DEVELOPMENT_LOG.md` — Log Week 3 completion

---

## 💬 User Feedback Incorporated

**Quote 1:**
> "Nếu RPC fail → Client filter
> thì đang chuyển một phần authorization xuống mobile.
> Đây là thứ tôi sẽ không cho phép tồn tại lâu."

**Action:** ✅ Priority 1, Day 1 — Deploy RPC and remove fallback

---

**Quote 2:**
> "10 ca toàn spa, KTV A có 2 ca
> App hiện hiển thị 10 ca thay vì 2 ca
> Tôi xem đây là Priority P1"

**Action:** ✅ Priority 1, Day 2 — Fix KTV stats with RPC

---

**Quote 3:**
> "Tôi muốn:
> Loading, Error, Retry, Offline, Empty, Success đầy đủ."

**Action:** ✅ Day 3 — Complete all error states

---

**Quote 4:**
> "Nếu nền dashboard chưa ổn định:
> Check-in → Thống kê sai → KTV mất niềm tin"

**Action:** ✅ NO QR/GPS/Camera in Week 3 — Fix foundation first

---

## 🎖️ Expected Rating After Week 3

**User's target:** 9.4/10

**Plan to achieve:**
1. ✅ Deploy RPC (Security: 8→10)
2. ✅ Fix KTV stats (Business Logic: 7→10)
3. ✅ Complete error handling (Error Handling: 7→9)
4. ✅ Polish & test (Maintainability: 9→9.5)

**Calculation:**
- Current weighted average: 8.8/10
- After fixes: **9.4/10** ✅

---

## ✅ Definition of Done (Week 3)

**Week 3 is DONE when user confirms:**

> "Tôi đã test trên staging và production.
> 
> ✅ RPC hoạt động ổn định
> ✅ KTV stats hiển thị đúng
> ✅ Error handling đầy đủ
> ✅ Không có fallback client-side filtering
> 
> Rating: 9.4/10
> 
> Approved to proceed to Week 4 (QR Check-in)"

**Until then, Week 3 is NOT complete.**

---

## 🚀 After Week 3

**Once foundation is solid (9.4/10), then:**

**Week 4: QR Check-in/Check-out**
- Camera permissions
- QR scanner
- GPS location
- Check-in flow

**Week 5: Session Actions**
- Complete session
- Add notes
- View history

**Week 6: Advanced Features**
- Push notifications
- Offline sync
- Photo upload

---

**Created by:** Kiro AI Agent
**Based on:** User feedback from Week 2 review
**Status:** ✅ **READY FOR IMPLEMENTATION**

**Next step:** Get user approval, then start Day 1
