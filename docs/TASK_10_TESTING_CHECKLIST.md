# Task 10: Service Items Management - Testing Checklist

**Status:** Ready for Testing  
**Feature:** Add/edit/delete service items for bookings with commission calculation  
**URL:** `/dashboard/bookings/[id]/services`

---

## 🔧 Prerequisites

### 1. Database Migrations
```bash
# Verify migrations are applied (or run them)
npm run db:migrate

# OR manually check Supabase dashboard:
# - Table: booking_service_items exists
# - Table: tenants.commission_config exists
# - Table: users.position_tier exists (optional)
```

### 2. Test Data Setup
```sql
-- Create test tenant with commission config
INSERT INTO tenants (id, name, commission_config) VALUES
  ('test-tenant-beauty-1', 'Test Beauty Spa', 
   '{"service_commission_default": {"type": "fixed", "value": 150000}}'::jsonb
  );

-- Create test customer
INSERT INTO customers (id, phone, name_mother, tenant_id) VALUES
  ('test-customer-1', '0901234567', 'Chị Test', 'test-tenant-beauty-1');

-- Create test package
INSERT INTO packages (id, name, price, tenant_id, status) VALUES
  ('test-package-1', 'Gói Massage', 500000, 'test-tenant-beauty-1', 'active');

-- Create test booking
INSERT INTO bookings (
  id, booking_number, customer_id, package_id, 
  status, tenant_id, start_date, total_sessions
) VALUES (
  'test-booking-1', 'BK-TEST-001', 'test-customer-1', 'test-package-1',
  'booked', 'test-tenant-beauty-1', '2026-06-22', 10
);

-- Create test KTV user
INSERT INTO users (id, email, full_name, role, tenant_id) VALUES
  ('test-ktv-1', 'ktv.test@example.com', 'KTV Test', 'ktv', 'test-tenant-beauty-1');
```

### 3. Enable Beauty Spa Module
```sql
-- Enable beauty_spa module for test tenant
UPDATE tenants
SET enabled_modules = '{"beauty_spa": true, "babycare": false}'::jsonb
WHERE id = 'test-tenant-beauty-1';
```

---

## ✅ Manual Testing Steps

### Test 1: Page Access & Module Isolation

**Steps:**
1. Login as admin of `test-tenant-beauty-1`
2. Navigate to `/dashboard/bookings`
3. Click on booking `BK-TEST-001`
4. Navigate to `/dashboard/bookings/test-booking-1/services`

**Expected Result:**
- ✅ Page loads successfully
- ✅ Shows "Quản lý Dịch vụ" header
- ✅ Shows customer name: "Chị Test"
- ✅ Shows package name: "Gói Massage"
- ✅ Summary cards show: 0 services, 0đ revenue, 0đ commission
- ✅ Empty state message: "Chưa có dịch vụ nào"

**Test Module Isolation:**
1. Login as admin of a **babycare tenant** (non-beauty_spa)
2. Try to access service management page

**Expected Result:**
- ✅ Shows error: "Tính năng này chỉ khả dụng cho mô-đun Beauty Spa"
- ✅ Does NOT show service management UI

---

### Test 2: Add Service Item with FIXED Commission

**Steps:**
1. Click "Thêm dịch vụ" button
2. Modal opens
3. Fill form:
   - Dịch vụ: Select "Gói Massage"
   - Số lượng: 1
   - Đơn giá: Should auto-fill 500,000đ
   - Ngày hoàn thành: Today's date
   - ID KTV: Leave blank or enter `test-ktv-1`
   - Check "Tùy chỉnh hoa hồng"
   - Loại: Fixed
   - Giá trị: 150000
4. Click "Thêm dịch vụ"

**Expected Result:**
- ✅ Modal closes
- ✅ Service appears in table
- ✅ Service name: "Gói Massage"
- ✅ Quantity: 1
- ✅ Unit price: 500,000đ
- ✅ Subtotal: 500,000đ
- ✅ Commission: 150,000đ (with "Cố định" label)
- ✅ Status: "Hoàn thành" (green badge)
- ✅ Date: Today's date
- ✅ Summary cards update:
  - Total services: 1
  - Total revenue: 500,000đ
  - Total commission: 150,000đ

**Database Verification:**
```sql
SELECT 
  service_name, 
  quantity, 
  unit_price, 
  subtotal,
  override_commission_type,
  override_commission_value,
  calculated_commission,
  status
FROM booking_service_items
WHERE booking_id = 'test-booking-1';

-- Expected:
-- service_name: "Gói Massage"
-- quantity: 1
-- unit_price: 500000
-- subtotal: 500000
-- override_commission_type: "fixed"
-- override_commission_value: 150000
-- calculated_commission: 150000
-- status: "completed"
```

---

### Test 3: Add Service Item with PERCENTAGE Commission

**Steps:**
1. Click "Thêm dịch vụ"
2. Fill form:
   - Dịch vụ: "Gói Massage" (or create another)
   - Số lượng: 2
   - Đơn giá: 300,000đ (manually change)
   - Check "Tùy chỉnh hoa hồng"
   - Loại: Phần trăm (%)
   - Giá trị: 15
3. Submit

**Expected Result:**
- ✅ Service added
- ✅ Quantity: 2
- ✅ Unit price: 300,000đ
- ✅ Subtotal: 600,000đ (2 * 300,000)
- ✅ Commission: 90,000đ (600,000 * 15%)
- ✅ Commission label: "90,000đ (10%)"
- ✅ Summary totals update correctly

---

### Test 4: Add Service WITHOUT Commission Override (Use Default)

**Steps:**
1. Click "Thêm dịch vụ"
2. Fill form:
   - Dịch vụ: "Gói Massage"
   - Số lượng: 1
   - Đơn giá: 400,000đ
   - **DO NOT** check "Tùy chỉnh hoa hồng"
3. Submit

**Expected Result:**
- ✅ Service added
- ✅ Commission: 150,000đ (uses tenant default from commission_config)
- ✅ No override label shown

**Database Verification:**
```sql
SELECT override_commission_type, override_commission_value, calculated_commission
FROM booking_service_items
WHERE booking_id = 'test-booking-1' AND unit_price = 400000;

-- Expected:
-- override_commission_type: NULL
-- override_commission_value: NULL
-- calculated_commission: 150000 (from tenant default)
```

---

### Test 5: Delete Service Item

**Steps:**
1. Click trash icon (🗑️) on any service item
2. Confirm deletion dialog

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ After confirm, service item disappears from table
- ✅ Summary totals update (decrease)
- ✅ Page refreshes automatically

**Database Verification:**
```sql
SELECT status, calculated_commission
FROM booking_service_items
WHERE id = '<deleted-service-id>';

-- Expected (soft delete):
-- status: "cancelled"
-- calculated_commission: 0
```

---

### Test 6: Empty State Display

**Steps:**
1. Delete all service items
2. Verify empty state

**Expected Result:**
- ✅ Shows message: "Chưa có dịch vụ nào. Nhấn nút 'Thêm dịch vụ' để bắt đầu."
- ✅ Summary cards show 0 for all values

---

### Test 7: Form Validation

**Test Invalid Quantity:**
1. Try to submit with quantity = 0 or empty

**Expected:**
- ✅ Form validation prevents submission
- ✅ Shows error message (HTML5 validation)

**Test Invalid Dates:**
1. Try to submit with future date (optional validation)

**Expected:**
- ✅ Should allow (completed_date can be in future)

---

### Test 8: Mobile Responsiveness

**Steps:**
1. Open page on mobile viewport (Chrome DevTools)
2. Test all CRUD operations

**Expected Result:**
- ✅ Table is scrollable horizontally
- ✅ Modal fits screen
- ✅ All buttons are tappable
- ✅ Form inputs are accessible

---

### Test 9: Multi-User Concurrency

**Steps:**
1. User A: Open service management page
2. User B: Add a service item
3. User A: Try to refresh or add another service

**Expected Result:**
- ✅ User A sees updated list after page refresh
- ✅ No duplicate entries
- ✅ No race conditions

---

### Test 10: Performance

**Steps:**
1. Add 50+ service items (use script or manual)
2. Measure page load time
3. Measure add/delete operation time

**Expected Result:**
- ✅ Page loads in < 2 seconds
- ✅ Add operation < 500ms
- ✅ Delete operation < 500ms
- ✅ Table renders smoothly (no lag)

---

## 🔐 Security Testing

### Test RLS (Row-Level Security)

**Steps:**
1. Create service item for tenant A
2. Login as admin of tenant B
3. Try to access tenant A's service management page

**Expected Result:**
- ✅ Tenant B admin cannot see tenant A's service items
- ✅ API returns 404 or empty data
- ✅ No unauthorized access

---

## 🧪 Automated Test Execution

```bash
# Run unit tests
npm run test -- service-items-actions.test.ts

# Run integration tests (if available)
npm run test:integration

# Check test coverage
npm run test:coverage
```

**Expected Coverage:**
- ✅ Line coverage: > 80%
- ✅ Branch coverage: > 70%
- ✅ Function coverage: > 90%

---

## 📊 Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page Access | ⏳ Pending | |
| Module Isolation | ⏳ Pending | |
| Add Fixed Commission | ⏳ Pending | |
| Add Percentage Commission | ⏳ Pending | |
| Add Default Commission | ⏳ Pending | |
| Delete Service | ⏳ Pending | |
| Empty State | ⏳ Pending | |
| Form Validation | ⏳ Pending | |
| Mobile Responsive | ⏳ Pending | |
| Multi-User Concurrency | ⏳ Pending | |
| Performance | ⏳ Pending | |
| RLS Security | ⏳ Pending | |

---

## 🐛 Known Issues / Limitations

1. **Edit functionality not implemented yet** - Only add/delete supported
2. **KTV dropdown not implemented** - Must manually enter KTV ID
3. **Package filter not implemented** - Shows all packages (not filtered by beauty_spa)
4. **No bulk operations** - Must delete items one by one
5. **Database types not regenerated** - Using type-safe wrappers as workaround

---

## 🔄 Post-Testing Actions

### If Tests Pass:
- ✅ Mark Task 10 as DONE in `COMMISSION_SYSTEM_REMAINING_TASKS.md`
- ✅ Update test results table above
- ✅ Proceed to Task 11 (Product Sales Management)
- ✅ Consider regenerating database types: `npm run generate-types`

### If Tests Fail:
- ❌ Document bugs in GitHub Issues
- ❌ Fix critical bugs before proceeding
- ❌ Update this checklist with workarounds
- ❌ Re-test after fixes

---

**Testing Date:** _____________________  
**Tester:** _____________________  
**Environment:** _____________________  
**Pass/Fail:** _____________________  
**Notes:**

_____________________
_____________________
_____________________
