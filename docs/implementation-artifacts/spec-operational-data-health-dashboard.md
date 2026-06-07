---
status: done
date: 2026-06-07
area: accounting-health
---

# Operational Data Health Dashboard

## Intent

Đưa các rule kiểm tra dữ liệu kinh doanh đã chạy trong CI lên giao diện quản trị để admin/kế toán có thể tự quét và nhìn thấy lỗi vận hành: thanh toán lệch booking, doanh thu thiếu side-effect, lương nháp lệch số ca, kho thiếu log trừ vật tư, sổ cái/outbox lỗi và metadata cần review.

## Scope

- Thêm server action `getBusinessHealthSummary` đọc dữ liệu theo `tenant_id` hiện tại.
- Tái dùng rule thuần từ `scripts/check-business-invariants.cjs` thay vì viết lại công thức.
- Hiển thị khối “Sức khỏe dữ liệu vận hành” trên `/dashboard/accounting/health`.
- Phân loại lỗi chặn và cảnh báo bằng tiếng Việt vận hành, kèm link sang màn hình xử lý liên quan.
- Thêm quick repair whitelist cho hai luồng đã có audit/revalidate sẵn: replay outbox bị kẹt và backfill metadata kế toán.
- Thêm repair có xác nhận cho lỗi booking đã đủ cọc nhưng vẫn ở trạng thái `deposit_pending`.
- Thêm repair có xác nhận cho lỗi số buổi hoàn thành trên booking lệch với log ca thực tế.
- Thêm repair có xác nhận cho lỗi ca hoàn thành thiếu log tiêu hao kho, dùng lại engine `autoConsumeForSession`.
- Thêm repair có xác nhận cho lỗi ca hoàn thành thiếu side-effect kế toán `SESSION_DONE`, enqueue lại outbox bằng rule engine chuẩn.
- Thêm repair có xác nhận cho lỗi ca đã trừ kho nhưng thiếu side-effect kế toán `INVENTORY_CONSUMED`, tính lại giá trị tiêu hao từ log kho và đơn giá vật tư trước khi enqueue outbox.
- Thêm repair có xác nhận cho lỗi khoản thu gói/cọc đã xác nhận nhưng thiếu side-effect kế toán `PACKAGE_SALE`, enqueue lại outbox bằng rule engine chuẩn.
- Chưa thêm auto-fix lương/session sâu vì cần quy trình duyệt và rollback riêng.

## Safety Rules

- Query lỗi phải throw rõ ràng, không trả về summary giả khỏe.
- Mọi dữ liệu đọc theo tenant của admin hiện tại.
- Quick repair chỉ gọi action chuẩn đã có audit trail: `replayOutboxEvent` và `runAccountingMetadataBackfill`.
- Repair booking cọc phải đọc lại booking và revenue mới nhất, chỉ update `deposit_pending -> booked` khi confirmed payment đủ mức cọc; nếu ghi audit thất bại thì rollback trạng thái booking.
- Repair số buổi booking phải đọc lại log ca `completed` mới nhất, chỉ update trường `bookings.completed_sessions`, chặn booking đã `cancelled` hoặc `completed`, và rollback bộ đếm nếu audit thất bại.
- Repair thiếu tiêu hao kho phải đọc lại ca, booking, định mức vật tư và log kho mới nhất; ghi audit trước khi gọi engine kho; không tạo trùng log nếu ca đã có tiêu hao.
- Manual inventory repair được phép gọi `autoConsumeForSession(..., { force: true })` để xử lý dữ liệu lịch sử kể cả khi cấu hình auto-consume đang tắt, nhưng vẫn dùng engine chuẩn để trừ tồn, ghi log và enqueue outbox kế toán.
- Repair `SESSION_DONE` phải đọc lại ca, booking, doanh thu đã xác nhận và dấu vết outbox/journal mới nhất; ghi audit trước khi enqueue; không tạo trùng nếu đã có outbox `SESSION_DONE` hoặc bút toán active.
- Repair `SESSION_DONE` chỉ enqueue vào `accounting_outbox`; worker kế toán chịu trách nhiệm post journal và vẫn áp dụng guard stale session như hiện có.
- Repair `INVENTORY_CONSUMED` phải đọc lại ca, booking, log kho, vật tư và dấu vết outbox/journal mới nhất; chặn tạo trùng nếu đã có outbox `INVENTORY_CONSUMED` hoặc journal `INVENTORY_CONSUMPTION` active.
- Repair `INVENTORY_CONSUMED` không được tạo bút toán 0đ: nếu log kho thiếu vật tư hoặc vật tư chưa có đơn giá, action phải fail rõ ràng để admin cập nhật cấu hình giá vốn trước.
- Repair `PACKAGE_SALE` phải đọc lại khoản thu, booking và dấu vết outbox/journal mới nhất; chỉ chạy khi khoản thu đã `confirmed`, thuộc nhóm cọc/thanh toán gói, số tiền dương, và booking hợp lệ cùng chi nhánh.
- Repair `PACKAGE_SALE` chỉ enqueue vào `accounting_outbox`; worker kế toán chịu trách nhiệm post journal `PACKAGE_SALE`, nhờ vậy không có đường ghi sổ song song.
- Không tự sửa lương, tạo/xóa session hoặc bypass engine side-effect nghiệp vụ trong dashboard health.
- Không thay đổi rule tính toán hiện có.

## Verification

- Added `src/__tests__/business-health.test.ts`.
- Focused verification: `npm.cmd test -- src/__tests__/business-health.test.ts src/__tests__/business-invariants-check.test.ts --runInBand`.
- Lint verification: `npm.cmd run lint -- src/services/accounting/business-health.ts src/services/accounting-actions.ts src/services/accounting/types.ts src/app/dashboard/accounting/health/page.tsx src/__tests__/business-health.test.ts`.
- Production build verification: `npm.cmd run build`.
