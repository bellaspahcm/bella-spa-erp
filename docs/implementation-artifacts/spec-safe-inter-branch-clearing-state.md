# Safe Inter-Branch Clearing State

## Mục tiêu

Khóa luồng gạch nợ bù trừ chi nhánh để không thể chuyển nhầm trạng thái khi bản ghi đã được xử lý, bị hủy, hoặc có hai thao tác gạch nợ chạy gần như cùng lúc.

## Phạm vi đã xử lý

- Chỉ cho phép gạch nợ bản ghi đang ở trạng thái `pending`.
- Lệnh cập nhật dùng điều kiện kép `id` và `status = pending` để chống race condition.
- Nếu bản ghi vừa bị thao tác khác xử lý, hệ thống trả lỗi rõ ràng và yêu cầu quét lại dữ liệu.
- Payload cập nhật dùng kiểu dữ liệu sinh từ schema để tránh ghi sai cột.
- Test kiểm tra quyền truy cập, trạng thái không hợp lệ, lỗi cập nhật và race condition.

## Bổ sung tiếp theo

Đã thêm event kế toán tự động cho `INTER_BRANCH_CLEARING`:

- Gạch nợ bù trừ tạo hai outbox events, một cho chi nhánh trả và một cho chi nhánh nhận.
- Nếu enqueue kế toán không đủ hai phía, hệ thống rollback trạng thái clear và dọn event đã tạo.
- Worker kiểm tra bản ghi nguồn vẫn `cleared`, đúng tenant pair và đúng số tiền trước khi post journal.
- Database migration mở rộng CHECK constraint và đổi idempotency sang `(tenant_id, event_type, reference_id)` để một bản bù trừ có thể đi vào hai sổ chi nhánh riêng.

Phần cần theo dõi sau: báo cáo hợp nhất HQ nên có lớp loại trừ giao dịch nội bộ nếu muốn trình bày báo cáo consolidated không bị phóng đại doanh thu/giá vốn nội bộ.
