# Chuẩn hóa rule engine vận hành nhóm 4-6

Ngày: 2026-06-07

## Mục tiêu

Gom các công thức vận hành còn lại vào engine thuần, tránh tình trạng cùng một logic bị tính lại ở nhiều màn hình hoặc nhiều server action.

## Nhóm đã chuẩn hóa

1. Attendance engine: `src/lib/business-rules/attendance.ts`
   - Chuẩn hóa trạng thái chấm công.
   - Tính ngày công thực tế.
   - Tính check-in trễ theo mốc giờ chuẩn.
   - Quy đổi nghỉ phép sang `absent` hoặc `half_day`.
   - Chuẩn hóa timestamp chấm công theo múi giờ Việt Nam.

2. Salary/penalty engine: `src/lib/business-rules/salary.ts`
   - Tính ngày công và lương cơ bản pro-rata.
   - Tính phạt đi trễ/vắng theo cấu hình.
   - Tính số ca quy đổi theo hệ số gói.
   - Tính hoa hồng ca, thưởng đánh giá, KPI bonus.
   - Tính tổng lương cuối cùng bằng một công thức chung.

3. Inventory engine: `src/lib/business-rules/inventory.ts`
   - Tính nhập kho, tiêu hao, rollback tồn kho.
   - Tính cảnh báo tồn thấp và tổng giá trị kho.
   - Chuẩn hóa định mức vật tư theo gói.
   - Tính variance kiểm kê tháng.
   - Lập kế hoạch tiêu hao vật tư cho một ca hoàn thành.

## Điểm nối đã thay

- `src/services/attendance-actions.ts`
- `src/modules/hr-salary/actions/salary-attendance-calculation.ts`
- `src/modules/hr-salary/actions/kpi-calculator.ts`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/modules/hr-salary/actions/query-salary-actions.ts`
- `src/services/inventory-actions.ts`

## Kiểm thử bảo vệ

- `src/__tests__/business-rule-engines.test.ts`
- `src/__tests__/kpi-calculator.test.ts`
- `src/__tests__/query-salary-actions.test.ts`
- `src/__tests__/attendance-actions.test.ts`
- `src/__tests__/inventory-actions.test.ts`

Focused regression: 71/71 tests pass.

## Ranh giới không đổi

- Không đổi schema database.
- Không đổi trạng thái nghiệp vụ.
- Không đổi luồng ghi side-effect/rollback.
- Không đổi quyền truy cập.
- Không đổi công thức lương đã được khóa bởi AGENTS.md; chỉ chuyển công thức sang nguồn chung.
