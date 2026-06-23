# Week 3 Post-Review Action Plan
**Date:** 2026-06-22  
**Status:** 🔴 **BLOCKERS IDENTIFIED**  
**Decision:** Week 3 APPROVED but Week 4 BLOCKED until action items complete

---

## 📋 USER FEEDBACK SUMMARY

**Overall Assessment:**
> "Week 3 không tạo ra nhiều tính năng mới nhưng lại là một trong những tuần giá trị nhất của toàn bộ roadmap. Nó đã sửa ba vấn đề nguy hiểm nhất."

**Week 3 Rating:**
- Security: 10/10 ✅
- Business Logic: 10/10 ✅
- Architecture: 9.5/10 ✅
- Error Handling: 9/10 ✅
- **Production Readiness: 8.5/10** ⚠️

**Status:** `APPROVED` with conditions

---

## 🔴 3 CRITICAL GAPS IDENTIFIED

### Gap #1: Chưa có Device Testing thật

**Problem:**
```
Expo simulator ≠ iPhone thật ≠ Android thật
```

**Current State:**
- Week 2 và Week 3 đều ghi "Test on real devices: TODO"
- Chỉ test trên simulator/web
- Không verify trên thiết bị thật

**User Requirement:**
> "Trước Week 4 tôi muốn thấy:
> - iPhone thật
> - Android Samsung thật
> 
> Test: login, refresh, realtime, offline, background resume"

**Priority:** 🔴 **BLOCKER for Week 4**

---

### Gap #2: Chưa có Monitoring (Sentry)

**Problem:**
```
Production Error → Không ai biết
```

**Current State:**
- Báo cáo thừa nhận: "Error logging not yet implemented"
- Không có production error tracking
- Không có performance monitoring

**User Opinion:**
> "Tôi xem Sentry là ưu tiên cao hơn nhiều người nghĩ."

**Priority:** 🟡 **HIGH (không block Week 4 nhưng cần setup ngay)**

---

### Gap #3: Chưa có Unit Test cho Mobile

**Problem:**
```
Testing = 0/10
```

**Current State:**
- Không có unit tests cho mobile
- Không có integration tests
- Chỉ có manual testing

**User Requirement:**
> "Nếu roadmap dài tới Week 8+, thì nên bắt đầu từ Week 4-5.
> 
> Không cần nhiều. Chỉ cần test:
> - permissions
> - validators
> - services"

**Priority:** 🟡 **MEDIUM (Week 4-5)**

---

## ✅ ACTION PLAN

### Phase 1: Pre-Week 4 Blockers (2-3 days)

**MUST complete before starting Week 4 features:**

#### 1.1. Deploy RPC to Production ⏰ 2 hours
- [ ] Deploy `20260621_mobile_rpc.sql` to production
- [ ] Deploy `20260622_ktv_dashboard_stats.sql` to production
- [ ] Verify both RPCs work on production
- [ ] Monitor logs for 24 hours

**Command:**
```bash
supabase db push --project-ref PROD_REF
```

**Verification:**
```sql
-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats');
```

---

#### 1.2. Real Device Testing ⏰ 4-6 hours

**Setup:**
- [ ] Get 1 iPhone (iOS 15+)
- [ ] Get 1 Android Samsung (Android 10+)
- [ ] Install Expo Go on both devices
- [ ] Create test accounts: 1 Admin, 2 KTVs

**Test Scenarios:**

**A. Basic Flow (30 min per device):**
- [ ] Login with phone number + OTP
- [ ] Dashboard loads (KPI + sessions)
- [ ] Pull to refresh works
- [ ] Logout works

**B. KTV Stats Verification (30 min):**
- [ ] Login as KTV A
- [ ] Verify shows only assigned sessions (not all spa sessions)
- [ ] Login as KTV B
- [ ] Verify different stats
- [ ] Login as Admin
- [ ] Verify sees all sessions

**C. Realtime (30 min):**
- [ ] Open dashboard on Device A
- [ ] Create new session from web (Device B)
- [ ] Verify Device A updates within 5 seconds
- [ ] Update session status
- [ ] Verify realtime update works

**D. Offline Behavior (30 min):**
- [ ] Open dashboard (data loads)
- [ ] Turn off WiFi + cellular
- [ ] Verify cached data still shows
- [ ] Verify error message when trying to refresh
- [ ] Turn on network
- [ ] Verify data refreshes

**E. Background Resume (15 min):**
- [ ] Open dashboard
- [ ] Switch to another app for 5 minutes
- [ ] Return to Bella ERP
- [ ] Verify data still loads
- [ ] Pull to refresh
- [ ] Verify updates

**F. Error Handling (30 min):**
- [ ] Force RPC error (temporary network failure)
- [ ] Verify error UI shows
- [ ] Press retry button
- [ ] Verify data loads

**Documentation:**
- [ ] Create test report: `docs/mobile-app/DEVICE_TESTING_REPORT.md`
- [ ] Include screenshots from both devices
- [ ] Document any bugs found
- [ ] Document device specs (iOS version, Android version)

---

#### 1.3. Manual Production Pilot (2 days)

**Pilot Users:**
- [ ] 1 Admin user
- [ ] 2-3 real KTVs from Bella Spa

**Process:**
1. Deploy app to internal TestFlight/Google Play Internal Testing
2. Send install instructions to pilot users
3. Monitor usage for 2 days
4. Collect feedback via Telegram/Zalo

**Success Criteria:**
- [ ] All pilot users can login
- [ ] KTV stats show correct numbers
- [ ] No crashes reported
- [ ] No blank screens reported
- [ ] Realtime updates work

**If issues found:**
- Create hotfix branch
- Fix issues
- Re-deploy
- Re-test

---

### Phase 2: Monitoring Setup (1 day) 🟡

**Can start in parallel with Week 4, but MUST complete before Week 4 features go to production**

#### 2.1. Sentry Integration ⏰ 4 hours

**Setup:**
- [ ] Create Sentry account (if not exists)
- [ ] Create project: "bella-mobile"
- [ ] Install Sentry SDK:
  ```bash
  npm install --save @sentry/react-native --workspace=apps/mobile
  npx @sentry/wizard@latest -i reactNative
  ```

**Configuration:**
```typescript
// apps/mobile/app/_layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV || 'development',
  tracesSampleRate: 0.2, // 20% of transactions
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  beforeSend(event, hint) {
    // Filter out development errors
    if (process.env.EXPO_PUBLIC_ENV === 'development') {
      return null;
    }
    return event;
  },
});
```

**Test:**
- [ ] Trigger test error: `Sentry.captureException(new Error('Test error'))`
- [ ] Verify error appears in Sentry dashboard
- [ ] Test breadcrumbs (navigation, network requests)
- [ ] Test user context (userId, role, tenantId)

---

#### 2.2. Error Boundary ⏰ 1 hour

**Wrap app with Sentry ErrorBoundary:**
```typescript
// apps/mobile/app/_layout.tsx
import * as Sentry from '@sentry/react-native';

function RootLayout() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <View>
          <Text>Đã xảy ra lỗi</Text>
          <Text>{error.message}</Text>
          <Button title="Thử lại" onPress={resetError} />
        </View>
      )}
    >
      {/* App content */}
    </Sentry.ErrorBoundary>
  );
}
```

---

#### 2.3. Custom Error Tracking ⏰ 1 hour

**Add to existing error handling:**
```typescript
// apps/mobile/src/hooks/useDashboardStats.ts
import * as Sentry from '@sentry/react-native';

try {
  const data = await fetchDashboardStats(...);
  setKpi(data);
} catch (err) {
  // ✅ Log to Sentry
  Sentry.captureException(err, {
    contexts: {
      fetch: {
        service: 'fetchDashboardStats',
        tenantId,
        userId,
        role,
      },
    },
  });
  
  setError(err.message);
}
```

**Add performance tracking:**
```typescript
const transaction = Sentry.startTransaction({ name: 'loadDashboard' });
const span = transaction.startChild({ op: 'fetch', description: 'fetchDashboardStats' });

try {
  const data = await fetchDashboardStats(...);
  span.setStatus('ok');
} catch (err) {
  span.setStatus('unknown_error');
  throw err;
} finally {
  span.finish();
  transaction.finish();
}
```

---

### Phase 3: Unit Testing Foundation (Week 4-5) 🟢

**NOT a blocker for Week 4 features, but should start in parallel**

#### 3.1. Test Setup ⏰ 2 hours

**Install dependencies:**
```bash
npm install --save-dev jest @testing-library/react-native @testing-library/react-hooks --workspace=apps/mobile
```

**Configuration:**
```javascript
// apps/mobile/jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
```

---

#### 3.2. Start with Services ⏰ 4-6 hours

**Priority 1: Test permissions/validators**
```typescript
// apps/mobile/src/utils/__tests__/permissions.test.ts
import { isTechnicianRole } from '@bella/shared';

describe('permissions', () => {
  it('should identify KTV roles', () => {
    expect(isTechnicianRole('ktv')).toBe(true);
    expect(isTechnicianRole('ktv_lead')).toBe(true);
    expect(isTechnicianRole('admin')).toBe(false);
  });
});
```

**Priority 2: Test service functions**
```typescript
// apps/mobile/src/services/dashboard/__tests__/fetchDashboardStats.test.ts
import { fetchDashboardStats } from '../fetchDashboardStats';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  getMobileSupabase: () => ({
    rpc: jest.fn(),
  }),
}));

describe('fetchDashboardStats', () => {
  it('should fetch KTV stats via RPC', async () => {
    const mockRpc = jest.fn().mockResolvedValue({
      data: [{ total_sessions: 5, completed_sessions: 3 }],
      error: null,
    });
    
    const supabase = require('../../lib/supabase').getMobileSupabase();
    supabase.rpc = mockRpc;
    
    const result = await fetchDashboardStats({
      tenantId: 'test-tenant',
      userId: 'test-ktv',
      role: 'ktv',
    });
    
    expect(mockRpc).toHaveBeenCalledWith('rpc_ktv_dashboard_stats', {
      p_tenant_id: 'test-tenant',
      p_ktv_id: 'test-ktv',
      p_today: expect.any(String),
    });
    
    expect(result).toEqual({
      todayTotal: 5,
      completed: 3,
      remaining: 2,
    });
  });
  
  it('should throw error if RPC fails', async () => {
    const mockRpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });
    
    const supabase = require('../../lib/supabase').getMobileSupabase();
    supabase.rpc = mockRpc;
    
    await expect(
      fetchDashboardStats({
        tenantId: 'test-tenant',
        userId: 'test-ktv',
        role: 'ktv',
      })
    ).rejects.toThrow('Failed to fetch KTV stats: RPC failed');
  });
});
```

**Priority 3: Test hooks**
```typescript
// apps/mobile/src/hooks/__tests__/useDashboardStats.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useDashboardStats } from '../useDashboardStats';

jest.mock('../services/dashboard/fetchDashboardStats');

describe('useDashboardStats', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() =>
      useDashboardStats({
        tenantId: 'test-tenant',
        userId: 'test-user',
        role: 'ktv',
      })
    );
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.kpi).toBeNull();
    expect(result.current.error).toBeNull();
  });
  
  it('should return data on success', async () => {
    const mockFetch = require('../services/dashboard/fetchDashboardStats').fetchDashboardStats;
    mockFetch.mockResolvedValue({
      todayTotal: 5,
      completed: 3,
      remaining: 2,
    });
    
    const { result } = renderHook(() =>
      useDashboardStats({
        tenantId: 'test-tenant',
        userId: 'test-user',
        role: 'ktv',
      })
    );
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.kpi).toEqual({
      type: 'technician',
      data: { todayTotal: 5, completed: 3, remaining: 2 },
    });
    expect(result.current.error).toBeNull();
  });
  
  it('should return error on failure', async () => {
    const mockFetch = require('../services/dashboard/fetchDashboardStats').fetchDashboardStats;
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() =>
      useDashboardStats({
        tenantId: 'test-tenant',
        userId: 'test-user',
        role: 'ktv',
      })
    );
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.kpi).toBeNull();
    expect(result.current.error).toBe('Network error');
  });
});
```

**Test Coverage Goal:**
- Week 4-5: 30%+ coverage
- Week 6-8: 50%+ coverage
- Week 9+: 70%+ coverage

---

## 📅 REVISED TIMELINE

### Current Status: End of Week 3
- ✅ Code complete (9.4/10 quality)
- ❌ Production deployment
- ❌ Real device testing
- ❌ Monitoring setup

### Pre-Week 4 Checklist (2-3 days)
**BLOCKERS - Must complete:**
- [ ] Day 1: Deploy RPC to production
- [ ] Day 1-2: Real device testing (iPhone + Android)
- [ ] Day 2-3: Production pilot with 2-3 KTVs
- [ ] Document all test results

### Week 4 Parallel Work
**Feature development (QR Check-in) can start ONLY IF:**
- ✅ RPCs deployed to production
- ✅ Device testing complete
- ✅ KTV stats verified correct

**In parallel with Week 4 features:**
- [ ] Setup Sentry monitoring
- [ ] Start unit testing foundation
- [ ] Monitor pilot usage

---

## 🎯 UPDATED SUCCESS CRITERIA

**Week 3 → Week 4 Transition:**

### Must Have (Blockers):
- [x] Code quality 9.4/10
- [ ] **RPC deployed production** ⚠️
- [ ] **Device testing complete** ⚠️
- [ ] **KTV stats verified on devices** ⚠️

### Should Have (High Priority):
- [ ] Sentry integrated
- [ ] Error tracking working
- [ ] Performance monitoring

### Nice to Have (Start in Week 4-5):
- [ ] Unit test foundation
- [ ] 30%+ test coverage
- [ ] CI/CD with tests

---

## 💬 USER QUOTE

> "Tôi có cho phép sang Week 4 không?
> 
> Có
> 
> Nhưng với điều kiện:
> 
> Bắt buộc:
> - RPC đã deploy production
> - Manual test trên thiết bị thật
> - Verify KTV stats
> 
> → Mới sang QR/GPS"

**Status:** Conditions NOT yet met ⚠️

---

## 📊 FINAL ASSESSMENT

**Week 3 Rating (User):**
- Security: 10/10 ✅
- Business Logic: 10/10 ✅
- Architecture: 9.5/10 ✅
- Error Handling: 9/10 ✅
- Production Readiness: 8.5/10 ⚠️

**CTO Review:**
```
Week 3
STATUS: APPROVED
```

**But:**
```
Week 4
STATUS: BLOCKED until:
- Production deployment
- Device testing
- KTV stats verification
```

---

## 🚀 NEXT IMMEDIATE ACTIONS

1. **Deploy RPCs** (2 hours)
2. **Get test devices** (1 hour)
3. **Run device tests** (4-6 hours)
4. **Production pilot** (2 days)
5. **Then** start Week 4 features

**ETA to Week 4 start:** 3-4 days from now

---

**Document Created:** 2026-06-22  
**Status:** 🔴 **ACTION REQUIRED**  
**Owner:** Mobile Development Team  
**Deadline:** Before Week 4 QR feature development
