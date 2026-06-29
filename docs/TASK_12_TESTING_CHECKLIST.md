# Task 12 Testing Checklist: Service Commission on Booking Save

## Test Scope
Verify service items creation with commission calculation integrated into booking save flow.

---

## Pre-Test Setup

### 1. Database State
- [ ] Verify `booking_service_items` table exists
- [ ] Check tenant has commission config in settings
- [ ] Confirm test KTV and packages exist

### 2. Test Data Needed
- Customer ID (existing or will create new)
- Package ID (beauty_spa module)
- KTV ID (for commission assignment)
- Tenant with commission defaults

---

## Test Scenarios

### **Scenario 1: Booking WITHOUT Service Items (Backward Compatibility)**
**Goal:** Ensure existing booking flow still works

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 1000000,
  "total_sessions": 10
}
```

**Expected:**
- ✅ Booking created successfully
- ✅ No service items created
- ✅ No errors logged
- ✅ Normal booking flow completes

**SQL Verification:**
```sql
SELECT COUNT(*) FROM booking_service_items WHERE booking_id = '<new-booking-id>';
-- Expected: 0
```

---

### **Scenario 2: Booking WITH Service Items (Default Commission)**
**Goal:** Service items created with default commission calculation

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 1000000,
  "serviceItems": [
    {
      "serviceName": "Tắm bé cơ bản",
      "packageId": "package-uuid",
      "quantity": 1,
      "unitPrice": 150000,
      "ktvId": "ktv-uuid"
    }
  ]
}
```

**Expected:**
- ✅ Booking created successfully
- ✅ 1 service item created in `booking_service_items`
- ✅ `calculated_commission` = default commission (e.g., 150,000 VND)
- ✅ `status` = 'completed' (if booking status is confirmed/completed)
- ✅ `override_commission_type` = NULL
- ✅ Console log: "Created 1 service items with total commission: 150000 VND"

**SQL Verification:**
```sql
SELECT 
  service_name,
  quantity,
  unit_price,
  subtotal,
  calculated_commission,
  override_commission_type,
  override_commission_value,
  status
FROM booking_service_items 
WHERE booking_id = '<new-booking-id>';

-- Expected:
-- service_name: "Tắm bé cơ bản"
-- quantity: 1
-- unit_price: 150000
-- subtotal: 150000
-- calculated_commission: 150000 (or tenant default)
-- override_*: NULL
-- status: 'completed' or 'pending'
```

---

### **Scenario 3: Service Items with FIXED Override Commission**
**Goal:** Override commission with fixed amount

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 2000000,
  "serviceItems": [
    {
      "serviceName": "Massage bé VIP",
      "packageId": "package-uuid",
      "quantity": 2,
      "unitPrice": 300000,
      "ktvId": "ktv-uuid",
      "overrideType": "fixed",
      "overrideValue": 200000
    }
  ]
}
```

**Expected:**
- ✅ Booking created
- ✅ 1 service item created
- ✅ `calculated_commission` = 200,000 VND (overridden)
- ✅ `override_commission_type` = 'fixed'
- ✅ `override_commission_value` = 200000
- ✅ `subtotal` = 600,000 (2 × 300,000)
- ✅ Console log: "Created 1 service items with total commission: 200000 VND"

**SQL Verification:**
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
-- subtotal: 600000
```

---

### **Scenario 4: Service Items with PERCENTAGE Override Commission**
**Goal:** Override commission with percentage

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 1500000,
  "serviceItems": [
    {
      "serviceName": "Spa full body",
      "packageId": "package-uuid",
      "quantity": 1,
      "unitPrice": 500000,
      "ktvId": "ktv-uuid",
      "overrideType": "percentage",
      "overrideValue": 30
    }
  ]
}
```

**Expected:**
- ✅ Booking created
- ✅ 1 service item created
- ✅ `calculated_commission` = 150,000 (30% of 500,000)
- ✅ `override_commission_type` = 'percentage'
- ✅ `override_commission_value` = 30
- ✅ `subtotal` = 500,000

**SQL Verification:**
```sql
SELECT 
  calculated_commission,
  override_commission_type,
  override_commission_value,
  subtotal,
  unit_price
FROM booking_service_items 
WHERE booking_id = '<new-booking-id>';

-- Expected:
-- calculated_commission: 150000 (30% of 500000)
-- override_commission_type: 'percentage'
-- override_commission_value: 30
```

---

### **Scenario 5: Multiple Service Items (Mixed Override Types)**
**Goal:** Multiple items with different commission types

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 3000000,
  "serviceItems": [
    {
      "serviceName": "Item 1 - Default",
      "quantity": 1,
      "unitPrice": 200000,
      "ktvId": "ktv-uuid"
    },
    {
      "serviceName": "Item 2 - Fixed Override",
      "quantity": 2,
      "unitPrice": 300000,
      "ktvId": "ktv-uuid",
      "overrideType": "fixed",
      "overrideValue": 250000
    },
    {
      "serviceName": "Item 3 - Percentage Override",
      "quantity": 1,
      "unitPrice": 400000,
      "ktvId": "ktv-uuid",
      "overrideType": "percentage",
      "overrideValue": 25
    }
  ]
}
```

**Expected:**
- ✅ Booking created
- ✅ 3 service items created
- ✅ Item 1: commission = default (150,000 or tenant config)
- ✅ Item 2: commission = 250,000 (fixed override)
- ✅ Item 3: commission = 100,000 (25% of 400,000)
- ✅ Total commission = 500,000 (150k + 250k + 100k)
- ✅ Console log: "Created 3 service items with total commission: 500000 VND"

**SQL Verification:**
```sql
SELECT 
  service_name,
  calculated_commission,
  override_commission_type,
  override_commission_value
FROM booking_service_items 
WHERE booking_id = '<new-booking-id>'
ORDER BY service_name;

-- Expected 3 rows with correct commission calculations
```

---

### **Scenario 6: Service Items Creation Failure (Resilience Test)**
**Goal:** Verify booking still succeeds if service items fail

**Setup:**
- Temporarily break `booking_service_items` table (e.g., invalid constraint)
- Or provide invalid ktvId

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 1000000,
  "serviceItems": [
    {
      "serviceName": "Test Item",
      "quantity": 1,
      "unitPrice": 150000,
      "ktvId": "invalid-uuid-format"
    }
  ]
}
```

**Expected:**
- ✅ Booking STILL created successfully (best-effort approach)
- ✅ Service items NOT created (error logged)
- ✅ Console error: "[createBooking] Service items creation failed: ..."
- ✅ User can add service items later via booking detail page

---

### **Scenario 7: Validation Errors (Bad Input)**
**Goal:** Zod schema catches invalid service items

**Request:**
```json
{
  "customer_id": "existing-uuid",
  "package_id": "package-uuid",
  "deposit_amount": 1000000,
  "serviceItems": [
    {
      "serviceName": "",
      "quantity": -1,
      "unitPrice": -100,
      "ktvId": "not-a-uuid"
    }
  ]
}
```

**Expected:**
- ❌ Booking creation fails
- ❌ Error response: "Dữ liệu booking không hợp lệ: ..."
- ✅ Validation details include:
  - "Tên dịch vụ không được để trống"
  - "Số lượng phải >= 1"
  - "Đơn giá phải >= 0"
  - "KTV ID phải là UUID hợp lệ"

---

## Integration Points to Verify

### 1. Commission Defaults Loading
```typescript
// In create-booking-action.ts
const commissionDefaults = tenantContext.context.settings?.commission_config?.service_commission_default;
```

**Check:**
- [ ] Tenant context has commission config
- [ ] Defaults are passed to helper correctly
- [ ] Helper uses defaults when no override provided

### 2. Booking Status → Service Item Status Mapping
**Check:**
- [ ] If booking status is 'confirmed'/'completed' → service items status = 'completed'
- [ ] If booking status is 'pending' → service items status = 'pending'

### 3. Cache Revalidation
**Check:**
- [ ] After booking + service items creation, relevant paths revalidated:
  - `/dashboard/bookings`
  - `/dashboard/bookings/[id]`
  - `/dashboard/customers/[id]`
  - `/dashboard/finance`

---

## Post-Test Verification

### Database Integrity
```sql
-- All service items have valid booking_id
SELECT COUNT(*) FROM booking_service_items bsi
LEFT JOIN bookings b ON bsi.booking_id = b.id
WHERE b.id IS NULL;
-- Expected: 0

-- All service items have valid tenant_id
SELECT COUNT(*) FROM booking_service_items bsi
LEFT JOIN tenants t ON bsi.tenant_id = t.id
WHERE t.id IS NULL;
-- Expected: 0

-- All service items have non-negative commission
SELECT COUNT(*) FROM booking_service_items
WHERE calculated_commission < 0;
-- Expected: 0

-- Subtotal matches quantity × unit_price
SELECT COUNT(*) FROM booking_service_items
WHERE subtotal != (quantity * unit_price);
-- Expected: 0
```

### Logs Check
- [ ] No unhandled errors in console
- [ ] Success messages logged for successful service items creation
- [ ] Error messages logged (but not thrown) for failed service items

---

## Test Execution Log

### Environment
- **Date:** _____________
- **Tester:** _____________
- **Branch:** _____________
- **Database:** _____________
- **Tenant ID:** _____________

### Results Summary
| Scenario | Status | Notes |
|----------|--------|-------|
| 1. No service items | ⬜ | |
| 2. Default commission | ⬜ | |
| 3. Fixed override | ⬜ | |
| 4. Percentage override | ⬜ | |
| 5. Multiple items | ⬜ | |
| 6. Failure resilience | ⬜ | |
| 7. Validation errors | ⬜ | |

### Issues Found
1. _____________
2. _____________

### Sign-off
- [ ] All tests passed
- [ ] Documentation updated
- [ ] Ready for production

**Tester Signature:** _____________
**Date:** _____________
