# Employee Detail Screen API - Testing Guide

## ✅ Hoàn thành Phase 2: Real API Integration

### Các file đã tạo/sửa:

1. **API Route** (NEW): `src/app/api/payroll/employees/[employeeId]/detail/route.ts`
   - Fetch employee info, salary records, sessions, attendance, advances
   - Calculate salary breakdown với package multipliers
   - Compare với tháng trước
   - Authorization: Admin xem tất cả, KTV chỉ xem của mình

2. **Component** (UPDATED): `src/components/payroll/EmployeeDetailScreen.tsx`
   - Xóa `MOCK_EMPLOYEE_DATA`
   - Thêm `useEffect` để fetch real data
   - Loading state với spinner
   - Error state với retry button
   - TypeScript interfaces matching API response

3. **Page** (UPDATED): `src/app/dashboard/payroll/employees/[employeeId]/detail/page.tsx`
   - Pass `employeeId` từ route params
   - Pass `month` từ query params (optional)

---

## 🧪 Test Cases

### Test 1: Kiểm tra API với curl/Postman

```bash
# Test với employee ID thật (thay YOUR_EMPLOYEE_ID)
curl http://localhost:3000/api/payroll/employees/YOUR_EMPLOYEE_ID/detail

# Test với tháng cụ thể
curl "http://localhost:3000/api/payroll/employees/YOUR_EMPLOYEE_ID/detail?month=2026-05"
```

**Expected Response:**
```json
{
  "employee": {
    "id": "...",
    "name": "Nguyễn Văn A",
    "position": "Senior KTV",
    "hireDate": "2024-01-15",
    "yearsOfService": 2.1
  },
  "month": "2026-06",
  "salary": {
    "total": 8650000,
    "totalLastMonth": 9100000,
    "changePercent": -4.9
  },
  "breakdown": {
    "baseSalary": { ... },
    "serviceCommission": { ... },
    "positionBonus": { ... },
    "ratingBonus": { ... },
    "attendancePenalty": { ... },
    "advances": { ... }
  }
}
```

---

### Test 2: Kiểm tra UI trên browser

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/dashboard/payroll/employees/YOUR_EMPLOYEE_ID/detail
   ```

3. **Kiểm tra các element:**
   - [ ] Loading spinner hiển thị khi fetch data
   - [ ] Employee name, position, hire date đúng
   - [ ] Tổng lương hiển thị chính xác
   - [ ] So sánh với tháng trước (% change, trend icon)
   - [ ] 6 breakdown cards expand/collapse
   - [ ] Số liệu trong mỗi card khớp với database

4. **Test with query params:**
   ```
   http://localhost:3000/dashboard/payroll/employees/YOUR_EMPLOYEE_ID/detail?month=2026-05
   ```
   - [ ] Data thay đổi theo tháng được chọn

---

### Test 3: Edge Cases

#### 3.1. Employee không tồn tại
```
http://localhost:3000/dashboard/payroll/employees/invalid-id/detail
```
**Expected:** Error screen với message "Employee not found"

#### 3.2. Employee chưa có salary record
- Navigate đến employee mới hire (chưa có dữ liệu lương)
**Expected:** 
- Base salary = 0 (chưa có working days)
- Commission = 0 (chưa có sessions)
- Total = 0

#### 3.3. Tháng không có dữ liệu
```
http://localhost:3000/dashboard/payroll/employees/YOUR_EMPLOYEE_ID/detail?month=2025-01
```
**Expected:** All breakdowns = 0

#### 3.4. KTV user xem data của người khác
- Login as KTV user
- Navigate to other KTV's detail page
**Expected:** 403 Forbidden error

#### 3.5. Network error simulation
- Stop API server
- Reload page
**Expected:** Error screen với "Retry" button

---

### Test 4: Authorization

| User Role | Can See All KTVs | Can See Own Data |
|-----------|------------------|------------------|
| Admin     | ✅               | ✅               |
| Manager   | ✅               | ✅               |
| KTV       | ❌               | ✅               |

**Test steps:**
1. Login as Admin → Navigate to any KTV detail → ✅ Should work
2. Login as KTV → Navigate to own detail → ✅ Should work
3. Login as KTV → Navigate to other KTV detail → ❌ Should show 403

---

## 🔧 Debug Checklist

Nếu gặp lỗi, kiểm tra:

### API Route Issues

```bash
# Check API logs
# Look for errors in terminal running `npm run dev`
```

**Common errors:**
- `Missing tenant context` → User not logged in or no tenant_id
- `Employee not found` → Invalid employee ID or wrong tenant
- `Session query failed` → Database schema mismatch

### Component Issues

**Loading forever:**
- Check Network tab in DevTools
- Verify API URL is correct
- Check CORS/auth errors

**Data not displaying:**
- Check API response format matches TypeScript interface
- Verify all fields are mapped correctly
- Check console for render errors

### Database Issues

**Missing data:**
```sql
-- Check if employee exists
SELECT id, full_name, role FROM users WHERE id = 'YOUR_EMPLOYEE_ID';

-- Check if salary record exists
SELECT * FROM salary_records WHERE ktv_id = 'YOUR_EMPLOYEE_ID';

-- Check sessions count
SELECT COUNT(*) FROM session_logs 
WHERE completed_by_ktv_id = 'YOUR_EMPLOYEE_ID' 
AND status = 'completed';
```

---

## 📊 Performance Benchmarks

**Expected API response times:**
- Employee with 0 sessions: ~150ms
- Employee with 10-20 sessions: ~300ms
- Employee with 50+ sessions: ~500ms

**Database queries count:** 13 queries per request
- 1 employee info
- 1 salary record
- 1 sessions with bookings
- 1 packages
- 1 attendance logs
- 1 advances
- 1 session reviews
- 1 tenant config
- 1 previous month salary
- 4 additional joins

---

## 🎯 Next Steps (Post-Testing)

After successful testing, these features can be added:

1. **Comparison Modal** (Placeholder implemented)
   - Side-by-side comparison with previous months
   - Trend charts

2. **PDF Export** (Placeholder implemented)
   - Generate payslip PDF
   - Include QR code for verification

3. **Session Detail Modal**
   - Click "Xem 15 ca" to see session list
   - Filter by package, date, customer

4. **Attendance Detail Modal**
   - Click "Xem chấm công" to see calendar view
   - Show check-in/check-out times

5. **Caching & Optimization**
   - Cache API response for 5 minutes
   - Add React Query for better state management

6. **Real-time Updates**
   - Realtime subscription to salary_records changes
   - Auto-refresh when new sessions completed

---

## ✅ Definition of Done

Feature is ready for production when:

- [x] API route created and returns correct data
- [x] Component fetches and displays real data
- [x] Loading and error states implemented
- [ ] All 4 edge cases tested and handled
- [ ] Authorization tested for all roles
- [ ] Performance benchmarks met (<500ms)
- [ ] No console errors in browser
- [ ] Build succeeds without warnings
- [ ] Manual QA by HR user completed
- [ ] Documentation updated

---

## 🚀 Deployment Checklist

Before deploying to production:

1. [ ] Run full test suite: `npm test`
2. [ ] Build production bundle: `npm run build`
3. [ ] Test on staging environment
4. [ ] Performance test with real data (50+ KTVs)
5. [ ] Security audit (SQL injection, XSS)
6. [ ] Load test (100 concurrent users)
7. [ ] Backup database before deploy
8. [ ] Monitor error logs after deploy

---

## 📝 Known Limitations

1. **Late minutes not stored**: Currently hardcoded to 15 minutes. Need to add `late_minutes` field to `attendance` table.

2. **Position multiplier**: Hardcoded in API. Should fetch from `position_configs` table.

3. **Session commission rate**: Hardcoded to 150k. Should fetch from tenant config.

4. **No caching**: Every request hits database. Add Redis cache for production.

5. **No pagination**: If employee has 100+ sessions, response will be slow. Consider pagination.

---

**Last Updated:** 2026-06-22
**Author:** AI Agent (Option B implementation)
**Status:** ✅ Phase 2 Complete - Ready for Testing
