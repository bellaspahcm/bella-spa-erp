# 🧪 Payroll Dashboard Test Guide

**Date:** 2026-06-22  
**Feature:** Payroll Health Check + Publish Modal (Refactored from Wizard)  
**URL:** http://localhost:3000/dashboard/salary

---

## 📋 Architecture Decision

**❌ REMOVED:** Payroll Wizard (`/dashboard/payroll/run`)  
**✅ REFACTORED TO:** Single-source-of-truth Payroll Dashboard with:
- **PayrollHealthCheck component** (real-time anomaly detection)
- **PublishConfirmModal** (exception blocking + bulk publish)

**Rationale (YAGNI Principle):**
- Wizard was 100% code duplication of existing salary dashboard
- Salary dashboard ALREADY has:
  - Real-time salary calculation (`getSalaryData()`)
  - SalaryTable component with all breakdowns
  - "Gửi đối soát" button for bulk publish
- Wizard added NO new logic, just "pretty UI wrapper"
- Violates single-source-of-truth principle

**New Workflow:**
1. HR views **one unified dashboard** at `/dashboard/salary`
2. **Health Check card** shows anomalies in real-time (above salary table)
3. **"Gửi đối soát" button** opens confirmation modal
4. **Modal blocks publish** if critical anomalies exist
5. After resolving exceptions → publish all at once

---

## ✅ Pre-Test Setup

1. **Dev server đang chạy:** http://localhost:3000
2. **Login as Admin/HR** (không phải KTV role)
3. **Navigate to:** Dashboard → Lương KTV
4. **Check:** 
   - Health check card hiển thị (above salary table)
   - "Gửi đối soát" button hiển thị (màu amber/vàng)

---

## 🧪 Test Scenarios

### **Scenario 1: Happy Path - Full Wizard Flow**

#### Step 1: Generate (Tính lương)
- [ ] Click nút "Chạy bảng lương" từ salary dashboard
- [ ] Wizard mở ra với tiêu đề "Chạy bảng lương tháng {MM/YYYY}"
- [ ] Progress indicator hiển thị bước 1/3 active (màu xanh)
- [ ] Month selector hiển thị tháng hiện tại
- [ ] Click "Tính lương" button
- [ ] Progress bar chạy từ 0% → 100% (smooth animation)
- [ ] Success card hiển thị:
  - Tổng KTV: {số}
  - Tổng quỹ lương: {số}đ
  - Lương TB: {số}đ
- [ ] Nút "Tiếp theo: Kiểm tra" xuất hiện
- [ ] Click "Tiếp theo"

#### Step 2: Review (Kiểm tra)
- [ ] Progress indicator chuyển sang bước 2/3 active
- [ ] Bước 1 có checkmark màu xanh lá
- [ ] Summary cards hiển thị:
  - Tổng số bản ghi
  - Có anomalies (số lượng)
  - Cần xem xét ngay (high severity)
- [ ] Nếu có anomalies → warning card màu vàng hiển thị
- [ ] Table hiển thị tất cả KTV với các cột:
  - Tên KTV (+ số ngày công)
  - Số ca
  - Lương cứng
  - Hoa hồng
  - Thưởng KPI
  - Phạt
  - Tổng nhận (color-coded)
  - Cảnh báo (anomaly badges)
  - Thao tác (edit button)

**Test Anomaly Detection:**
- [ ] KTV có lương = 0 → badge đỏ "Lương = 0 - Không có dữ liệu công/ca"
- [ ] KTV có lương âm → badge đỏ "Lương âm - Kiểm tra tạm ứng/phạt"
- [ ] KTV có lương >15M → badge vàng "Lương cao bất thường"

**Test Inline Editing:**
- [ ] Click icon bút chì ở một KTV
- [ ] Input fields xuất hiện cho: lương cứng, KPI, phạt
- [ ] Thay đổi giá trị → tổng lương tự động cập nhật
- [ ] Click icon ✓ (Save) → toast "Đã lưu thay đổi"
- [ ] Click icon X (Cancel) → revert về giá trị cũ

**Navigation:**
- [ ] Click "Quay lại" → về Step 1
- [ ] Click "Tiếp theo: Xuất bản" → sang Step 3 (disabled nếu đang edit)

#### Step 3: Publish (Xuất bản)
- [ ] Progress indicator chuyển sang bước 3/3 active
- [ ] Bước 1 & 2 có checkmark màu xanh lá
- [ ] Final summary cards hiển thị đúng:
  - Tổng KTV
  - Tổng quỹ lương
  - Lương TB
- [ ] "Sau khi xuất bản" section hiển thị 3 bullet points
- [ ] Click "Xuất bản tất cả" button (gradient tím-xanh)
- [ ] Loading state: spinner + "Đang xuất bản..." + "Đang gửi thông báo cho {X} nhân viên"
- [ ] Success state:
  - Green card "Xuất bản thành công!"
  - "✓ Đã xuất bản {X}/{X} bản ghi lương"
  - "✓ KTV có thể xem và xác nhận trên app"
  - "Đang chuyển về màn hình lương..."
  - Auto-redirect sau 2 giây → /dashboard/salary
- [ ] Verify trên salary dashboard:
  - Status của các KTV chuyển thành "Chờ KTV xác nhận" (màu vàng)

---

### **Scenario 2: Error Handling**

#### Step 1: Network Error
- [ ] Disconnect internet/database
- [ ] Click "Tính lương"
- [ ] Red error card hiển thị: "Không thể tính lương. Vui lòng kiểm tra dữ liệu..."
- [ ] Nút "Thử lại" xuất hiện
- [ ] Reconnect → Click "Thử lại" → success

#### Step 3: Partial Failure
- [ ] Một số KTV không publish được
- [ ] Result card hiển thị:
  - "Đã xuất bản: {success}/{total}"
  - "Thất bại: {failed}"
  - White box với "Chi tiết lỗi:" + list of failures
- [ ] Retry button hoạt động

---

### **Scenario 3: Navigation & Back Button**

- [ ] Từ Step 2 → "Quay lại" → về Step 1 (data vẫn giữ nguyên)
- [ ] Từ Step 3 → "Quay lại" → về Step 2
- [ ] Từ Step 1 → Click back button trên header → router.back()
- [ ] Wizard không mất data khi navigate back trong cùng session

---

### **Scenario 4: Month Selection**

- [ ] Thay đổi month selector sang tháng khác
- [ ] Click "Tính lương"
- [ ] Data tính cho tháng đã chọn
- [ ] Header wizard hiển thị đúng tháng: "Chạy bảng lương tháng {MM/YYYY}"

---

### **Scenario 5: Role-Based Access**

- [ ] Logout admin
- [ ] Login as KTV role
- [ ] Navigate to /dashboard/salary
- [ ] Nút "Chạy bảng lương" KHÔNG hiển thị
- [ ] Direct access to /dashboard/payroll/run → check authorization

---

## 🐛 Known Issues / TODOs

1. **Month-over-month anomaly detection:** Cần historical salary data
2. **Inline edit API:** Hiện tại chỉ update local state, chưa call API thật
3. **Authorization check:** Cần verify /dashboard/payroll/run route có middleware chặn KTV không

---

## 📸 Expected Screenshots

### Step 1: Generate
- Progress bar at 50%
- Success summary with 3 cards

### Step 2: Review
- Anomaly badges (red + yellow)
- Inline editing mode with input fields

### Step 3: Publish
- Loading state với spinner
- Success state với green card

---

## ✅ Test Results Template

| Scenario | Status | Notes |
|----------|--------|-------|
| Happy Path - Full Flow | ⏳ Pending | |
| Error Handling | ⏳ Pending | |
| Navigation & Back | ⏳ Pending | |
| Month Selection | ⏳ Pending | |
| Role-Based Access | ⏳ Pending | |

---

## 🚀 Next Steps After Testing

1. **If bugs found:** Fix and re-test
2. **If all green:** Deploy to staging
3. **HR training:** Record demo video
4. **Production rollout:** Monitor first payroll run

---

**Tester:** ___________  
**Date Tested:** ___________  
**Result:** ⏳ Pending / ✅ Pass / ❌ Fail  
**Notes:** ___________
