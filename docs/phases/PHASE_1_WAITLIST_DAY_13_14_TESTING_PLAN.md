# Phase 1 Waitlist: Day 13-14 Integration Testing Plan

**Status:** 🚧 IN PROGRESS  
**Date:** July 9, 2026  
**Estimated Time:** 2 days (16 hours)  
**Target:** 90+ tests, 85%+ coverage

---

## 📋 TESTING STRATEGY

### Test Pyramid Approach

```
        /\
       /UI\           15 tests (Component tests)
      /----\
     / API  \         20 tests (API endpoint tests)
    /--------\
   / SERVICE  \       30 tests (Service layer tests)
  /------------\
 / NOTIFICATION \     25 tests (Notification system tests)
/________________\

Total: 90 tests minimum
```

### Testing Tools

- **Framework:** Jest (already configured)
- **Mocking:** @supabase/supabase-js (mock client)
- **Assertions:** Jest matchers
- **Coverage:** Jest --coverage
- **CI/CD:** GitHub Actions (future)

---

## 🧪 TEST SUITES

### 1. Service Layer Tests (30 tests, 3 hours)

**File:** `src/services/waitlist/__tests__/waitlist-service.test.ts`

#### 1.1. addToWaitlist() - 8 tests
- [x] Test Plan Written
- [ ] ✅ Success: Valid input creates entry with correct priority
- [ ] ✅ Success: Priority calculation matches Decision Engine
- [ ] ❌ Duplicate: Rejects duplicate active entry for same customer/service/date
- [ ] ❌ Capacity Full: Rejects when waitlist size >= 10
- [ ] ❌ Invalid Customer: Returns error if customer_id not found
- [ ] ❌ Invalid Package: Returns error if package_id not found
- [ ] ✅ Tier Mapping: Correctly maps VIP/Loyal/New customer tiers
- [ ] ✅ Position Assignment: Assigns correct position (1 for first, 2 for second, etc.)

#### 1.2. getWaitlistEntries() - 5 tests
- [ ] ✅ List All: Returns all entries for tenant
- [ ] ✅ Filter by Status: Returns only 'active' entries
- [ ] ✅ Filter by Date: Returns entries for specific date
- [ ] ✅ Pagination: Returns correct page (20 items per page)
- [ ] ✅ Sorting: Sorts by priority (high to low)

#### 1.3. processSlotAvailable() - 6 tests
- [ ] ✅ Match Score: Calculates correct match score (date 40 + time 40 + KTV 20)
- [ ] ✅ Top 3 Notification: Notifies top 3 matches only
- [ ] ✅ Status Update: Updates entry status to 'notified'
- [ ] ✅ Notification Sent: Calls sendNotification() with correct params
- [ ] ✅ Channel Selection: VIP gets Zalo, Others get SMS
- [ ] ❌ No Matches: Returns empty if no entries >= 50 match score

#### 1.4. expireOldEntries() - 4 tests
- [ ] ✅ Expire Old: Marks entries with expires_at < now as 'expired'
- [ ] ✅ Expiry Notification: Sends 'expired' notification to customer
- [ ] ✅ Count Correct: Returns correct expired_count
- [ ] ❌ No Expired: Returns 0 if all entries still valid

#### 1.5. recalculatePositions() - 3 tests
- [ ] ✅ Position Update: Recalculates positions by priority
- [ ] ✅ Tie Breaker: Earlier created_at wins if same priority
- [ ] ✅ Count Correct: Returns correct updated_count

#### 1.6. Edge Cases - 4 tests
- [ ] ❌ Null/Undefined Input: Handles null tenant_id gracefully
- [ ] ❌ Empty Waitlist: Handles empty waitlist for slot processing
- [ ] ✅ Multiple Tenants: Isolates data by tenant_id
- [ ] ❌ Database Error: Returns error if DB query fails

---

### 2. API Endpoint Tests (20 tests, 2 hours)

**File:** `src/app/api/waitlist/__tests__/waitlist-api.test.ts`

#### 2.1. POST /api/waitlist - 4 tests
- [ ] ✅ 201 Created: Valid input creates entry
- [ ] ❌ 400 Bad Request: Missing required field (customer_id)
- [ ] ❌ 401 Unauthorized: No auth token
- [ ] ❌ 409 Conflict: Duplicate entry

#### 2.2. GET /api/waitlist - 3 tests
- [ ] ✅ 200 OK: Returns list with filters
- [ ] ✅ 200 OK: Pagination works (page=2)
- [ ] ❌ 401 Unauthorized: No auth token

#### 2.3. GET /api/waitlist/:id - 3 tests
- [ ] ✅ 200 OK: Returns single entry
- [ ] ❌ 404 Not Found: Invalid entry_id
- [ ] ❌ 401 Unauthorized: No auth token

#### 2.4. PATCH /api/waitlist/:id - 3 tests
- [ ] ✅ 200 OK: Updates status
- [ ] ❌ 400 Bad Request: Invalid status value
- [ ] ❌ 404 Not Found: Invalid entry_id

#### 2.5. DELETE /api/waitlist/:id - 2 tests
- [ ] ✅ 200 OK: Soft deletes entry (status = 'cancelled')
- [ ] ❌ 404 Not Found: Invalid entry_id

#### 2.6. POST /api/waitlist/process-slot - 2 tests
- [ ] ✅ 200 OK: Processes slot and returns notified_customers
- [ ] ❌ 400 Bad Request: Missing slot details

#### 2.7. GET /api/waitlist/:id/notifications - 3 tests
- [ ] ✅ 200 OK: Returns notification logs
- [ ] ✅ 200 OK: Returns empty array if no notifications
- [ ] ❌ 400 Bad Request: Missing entryId

---

### 3. Notification Service Tests (25 tests, 2 hours)

**File:** `src/services/notifications/__tests__/notification-service.test.ts`

#### 3.1. sendNotification() - 6 tests
- [ ] ✅ Success: Sends notification via MockProvider
- [ ] ✅ Logging: Creates log in waitlist_notification_logs
- [ ] ✅ Channel Selection: VIP gets Zalo, Others get SMS
- [ ] ✅ Template Interpolation: Variables replaced correctly
- [ ] ❌ Customer Not Found: Returns error
- [ ] ❌ Template Not Found: Returns error

#### 3.2. Notification Templates - 5 tests
- [ ] ✅ Template Loading: All 20 templates load correctly
- [ ] ✅ Variable Interpolation: {{customerName}} replaced
- [ ] ✅ Vietnamese Text: No encoding issues
- [ ] ✅ HTML Email: Valid HTML format
- [ ] ✅ SMS Length: SMS templates <= 160 chars

#### 3.3. Notification Logger - 5 tests
- [ ] ✅ Log Attempt: logNotificationAttempt() inserts DB row
- [ ] ✅ Update Status: updateNotificationStatus() updates row
- [ ] ✅ Get Logs: getNotificationLogs() fetches by entry_id
- [ ] ✅ Failed Queue: getFailedNotificationsForRetry() returns failed only
- [ ] ✅ Retry Count: incrementRetryCount() increments correctly

#### 3.4. Channel Selection - 3 tests
- [ ] ✅ VIP → Zalo: selectChannel('vip') returns 'zalo'
- [ ] ✅ Loyal → SMS: selectChannel('loyal') returns 'sms'
- [ ] ✅ New → Email: selectChannel('new') returns 'email'

#### 3.5. Mock Provider - 3 tests
- [ ] ✅ Send Success: MockProvider.send() returns success
- [ ] ✅ Validation: MockProvider validates input
- [ ] ✅ Metadata: MockProvider returns messageId

#### 3.6. Retry Logic - 3 tests
- [ ] ✅ Retry Single: retryNotification() retries failed notification
- [ ] ✅ Max Retries: Does not retry if retry_count >= 3
- [ ] ✅ Retry Batch: retryFailedNotifications() retries all failed

---

### 4. UI Component Tests (15 tests, 1 hour)

**File:** `src/app/dashboard/waitlist/__tests__/waitlist-components.test.tsx`

#### 4.1. WaitlistTable - 3 tests
- [ ] ✅ Renders: Displays entries correctly
- [ ] ✅ Empty State: Shows "Chưa có khách hàng" when empty
- [ ] ✅ Actions: View/Notify/Cancel buttons work

#### 4.2. WaitlistFilters - 3 tests
- [ ] ✅ Filter by Status: Filters active/notified/expired
- [ ] ✅ Filter by Date: Date picker works
- [ ] ✅ Search: Search by customer name works

#### 4.3. AddToWaitlistModal - 3 tests
- [ ] ✅ Form Validation: Required fields validated
- [ ] ✅ Priority Preview: Shows calculated priority score
- [ ] ✅ Submit: Calls API with correct payload

#### 4.4. WaitlistDetailContent - 3 tests
- [ ] ✅ Renders: Displays entry details
- [ ] ✅ Notification History: Shows notification logs
- [ ] ✅ Actions: Status-based actions displayed correctly

#### 4.5. WaitlistStatusBadge - 3 tests
- [ ] ✅ Active: Green badge with "Đang chờ"
- [ ] ✅ Notified: Blue badge with "Đã thông báo"
- [ ] ✅ Expired: Red badge with "Hết hạn"

---

## 🎯 SUCCESS CRITERIA

### Coverage Targets

| Module | Target | Min Acceptable |
|--------|--------|----------------|
| Service Layer | 90%+ | 85% |
| API Routes | 85%+ | 80% |
| Notification Service | 90%+ | 85% |
| UI Components | 80%+ | 75% |
| **Overall** | **85%+** | **80%** |

### Quality Gates

- [ ] All tests passing (0 failures)
- [ ] No console errors in tests
- [ ] Coverage reports generated
- [ ] Test execution time < 30 seconds
- [ ] All edge cases covered

---

## 📅 TIMELINE

### Day 13: Write Tests (8 hours)

**Morning (4 hours):**
- 9:00 - 10:00: Setup test infrastructure + mock Supabase client
- 10:00 - 12:00: Write service layer tests (30 tests)
- 12:00 - 13:00: Write API endpoint tests (20 tests)

**Afternoon (4 hours):**
- 14:00 - 16:00: Write notification service tests (25 tests)
- 16:00 - 17:00: Write UI component tests (15 tests)
- 17:00 - 18:00: Run all tests, fix failures

**Deliverables:**
- 90+ tests written
- All tests passing
- Coverage report generated

---

### Day 14: Manual Testing + Bug Fixes (8 hours)

**Morning (4 hours):**
- 9:00 - 10:00: End-to-end flow testing (add → notify → expire)
- 10:00 - 11:00: Edge case testing (capacity full, duplicates, etc.)
- 11:00 - 12:00: Performance testing (load 100+ entries)
- 12:00 - 13:00: Mobile responsiveness testing

**Afternoon (4 hours):**
- 14:00 - 16:00: Bug fixes (any issues found during testing)
- 16:00 - 17:00: Documentation updates (README, testing guide)
- 17:00 - 18:00: Final verification, pilot-ready checklist

**Deliverables:**
- All bugs fixed
- Documentation updated
- Pilot-ready codebase

---

## 🛠️ TEST INFRASTRUCTURE

### Mock Supabase Client

**File:** `src/lib/__mocks__/supabase-server.ts`

```typescript
export const createClient = jest.fn(() => ({
  from: jest.fn((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
  },
}));
```

### Test Data Fixtures

**File:** `src/__tests__/fixtures/waitlist-fixtures.ts`

```typescript
export const mockCustomer = {
  id: 'customer-123',
  name_mother: 'Nguyễn Thị A',
  phone: '0901234567',
};

export const mockPackage = {
  id: 'package-123',
  name: 'Combo Mẹ & Bé Tiết Kiệm',
};

export const mockWaitlistEntry = {
  id: 'entry-123',
  tenant_id: 'tenant-123',
  customer_id: 'customer-123',
  customer_name: 'Nguyễn Thị A',
  customer_tier: 'vip',
  package_id: 'package-123',
  package_name: 'Combo Mẹ & Bé Tiết Kiệm',
  preferred_date: '2026-07-15',
  preferred_start_time: '09:00',
  priority_score: 85,
  position: 1,
  status: 'active',
};
```

---

## 🚨 KNOWN RISKS & MITIGATION

### Risk 1: Supabase Mock Complexity
**Impact:** High  
**Probability:** Medium  
**Mitigation:** Use simplified mock that returns predictable data

### Risk 2: Async Test Timing Issues
**Impact:** Medium  
**Probability:** High  
**Mitigation:** Use `await` consistently, mock timers if needed

### Risk 3: Decision Engine Integration
**Impact:** Medium  
**Probability:** Low  
**Mitigation:** Mock WaitlistManagementProvider for unit tests

### Risk 4: Test Execution Time
**Impact:** Low  
**Probability:** Medium  
**Mitigation:** Run tests in parallel, use --maxWorkers flag

---

## 📊 PROGRESS TRACKING

### Day 13 Progress (Target: 90 tests)

- [ ] Service Layer Tests: 0/30 ⏳
- [ ] API Endpoint Tests: 0/20 ⏳
- [ ] Notification Service Tests: 0/25 ⏳
- [ ] UI Component Tests: 0/15 ⏳

**Total: 0/90 (0%)**

### Day 14 Progress (Target: All bugs fixed)

- [ ] End-to-end flow testing ⏳
- [ ] Edge case testing ⏳
- [ ] Performance testing ⏳
- [ ] Mobile testing ⏳
- [ ] Bug fixes ⏳
- [ ] Documentation ⏳

---

## 📚 REFERENCE DOCUMENTS

- Jest Documentation: https://jestjs.io/docs/getting-started
- Testing Library React: https://testing-library.com/docs/react-testing-library/intro
- Supabase Testing Guide: https://supabase.com/docs/guides/testing
- Bella ERP Testing Standards: `docs/development/TESTING_STANDARDS.md`

---

## 🎓 LESSONS LEARNED (To be filled after Day 14)

### What Went Well
- TBD

### What Could Improve
- TBD

### Key Insights
- TBD

---

**Last Updated:** 2026-07-09  
**Next Update:** After Day 13 completion  
**Status:** 🚧 Day 13 in progress (writing tests)
