# Task 13 Testing Checklist
## Service Items Display in Booking Detail Modal

---

## ✅ Build Verification

- [x] **TypeScript compilation:** 0 errors
- [x] **All pages generated:** 75/75 routes built successfully
- [x] **Build time:** ~40s (TypeScript) + ~1.4s (page data)

---

## 📋 Manual Testing Scenarios

### **Scenario 1: Empty State (No Service Items)**

**Steps:**
1. Navigate to `/dashboard/bookings`
2. Open any booking detail modal (click on a session)
3. Scroll to "Dịch vụ bổ sung" section

**Expected Result:**
- ✅ Section displays with emerald border
- ✅ Icon: ShoppingBag (emerald color)
- ✅ Title: "Dịch vụ bổ sung"
- ✅ Empty state message: "Chưa có dịch vụ bổ sung"
- ✅ "Thêm dịch vụ" button visible (emerald background)
- ✅ Click button → navigates to `/dashboard/bookings/[id]/services`

---

### **Scenario 2: Loading State**

**Steps:**
1. Open booking detail modal
2. Observe service items section while data loads

**Expected Result:**
- ✅ Shows loading skeleton with pulse animation
- ✅ Text: "Đang tải dịch vụ..."
- ✅ ShoppingBag icon animates (pulse)

---

###** Scenario 3: Single Service Item (Default Commission)**

**Test Data:** Booking with 1 service item, no override

**Expected Display:**

**Desktop View (Table):**
| Dịch vụ | SL | Đơn giá | Tổng | Hoa hồng | Thực nhận |
|---------|----|---------| -----|----------|-----------|
| Tắm bé cơ bản | 1 | 150,000đ | 150,000đ | Mặc định | 150,000đ |

**Mobile View (Cards):**
```
┌─────────────────────────────────────┐
│ Tắm bé cơ bản            [✓ Hoàn thành] │
│                                     │
│ Số lượng: 1      Đơn giá: 150,000đ │
│ Tổng tiền: 150,000đ  Hoa hồng: 150,000đ │
│ [Mặc định]                         │
└─────────────────────────────────────┘
```

**Summary Card:**
- Tổng doanh thu dịch vụ: 150,000đ
- **Tổng hoa hồng: 150,000đ** (bold, emerald color)

**Info Note:**
"Hoa hồng dịch vụ bổ sung sẽ được tính vào lương tháng của KTV phụ trách..."

- ✅ All values formatted with thousand separators
- ✅ Status badge displays correctly (Hoàn thành = green)
- ✅ KTV name shown if assigned
- ✅ Edit button ("Quản lý") visible

---

### **Scenario 4: Multiple Service Items (Mixed Commission Types)**

**Test Data:**
- Item 1: Fixed override (200,000đ)
- Item 2: Percentage override (30%)
- Item 3: Default commission

**Expected Result:**

**Desktop Table Shows:**
1. **Item 1:** Hoa hồng = "Cố định: 200,000đ" | Thực nhận = 200,000đ
2. **Item 2:** Hoa hồng = "30%" | Thực nhận = calculated (30% of subtotal)
3. **Item 3:** Hoa hồng = "Mặc định" | Thực nhận = default amount

**Summary Totals:**
- Revenue = sum of all subtotals
- Commission = sum of all calculated_commission

---

### **Scenario 5: Service Items with Different Statuses**

**Test Data:** Items with status = 'completed', 'pending', 'cancelled'

**Expected Badges:**
- ✅ **Completed:** Green badge "Hoàn thành"
- ✅ **Pending:** Amber badge "Chờ xử lý"
- ✅ **Cancelled:** Red badge "Đã hủy"

---

### **Scenario 6: Service Items with KTV Assignment**

**Test Data:** Service item with ktv_id assigned

**Expected Result:**
- ✅ KTV name displayed under service name
- ✅ Format: "KTV: [Full Name]"
- ✅ Text color: slate-400
- ✅ Font size: text-[10px]

---

### **Scenario 7: Edit Button Functionality**

**Steps:**
1. Open booking detail modal with service items
2. Click "Quản lý" (Edit) button

**Expected Result:**
- ✅ Modal closes smoothly
- ✅ Client-side navigation (router.push, no page reload)
- ✅ Navigate to `/dashboard/bookings/[bookingId]/services`
- ✅ Service management page loads (Task 10 page)

---

### **Scenario 8: Responsive Layout**

**Desktop (≥768px):**
- ✅ Service items displayed in table format
- ✅ Section spans full width (md:col-span-2)
- ✅ 6 columns visible: Dịch vụ, SL, Đơn giá, Tổng, Hoa hồng, Thực nhận

**Mobile (<768px):**
- ✅ Service items displayed as cards
- ✅ Card layout with grid (2 columns for data)
- ✅ Commission type shown in separate emerald box
- ✅ Status badge positioned top-right
- ✅ All text readable (no overflow)

---

### **Scenario 9: Animations**

**Expected Animations:**
- ✅ Table rows: Fade in + slide from left (staggered by 0.05s per row)
- ✅ Mobile cards: Fade in + slide up (staggered by 0.05s per card)
- ✅ Smooth transitions (framer-motion)
- ✅ Loading state: Pulse animation

---

### **Scenario 10: Integration with Booking Detail Modal**

**Steps:**
1. Open any booking detail modal
2. Verify section placement

**Expected Layout Order:**
1. Header (Chi tiết lịch hẹn)
2. Grid (2 columns on desktop):
   - Customer/KTV
   - Time/Location
   - Package Progress
   - Status
3. **Service Items Section** (full width - NEW)
4. Session History (full width)
5. Invoice Print Logs (full width)
6. Care Notes (full width)
7. Action Buttons (bottom)

- ✅ Service items section placed after Status, before Session History
- ✅ Section spans full width (md:col-span-2)
- ✅ Consistent spacing with other sections
- ✅ Border and background match modal design (emerald theme)

---

## 🎨 Visual Consistency Checklist

### Color Scheme
- ✅ Border: `border-emerald-100`
- ✅ Background: `bg-emerald-50/50`
- ✅ Icon color: `text-emerald-600`
- ✅ Title color: `text-emerald-600`
- ✅ Badge background: `bg-emerald-600`
- ✅ Commission text: `text-emerald-700`
- ✅ Edit button: `bg-white` with `text-emerald-600`

### Typography
- ✅ Section title: `text-xs font-black uppercase tracking-widest`
- ✅ Table headers: `text-xs font-black uppercase tracking-wider`
- ✅ Service names: `font-bold text-slate-900`
- ✅ Commission values: `font-black text-emerald-700`
- ✅ Info note: `text-[10px] font-bold leading-relaxed`

### Spacing & Borders
- ✅ Padding: `p-4 sm:p-6` (consistent with other sections)
- ✅ Rounded corners: `rounded-[24px] sm:rounded-[32px]`
- ✅ Gap between elements: `gap-3` or `gap-4`

---

## 🐛 Edge Cases to Test

### **Edge Case 1: Very Long Service Name**
- ✅ Text wraps properly (break-words)
- ✅ No overflow outside card/cell

### **Edge Case 2: Large Quantities (>100)**
- ✅ Numbers formatted correctly (e.g., 123 → 123)
- ✅ Subtotal calculation correct

### **Edge Case 3: Large Amounts (>1 billion VND)**
- ✅ Formatting with thousand separators (1,000,000,000đ)
- ✅ No number overflow

### **Edge Case 4: Percentage Over 100%**
- ✅ Displays as shown (e.g., "150%")
- ✅ Warning indicator if needed (optional)

### **Edge Case 5: Missing KTV Assignment**
- ✅ No KTV name line shown
- ✅ No error or blank space

### **Edge Case 6: No Booking ID in Modal Data**
- ✅ Service items not fetched (no error)
- ✅ Empty state shown

### **Edge Case 7: Fetch Error**
- ✅ Empty state shown (graceful degradation)
- ✅ Error logged to console
- ✅ No crash or white screen

---

## 📱 Device Testing

### Browsers
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

### Screen Sizes
- [ ] Mobile: 375px width
- [ ] Tablet: 768px width
- [ ] Desktop: 1920px width

### Touch Interactions
- [ ] Edit button tap works on mobile
- [ ] Scroll in table/cards works smoothly

---

## ♿ Accessibility Testing

### Semantic HTML
- ✅ Table uses `<table>` element (desktop)
- ✅ Proper `<th>` and `<td>` usage
- ✅ Cards use semantic elements (mobile)

### ARIA Labels
- ✅ AlertCircle icon with info text
- ✅ Edit button has clear text ("Quản lý")
- ✅ Status badges have clear text

### Keyboard Navigation
- ✅ Edit button focusable
- ✅ Tab order logical

### Screen Reader
- ✅ Table headers announced
- ✅ Commission values announced correctly
- ✅ Status announced with badge text

---

## 🔄 Real-time Updates

### **Test: Add Service Item from Management Page**

**Steps:**
1. Open booking detail modal
2. Note service items count
3. Click "Quản lý" → navigate to management page
4. Add new service item
5. Go back to bookings page
6. Re-open same booking detail modal

**Expected:**
- ❓ Service items refetch on modal open
- ❓ New item appears in list
- ❓ Totals updated correctly

**Note:** This depends on whether modal refetches data on reopen. Current implementation fetches in useEffect when `isOpen && bookingId` changes.

---

## 📊 Performance Testing

### Load Time
- ✅ Service items fetch completes within 500ms (local)
- ✅ No blocking of modal render
- ✅ Loading state shown during fetch

### Memory
- ✅ No memory leaks on modal open/close
- ✅ Service items state cleared on unmount (optional)

---

## ✅ Integration Points

### With Task 10 (Service Management Page)
- ✅ Edit button navigates to correct URL
- ✅ Booking ID passed correctly in URL

### With Task 12 (Commission Calculation)
- ✅ Calculated commission values match server calculation
- ✅ Override types displayed correctly

### With Database
- ✅ Query fetches from `booking_service_items` table
- ✅ Join with `users` table for KTV name works
- ✅ Tenant ID filtering applied

---

## 🚀 Sign-off Criteria

**Task 13 is COMPLETE when:**

- [x] Build passes with 0 TypeScript errors ✅
- [ ] All 10 test scenarios pass ⏳
- [ ] Visual consistency verified ⏳
- [ ] Edge cases handled ⏳
- [ ] Responsive on mobile/tablet/desktop ⏳
- [ ] Accessibility requirements met ⏳
- [ ] Edit button navigates correctly ⏳

---

## 📝 Test Execution Log

**Tester:** _____________  
**Date:** _____________  
**Environment:** _____________

### Results Summary
| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Empty state | ⬜ | |
| 2. Loading state | ⬜ | |
| 3. Single item | ⬜ | |
| 4. Multiple items | ⬜ | |
| 5. Different statuses | ⬜ | |
| 6. KTV assignment | ⬜ | |
| 7. Edit functionality | ⬜ | |
| 8. Responsive layout | ⬜ | |
| 9. Animations | ⬜ | |
| 10. Integration | ⬜ | |

### Issues Found
1. _____________
2. _____________

**Sign-off:** _____________
