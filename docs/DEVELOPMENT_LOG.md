# 📔 Nhật ký Phát triển & Bảo trì Tổng hợp (Development & Maintenance Log)
**Dự án**: Bella Spa Enterprise Resource Planning (ERP) System  
**Ngày cập nhật**: 01/06/2026
**Mục tiêu**: Gom và tổng hợp tất cả các nhật ký làm việc hàng ngày của AI Agent và nhà phát triển để giúp việc tra cứu lịch sử được dễ dàng, tránh làm tràn context của AI Coding.

---

## 📅 Nhật ký Chi tiết Theo Ngày

### 🟢 Ngày 01/06/2026: Harden Admin Confirm On Behalf Audit
* **Mục tiêu kỹ thuật**:
  * Siết `adminConfirmOnBehalf` để hành động admin xác nhận hộ KTV có audit trail và không còn no-op im lặng.
  * Tránh trạng thái `salary_records` đã chuyển `confirmed` nhưng audit log ghi nhận xác nhận hộ bị thiếu.
* **Thay đổi chính**:
  * Thêm snapshot eligible current-month salary row theo KTV/month/tenant với status `published` hoặc `disputed`.
  * Nếu không có row eligible, action trả failure rõ và không update/audit/revalidate.
  * Sau khi update `status`, `ktv_confirmed_at`, `confirmed_by_admin`, action ghi audit old/new data.
  * Nếu audit fail, rollback các field đã đổi về snapshot; nếu rollback fail thì response chứa cả lỗi audit và lỗi rollback.
  * Mở rộng `admin-salary-actions.test.ts` lên 19 test, bao phủ success, no-op, update failure, audit rollback và rollback-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Clean Salary Page ESLint Warnings
* **Mục tiêu kỹ thuật**:
  * Dọn warning ESLint còn lại trong `src/app/dashboard/salary/page.tsx` sau các lát cắt salary hardening.
  * Giữ nguyên behavior hiện hữu, chỉ xóa symbol không còn được sử dụng.
* **Thay đổi chính**:
  * Xóa import không dùng: `motion`, `ShieldCheck`, `Search`, `Filter`.
  * Xóa `handleApproveAll` vì không được render/gọi ở salary page.
  * Giữ `searchQuery` vì vẫn được truyền xuống `SalaryTable` qua props.
* **Kiểm tra**:
  * `npx.cmd eslint src/app/dashboard/salary/page.tsx` pass.
  * `npx.cmd tsc --noEmit` pass.

### 🟢 Ngày 01/06/2026: Harden Bulk Salary Partial Failure Reporting
* **Mục tiêu kỹ thuật**:
  * Siết `publishAllSalaryRecords` và `finalizeAllSalaryRecords` để không còn trả success khi một phần KTV thất bại.
  * Bắt lỗi query danh sách target ban đầu thay vì để bulk workflow im lặng chạy với danh sách rỗng.
* **Thay đổi chính**:
  * Thêm bulk result summary gồm `count`, `total`, `failedCount`, `failures` và `error` chi tiết.
  * `publishAllSalaryRecords` ghi nhận từng KTV publish fail/throw và trả `success: false` nếu có partial failure.
  * `finalizeAllSalaryRecords` ghi nhận từng KTV finalize fail/throw và trả `success: false` nếu có partial failure.
  * UI trang salary hiển thị `res.error` từ bulk action và refresh data khi có một phần bản ghi đã thành công.
  * Mở rộng `admin-salary-actions.test.ts` lên 14 test, bao phủ bulk success, publish partial failure, target fetch failure và finalize thrown failure.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/app/dashboard/salary/page.tsx src/__tests__/admin-salary-actions.test.ts` pass với warning cũ trong `page.tsx`.

### 🟢 Ngày 01/06/2026: Harden Confirm KTV Sessions Rollback
* **Mục tiêu kỹ thuật**:
  * Siết `confirmKtvSessions` để không còn trạng thái `session_logs.is_confirmed` đã đổi nhưng salary recalculation thất bại.
  * Giữ salary calculation trong central salary engine, chỉ thêm snapshot/rollback cho side-effect xác nhận session.
* **Thay đổi chính**:
  * Snapshot `id` và `is_confirmed` của các completed `session_logs` theo KTV trước khi update.
  * Sau khi set `is_confirmed = true`, nếu `recalculateAndSaveSalaryRecord` fail thì khôi phục từng session về giá trị `is_confirmed` cũ.
  * Nếu rollback session fail, response trả rõ cả lỗi salary recalc và lỗi rollback; không revalidate trang lương trong nhánh failure.
  * Mở rộng `admin-salary-actions.test.ts` lên 9 test, bao phủ success, recalc rollback, rollback-failure reporting và session update failure.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Update Salary Config Audit Rollback
* **Mục tiêu kỹ thuật**:
  * Siết `updateSalaryConfig` để không còn trạng thái `salary_records` đã thay đổi nhưng audit log cấu hình lương bị thiếu.
  * Giữ toàn bộ phép tính lương trong central salary engine, không tạo logic tính lương riêng ở action.
* **Thay đổi chính**:
  * Snapshot current-month `salary_records` theo KTV/month/tenant trước khi gọi `recalculateAndSaveSalaryRecord`.
  * Audit log ghi cả `old_data` và `new_data` cho thay đổi cấu hình lương.
  * Nếu audit fail sau khi recalc thành công, action rollback row cũ bằng `id`; nếu trước đó chưa có row thì xóa row current-month vừa sinh theo KTV/month/tenant.
  * Nếu rollback cũng fail, response trả rõ cả lỗi audit và lỗi rollback; không revalidate trang lương trong nhánh failure.
  * Thêm `admin-salary-actions.test.ts` với 5 test cho audit success, rollback update, rollback delete, rollback-failure reporting và recalc failure không audit.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Update Base Salary Recalculation
* **Mục tiêu kỹ thuật**:
  * Siết `updateBaseSalary` để thay đổi lương cứng KTV luôn đồng bộ current-month `salary_records` qua central salary engine.
  * Tránh trạng thái `users.base_salary` đã đổi nhưng salary record hoặc audit log bị lệch.
* **Thay đổi chính**:
  * Snapshot `base_salary`, `role`, `tenant_id` của user trước khi update.
  * Nếu target là KTV, gọi `recalculateAndSaveSalaryRecordEngine` sau khi cập nhật lương cứng.
  * Nếu salary recalc fail, rollback `users.base_salary` về snapshot và recalc lại lương cũ.
  * Nếu audit fail sau recalc, rollback `users.base_salary`, recalc lại salary cũ và trả failure rõ.
  * Mở rộng `user-actions.test.ts` lên 18 test, assert KTV recalc, non-KTV skip, recalc rollback và audit rollback.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Delete User Audit Rollback
* **Mục tiêu kỹ thuật**:
  * Siết `deleteUser` để không còn hard-delete user thành công nhưng audit log bị thiếu.
  * Giữ hard-delete hiện tại, chỉ thêm snapshot và compensating restore khi audit fail.
* **Thay đổi chính**:
  * Snapshot toàn bộ row `users` và các `staff_leaves` liên quan trước khi delete.
  * Ghi audit delete với `old_data` là snapshot user đã bị xóa.
  * Nếu `recordAuditLog` fail sau khi delete thành công, action insert lại snapshot user và các leave bị cascade.
  * Error trả về bao gồm restore failure nếu khôi phục user hoặc staff leave cũng lỗi.
  * Mở rộng `user-actions.test.ts` lên 14 test, assert delete success, snapshot failure, audit failure restore, cascade restore và restore-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Create User Rollback
* **Mục tiêu kỹ thuật**:
  * Siết `createUser` để không còn rollback Auth user bị nuốt lỗi khi insert `public.users` thất bại.
  * Đảm bảo nếu audit log tạo user fail sau khi profile đã được insert, action cleanup profile/Auth và trả failure rõ thay vì để user thiếu audit.
* **Thay đổi chính**:
  * Thêm rollback helper cho Auth user và `public.users` profile.
  * Type hóa payload insert user bằng `Database['public']['Tables']['users']['Insert']`, bỏ cast lỏng ở payload insert.
  * Nếu profile insert fail, action gọi Auth delete và gắn lỗi rollback vào response nếu Auth cleanup fail.
  * Nếu audit insert fail, action rollback profile rồi rollback Auth user, không revalidate settings.
  * Mở rộng `user-actions.test.ts` lên 9 test, assert Auth/profile/audit side effects và cleanup-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden User Update Audit Rollback
* **Mục tiêu kỹ thuật**:
  * Siết các mutation cập nhật user để không còn trạng thái user đã đổi nhưng audit log bị thiếu.
  * Bắt đầu với `updateUserStatus` và `updateUser`, chưa chạm create/delete/base salary để tránh trộn auth rollback và salary lifecycle.
* **Thay đổi chính**:
  * Snapshot field user trước khi update: `status`, hoặc `full_name`/`role`.
  * Nếu `recordAuditLog` fail sau khi update DB thành công, action rollback user về snapshot và trả failure rõ.
  * Error trả về bao gồm rollback failure nếu rollback user cũng lỗi.
  * Thêm `user-actions.test.ts` với 4 test side-effect cho audit success, audit failure rollback và rollback-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Lock Start Session GPS Warnings
* **Mục tiêu kỹ thuật**:
  * Khóa rõ ranh giới critical/non-critical trong `startSession`.
  * Xác nhận session start và booking update vẫn là side-effect bắt buộc, còn GPS enrichment chỉ trả warning sau khi check-in chính đã thành công.
* **Thay đổi chính**:
  * Không đổi production code vì behavior hiện tại đúng phạm vi nghiệp vụ.
  * Bổ sung test cho lỗi lưu GPS vào `session_logs` khi check-in: action vẫn success với warning, không rollback.
  * Bổ sung test khi cả session GPS và customer GPS cùng lỗi: warning được gom đầy đủ, không che lỗi booking/session critical.
  * Mở rộng `ktv-actions.test.ts` lên 17 test.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden KTV Booking Rollback
* **Mục tiêu kỹ thuật**:
  * Hoàn thiện rollback cho `completeKTVSession` khi booking update đã thành công nhưng bước cleanup phía sau lỗi.
  * Tránh trạng thái lệch: session/inventory đã rollback nhưng booking vẫn ở `completed` hoặc trạng thái mới.
* **Thay đổi chính**:
  * Snapshot `bookings.status`, `is_in_care`, `updated_at` trước khi cập nhật trạng thái booking.
  * Nếu lỗi xảy ra sau booking update thành công, rollback helper sẽ khôi phục booking trước khi rollback session.
  * Error trả về gom thêm lỗi rollback booking nếu khôi phục booking thất bại.
  * Mở rộng `ktv-actions.test.ts` lên 15 test, assert rollback booking và rollback-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden KTV Session Cleanup Failure
* **Mục tiêu kỹ thuật**:
  * Đóng lỗi silent DB failure cuối luồng `completeKTVSession` khi booking đã hoàn tất.
  * Tránh trả success nếu bước xóa các `session_logs` scheduled dư bị lỗi, vì booking completed nhưng lịch dư vẫn còn.
* **Thay đổi chính**:
  * Kiểm tra kết quả cleanup delete sau khi booking đạt trạng thái hoàn tất.
  * Nếu cleanup delete lỗi, action trả failure rõ và đi qua rollback helper để hoàn tác session/inventory đã hoàn thành trước đó.
  * Mở rộng `ktv-actions.test.ts` lên 14 test, bao phủ cleanup delete failure và case booking chưa hoàn tất không gọi cleanup.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden KTV Session Completion Side Effects
* **Mục tiêu kỹ thuật**:
  * Siết luồng hoàn thành ca KTV sau khi auto-consume inventory đã chạy thành công.
  * Tránh trường hợp session bị rollback khỏi trạng thái `completed` nhưng vật tư tiêu hao và inventory logs vẫn còn, làm lệch kho và COGS.
* **Thay đổi chính**:
  * `completeKTVSession` track khi `autoConsumeForSession` thật sự tạo side-effect inventory (`processed` hoặc `totalCost` > 0).
  * Nếu lỗi xảy ra ở bước đếm ca hoàn thành hoặc cập nhật booking sau khi đã trừ kho, action gọi `rollbackInventoryConsumption(sessionId)` trước khi trả failure.
  * Error trả về bao gồm lỗi rollback inventory nếu quá trình hoàn kho cũng thất bại.
  * Giữ nguyên hành vi checkout GPS là warning không-critical khi các bước nghiệp vụ chính thành công.
  * Mở rộng `ktv-actions.test.ts` lên 12 test, bao phủ rollback inventory khi count/booking lỗi và không rollback khi auto-consume bị bypass.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Leave Reassignment Rollback
* **Mục tiêu kỹ thuật**:
  * Siết tiếp luồng phê duyệt nghỉ phép sau khi đã rollback `staff_leaves` khi ghi `attendance` lỗi.
  * Tránh trạng thái ca đã bị điều chuyển người làm thay nhưng đơn nghỉ không được duyệt hoặc chấm công không được ghi nhận.
* **Thay đổi chính**:
  * `approveLeaveRequest` snapshot `session_logs.completed_by_ktv_id` và `notes` trước mỗi reassignment.
  * Nếu approve leave hoặc attendance side effect lỗi sau khi đã điều chuyển ca, action rollback các `session_logs` đã đổi theo thứ tự ngược.
  * Rollback failure của reassignment được trả về trong error text thay vì bị che mất.
  * Mở rộng `attendance-actions.test.ts` lên 13 test, bao phủ reassignment success, approval failure rollback, attendance failure rollback và reassignment rollback failure.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/attendance-actions.test.ts --runInBand` pass.
  * Các lệnh verify bổ sung được chạy trước khi commit: `security-hardening`, `tsc`, `eslint`.

### 🟢 Ngày 01/06/2026: Harden Attendance Leave Approval
* **Mục tiêu kỹ thuật**:
  * Siết luồng phê duyệt nghỉ phép KTV để trạng thái leave và dữ liệu chấm công luôn nhất quán.
  * Tránh trường hợp đơn nghỉ đã `approved` nhưng không có bản ghi `attendance`, làm lệch tính lương pro-rata và auto-deduction.
* **Thay đổi chính**:
  * `approveLeaveRequest` snapshot `staff_leaves.status` và `approved_by` trước khi approve.
  * Nếu đọc/ghi `attendance` lỗi sau khi approve leave, action rollback leave về trạng thái cũ và trả lỗi rõ.
  * Type hóa payload update/insert liên quan tới `staff_leaves` và `attendance` bằng Supabase generated types.
  * Mở rộng `attendance-actions.test.ts` lên 9 test, bao phủ full-day `absent`, half-day `half_day`, rollback khi attendance insert/update lỗi, và rollback-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/attendance-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/attendance-actions.ts src/__tests__/attendance-actions.test.ts` pass, còn warning `any` cũ trong `attendance-actions.ts`.

### 🟢 Ngày 01/06/2026: Harden Finance Transaction Outbox
* **Mục tiêu kỹ thuật**:
  * Siết luồng Finance legacy khi transaction đã ghi DB nhưng accounting outbox enqueue lỗi.
  * Tránh báo cáo ghi nhận doanh thu/chi phí `confirmed`/`approved` trong khi kế toán tự động không có event tương ứng.
* **Thay đổi chính**:
  * `confirmTransaction` snapshot các field mutable của `revenue`/`expenses` trước khi confirm và rollback nếu outbox lỗi.
  * Nhánh lương trong confirm expense rollback cả `salary_records` và `expenses` nếu `SALARY_PAID` outbox lỗi.
  * `recordTransaction` xóa row `revenue`/`expenses` vừa insert nếu transaction đã confirmed/approved nhưng outbox lỗi.
  * Thêm `finance-transaction-mutations.test.ts` với 5 test side-effect cho rollback revenue, expense, salary và rollback-failure reporting.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/finance-transaction-mutations.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/dual-mode-accounting.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/finance/transaction-mutations.ts src/__tests__/finance-transaction-mutations.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Inventory Transfer Rollbacks
* **Mục tiêu kỹ thuật**:
  * Siết luồng chuyển kho nội bộ sau khi đã harden tiêu hao kho tự động.
  * Tránh trạng thái kho/log bị lệch với trạng thái đơn nếu lỗi xảy ra sau khi đã trừ/cộng kho một phần.
* **Thay đổi chính**:
  * `approveAndShipTransfer` track các lần trừ kho + log shipment đã thành công và rollback theo thứ tự ngược nếu item sau hoặc cập nhật trạng thái đơn lỗi.
  * `confirmTransferReceipt` track các lần cộng kho + log receipt đã thành công và rollback nếu item sau hoặc cập nhật trạng thái đơn lỗi.
  * Rollback xóa log chuyển kho bằng tuple hẹp `item_id`, `reason`, `tenant_id`, `notes` để không đụng lịch sử kho khác.
  * Mở rộng `inventory-transfer.test.ts` lên 29 test, bao phủ rollback partial shipment, shipment status update failure, partial receipt, và receipt status update failure.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/inventory-transfer.test.ts --runInBand` pass.
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/inventory-transfer-actions.ts src/__tests__/inventory-transfer.test.ts` pass.

### 🟢 Ngày 01/06/2026: Harden Auto Consume Inventory
* **Mục tiêu kỹ thuật**:
  * Khóa luồng tự động trừ kho khi hoàn thành buổi liệu trình, nơi định mức package chuyển thành cập nhật tồn kho thật.
  * Giảm rủi ro trừ kho một phần nhưng không hoàn kho nếu vật tư sau đó thiếu tồn hoặc ghi outbox kế toán lỗi.
* **Thay đổi chính**:
  * Mở rộng `inventory-actions.test.ts` lên 17 test.
  * Mock `enqueueWithAutoClient` để assert sự kiện `INVENTORY_CONSUMED` được gọi đúng tổng chi phí vật tư.
  * Bổ sung coverage cho auto-consume disabled, consume nhiều vật tư thành công, rollback khi vật tư thứ hai thiếu tồn, và rollback khi accounting outbox enqueue lỗi.
  * Không đổi implementation vì test xác nhận `autoConsumeForSession` hiện đã propagation lỗi và rollback đúng theo session log.
* **Kiểm tra**:
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.

### 🟢 Ngày 01/06/2026: Harden Package Materials
* **Mục tiêu kỹ thuật**:
  * Hoàn tất trục Services → Package → Materials bằng cách siết luồng lưu định mức tiêu hao vật tư theo gói.
  * Giảm rủi ro mất định mức cũ nếu thao tác thay thế vật tư bị lỗi giữa chừng.
* **Thay đổi chính**:
  * `upsertPackageMaterials` snapshot định mức cũ trước khi xóa.
  * Nếu insert định mức mới thất bại, hệ thống tự restore định mức cũ và trả lỗi rõ ràng.
  * Nếu restore cũng thất bại, lỗi trả về bao gồm cả lỗi insert mới và lỗi rollback.
  * Mở rộng `inventory-actions.test.ts` lên 13 test, bổ sung coverage cho replace, empty replace, delete failure, insert failure rollback và rollback failure.
* **Kiểm tra**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/inventory-actions.ts src/__tests__/inventory-actions.test.ts` pass.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.

### 🟢 Ngày 01/06/2026: Wire Services page sang Package Actions
* **Mục tiêu kỹ thuật**:
  * Loại bỏ đường ghi `packages` trực tiếp từ browser Supabase trong hook Services sau khi `package-actions` đã được harden.
  * Gom package CRUD về action boundary đã type hóa, audit và rollback-test, trong khi giữ nguyên luồng `package_materials`.
* **Thay đổi chính**:
  * `useServicesPageState` chuyển load danh sách package sang `getPackages`.
  * Add/edit/delete/toggle status trong Services hook chuyển sang `createPackage`, `updatePackage`, `deletePackage`.
  * Đồng bộ gói mặc định gọi `createPackage` theo từng gói để đi qua audit/rollback path.
  * Phần định mức tiêu hao vật tư tiếp tục dùng `upsertPackageMaterials` như trước.
* **Kiểm tra**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/app/dashboard/services/hooks/useServicesPageState.ts src/services/package-actions.ts` pass.
  * `npm.cmd test -- src/__tests__/package-actions.test.ts --runInBand` pass.

### 🟢 Ngày 01/06/2026: Harden Package Actions
* **Mục tiêu kỹ thuật**:
  * Siết lớp Server Actions quản lý package sau khi đã tách state của màn hình Services.
  * Giảm rủi ro lỗi âm thầm ở package CRUD, nơi liên quan đến booking, dịch vụ, định mức vật tư và hệ số quy đổi ca KTV.
* **Thay đổi chính**:
  * Type hóa `src/services/package-actions.ts` bằng Supabase generated types cho `packages` Row/Insert/Update.
  * Thay payload `any` bằng `PackageActionInput` rõ ràng, chuẩn hóa giá, số buổi, hoa hồng và chi tiết dịch vụ trước khi ghi DB.
  * Siết rollback audit cho create/update/delete: nếu rollback DB thất bại, action trả lỗi gồm cả lỗi audit và lỗi rollback thay vì che mất lỗi phụ.
  * Mở rộng `src/__tests__/package-actions.test.ts` lên 8 test, assert side effects cho insert/update/delete, audit log, rollback create/update/delete và failure propagation.
* **Kiểm tra**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/services/package-actions.ts src/__tests__/package-actions.test.ts` pass.
  * `npm.cmd test -- src/__tests__/package-actions.test.ts --runInBand` pass.

### 🟢 Ngày 01/06/2026: Refactor Services page state theo BMAD
* **Mục tiêu kỹ thuật**:
  * Tiếp tục giảm rủi ro bảo trì sau inventory refactor bằng cách tách logic state/action khỏi `src/app/dashboard/services/page.tsx`.
  * Giữ nguyên UI và hành vi hiện tại của màn hình Quản lý dịch vụ, gồm filter, pagination, modal add/edit, sync package mặc định và định mức tiêu hao vật tư.
* **Thay đổi chính**:
  * Tạo `src/app/dashboard/services/types.ts` để gom type cho package, inventory item, status/filter, modal mode và material row dựa trên Supabase generated types.
  * Tạo `src/app/dashboard/services/constants.ts` để gom `PAGE_SIZE` và factory form rỗng.
  * Tạo `src/app/dashboard/services/hooks/useServicesPageState.ts` để quản lý load packages/inventory items, modal form, CRUD package, toggle status, sync default packages, material rows và pagination.
  * Thu gọn `src/app/dashboard/services/page.tsx` về vai trò render UI, tương tự pattern đã áp dụng cho inventory page.
* **Kiểm tra**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/app/dashboard/services/page.tsx src/app/dashboard/services/types.ts src/app/dashboard/services/constants.ts src/app/dashboard/services/hooks/useServicesPageState.ts` pass.

### 🟢 Ngày 01/06/2026: Refactor Inventory page bước 1
* **Mục tiêu nghiệp vụ/kỹ thuật**:
  * Tiếp tục giảm rủi ro bảo trì ở khu vực kho vật tư, nơi liên quan trực tiếp đến tồn kho, kiểm kê, yêu cầu cấp hàng từ HQ và log audit.
  * Tách state/fetch/mutation khỏi `src/app/dashboard/inventory/page.tsx` để page chính tập trung render UI, dễ review và dễ tiếp tục tách component.
* **Inventory refactor**:
  * Tạo `src/app/dashboard/inventory/types.ts` để gom type cho inventory item, inventory log, reconciliation row, tab/filter và request cart item.
  * Tạo `src/app/dashboard/inventory/constants.ts` để gom danh sách tháng/năm dùng chung.
  * Tạo `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` để quản lý dữ liệu tồn kho, log kho, lệnh chuyển kho, modal thêm vật tư, điều chỉnh kho và kiểm kê cuối tháng.
  * Giữ nguyên UI hiện tại trong `page.tsx`, nhưng giảm file từ khoảng 1.108 dòng xuống khoảng 812 dòng sau khi tách state/handler.
  * Siết hành vi lỗi trong phần client inventory: lỗi fetch items/logs không còn chỉ `console.error` rồi tiếp tục set dữ liệu rỗng; lỗi ghi `inventory_logs` khi điều chỉnh kho hoặc tạo tồn ban đầu sẽ được kiểm tra và báo lỗi rõ.
  * Type hóa payload insert/update bằng Supabase generated types cho `inventory_items` và `inventory_logs`.
  * Tách tiếp UI inventory thành component chuyên trách: `InventoryPageHeader`, `InventoryTabs`, `InventoryStockPanel`, `InventoryTransferOrdersPanel`, `InventoryReconciliationPanel`, `InventoryLogsPanel`, `InventoryRestockModal`, `InventoryCreateRequestModal`, `InventoryAddItemModal`.
  * Sau bước tách component UI, `src/app/dashboard/inventory/page.tsx` giảm tiếp xuống khoảng 165 dòng và chỉ còn orchestration.
* **Inventory actions hardening**:
  * Type hóa payload insert/update cho `inventory_items`, `inventory_logs`, `package_materials` bằng Supabase generated types.
  * `restockItem` và `consumeInventory` không còn bỏ qua lỗi ghi `inventory_logs`; nếu log thất bại sau khi đã cập nhật tồn kho, hệ thống rollback tồn kho về giá trị trước đó và trả failure rõ ràng.
  * `saveMonthlyReconciliation` rollback tồn kho về expected khi update kiểm kê đã chạy nhưng ghi log kiểm kê thất bại.
  * `autoConsumeForSession` kiểm tra lỗi đọc tenant config và báo lỗi rollback nếu rollback inventory thất bại.
  * `rollbackInventoryConsumption` không còn bỏ qua lỗi fetch/update từng vật tư; nếu hoàn kho lỗi thì dừng và không xóa log tiêu hao.
  * Bổ sung test side-effect cho lỗi ghi log restock/consume và lỗi hoàn kho rollback.
* **Kiểm tra**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/app/dashboard/inventory/page.tsx src/app/dashboard/inventory/constants.ts src/app/dashboard/inventory/types.ts src/app/dashboard/inventory/hooks/useInventoryPageState.ts` pass.
  * `npx.cmd eslint src/app/dashboard/inventory/page.tsx src/app/dashboard/inventory/components/*.tsx src/app/dashboard/inventory/constants.ts src/app/dashboard/inventory/types.ts src/app/dashboard/inventory/hooks/useInventoryPageState.ts` pass sau khi tách UI.
  * `npx.cmd eslint src/services/inventory-actions.ts src/__tests__/inventory-actions.test.ts` pass.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` pass.
  * `npm.cmd test -- src/__tests__/transaction-safety.test.ts --runInBand` pass.
  * Freeze clock trong `src/__tests__/cross-module-integrity.test.ts` và `src/__tests__/e2e-pipeline.test.ts` về tháng 05/2026 để test không fail khi ngày hệ thống sang 01/06/2026.
  * `npm.cmd test -- src/__tests__/inventory-actions.test.ts src/__tests__/transaction-safety.test.ts src/__tests__/cross-module-integrity.test.ts src/__tests__/e2e-pipeline.test.ts src/__tests__/e2e-negative-pipeline.test.ts src/__tests__/state-machine.test.ts --runInBand` pass.

### 🟢 Ngày 31/05/2026: Refactor booking/KTV dashboard để giảm rủi ro bảo trì
* **Mục tiêu nghiệp vụ/kỹ thuật**:
  * Giảm rủi ro regression cho các màn hình vận hành có tần suất sử dụng cao: KTV dashboard, booking admin, timeline KTV, lịch tháng, modal tạo/dời lịch, modal chi tiết buổi chăm sóc và QR payment.
  * Chuyển các file page lớn từ dạng “ôm toàn bộ UI + state + fetch + realtime” sang cấu trúc component/hook rõ trách nhiệm, dễ kiểm tra và dễ rollback từng phần.
  * Giữ nguyên hành vi nghiệp vụ hiện có: không đổi schema DB, không đổi khóa ngoại, không đổi migration, không đổi luồng booking/session/QR/GPS.
* **KTV dashboard refactor**:
  * Tách các phần UI/flow lớn trong `src/app/ktv/dashboard/page.tsx` thành component riêng cho header, attendance/offline, sessions, navigation/notifications, check-in, profile, password, leave và checkout confirmation.
  * Type hóa state/effects chính của dashboard KTV để giảm coupling giữa UI mobile và logic check-in/out.
  * Kiểm tra: `npx.cmd tsc --noEmit` pass; ESLint cho KTV dashboard và component liên quan pass.
* **Booking admin refactor**:
  * Tách `src/app/dashboard/bookings/page.tsx` thành các component chuyên trách:
    * `BookingsPageHeader`
    * `BookingsMonthCalendar`
    * `BookingsTimelineDateRibbon`
    * `BookingsSpecialtyFilter`
    * `BookingsTimelineGrid`
    * `BookingsDayTimelineList`
    * `BookingDayDetailModal`
    * `BookingCreateScheduleModal`
  * Tách data/realtime vào `src/app/dashboard/bookings/hooks/useBookingsPageData.ts`, bao gồm fetch sessions, bookings, KTV, session history và Supabase realtime subscription.
  * Tách mutation/action vào `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts`, bao gồm QR payment, update session, dời lịch và tạo lịch chăm sóc mới.
  * Tách helper thuần vào `src/app/dashboard/bookings/utils/bookingsPageUtils.ts`, bao gồm `getMonthDays`, `isSameDay`, `buildSessionModalData`.
  * Tách tiếp `createSessionLog` và `rescheduleSession` khỏi `session-mutation-actions.ts` sang action file riêng, đồng thời giữ wrapper `session-actions.ts` để không đổi API gọi từ các màn hình.
  * Tách helper cho `updateSessionLog`: normalize payload, tự điền thông tin khi hoàn thành buổi, gọi completion engine/rollback, và sync booking progress được gom vào `update-session-log-helpers.ts`.
  * Tách helper cho `createBooking`: rate limit, tạo customer, resolve tenant, upsert booking/audit, ghi revenue cọc/outbox và tạo session logs ban đầu được gom vào `create-booking-helpers.ts`.
  * Tách helper cho `processSessionCompletion`: kiểm tra kỳ kế toán, trừ/rollback kho, sync booking progress, ghi revenue gói lẻ/outbox, sync lương KTV, review placeholder và SESSION_DONE outbox được gom vào `session-completion-helpers.ts`.
  * Tách helper cho payment actions: snapshot booking/payment, validate overpayment, kiểm tra khóa kỳ, gọi RPC `record_remaining_payment_atomic`, update share token và fetch QR/payment detail được gom vào `payment-helpers.ts`.
  * Tách salary recalculation engine: `recalculateAndSaveSalaryRecord` giữ wrapper public trong `admin-salary-actions.ts`, còn logic pro-rata, session multiplier, KPI sync, rating bonus, deductions và preserve non-draft được gom vào `salary-recalculation-engine.ts`.
  * Tách salary admin workflow helpers: kiểm tra khóa kỳ lương, tạo expense kế toán cho approve/finalize, audit status và revalidate dashboard được gom vào `admin-salary-workflow-helpers.ts`.
  * Bỏ global `window.fetchSessionHistory`, thay bằng callback từ hook; bỏ state thừa `isLoading`, `isFetchingQrData`.
  * Bỏ DOM side-effect `document.querySelector('input[name="date"]')` khi tạo lịch từ timeline; truyền `createDate` rõ ràng vào `BookingCreateScheduleModal`.
  * Type hóa dữ liệu booking chính: `TimelineSession`, `BookingModalData`, `BookingOption`, `KtvOption`, `SessionHistoryItem`, tenant QR info và payment revenue item.
  * `bookings/page.tsx` giảm từ khoảng hơn 1.500 dòng xuống khoảng 240 dòng sau khi tách UI + hook + utils.
* **Kiểm tra cuối chuỗi refactor**:
  * `npx.cmd tsc --noEmit` pass.
  * `npx.cmd eslint src/app/dashboard/bookings/page.tsx src/app/dashboard/bookings/components/*.tsx src/app/dashboard/bookings/hooks/*.ts src/app/dashboard/bookings/utils/*.ts` pass, không còn warning.
  * `npm.cmd test -- src/__tests__/transaction-safety.test.ts --runInBand` pass sau khi tách session mutation/update actions.
  * Các test liên quan `createBooking` pass sau khi tách helper: `transaction-safety`, `idempotency`, `concurrency`, `cross-module-integrity`, `e2e-pipeline`.
  * Sau khi tách `processSessionCompletion`: `tsc`, ESLint, `transaction-safety`, `e2e-pipeline`, `idempotency`, `concurrency`, `edge-cases` pass. `e2e-negative-pipeline` còn fail ở case overpayment do test đang tính cả revenue cọc setup từ `createBooking`.
  * Sau khi tách payment actions: `e2e-negative-pipeline`, `transaction-safety`, `cross-module-integrity`, `e2e-pipeline`, `subscription`, và `tsc` pass.
  * Sau khi tách salary recalculation engine: `tsc`, ESLint targeted, `salary`, `state-machine`, `edge-cases`, `salary-reconciliation`, `reconciliation` pass.
  * Sau khi tách salary admin workflow helpers: `tsc`, ESLint targeted, `salary`, `state-machine`, `edge-cases`, `salary-reconciliation`, `reconciliation` pass.
* **Commit nổi bật trong chuỗi refactor**:
  * `e8fc839` tách checkout confirmation modal cho KTV dashboard.
  * `eaa074b` type hóa state/effects KTV dashboard.
  * `9e4446e` tách booking page header.
  * `c0b2a23` tách timeline controls.
  * `6d03fe8` tách month calendar.
  * `5d641bd` gom mapping dữ liệu session modal.
  * `0a21a4f` tách day detail modal.
  * `3035176` tách create schedule modal.
  * `aa8f4e1` tách timeline grid.
  * `c6d505f` type hóa booking page state.
  * `39a3f4f` tách day timeline list.
  * `b46e245` tách page data hook.
  * `79d0411` tách page action hook.
  * `1e0eda0` tách page utilities.
  * `43d37a7` truyền create date explicit, bỏ DOM query thủ công.
  * `1694f4e` tách create/reschedule session actions khỏi mutation action lớn.

### 🟢 Ngày 30/05/2026: Hardening DB, GPS KTV, Salary/P&L và tối ưu UI HQ/Mobile
* **Nghiệp vụ thực hiện**:
  * Chuẩn hóa bộ quy tắc chống hồi quy trong `AGENTS.md`: Zero Silent DB Failures, side-effect assertions, strict DB payload typing, salary recalculation engine, trạng thái P&L, salary reconciliation legacy consistency, và package-based KTV session multipliers.
  * Hoàn thiện logic lương KTV: tính session quy đổi theo `packages.session_multiplier`, đồng bộ KPI từ `kpi_records`, bảo toàn manual approvals khi salary record không còn draft, và loại `NO_LEGACY/PENDING_LEGACY` khỏi nhóm lệch lớn trong salary reconciliation.
  * Siết báo cáo tài chính/P&L: chỉ ghi nhận doanh thu `confirmed`, chỉ tính chi phí `approved/paid`, dùng salary record đã lưu nếu có, và pro-rata lương KTV cho record chưa lưu.
  * Đảm bảo KTV vẫn check-in/check-out được khi GPS lỗi: GPS trở thành thao tác phụ trợ, chỉ trả warning; lỗi quan trọng như cập nhật booking, trừ kho, đếm session vẫn rollback để tránh dữ liệu nửa vời.
  * Sửa các màn HQ và financial overview: danh sách chi nhánh hiển thị đúng Bella Spa/HQ, loại bỏ số liệu fallback giả, sửa matrix phân phối liệu trình chuẩn, và chỉnh responsive mobile cho header/date filter/thẻ liệu trình.
  * Bổ sung hiển thị GPS check-in/check-out trong thẻ liệu trình đã hoàn thành của admin, kèm link Google Maps khi có tọa độ.
* **Kỹ thuật**:
  * Harden nhiều Server Actions để không nuốt lỗi DB: audit actions, brand service, customer/package audit rollback, session audit rollback, dashboard/customer/attendance/KTV reads, và KTV session start/complete rollback.
  * Cập nhật `.gitignore` để bỏ qua `.env`, `.env.*`, vẫn cho phép `.env.example`; cấu hình Vercel đúng project `bella-spa-s-projects/bella-spa-erp`.
  * Sửa `getBrandDistributionMatrix()` không dùng embed `packages.select('*, tenants(name)')` khi schema không có FK trực tiếp; fetch tenants riêng rồi map bằng `tenant_id`.
  * Sửa financial chart legend bằng legend thủ công để màu chú thích khớp màu cột (`Doanh thu thuần` hồng, `Lợi nhuận sau thuế` xanh).
  * Thêm/điều chỉnh Jest coverage cho HQ actions, brand distribution matrix, KTV GPS warning/rollback, GPS geocode attendance, salary/reconciliation/P&L regression cases.
  * Kết quả kiểm tra cuối ngày: `npx.cmd tsc --noEmit` pass; full Jest đạt **51 test suites / 519 tests pass**.
* **Commit nổi bật trong ngày**:
  * `9531578` nâng cấp GPS day-by-day check-in/out và customer geolocation.
  * `aab12d7`, `2ed15c1`, `cce05fe` chuẩn hóa salary recalculation và package session multipliers.
  * `2f5c153`, `6afdec7` sửa strict P&L filters và dynamic KTV salary fund.
  * `955121f`, `b4a15d5`, `6b7c254` sửa salary reconciliation legacy/discrepancy logic.
  * `08e5039` đến `6c0d9ac` hardening audit/transaction/read failures.
  * `497a2f6` cho phép KTV check-in/check-out khi GPS lỗi, chỉ warning.
  * `0e4b774`, `e22c7ce` sửa HQ branch list và brand distribution matrix.
  * `125fcf2`, `c175d89`, `9852cda`, `2827429`, `a32f4fa` tối ưu UI HQ/mobile, financial chart và thẻ liệu trình.

### 🟢 Ngày 29/05/2026: Tích hợp nút Refresh (F5)
* **Nghiệp vụ thực hiện**:
  * Tích hợp nút làm mới dữ liệu (tương tự chức năng F5 của trình duyệt) trực quan và đồng bộ trên cả hai giao diện Kỹ thuật viên (KTV) và cổng thông tin Khách hàng (Portal).
  * Giúp KTV và Khách hàng chủ động reload cập nhật trạng thái dữ liệu mới nhất (Điểm danh, Check-in/out, Đánh giá ca làm, Tiến độ gói dịch vụ) mà không cần tải lại thủ công bằng trình duyệt.
* **Kỹ thuật**:
  * Chèn nút bấm tròn làm mới trang với biểu tượng `RefreshCw` ở Header góc phải trên cùng (cạnh nút Profile Settings) trên KTV Dashboard (`src/app/ktv/dashboard/page.tsx`).
  * Điều chỉnh bố cục tiêu đề chào mừng của Khách hàng thành `flex justify-between items-center` và bổ sung nút Refresh tinh tế phía bên phải trên Customer Portal (`src/app/portal/[token]/page.tsx`).
  * Sử dụng API `window.location.reload()`.
  * Chạy biên dịch TypeScript và chạy qua thành công **445/445** ca test Jest an toàn 100%.

### 🟢 Ngày 28/05/2026: Kiểm toán QA & QA Nghiệm thu 3 Lớp
* **Nghiệp vụ thực hiện**:
  * Thực hiện cuộc kiểm toán toàn diện & QA nghiệm thu 3 lớp cực kỳ nghiêm ngặt trên hệ thống Bella Spa ERP.
  * Khắc phục lỗi tự động phóng to (auto-zoom) khó chịu của iOS Safari khi người dùng click nhập dữ liệu trên PWA mobile.
* **Kỹ thuật**:
  * Tạo mới **7 bộ test tự động Jest** (`state-machine`, `transaction-safety`, `idempotency`, `concurrency`, `edge-cases`, `cross-module-integrity`, `security-hardening`) nâng tổng số test lên 445 pass hoàn hảo.
  * Cấu hình quy tắc CSS tối ưu trong `globals.css` (bọc trong `@media (max-width: 767px)`) đặt thuộc tính `font-size: 16px !important` cho tất cả các phần tử `input`, `textarea` và `select` trên màn hình nhỏ.
  * Nâng cấp **2 bộ test E2E Playwright** (`06-cross-module-verification` và `07-security-boundary`) chạy pass hoàn hảo trên Cloud Staging DB thực tế.
  * Xây dựng báo cáo kiểm toán HTML cao cấp phong cách Rose Spa sang trọng.

### 🟢 Ngày 27/05/2026: Tối ưu UI Đăng ký Đổi ca & Theme Switcher
* **Nghiệp vụ thực hiện**:
  * Khắc phục triệt để lỗi giao diện cắt chữ ThemeToggle (nút chuyển giao diện Sáng/Tối) trên PC và Mobile.
  * Tối ưu hóa UI đăng ký nghỉ phép và đổi ca của KTV để hiển thị lịch làm thay chính xác.
* **Kỹ thuật**:
  * Điều chỉnh cấu trúc CSS và layout flexbox của ThemeToggle để không bị cắt chữ hoặc tràn màn hình ở các độ phân giải responsive khác nhau.
  * Cập nhật logic timeline của Admin để ưu tiên sử dụng `s.completed_by_ktv_id` (KTV làm thay) khi hiển thị phân ca ngày, tự động đồng bộ hóa lịch của KTV Bella làm thay KTV Thúy Vân.

### 🟢 Ngày 26/05/2026: AI Agent Infrastructure & Salary Reconciliation
* **Nghiệp vụ thực hiện**:
  * Xây dựng cơ sở hạ tầng AI Agent (AI COO Service) hỗ trợ tính toán lương, đối soát và tự động phát hiện dị thường tài chính.
* **Kỹ thuật**:
  * Viết các function database an toàn và phân quyền RLS cho phép `service_role` của AI gọi RPC thực thi đối soát chéo.
  * Phát triển màn hình và Server Actions Đối soát lương KTV (`salary_reconciliation`).

### 🟢 Ngày 25/05/2026: Hệ thống Kế toán Kép (Dual-mode Accounting) & Period Closing
* **Nghiệp vụ thực hiện**:
  * Tích hợp hệ thống kế toán kép tự động đồng bộ dòng tiền với sổ cái (General Ledger) và báo cáo tài chính P&L.
  * Hỗ trợ chức năng khóa kỳ kế toán theo tháng và tự động phân bổ chi phí lương KTV tạm tính lũy kế.
* **Kỹ thuật**:
  * Tạo bảng `accounting_outbox`, `accounting_periods` và cài đặt trigger tự động đẩy giao dịch vào sổ cái.
  * Xây dựng báo cáo Cash Flow Statement (Lưu chuyển tiền tệ) và Consolidated P&L (Báo cáo kết quả kinh doanh hợp nhất) thời gian thực của các chi nhánh.

### 🟢 Ngày 22/05/2026: Hệ thống Nhượng quyền & Chế độ Ngoại tuyến (Offline Mode)
* **Nghiệp vụ thực hiện**:
  * Thiết lập cấu trúc Đa chi nhánh (Multi-tenant) độc lập dữ liệu nhưng đồng quy dòng tiền Royalty (Phí nhượng quyền) 10% về tổng bộ HQ.
  * Phát triển tính năng Đồng bộ Ngoại tuyến (Offline Sync / Dexie DB) cho KTV làm việc tại vùng mất sóng mạng 4G.
* **Kỹ thuật**:
  * Cài đặt RLS thắt chặt trên toàn bộ 16 bảng dữ liệu của Supabase.
  * Viết hook `useOfflineSync` và database Dexie trên trình duyệt di động để lưu tạm các thao tác Check-in, Bắt đầu ca, Kết thúc ca của KTV khi không có mạng, tự động đồng bộ khi có kết nối trở lại.

### 🟢 Ngày 21/05/2026: Tích điểm Loyalty & Đối soát Tài chính chi tiết
* **Nghiệp vụ thực hiện**:
  * Triển khai hệ thống Tích điểm Loyalty tự động cho mẹ bầu sau mỗi giao dịch thanh toán thành công (Tỷ lệ 100.000đ = 1 điểm).
  * Nâng cấp màn hình Đối soát tài chính với nút "Điều tra lệch" và hỗ trợ ghi nhận số tiền âm (Refund) để cân bằng sổ cái đối soát.
* **Kỹ thuật**:
  * Tạo trigger database `trg_calculate_loyalty_points` trên bảng `revenue`.
  * Viết script chạy Retroactive tự động cập nhật điểm thưởng lịch sử cho toàn bộ 27 khách hàng cũ.
  * Tạo liên kết điều tra trực tiếp từ trang đối soát tài chính về trang chi tiết khách hàng và lịch sử thanh toán chi tiết.

---

## 📌 Các quy tắc & bài học kỹ thuật cốt lõi tích lũy

1. **Zero Silent Database Failures (Chặn đứng nuốt lỗi DB):**
   - Tất cả các Server Actions hoặc DB mutations bắt buộc phải re-throw lỗi hoặc trả về explicit error status để các test suites tự động hoặc caller components có thể dừng ngay tiến trình khi có lỗi xảy ra.
2. **Quy tắc Font 16px trên Mobile:**
   - Cưỡng chế `font-size: 16px !important` cho tất cả các phần tử `input`, `textarea` và `select` trên màn hình di động (`max-width: 767px`) để tránh lỗi auto-zoom khó chịu của Safari iOS khi click nhập dữ liệu.
3. **Database Payload Typing nghiêm ngặt:**
   - Luôn sử dụng kiểu dữ liệu tự động tạo từ Supabase (ví dụ: `Database['public']['Tables']['attendance']['Insert']`) thay vì `as any` để TypeScript compiler (`npx tsc --noEmit`) tự động bắt lỗi sai cột/mismatch kiểu khi build.
