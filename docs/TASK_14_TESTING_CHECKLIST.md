# Task 14 Testing Checklist
## Product Sales Form/Modal

---

## ✅ Build Verification

- [x] **TypeScript compilation:** 0 errors ✅
- [x] **All pages generated:** 75/75 routes built successfully ✅
- [x] **Build time:** ~40s (TypeScript) + ~1.4s (page data) ✅

---

## 📋 Prerequisites

**Before testing this feature, you MUST:**

1. **Run database migration:**
   ```sql
   -- Run migration file:
   supabase/migrations/20260622164000_create_product_sales.sql
   ```

2. **Uncomment server actions:**
   - File: `src/modules/product-sales/actions/product-sales-actions.ts`
   - Uncomment the implementation code in:
     - `createProductSale()`
     - `updateProductSale()`
     - `deleteProductSale()`
     - `getProductSales()`
     - `getProductSaleById()`

3. **Regenerate database types:**
   ```bash
   npm run types:generate
   ```

4. **Update ProductSalesInsert type:**
   - Replace inline type definition with:
     ```typescript
     type ProductSalesInsert = Database['public']['Tables']['product_sales']['Insert'];
     ```

---

## 📋 Manual Testing Scenarios

### **Scenario 1: Open Modal (Empty Form)**

**Steps:**
1. Navigate to a page with ProductSaleModal component
2. Click "Record Product Sale" button

**Expected Result:**
- ✅ Modal opens with smooth animation (scale + fade)
- ✅ Header displays: "Ghi nhận bán hàng" with ShoppingCart icon
- ✅ Form has 5 sections:
  1. Người bán & Khách hàng
  2. Thông tin sản phẩm
  3. Cài đặt hoa hồng
  4. Thanh toán
  5. Ghi chú
- ✅ All fields reset to defaults:
  - Quantity: 1
  - Payment Method: "Tiền mặt"
  - Sale Date: Today
  - Commission override: Disabled

---

### **Scenario 2: Fill Required Fields Only**

**Test Data:** 
- KTV: Any from list
- Product Name: "Sữa tắm Dove"
- Quantity: 2
- Unit Price: 150,000đ

**Expected Behavior:**
- ✅ Total Sales Amount: **300,000đ** (auto-calculated, displayed in emerald box)
- ✅ Commission Preview: **30,000đ** (10% default, displayed below override section)
- ✅ Preview text: "Đang sử dụng mặc định hệ thống (10%)."
- ✅ Submit button enabled
- ✅ Success toast: "Chức năng này sẽ khả dụng sau khi chạy migration." (before migration)
- ✅ Modal closes after successful save
- ✅ Form resets

---

### **Scenario 3: Fill All Optional Fields**

**Test Data:**
- Customer: Select from list
- Product Category: "Mỹ phẩm"
- Product SKU: "DOVE-001"
- Notes: "Khách hàng mua 2 chai khuyến mãi"

**Expected Result:**
- ✅ All fields saved successfully
- ✅ Optional fields stored in database (after migration)
- ✅ Can view saved record with all data

---

### **Scenario 4: Commission Override - Fixed Amount**

**Steps:**
1. Fill required fields (Quantity: 1, Unit Price: 1,000,000đ)
2. Check "Tùy chỉnh hoa hồng" checkbox
3. Select "Cố định (đ)"
4. Enter value: 200,000

**Expected Result:**
- ✅ Override section expands with smooth animation
- ✅ Two fields appear: Type dropdown + Value input
- ✅ Value input shows "đ" suffix
- ✅ Commission Preview: **200,000đ**
- ✅ Preview text: "Đang sử dụng cài đặt tùy chỉnh."
- ✅ Helper text: "Hoa hồng cố định: Nhân viên nhận số tiền cố định..."

---

### **Scenario 5: Commission Override - Percentage**

**Steps:**
1. Fill required fields (Quantity: 1, Unit Price: 1,000,000đ)
2. Enable commission override
3. Select "Phần trăm (%)"
4. Enter value: 15

**Expected Result:**
- ✅ Value input shows "%" suffix
- ✅ Commission Preview: **150,000đ** (15% of 1M)
- ✅ Preview text: "Đang sử dụng cài đặt tùy chỉnh."
- ✅ Helper text: "Hoa hồng phần trăm: Nhân viên nhận % của tổng giá trị..."

---

### **Scenario 6: Commission Override - Percentage > 100%**

**Steps:**
1. Enable override, select "Phần trăm (%)"
2. Enter value: 150

**Expected Result:**
- ✅ Warning displayed: "⚠️ Tỷ lệ hoa hồng vượt quá 100%"
- ✅ Warning color: Amber
- ✅ Commission still calculated (clamped to 100% in business logic)

---

### **Scenario 7: Dynamic Total Calculation**

**Steps:**
1. Enter Quantity: 2
2. Enter Unit Price: 250,000đ
3. Change Quantity to 5
4. Change Unit Price to 100,000đ

**Expected Result:**
- ✅ After step 2: Total = **500,000đ**, Commission = **50,000đ**
- ✅ After step 3: Total = **1,250,000đ**, Commission = **125,000đ**
- ✅ After step 4: Total = **500,000đ**, Commission = **50,000đ**
- ✅ All updates instant (no lag)

---

### **Scenario 8: Payment Methods**

**Test Data:** Try all 5 payment methods

**Expected Options:**
- ✅ Tiền mặt (cash) - Default
- ✅ Chuyển khoản (bank_transfer)
- ✅ ZaloPay (zalo_pay)
- ✅ MoMo (momo)
- ✅ Thẻ (card)

---

### **Scenario 9: Sale Date Picker**

**Steps:**
1. Click on sale date input
2. Select a past date (e.g., 1 month ago)
3. Select a future date

**Expected Result:**
- ✅ Date picker opens (browser native)
- ✅ Past dates allowed
- ✅ Future dates allowed (no validation, user decides)
- ✅ Default value: Today's date

---

### **Scenario 10: Form Validation - Missing Required Fields**

**Steps:**
1. Leave KTV selector empty
2. Click "Lưu bán hàng"

**Expected Result:**
- ✅ Submit button disabled (greyed out)
- ✅ Tooltip on hover: "Vui lòng chọn KTV"

**Steps:**
1. Select KTV
2. Leave Product Name empty
3. Click "Lưu bán hàng"

**Expected Result:**
- ✅ Submit button disabled
- ✅ Browser validation: "Please fill out this field"

---

### **Scenario 11: Error Handling**

**Steps:**
1. Fill all required fields
2. Submit (before migration)

**Expected Result:**
- ✅ Error alert appears at top of form
- ✅ Alert color: Red
- ✅ Message: "Chức năng này sẽ khả dụng sau khi chạy migration. Table product_sales chưa tồn tại."
- ✅ Form does NOT close
- ✅ User can fix and retry

---

### **Scenario 12: Close Modal**

**Steps:**
1. Fill some fields (don't submit)
2. Click X button (top-right)

**Expected Result:**
- ✅ Modal closes immediately
- ✅ Smooth fade-out animation
- ✅ Form data preserved (not reset until successful save)

**Steps:**
1. Fill some fields
2. Click outside modal (backdrop)

**Expected Result:**
- ✅ Modal does NOT close (requires explicit X or Cancel button)

---

### **Scenario 13: Cancel Button**

**Steps:**
1. Fill some fields
2. Click "Hủy" button

**Expected Result:**
- ✅ Modal closes immediately
- ✅ Form data preserved

---

### **Scenario 14: Disabled State (Submitting)**

**Steps:**
1. Fill required fields
2. Click "Lưu bán hàng"
3. Observe UI during submission

**Expected Result:**
- ✅ Submit button shows loading spinner
- ✅ Button text: "Đang lưu..."
- ✅ All inputs disabled (greyed out)
- ✅ X button disabled
- ✅ Cancel button disabled

---

### **Scenario 15: Responsive Design - Mobile**

**Test on:** 375px width (iPhone SE)

**Expected Layout:**
- ✅ Modal: Full screen with rounded top corners
- ✅ Sections stack vertically
- ✅ Grid fields: 1 column on mobile
- ✅ All text readable (no overflow)
- ✅ Buttons full-width and stacked
- ✅ Scroll works smoothly

---

### **Scenario 16: Responsive Design - Tablet**

**Test on:** 768px width (iPad)

**Expected Layout:**
- ✅ Modal: Centered with max-width (3xl)
- ✅ Grid fields: 2 columns (md:grid-cols-2)
- ✅ Buttons side-by-side (50% each)

---

### **Scenario 17: Responsive Design - Desktop**

**Test on:** 1920px width

**Expected Layout:**
- ✅ Modal: Centered with max-width (3xl)
- ✅ All layouts as designed
- ✅ No excessive white space

---

## 🎨 Visual Consistency Checklist

### Color Scheme (Emerald Theme)
- ✅ Icon background: `bg-emerald-100`
- ✅ Icon color: `text-emerald-600`
- ✅ Section titles: `text-emerald-600`
- ✅ Total sales box: `bg-emerald-50 border-emerald-200`
- ✅ Commission preview: `bg-emerald-50 border-emerald-200`
- ✅ Submit button: `bg-emerald-600 hover:bg-emerald-700`

### Typography
- ✅ Modal title: `text-lg font-bold`
- ✅ Section headers: `text-xs font-black uppercase tracking-widest`
- ✅ Labels: `text-sm font-bold text-slate-700`
- ✅ Required asterisk: `text-red-500`
- ✅ Optional text: `text-slate-400 font-normal`

### Spacing & Borders
- ✅ Modal rounded corners: `rounded-[24px]`
- ✅ Padding: `p-6` for content, `px-6 py-4` for header
- ✅ Gap between sections: `space-y-6`
- ✅ Input border radius: `rounded-lg`

---

## ♿ Accessibility Testing

### ARIA Labels
- ✅ X button: `aria-label="Đóng"`
- ✅ KTV selector: Label associated with input
- ✅ All form fields have labels

### Keyboard Navigation
- ✅ Tab order logical (top to bottom, left to right)
- ✅ Submit on Enter key (from any input)
- ✅ Escape key closes modal

### Screen Reader
- ✅ Form sections announced
- ✅ Required fields announced
- ✅ Error messages announced
- ✅ Loading state announced

---

## 🐛 Edge Cases to Test

### **Edge Case 1: Very Long Product Name**
- Input: 200+ characters
- ✅ Text wraps properly (break-words)
- ✅ No overflow outside input

### **Edge Case 2: Very Large Quantity**
- Input: 9999.99
- ✅ Calculation correct
- ✅ Number formatted with separators

### **Edge Case 3: Very Large Unit Price**
- Input: 10,000,000,000đ (10 billion)
- ✅ Formatted correctly
- ✅ Total calculated correctly
- ✅ No number overflow

### **Edge Case 4: Decimal Quantity**
- Input: 2.5
- ✅ Accepted (product_sales.quantity is NUMERIC(10,2))
- ✅ Total calculated correctly

### **Edge Case 5: Zero Unit Price**
- Input: 0đ
- ✅ Accepted (valid for promotions/gifts)
- ✅ Commission: 0đ

### **Edge Case 6: Empty Customer List**
- ✅ Dropdown shows "-- Chọn khách hàng --"
- ✅ Can submit without customer (optional field)

### **Edge Case 7: Empty KTV List**
- ✅ Form unusable (KTV required)
- ✅ Show error message to admin

---

## 🔗 Integration Points

### With Commission Business Logic
- ✅ Uses `calculateProductSalesCommission` from `@/lib/business-rules/commission`
- ✅ Priority: override > default > system default (10%)
- ✅ Fixed amount: Returns value directly
- ✅ Percentage: Calculates % of total sales

### With Database (After Migration)
- ✅ Inserts into `product_sales` table
- ✅ Tenant ID filtering applied (RLS policies)
- ✅ All columns mapped correctly
- ✅ Status defaults to 'completed'

### With Validation Schema
- ✅ Uses `productSaleSchema` from `@/lib/validations`
- ✅ Zod validation on server side

---

## 🚀 Sign-off Criteria

**Task 14 is COMPLETE when:**

- [x] Build passes with 0 TypeScript errors ✅
- [ ] Database migration run successfully ⏳
- [ ] Server actions uncommented and working ⏳
- [ ] All 17 test scenarios pass ⏳
- [ ] Visual consistency verified ⏳
- [ ] Edge cases handled ⏳
- [ ] Responsive on mobile/tablet/desktop ⏳
- [ ] Accessibility requirements met ⏳
- [ ] Integration with database working ⏳

---

## 📝 Test Execution Log

**Tester:** _____________  
**Date:** _____________  
**Environment:** _____________

### Results Summary
| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Empty form | ⬜ | Requires migration |
| 2. Required fields only | ⬜ | Requires migration |
| 3. All optional fields | ⬜ | Requires migration |
| 4. Fixed commission | ⬜ | Requires migration |
| 5. Percentage commission | ⬜ | Requires migration |
| 6. Percentage > 100% | ⬜ | Requires migration |
| 7. Dynamic calculation | ⬜ | Requires migration |
| 8. Payment methods | ⬜ | Requires migration |
| 9. Date picker | ⬜ | Requires migration |
| 10. Validation | ⬜ | Requires migration |
| 11. Error handling | ⬜ | Requires migration |
| 12. Close modal | ⬜ | Requires migration |
| 13. Cancel button | ⬜ | Requires migration |
| 14. Disabled state | ⬜ | Requires migration |
| 15. Mobile responsive | ⬜ | Requires migration |
| 16. Tablet responsive | ⬜ | Requires migration |
| 17. Desktop responsive | ⬜ | Requires migration |

### Issues Found
1. _____________
2. _____________

**Sign-off:** _____________

---

## 📌 Notes

- **Modal does NOT open by default** - requires parent component to trigger
- **KTV and Customer lists** must be provided by parent component
- **Commission defaults** configurable via props (defaults to 10% if not provided)
- **onSuccess callback** optional - use to refresh data or show success message
- **Form resets after successful save** - ready for next entry
