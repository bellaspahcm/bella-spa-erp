# 🚨 CRITICAL BUG: Booking Conflict Detection Missing

**Date**: 15/07/2026  
**Severity**: 🔴 **CRITICAL** (P0)  
**Status**: CONFIRMED  
**Impact**: Production - Customer can create overlapping bookings  

---

## 📋 Bug Description

**Symptom**: Hệ thống cho phép tạo booking mới trùng giờ với booking đang hoạt động mà KHÔNG có cảnh báo hoặc chặn.

**Example**:
- **Booking 1**: "Massage Bụng (Lẻ)" - Status: `DEPOSIT_PENDING`
- **Booking 2**: "Tắm Bé Chuẩn Y Khoa Tại Nhà" - Status: `IN_PROGRESS`
- **User action**: Tạo booking mới cùng customer, cùng ngày
- **Expected**: ❌ Hệ thống cảnh báo: "Bạn đang có 2 gói đang thực hiện. Vui lòng hoàn thành trước khi đặt gói mới."
- **Actual**: ✅ Booking mới được tạo thành công, không có cảnh báo

---

## 🔥 Severity: CRITICAL

**Business Impact**:
1. **Operational Chaos**: KTV không biết phục vụ gói nào trước
2. **Resource Conflict**: 1 KTV không thể phục vụ 2 gói cùng lúc
3. **Customer Confusion**: Customer không biết gói nào đang active
4. **Revenue Loss**: Gói bị overlap có thể bị quên, không hoàn thành
5. **Data Integrity**: Booking status không phản ánh thực tế

**AGENTS.md Violation**:
- ❌ **Rule #2**: "Always assert side effects in tests. When testing actions that trigger side effects (e.g., booking conflict detection), you MUST query the side-effect tables and assert expected records are created/blocked."

---

## 🔍 Root Cause Analysis

### File: `src/core/services/order/online-booking-action.ts`

**Function**: `submitOnlineBooking()`

**Current Logic**:
```typescript
export async function submitOnlineBooking(formData: OnlineBookingFormData) {
  // 1. Basic validation ✅
  if (!formData.phone || !formData.name_mother || !formData.start_date) {
    return { error: '...' };
  }

  // 2. Package scope validation ✅
  const packageScopeResult = await validateBookingPackageScope(...);

  // 3. Customer lookup/create ✅
  // ...

  // 4. Create booking ✅
  const booking = await supabase.from('bookings').insert([bookingPayload]);

  // ❌ MISSING: Conflict detection with active bookings
  // ❌ MISSING: Check for overlapping bookings (same customer, same date, active status)
  
  return { success: true, bookingNumber };
}
```

**What's Missing**:
```typescript
// ❌ SHOULD HAVE THIS BEFORE STEP 4:
const activeBookings = await supabase
  .from('bookings')
  .select('id, package_name, status, start_date')
  .eq('customer_id', customerId)
  .eq('tenant_id', tenantId)
  .in('status', ['deposit_pending', 'in_progress', 'scheduled'])
  .gte('start_date', formData.start_date);  // Same or future date

if (activeBookings.data && activeBookings.data.length > 0) {
  return {
    error: `Bạn đang có ${activeBookings.data.length} gói đang thực hiện (${activeBookings.data.map(b => b.package_name).join(', ')}). Vui lòng hoàn thành trước khi đặt gói mới.`
  };
}
```

---

## 📊 Impact Analysis

### Affected User Flows
1. **Public Booking Page** (`/book`) - ✅ Affected
2. **Admin Booking Modal** (`BookingModal.tsx`) - ❓ Need to check
3. **Mobile App Booking** - ❓ Need to check

### Database State
```sql
-- Example of problematic state
SELECT 
  b.id,
  b.booking_number,
  b.package_name,
  b.status,
  b.start_date,
  c.name_mother,
  c.phone
FROM bookings b
JOIN customers c ON c.id = b.customer_id
WHERE c.phone = '0979637535'  -- Example customer
  AND b.status IN ('deposit_pending', 'in_progress', 'scheduled')
ORDER BY b.created_at DESC;

-- Expected: Max 1 active booking per customer
-- Actual: Multiple active bookings allowed (BUG)
```

**Current Production Data** (from screenshot):
```
Customer: Tiên (0979637535)
Active Bookings:
1. "Massage Bụng (Lẻ)" - Status: DEPOSIT_PENDING
2. "Tắm Bé Chuẩn Y Khoa Tại Nhà" - Status: IN_PROGRESS
3. "Massage Bầu Tại Nhà (Lẻ)" - Status: COMPLETED ✅
4. "Gói Thông Tắc Tia Sữa (Lẻ)" - Status: COMPLETED ✅
5. "Tắm Bé Chuẩn Y Khoa Tại Nhà" - Status: COMPLETED ✅

⚠️ Problem: Customer has 2 active bookings (#1 and #2)
```

---

## 💡 Solution

### Fix 1: Add Conflict Detection (CRITICAL - Deploy Immediately)

**File**: `src/core/services/order/online-booking-action.ts`

**Location**: After customer lookup/create, before booking creation

```typescript
export async function submitOnlineBooking(formData: OnlineBookingFormData): Promise<{
  success?: boolean;
  bookingNumber?: string;
  error?: string;
}> {
  'use server';

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  // ... existing validation ...

  // ... customer lookup/create ...
  
  // ✅ NEW: Conflict Detection (ADD THIS AFTER LINE 87)
  const { data: activeBookings, error: conflictCheckError } = await supabase
    .from('bookings')
    .select('id, package_name, status, start_date, booking_number')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed'])
    .gte('start_date', formData.start_date);  // Same or future date

  if (conflictCheckError) {
    console.error('[submitOnlineBooking] Conflict check error:', conflictCheckError);
    // Allow booking to proceed if conflict check fails (graceful degradation)
    // But log the error for monitoring
  }

  if (activeBookings && activeBookings.length > 0) {
    const activePackageNames = activeBookings
      .map(b => b.package_name || 'Gói không tên')
      .filter((name, index, self) => self.indexOf(name) === index)  // Unique names
      .join(', ');

    return {
      error: `❌ Bạn đang có ${activeBookings.length} gói đang thực hiện:\n\n` +
             `📦 ${activePackageNames}\n\n` +
             `Vui lòng hoàn thành hoặc hủy các gói này trước khi đặt gói mới.\n\n` +
             `💡 Nếu cần hỗ trợ, vui lòng liên hệ hotline để được tư vấn.`
    };
  }

  // ... rest of booking creation logic ...
}
```

---

### Fix 2: Database Constraint (LONG-TERM - Optional)

**Create unique constraint to prevent multiple active bookings**:

```sql
-- Migration: 20260715_add_booking_conflict_constraint.sql

-- Step 1: Clean up existing conflicts (manual intervention required)
-- Run this query to identify conflicts:
SELECT 
  customer_id,
  COUNT(*) as active_count,
  STRING_AGG(booking_number, ', ') as booking_numbers
FROM bookings
WHERE status IN ('deposit_pending', 'in_progress', 'scheduled', 'confirmed')
GROUP BY customer_id
HAVING COUNT(*) > 1;

-- Step 2: Add partial unique index (PostgreSQL)
-- This prevents multiple active bookings per customer per tenant
CREATE UNIQUE INDEX idx_bookings_one_active_per_customer 
ON bookings (customer_id, tenant_id) 
WHERE status IN ('deposit_pending', 'in_progress', 'scheduled', 'confirmed');

-- Note: This will block inserts at database level
-- Ensure application handles constraint violation gracefully
```

**⚠️ Caution**: Database constraint is aggressive. Prefer application-level check (Fix 1) for better UX.

---

### Fix 3: Add Warning UI (ENHANCEMENT)

**Show active bookings when creating new booking**:

**File**: `src/app/book/BookingPageClient.tsx`

```typescript
// Add this check after customer lookup
const checkActiveBookings = async (phone: string) => {
  const response = await fetch('/api/bookings/check-active', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  
  const { activeBookings } = await response.json();
  
  if (activeBookings && activeBookings.length > 0) {
    // Show warning modal
    setWarning({
      title: 'Thông báo: Bạn đang có gói đang thực hiện',
      message: `Chúng tôi phát hiện bạn đang có ${activeBookings.length} gói:\n\n` +
               activeBookings.map(b => `• ${b.package_name} (${b.status})`).join('\n') +
               '\n\nBạn có chắc chắn muốn đặt thêm gói mới?',
      actions: [
        { label: 'Hủy', variant: 'secondary' },
        { label: 'Vẫn đặt gói mới', variant: 'primary' }
      ]
    });
  }
};
```

---

## 🧪 Test Cases (MUST ADD)

### Test 1: Block Overlapping Active Bookings
```typescript
describe('submitOnlineBooking - Conflict Detection', () => {
  it('should block new booking if customer has active bookings', async () => {
    // Setup: Create customer with active booking
    const customer = await createTestCustomer();
    const activeBooking = await createTestBooking({
      customer_id: customer.id,
      status: 'in_progress',
      start_date: '2026-07-20',
    });

    // Action: Try to create new booking
    const result = await submitOnlineBooking({
      phone: customer.phone,
      name_mother: customer.name_mother,
      start_date: '2026-07-20',
      package_name: 'New Package',
    });

    // Assert: Should be blocked
    expect(result.success).toBeUndefined();
    expect(result.error).toContain('đang có 1 gói đang thực hiện');
    
    // Assert: No new booking created
    const bookings = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', customer.id);
    expect(bookings.data).toHaveLength(1);  // Only the original active booking
  });

  it('should allow new booking if previous bookings are completed', async () => {
    // Setup: Customer with completed booking
    const customer = await createTestCustomer();
    await createTestBooking({
      customer_id: customer.id,
      status: 'completed',
      start_date: '2026-07-15',
    });

    // Action: Create new booking
    const result = await submitOnlineBooking({
      phone: customer.phone,
      name_mother: customer.name_mother,
      start_date: '2026-07-20',
      package_name: 'New Package',
    });

    // Assert: Should succeed
    expect(result.success).toBe(true);
    expect(result.bookingNumber).toBeDefined();
  });

  it('should handle multiple active bookings gracefully', async () => {
    // Setup: Customer with 2 active bookings
    const customer = await createTestCustomer();
    await createTestBooking({ customer_id: customer.id, status: 'deposit_pending', package_name: 'Package A' });
    await createTestBooking({ customer_id: customer.id, status: 'in_progress', package_name: 'Package B' });

    // Action: Try to create 3rd booking
    const result = await submitOnlineBooking({
      phone: customer.phone,
      name_mother: customer.name_mother,
      start_date: '2026-07-20',
      package_name: 'Package C',
    });

    // Assert: Error message mentions both packages
    expect(result.error).toContain('2 gói đang thực hiện');
    expect(result.error).toContain('Package A');
    expect(result.error).toContain('Package B');
  });
});
```

---

## 📅 Deployment Plan

### Phase 1: Hotfix (IMMEDIATE - Today)
1. ✅ Apply Fix 1 (conflict detection in `submitOnlineBooking`)
2. ✅ Deploy to production
3. ✅ Monitor error logs for conflict detections
4. ✅ Verify with test booking

### Phase 2: Testing (Tomorrow)
1. ⏭️ Add test cases (Test 1, 2, 3 above)
2. ⏭️ Run full regression on booking flow
3. ⏭️ Verify conflict detection works across all booking entry points

### Phase 3: Enhancement (Next Week)
1. ⏭️ Add warning UI (Fix 3)
2. ⏭️ Consider database constraint (Fix 2) - requires data cleanup
3. ⏭️ Add admin dashboard to view conflicted bookings

---

## 🔧 Quick Fix Script (Run Now)

**File**: `src/core/services/order/online-booking-action.ts`

**Find this line** (around line 87):
```typescript
  console.log('[submitOnlineBooking] Created new lead customer:', customerId);
```

**Add this code AFTER it**:
```typescript
  // ✅ CONFLICT DETECTION (CRITICAL FIX - 15/07/2026)
  const { data: activeBookings, error: conflictCheckError } = await supabase
    .from('bookings')
    .select('id, package_name, status, start_date')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed']);

  if (conflictCheckError) {
    console.error('[submitOnlineBooking] Conflict check failed:', conflictCheckError);
  }

  if (activeBookings && activeBookings.length > 0) {
    const packageNames = activeBookings.map(b => b.package_name || 'Gói không tên').join(', ');
    return {
      error: `❌ Bạn đang có ${activeBookings.length} gói đang thực hiện: ${packageNames}. Vui lòng hoàn thành trước khi đặt gói mới.`
    };
  }
```

---

## ✅ Verification Checklist

After deploying fix:

- [ ] Test: Try creating overlapping booking → Should be blocked
- [ ] Test: Create booking after completing previous → Should succeed
- [ ] Test: Error message is clear and helpful
- [ ] Monitor: Check error logs for conflict detections
- [ ] Verify: Existing active bookings still work
- [ ] Customer: Can complete active bookings normally

---

## 📊 Monitoring

**Query to track conflict detections**:
```sql
-- Count how many times conflict detection fired (check application logs)
-- Or add a counter metric in code

-- Query active bookings per customer
SELECT 
  c.name_mother,
  c.phone,
  COUNT(*) as active_bookings_count,
  STRING_AGG(b.package_name, ', ') as packages
FROM customers c
JOIN bookings b ON b.customer_id = c.id
WHERE b.status IN ('deposit_pending', 'in_progress', 'scheduled', 'confirmed')
GROUP BY c.id, c.name_mother, c.phone
HAVING COUNT(*) > 1
ORDER BY active_bookings_count DESC;
```

---

**Priority**: 🔴 **CRITICAL (P0)**  
**Fix Time**: 15 minutes  
**Deploy**: Immediately  
**Risk**: LOW (only adds validation, does not change existing logic)  

---

**Report Created**: 15/07/2026  
**Assigned**: Development Team  
**Status**: Fix in progress
