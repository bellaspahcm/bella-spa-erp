# Hướng Dẫn Test E2E Hệ Thống Lương

## 📋 Tổng Quan

File test này kiểm tra toàn bộ quy trình lương từ A-Z với 3 KTV trong các tình huống khác nhau:

### KTV Alpha (Tình huống chuẩn)
- ✅ 20 ca làm việc (mixed packages)
- ✅ 22 ngày công (full month)
- ✅ Rating 4.8/5.0
- ✅ Có KPI Bonus
- ✅ 1 bonus thưởng thủ công
- ✅ Workflow hoàn chỉnh: draft → published → confirmed → finalized

### KTV Beta (Nghỉ giữa tháng)
- ✅ 10 ca làm việc (basic package)
- ✅ 12 ngày công (resigned 15/06)
- ✅ Rating 5.0/5.0
- ❌ Không KPI
- ⚠️ 1 deduction phạt kỷ luật
- 💰 Pro-rata base salary

### KTV Gamma (Tranh chấp)
- ✅ 15 ca làm việc (VIP package 2.0x)
- ✅ 20 ngày công + 2 ngày late
- ✅ Rating 4.5/5.0
- ✅ Có KPI Bonus
- ⚠️ Trừ kỷ luật tự động (late)
- 🔄 Dispute → Admin confirm

## 🎯 Các Tính Năng Được Test

### 1. Session Bonus Calculation (Package Multipliers)
```typescript
// Combo Mẹ & Bé Tiết Kiệm: 1.0x
// Combo Mẹ & Bé Hạnh Phúc: 1.5x
// Combo Mẹ & Bé VIP Toàn Diện: 2.0x

// KTV Alpha: 10×1.0 + 6×1.5 + 4×2.0 = 27 weighted sessions
```

### 2. Pro-Rata Base Salary
```typescript
// KTV Beta resigned 15/06 (worked 12 days)
// Pro-rata = (5,000,000 / 26) × 12 = 2,307,692 VNĐ
```

### 3. Rating Bonus
```typescript
// Rating 5.0 → 10% bonus
// Rating 4.5-4.9 → 5-9% bonus
// Rating < 4.5 → 0% bonus
```

### 4. KPI Bonus Sync
- Lấy từ bảng `kpi_records`
- Sync với leaderboard

### 5. Manual Adjustments
- Bonus categories: Thưởng hoàn thành mục tiêu, Thưởng đột xuất
- Deduction categories: Phạt kỷ luật, Trừ tạm ứng

### 6. Approval Workflow
```
draft → published → confirmed → finalized
           ↓
      disputed → admin confirmed → finalized
```

### 7. Salary Reconciliation
- AI computed vs Legacy (manual accounting)
- Status: MATCH / MINOR_DIFF / MAJOR_DIFF / PENDING_LEGACY

### 8. Accounting Integration
- Tự động tạo expense entry khi finalize
- Referential integrity với salary_records

## 🚀 Cách Chạy Test

### Chạy toàn bộ test suite
```bash
npm run test e2e-salary-comprehensive.test.ts
```

### Chạy từng phase
```bash
# Phase 1: Session Completion
npm run test e2e-salary-comprehensive.test.ts -t "Phase 1"

# Phase 2: Draft Calculation
npm run test e2e-salary-comprehensive.test.ts -t "Phase 2"

# Phase 3: Manual Adjustments
npm run test e2e-salary-comprehensive.test.ts -t "Phase 3"

# Phase 4: Approval Workflow
npm run test e2e-salary-comprehensive.test.ts -t "Phase 4"

# Phase 5: Finalization
npm run test e2e-salary-comprehensive.test.ts -t "Phase 5"

# Phase 6: Reconciliation
npm run test e2e-salary-comprehensive.test.ts -t "Phase 6"

# Phase 7: Edge Cases
npm run test e2e-salary-comprehensive.test.ts -t "Phase 7"

# Phase 8: Performance
npm run test e2e-salary-comprehensive.test.ts -t "Phase 8"
```

### Chạy với real database (E2E)
```bash
npm run test:real-db-e2e e2e-salary-comprehensive.test.ts
```

## 📊 Expected Test Results

### KTV Alpha (Full Month, Mixed Packages)
```
Base Salary:       6,000,000 VNĐ
Session Bonus:     2,700,000 VNĐ (27 sessions × 100k)
Rating Bonus:        270,000 VNĐ (10% of session bonus)
KPI Bonus:           500,000 VNĐ
Manual Bonus:        500,000 VNĐ
Deductions:                0 VNĐ
-------------------
Total Salary:      9,970,000 VNĐ
```

### KTV Beta (Resigned Mid-Month)
```
Base Salary:       2,307,692 VNĐ (pro-rata)
Session Bonus:     1,000,000 VNĐ (10 sessions)
Rating Bonus:        100,000 VNĐ (10%)
KPI Bonus:                 0 VNĐ
Manual Deduction:   -200,000 VNĐ (discipline)
-------------------
Total Salary:      3,207,692 VNĐ
```

### KTV Gamma (VIP Package, Disputed)
```
Base Salary:       7,000,000 VNĐ
Session Bonus:     3,000,000 VNĐ (15 sessions × 200k)
Rating Bonus:        270,000 VNĐ (~9%)
KPI Bonus:           800,000 VNĐ
Auto Deduction:      -50,000 VNĐ (2 late days)
-------------------
Total Salary:     11,020,000 VNĐ
```

## 🔧 Setup Required

### 1. Database Migrations
Đảm bảo các bảng sau đã được migrate:
- `users` (KTV profiles)
- `tenants` (tenant config)
- `packages` (with session_multiplier)
- `session_logs` (completed sessions)
- `attendance` (daily attendance)
- `kpi_records` (KPI bonuses)
- `salary_records` (salary calculations)
- `salary_adjustments` (manual adjustments)
- `expenses` (accounting integration)
- `audit_logs` (audit trail)

### 2. Test Data
File test sẽ tự động tạo test data trong `beforeAll`:
- 1 tenant
- 3 KTV users
- 3 packages (Tiết Kiệm, Hạnh Phúc, VIP)
- 45 session logs (20 + 10 + 15)
- 56 attendance records
- 3 KPI records
- 2 manual adjustments

### 3. Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📝 Implementation Checklist

Để chạy test này, cần implement các hàm sau:

### Salary Calculation Engine
- [x] `recalculateAndSaveSalaryRecordEngine` - Core calculation
- [x] `calcProRataBaseSalary` - Pro-rata for resignation
- [ ] `calculateSessionBonus` - With package multipliers
- [ ] `calculateRatingBonus` - Based on rating thresholds
- [ ] `syncKpiBonus` - From kpi_records table

### Admin Actions
- [x] `publishSalaryRecord` / `publishAllSalaryRecords`
- [x] `finalizeSalaryRecord` / `finalizeAllSalaryRecords`
- [x] `adminConfirmOnBehalf`
- [x] `updateSalaryConfig`
- [x] `confirmKtvSessions`
- [x] `approveSalary`

### KTV Actions
- [ ] `confirmSalary` - KTV confirms their salary
- [ ] `disputeSalary` - KTV disputes salary

### Adjustment Actions
- [ ] `createSalaryAdjustment`
- [ ] `approveSalaryAdjustment`
- [ ] `rejectSalaryAdjustment`

### Reconciliation Actions
- [x] `getSalaryReconciliationReport`
- [x] `getSalaryReconciliationSummary`

### Accounting Integration
- [ ] `createSalaryExpense` - Auto-create on finalize
- [ ] `verifySalaryExpenseIntegrity`

## 🐛 Known Issues & Workarounds

### Issue 1: Package Multiplier Not Applied
**Symptom**: Session count không nhân với multiplier

**Fix**: Đảm bảo query join với `packages` table và sum `session_multiplier`:
```sql
SELECT 
  SUM(COALESCE(p.session_multiplier, 1.0)) as weighted_sessions
FROM session_logs s
LEFT JOIN bookings b ON s.booking_id = b.id
LEFT JOIN packages p ON b.package_id = p.id
WHERE s.completed_by_ktv_id = $1
```

### Issue 2: Pro-Rata Calculation Rounding
**Symptom**: Sai lệch vài đồng do làm tròn

**Fix**: Dùng `Math.round()` consistent:
```typescript
const proRata = Math.round((baseSalary / 26) * actualDays);
```

### Issue 3: KPI Bonus Not Syncing
**Symptom**: KPI bonus = 0 dù có trong leaderboard

**Fix**: Query `kpi_records` table trong recalculation engine:
```typescript
const kpiRecord = await supabase
  .from('kpi_records')
  .select('bonus_amount')
  .eq('ktv_id', ktvId)
  .eq('month_year', monthYear)
  .maybeSingle();
```

## 📚 Related Documentation

- [AGENTS.md](../AGENTS.md#critical-bella-erp-development--testing-rules) - Salary testing rules
- [COMMISSION_SYSTEM_INDEX.md](./COMMISSION_SYSTEM_INDEX.md) - Commission system overview
- [INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md](./INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md) - Module development guide

## 🎓 Learning Resources

### Video Tutorials
- [ ] Session bonus calculation with package multipliers
- [ ] Pro-rata base salary for mid-month resignation
- [ ] KPI bonus syncing from leaderboard
- [ ] Salary reconciliation workflow

### Code Examples
- `src/__tests__/salary-recalculation-lifecycle.test.ts` - Lifecycle guards
- `src/__tests__/admin-salary-actions.test.ts` - Audit rollback patterns
- `src/__tests__/salary-reconciliation.test.ts` - Reconciliation report

## 🤝 Contributing

Khi thêm test cases mới:
1. Follow naming convention: `Phase X: [Category]`
2. Add expected values vào comments
3. Update README này với scenarios mới
4. Ensure cleanup in `afterAll`

## 📞 Support

Nếu gặp vấn đề khi chạy test:
1. Check database migrations are up-to-date
2. Verify test data in `beforeAll` was created successfully
3. Review error logs in console
4. Check AGENTS.md for salary testing rules

---

**Last Updated**: June 22, 2026
**Version**: 1.0.0
**Status**: ⚠️ Draft - Implementation in progress
