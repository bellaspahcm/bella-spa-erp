# Task 12 Manual Testing Guide
## Service Commission Calculation on Booking Save Integration

---

## 🎯 Test Goal

Verify that service items with commission calculation are correctly created when booking is saved, and that the integration doesn't break existing booking flow.

---

## 📋 Prerequisites

### 1. Environment Setup
- ✅ Application running locally or on staging
- ✅ Database migrations applied (booking_service_items table exists)
- ✅ Beauty Spa tenant account with commission config
- ✅ Test KTV user account
- ✅ Test customer
- ✅ At least one Beauty Spa package

### 2. Database Check
```sql
-- Run in database to verify prerequisites
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  (t.settings->'commission_config'->'service_commission_default')::jsonb AS defaults
FROM tenants t
WHERE t.enabled_modules @> '["beauty_spa"]'::jsonb
LIMIT 1;
```

Expected output:
```json
{
  "tenant_id": "uuid-here",
  "tenant_name": "Bella Spa Test",
  "defaults": {
    "type": "fixed",
    "value": 150000
  }
}
```

---

## 🧪 Test Execution Steps

### **TEST 1: Baseline - Booking WITHOUT Service Items**

**Purpose:** Ensure backward compatibility

**Steps:**

1. Navigate to booking creation page: `/dashboard/bookings`
2. Click "Tạo đặt lịch mới" button
3. Fill in booking form:
   - Customer: Select existing or create new
   - Package: Select any Beauty Spa package
   - Deposit: 1,000,000 VND
   - Sessions: 10
   - **DO NOT add any service items**
4. Click "Tạo đặt lịch"

**Expected Result:**
- ✅ Success toast: "Đã tạo booking thành công"
- ✅ Redirected to booking detail page
- ✅ No service items section visible (or empty)
- ✅ No errors in browser console
- ✅ Check database:
  ```sql
  SELECT COUNT(*) FROM booking_service_items WHERE booking_id = '<new-booking-id>';
  -- Should return: 0
  ```

---

### **TEST 2: Service Items with Default Commission**

**Purpose:** Verify service items creation with default commission

**Steps:**

1. Navigate to `/dashboard/bookings`
2. Click "Tạo đặt lịch mới"
3. Fill in basic booking info (customer, package, deposit)
4. **Add service item:**
   - Click "Thêm dịch vụ" button (if available in UI)
   - OR use API/Postman to send request:

**API Request (using Postman/curl):**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json
Cookie: <your-session-cookie>

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 1000000,
  "total_sessions": 10,
  "serviceItems": [
    {
      "serviceName": "Tắm bé cơ bản",
      "packageId": "<package-uuid>",
      "quantity": 1,
      "unitPrice": 150000,
      "ktvId": "<ktv-uuid>"
    }
  ]
}
```

**Expected Result:**
- ✅ Booking created successfully
- ✅ Check server logs: "Created 1 service items with total commission: 150000 VND"
- ✅ Verify in database:
  ```sql
  SELECT 
    service_name,
    calculated_commission,
    override_commission_type,
    subtotal
  FROM booking_service_items 
  WHERE booking_id = '<new-booking-id>';
  
  -- Expected:
  -- service_name: "Tắm bé cơ bản"
  -- calculated_commission: 150000
  -- override_commission_type: NULL
  -- subtotal: 150000
  ```

---

### **TEST 3: Service Items with FIXED Override**

**Purpose:** Test fixed commission override

**API Request:**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 2000000,
  "serviceItems": [
    {
      "serviceName": "Massage bé VIP",
      "quantity": 2,
      "unitPrice": 300000,
      "ktvId": "<ktv-uuid>",
      "overrideType": "fixed",
      "overrideValue": 200000
    }
  ]
}
```

**Expected Result:**
- ✅ Booking created
- ✅ Server log: "Created 1 service items with total commission: 200000 VND"
- ✅ Database check:
  ```sql
  SELECT 
    calculated_commission,
    override_commission_type,
    override_commission_value,
    subtotal
  FROM booking_service_items 
  WHERE booking_id = '<new-booking-id>';
  
  -- Expected:
  -- calculated_commission: 200000
  -- override_commission_type: 'fixed'
  -- override_commission_value: 200000
  -- subtotal: 600000 (2 × 300000)
  ```

---

### **TEST 4: Service Items with PERCENTAGE Override**

**Purpose:** Test percentage commission override

**API Request:**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 1500000,
  "serviceItems": [
    {
      "serviceName": "Spa full body",
      "quantity": 1,
      "unitPrice": 500000,
      "ktvId": "<ktv-uuid>",
      "overrideType": "percentage",
      "overrideValue": 30
    }
  ]
}
```

**Expected Result:**
- ✅ Booking created
- ✅ Server log: "Created 1 service items with total commission: 150000 VND"
- ✅ Database verification:
  ```sql
  SELECT 
    calculated_commission,
    override_commission_type,
    override_commission_value,
    subtotal,
    -- Verify percentage calculation
    (subtotal * override_commission_value / 100) AS expected_commission
  FROM booking_service_items 
  WHERE booking_id = '<new-booking-id>';
  
  -- Expected:
  -- calculated_commission: 150000
  -- override_commission_type: 'percentage'
  -- override_commission_value: 30
  -- expected_commission: 150000 (30% of 500000)
  ```

---

### **TEST 5: Multiple Service Items (Mixed Types)**

**Purpose:** Test multiple items with different commission types

**API Request:**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 3000000,
  "serviceItems": [
    {
      "serviceName": "Item 1 - Default",
      "quantity": 1,
      "unitPrice": 200000,
      "ktvId": "<ktv-uuid>"
    },
    {
      "serviceName": "Item 2 - Fixed",
      "quantity": 2,
      "unitPrice": 300000,
      "ktvId": "<ktv-uuid>",
      "overrideType": "fixed",
      "overrideValue": 250000
    },
    {
      "serviceName": "Item 3 - Percentage",
      "quantity": 1,
      "unitPrice": 400000,
      "ktvId": "<ktv-uuid>",
      "overrideType": "percentage",
      "overrideValue": 25
    }
  ]
}
```

**Expected Result:**
- ✅ Booking created
- ✅ Server log: "Created 3 service items with total commission: 500000 VND"
  - (Assuming default is 150k: 150k + 250k + 100k = 500k)
- ✅ Database check:
  ```sql
  SELECT 
    service_name,
    calculated_commission,
    override_commission_type
  FROM booking_service_items 
  WHERE booking_id = '<new-booking-id>'
  ORDER BY service_name;
  
  -- Expected 3 rows:
  -- Item 1: commission=150000, type=NULL
  -- Item 2: commission=250000, type='fixed'
  -- Item 3: commission=100000, type='percentage'
  ```

---

### **TEST 6: Validation Errors**

**Purpose:** Verify Zod schema validation

**API Request (intentionally bad data):**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 1000000,
  "serviceItems": [
    {
      "serviceName": "",
      "quantity": -1,
      "unitPrice": -100,
      "ktvId": "not-a-valid-uuid"
    }
  ]
}
```

**Expected Result:**
- ❌ Booking creation FAILS
- ✅ Error response:
  ```json
  {
    "error": "Dữ liệu booking không hợp lệ: ...",
    "details": {
      "serviceName": ["Tên dịch vụ không được để trống"],
      "quantity": ["Số lượng phải >= 1"],
      "unitPrice": ["Đơn giá phải >= 0"],
      "ktvId": ["KTV ID phải là UUID hợp lệ"]
    }
  }
  ```

---

### **TEST 7: Error Resilience (Service Items Fail)**

**Purpose:** Verify booking succeeds even if service items fail

**Setup:**
- Use invalid KTV ID (non-existent UUID but valid format)

**API Request:**
```bash
POST http://localhost:3000/api/bookings
Content-Type: application/json

{
  "customer_id": "<customer-uuid>",
  "package_id": "<package-uuid>",
  "deposit_amount": 1000000,
  "serviceItems": [
    {
      "serviceName": "Test Item",
      "quantity": 1,
      "unitPrice": 150000,
      "ktvId": "00000000-0000-0000-0000-000000000000"
    }
  ]
}
```

**Expected Result:**
- ✅ Booking STILL created successfully (best-effort approach)
- ✅ Service items NOT created
- ✅ Server error log: "[createBooking] Service items creation failed: ..."
- ✅ No error shown to user (booking succeeds)
- ✅ User can add service items later via booking detail page

---

## 🔍 How to Check Server Logs

### Local Development (terminal):
```bash
# Watch server logs in real-time
npm run dev

# Look for lines containing:
# "[createBooking] Created X service items with total commission: Y VND"
# or
# "[createBooking] Service items creation failed: ..."
```

### Browser Console:
1. Open DevTools (F12)
2. Go to "Console" tab
3. Filter by "createBooking"

---

## 📊 Database Verification Queries

After each test, run these queries to verify results:

### Quick Check - Last Created Booking
```sql
SELECT 
  b.id AS booking_id,
  b.created_at,
  c.full_name AS customer,
  COUNT(bsi.id) AS service_items_count,
  SUM(bsi.calculated_commission) AS total_commission
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN booking_service_items bsi ON b.id = bsi.booking_id
WHERE b.created_at > NOW() - INTERVAL '1 hour'
GROUP BY b.id, b.created_at, c.full_name
ORDER BY b.created_at DESC
LIMIT 5;
```

### Detailed Service Items Check
```sql
SELECT 
  bsi.id,
  bsi.service_name,
  bsi.quantity,
  bsi.unit_price,
  bsi.subtotal,
  bsi.calculated_commission,
  bsi.override_commission_type,
  bsi.override_commission_value,
  bsi.status,
  u.full_name AS ktv_name
FROM booking_service_items bsi
LEFT JOIN users u ON bsi.ktv_id = u.id
WHERE bsi.booking_id = '<replace-with-booking-id>'
ORDER BY bsi.created_at;
```

---

## ✅ Success Criteria

All tests pass if:

1. ✅ **Backward Compatibility**: Bookings without service items work unchanged
2. ✅ **Service Items Creation**: Items created with correct commission calculations
3. ✅ **Override Logic**: Fixed and percentage overrides work correctly
4. ✅ **Multiple Items**: Multiple items with mixed types handled properly
5. ✅ **Validation**: Invalid data rejected with clear error messages
6. ✅ **Resilience**: Booking succeeds even if service items fail
7. ✅ **Database Integrity**: All foreign keys valid, calculations correct
8. ✅ **Logging**: Appropriate success/error messages logged

---

## 🐛 Troubleshooting

### Issue: Service items not created (no error)
**Check:**
- Is `serviceItems` array in request body?
- Is tenant commission config set?
- Check server logs for silent errors

### Issue: Commission calculation wrong
**Check:**
- Tenant default commission config
- Override values in request
- Run SQL audit query from test script

### Issue: TypeScript errors in console
**Check:**
- `npm run build` passed?
- Database types regenerated?
- Cast to `any` present in helper?

### Issue: Booking fails completely
**Check:**
- Validation errors in response
- Database constraints
- RLS policies for `booking_service_items` table

---

## 📝 Test Report Template

After completing tests, fill out this summary:

**Test Date:** _____________  
**Tester:** _____________  
**Environment:** _____________  
**Tenant ID:** _____________

### Test Results
- [ ] TEST 1: Baseline (no service items) - PASS / FAIL
- [ ] TEST 2: Default commission - PASS / FAIL
- [ ] TEST 3: Fixed override - PASS / FAIL
- [ ] TEST 4: Percentage override - PASS / FAIL
- [ ] TEST 5: Multiple items - PASS / FAIL
- [ ] TEST 6: Validation errors - PASS / FAIL
- [ ] TEST 7: Error resilience - PASS / FAIL

### Issues Found
1. _____________
2. _____________

### Recommendations
_____________

**Sign-off:** _____________ (Date)
