# 🐛 Bug Fix: Employee Detail Screen Action Buttons

**Date:** 2026-06-22  
**Issue:** All action buttons in EmployeeDetailScreen were not working  
**Status:** ✅ Fixed

---

## 🔴 Problem

All 6 breakdown cards had `actionLabel` prop but **NO `onActionClick` handler**, causing buttons to be displayed but non-functional:

1. ❌ "Xem chấm công" (Lương cơ bản)
2. ❌ "Xem 12 ca" (Hoa hồng dịch vụ)
3. ❌ "Xem cấu hình chức danh" (Thưởng vị trí)
4. ❌ "Xem đánh giá chi tiết" (Thưởng đánh giá)
5. ❌ "Xem chấm công" (Phạt chấm công)
6. ❌ "Xem lịch sử tạm ứng" (Tạm ứng)
7. ❌ "Xuất PDF" (Header button)

---

## ✅ Solution

Added proper `onActionClick` handlers for all buttons:

### **Handlers Implemented:**

```typescript
// 1. View Attendance - Navigate to attendance tab with employee filter
const handleViewAttendance = () => {
  router.push(`/dashboard/salary?tab=attendance&ktv=${employeeId}`);
};

// 2. View Sessions - Navigate to session matrix with highlight
const handleViewSessions = () => {
  router.push(`/dashboard/salary?tab=payroll&highlight=${employeeId}#session-matrix`);
};

// 3. View Position Config - Navigate to HR profile tab
const handleViewPositionConfig = () => {
  router.push(`/dashboard/salary?tab=hr_profile&ktv=${employeeId}`);
};

// 4. View Rating Details - Placeholder (TODO)
const handleViewRatingDetails = () => {
  alert('Tính năng "Xem đánh giá chi tiết" đang phát triển');
};

// 5. View Advance History - Placeholder (TODO)
const handleViewAdvanceHistory = () => {
  alert('Tính năng "Xem lịch sử tạm ứng" đang phát triển');
};

// 6. Export PDF - Placeholder (TODO)
const handleExportPDF = () => {
  alert('Tính năng "Xuất PDF" đang phát triển');
};
```

### **Button Mappings:**

| Button | Card | Handler | Navigation |
|--------|------|---------|------------|
| "Xem chấm công" | Lương cơ bản | `handleViewAttendance` | `/dashboard/salary?tab=attendance&ktv={id}` |
| "Xem 12 ca" | Hoa hồng dịch vụ | `handleViewSessions` | `/dashboard/salary?tab=payroll&highlight={id}#session-matrix` |
| "Xem cấu hình chức danh" | Thưởng vị trí | `handleViewPositionConfig` | `/dashboard/salary?tab=hr_profile&ktv={id}` |
| "Xem đánh giá chi tiết" | Thưởng đánh giá | `handleViewRatingDetails` | Alert (TODO) |
| "Xem chấm công" | Phạt chấm công | `handleViewAttendance` | `/dashboard/salary?tab=attendance&ktv={id}` |
| "Xem lịch sử tạm ứng" | Tạm ứng | `handleViewAdvanceHistory` | Alert (TODO) |
| "Xuất PDF" | Header | `handleExportPDF` | Alert (TODO) |

---

## 🧪 Test Checklist

### **Working Buttons (navigate to existing pages):**
- [ ] "Xem chấm công" → Attendance tab with employee filter
- [ ] "Xem 12 ca" → Session matrix with employee highlighted
- [ ] "Xem cấu hình chức danh" → HR profile tab with employee filter

### **TODO Buttons (show placeholder alert):**
- [ ] "Xem đánh giá chi tiết" → Alert message
- [ ] "Xem lịch sử tạm ứng" → Alert message
- [ ] "Xuất PDF" → Alert message
- [ ] "So sánh" → Opens existing modal (already working)

---

## 📝 TODO - Future Enhancements

### **1. Rating Details Modal**
Create modal/page showing:
- All session reviews for this KTV
- Breakdown by star rating (5⭐, 4⭐, etc.)
- Customer comments
- Trend chart

### **2. Advance History Page**
Create dedicated page showing:
- Full advance history (not just current month)
- Payment status (pending/approved/deducted)
- Approval workflow
- Export to Excel

### **3. PDF Export**
Implement using:
- `jsPDF` or `pdfmake` library
- Include all breakdown details
- Branded header/footer
- Download or email option

### **4. Better Navigation**
- Add query param handling in salary page to auto-scroll to employee row
- Highlight employee in tables when coming from detail screen
- Back button should remember previous scroll position

---

## 🎯 Files Changed

- `src/components/payroll/EmployeeDetailScreen.tsx` - Added 6 handlers + wired up all buttons

---

## ✅ Verification

Test each button by:
1. Navigate to any employee detail screen
2. Expand each breakdown card
3. Click the action button
4. Verify:
   - Working buttons → navigate to correct page with correct filter
   - TODO buttons → show alert with feature name

---

**Status:** Ready for testing ✅  
**Blocker:** None  
**Next:** Implement TODO features (rating details, advance history, PDF export)
