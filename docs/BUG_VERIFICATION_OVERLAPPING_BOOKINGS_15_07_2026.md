# Bug Verification: Overlapping Bookings Not Blocked

**Date**: July 15, 2026  
**Reporter**: User  
**Severity**: 🔴 P0 Critical  
**Status**: 🔍 Under Investigation

---

## Bug Report

**User Statement**:
> "Kiểm tra hệ thống vẫn chưa chặn booking trùng thời gian gói"

**Example**:
- Customer has "Massage Bụng" (DEPOSIT_PENDING)
- Customer has "Tắm Bé" (IN_PROGRESS)
- System allows both to exist simultaneously

---

## Code Investigation

### ✅ Conflict Check DOES Exist (Added 15/07/2026)

**Location 1**: `src/core/services/order/create-booking-action.ts` (Admin Booking)

**Blocks these statuses**:
```typescript
.in('status', ['in_progress', 'scheduled', 'confirmed'])
```

**ALLOWS**:
- `deposit_pending` (intentional - allows admin to update pending deposits)
- `inquiry` (OK - just lead capture)
- `completed` (OK - past booking)
- `cancelled` (OK - cancelled booking)

---

**Location 2**: `src/core/services/order/online-booking-action.ts` (Public Booking)

**Blocks these statuses**:
```typescript
.in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed'])
```

**MORE RESTRICTIVE**: Also blocks `deposit_pending`

---

## Root Cause Analysis

### Scenario 1: Admin Creates Overlapping Bookings ❌

**Steps**:
1. Customer has "Massage Bụng" with status `deposit_pending`
2. Admin tries to create "Tắm Bé" booking
3. Conflict check runs: `.in(['in_progress', 'scheduled', 'confirmed'])`
4. "Massage Bụng" has status `deposit_pending` → NOT in block list
5. ✅ Booking creation succeeds (WRONG!)

**Result**: System allows overlap

---

### Scenario 2: Public Booking → Correctly Blocked ✅

**Steps**:
1. Customer has "Massage Bụng" with status `deposit_pending`
2. Customer tries to book "Tắm Bé" via public form
3. Conflict check runs: `.in(['deposit_pending', 'in_progress', 'scheduled', 'confirmed'])`
4. "Massage Bụng" has status `deposit_pending` → IN block list
5. ❌ Booking creation blocked (CORRECT!)

**Result**: System correctly blocks overlap

---

## The Problem

**Admin booking intentionally allows `deposit_pending` reuse**:

From code comments (line 209):
```typescript
// Note: We still allow 'deposit_pending' to be reused 
// (handled by findPendingBookingForCustomer below)
```

**Design Intent**:
- Admin finds customer with existing `deposit_pending` booking
- Admin updates the amount/package without creating new booking
- Reuses the same booking record

**Actual Bug**:
- Admin can create NEW booking while old `deposit_pending` exists
- This creates overlapping bookings!

---

## Why This Happens

### Expected Flow (Correct):
1. Customer has Booking A (`deposit_pending`)
2. Admin wants to add more services → Updates Booking A
3. No new booking created ✅

### Actual Flow (Buggy):
1. Customer has Booking A (`deposit_pending`)
2. Admin creates Booking B (new booking)
3. Conflict check skips `deposit_pending` → Allows creation
4. Now customer has 2 bookings ❌

---

## Evidence from User Report

**User Example**:
- "Massage Bụng (DEPOSIT_PENDING)"
- "Tắm Bé (IN_PROGRESS)"

**Analysis**:
- If Massage Bụng was created first as `deposit_pending`
- Then Tắm Bé was created (not blocked because first one is `deposit_pending`)
- First booking remains in `deposit_pending`, second progresses to `in_progress`
- Result: Overlapping bookings ✅ Matches user report

---

## Solution Options

### Option 1: Strict Blocking (Recommended ✅)

**Change**: Block `deposit_pending` in admin booking too

```typescript
// BEFORE
.in('status', ['in_progress', 'scheduled', 'confirmed'])

// AFTER
.in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed'])
```

**Impact**:
- ✅ Prevents overlapping bookings
- ⚠️ Admin cannot create new booking if `deposit_pending` exists
- ✅ Forces admin to either:
  - Complete/cancel old booking first, OR
  - Update existing `deposit_pending` booking

**Trade-off**: Slightly less flexible, but much safer

---

### Option 2: Smart Reuse Logic

**Keep current blocking, but add logic**:

```typescript
// If customer has deposit_pending:
//   1. Check if it's the SAME package
//   2. If yes → Update it (reuse)
//   3. If no → Block creation (overlapping)
```

**Impact**:
- ✅ Allows reusing `deposit_pending` for same package
- ✅ Blocks creating different package while one is pending
- ⚠️ More complex logic, more edge cases

**Trade-off**: More flexible, but harder to maintain

---

### Option 3: Time-Based Conflict Check

**Add additional check**:

```typescript
// Allow multiple bookings if:
//   1. They have different scheduled dates, OR
//   2. Time slots don't overlap
```

**Impact**:
- ✅ Most flexible - allows multiple bookings at different times
- ⚠️ Requires accurate scheduling data
- ⚠️ Complex overlap detection logic

**Trade-off**: Best UX, most complex

---

## Recommendation

### ✅ Implement Option 1 (Strict Blocking) IMMEDIATELY

**Reason**:
1. Simplest fix (1 line change)
2. Eliminates the bug completely
3. Safest for production
4. Can iterate to Option 2/3 later if needed

**File to modify**:
- `src/core/services/order/create-booking-action.ts` (line ~216)

**Change**:
```typescript
// CURRENT (line 216)
.in('status', ['in_progress', 'scheduled', 'confirmed']);

// FIX
.in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed']);
```

---

## Testing Plan

### Manual Test Cases

**Test 1: Admin Cannot Create Overlapping** (NEW)
1. Create Booking A (`deposit_pending`) for Customer X
2. Try to create Booking B for Customer X via admin
3. **Expected**: ❌ Blocked with error message
4. **Verify**: No new booking created

**Test 2: Admin Must Cancel Old Booking First**
1. Create Booking A (`deposit_pending`) for Customer X
2. Cancel Booking A
3. Try to create Booking B for Customer X
4. **Expected**: ✅ Allowed (no active bookings)

**Test 3: Public Booking Still Blocked** (Regression)
1. Create Booking A (`deposit_pending`) for Customer X
2. Try to book via public form as Customer X
3. **Expected**: ❌ Blocked (should still work)

---

### Automated Test Cases

Update `src/__tests__/booking-conflict-customer-level.test.ts`:

```typescript
describe('Admin Booking Conflict Detection', () => {
  it('should block admin booking if customer has deposit_pending', async () => {
    // Given: Customer with deposit_pending booking
    mockStore.bookings.push({
      id: 'booking-1',
      customer_id: 'cust-1',
      status: 'deposit_pending',
      package_name: 'Massage Bụng',
      // ...
    });

    // When: Admin tries to create new booking
    const result = await createBooking({
      customer_id: 'cust-1',
      package_name: 'Tắm Bé',
      // ...
    });

    // Then: Should be blocked
    expect(result.error).toContain('đang có');
    expect(result.error).toContain('Massage Bụng');
    expect(mockStore.bookings.length).toBe(1); // No new booking created
  });
});
```

---

## Rollout Plan

### Phase 1: Immediate Fix (Today)
1. ✅ Apply 1-line change to `create-booking-action.ts`
2. ✅ Update error message to mention `deposit_pending`
3. ✅ Test manually (3 test cases above)
4. ✅ Deploy to production

### Phase 2: Automated Tests (Tomorrow)
1. Add test case for admin `deposit_pending` blocking
2. Update existing tests if they assume old behavior
3. Run full test suite to verify no regressions

### Phase 3: Monitor (Week 1)
1. Monitor admin complaints about "too strict"
2. Check if workflow is acceptable
3. Gather feedback for Option 2/3 implementation

---

## Acceptance Criteria

✅ **Bug is FIXED when**:
1. Admin cannot create new booking if customer has ANY active booking (including `deposit_pending`)
2. Public booking still blocks `deposit_pending` (no regression)
3. Error message clearly explains why booking was blocked
4. Admin workflow: Cancel old booking → Create new booking (2 steps, acceptable)

---

## Communication Plan

### For Admins
**Message**:
> 🔒 **Cập nhật bảo mật**: Hệ thống giờ chặn tạo booking trùng lặp nghiêm ngặt hơn.
> 
> Nếu khách hàng đã có booking đang chờ (`deposit_pending`), bạn cần:
> 1. Hoàn thành hoặc hủy booking cũ trước
> 2. Sau đó tạo booking mới
> 
> Điều này đảm bảo khách hàng không bị trùng lịch dịch vụ.

### For Customers (via hotline)
**If they call about blocked booking**:
> Để đảm bảo chất lượng dịch vụ, mỗi khách hàng chỉ được thực hiện 1 gói tại 1 thời điểm.
> 
> Quý khách vui lòng hoàn thành gói hiện tại trước khi đặt gói mới, hoặc liên hệ hotline để được hỗ trợ điều chỉnh.

---

## Status

**Current**: 🔍 Bug confirmed, solution identified  
**Next**: 🔧 Apply fix (1-line change)  
**ETA**: 5 minutes to fix, 10 minutes to test, immediate deploy

---

**Investigation By**: Kiro AI Agent  
**Date**: July 15, 2026  
**Priority**: P0 (Production bug affecting customer experience)
