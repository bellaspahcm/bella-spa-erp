# Quick Test Guide - Employee Detail Screen

**Thời gian:** 10 phút  
**Mục tiêu:** Xác nhận màn hình hoạt động và layout hợp lý

---

## Bước 1: Khởi động (1 phút)

1. Mở terminal, chạy:
   ```bash
   npm run dev
   ```

2. Đợi thấy message:
   ```
   ✓ Ready in Xms
   ○ Local: http://localhost:3000
   ```

3. Mở browser, vào:
   ```
   http://localhost:3000/dashboard/payroll/employees/emp001/detail
   ```

---

## Bước 2: Visual Check (2 phút)

### ✅ Checklist nhanh:

- [ ] Thấy header "NGUYỄN VĂN A - Tháng 6/2026"
- [ ] Thấy số lương lớn "8,650,000đ"
- [ ] Thấy 6 cards màu xanh/đỏ:
  - 🟢 Lương cơ bản
  - 🟢 Hoa hồng dịch vụ
  - 🟢 Thưởng vị trí
  - 🟢 Thưởng đánh giá
  - 🔴 Phạt chấm công
  - 🔴 Tạm ứng
- [ ] Thấy tổng kết ở cuối
- [ ] Không có lỗi trong console (F12)

**Nếu có bất kỳ item nào FAIL → STOP, báo lỗi**

---

## Bước 3: Interaction Test (5 phút)

### Test 1: Expand/Collapse Cards

1. Click vào card "LƯƠNG CƠ BẢN"
   - [ ] Card mở rộng (không bị lag)
   - [ ] Thấy công thức: "6,000,000đ ÷ 26 × 24 = 5,538,462đ"
   - [ ] Thấy ngày vắng: 10/06, 15/06

2. Click lại card "LƯƠNG CƠ BẢN"
   - [ ] Card thu gọn lại

3. Click vào card "HOA HỒNG DỊCH VỤ"
   - [ ] Card mở rộng
   - [ ] Thấy breakdown 4 loại gói
   - [ ] Thấy tổng quy đổi: 15.0 ca

### Test 2: Buttons

1. Click nút "So sánh"
   - [ ] Modal xuất hiện
   - [ ] Có text "Tính năng đang phát triển"

2. Click "Đóng"
   - [ ] Modal đóng lại

3. Hover các nút "[Xem chấm công]", "[Xem 12 ca]"
   - [ ] Có cursor pointer
   - [ ] Có hover effect

---

## Bước 4: Responsive Check (Optional - 2 phút)

1. Thu nhỏ browser xuống 1024px width
   - [ ] Layout vẫn OK (không bị vỡ)

2. Thu nhỏ xuống 768px (tablet)
   - [ ] Cards stack vertical
   - [ ] Số vẫn đọc được

---

## Expected Output ✅

Nếu tất cả checkboxes đều ✅:

```
┌─────────────────────────────────────────────┐
│ ✅ Màn hình hiển thị đúng                   │
│ ✅ Số liệu đúng (8.65M)                     │
│ ✅ Expand/collapse hoạt động                │
│ ✅ Buttons responsive                       │
│ ✅ Không có console errors                  │
│                                             │
│ → Ready for HR user testing! 🎯            │
└─────────────────────────────────────────────┘
```

---

## Common Issues & Fixes

### Issue 1: Page 404
**Symptom:** Không load được page  
**Fix:** Kiểm tra file path:
- File phải ở: `src/app/dashboard/payroll/employees/[employeeId]/detail/page.tsx`
- URL phải là: `http://localhost:3000/dashboard/payroll/employees/emp001/detail`

### Issue 2: Component not found
**Symptom:** "Cannot find module '@/components/payroll/EmployeeDetailScreen'"  
**Fix:** Kiểm tra file `src/components/payroll/EmployeeDetailScreen.tsx` tồn tại

### Issue 3: Styling broken
**Symptom:** Cards không có màu, layout vỡ  
**Fix:** 
```bash
npm install lucide-react
```

### Issue 4: TypeScript errors
**Symptom:** Red squiggles, build errors  
**Fix:** Check `@/components/ui/button` và `@/components/ui/card` tồn tại (shadcn/ui components)

---

## Next: Full User Testing

Nếu Quick Test pass:
1. In file `EMPLOYEE_DETAIL_TEST_CHECKLIST.md`
2. Gọi 1-2 HR staff (không tech)
3. Ngồi cạnh, quan sát họ dùng (không hướng dẫn!)
4. Ghi chú vào checklist
5. Iterate based on feedback

**Mục tiêu:** HR phải giải thích được lương trong <5 phút mà không cần hỏi gì.
