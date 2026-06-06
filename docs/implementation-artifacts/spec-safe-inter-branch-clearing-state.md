# Safe Inter-Branch Clearing State

## Mục tiêu

Khóa luồng gạch nợ bù trừ chi nhánh để không thể chuyển nhầm trạng thái khi bản ghi đã được xử lý, bị hủy, hoặc có hai thao tác gạch nợ chạy gần như cùng lúc.

## Phạm vi đã xử lý

- Chỉ cho phép gạch nợ bản ghi đang ở trạng thái `pending`.
- Lệnh cập nhật dùng điều kiện kép `id` và `status = pending` để chống race condition.
- Nếu bản ghi vừa bị thao tác khác xử lý, hệ thống trả lỗi rõ ràng và yêu cầu quét lại dữ liệu.
- Payload cập nhật dùng kiểu dữ liệu sinh từ schema để tránh ghi sai cột.
- Test kiểm tra quyền truy cập, trạng thái không hợp lệ, lỗi cập nhật và race condition.

## Phần cần làm tiếp

Chưa tạo event kế toán tự động cho bù trừ chi nhánh trong lượt này, vì hệ thống outbox hiện chưa có loại sự kiện chính thức cho `INTER_BRANCH_CLEARING`. Bước tiếp theo nên thêm event này theo đúng chuỗi: migration dữ liệu, rule hạch toán, worker xử lý, rollback khi side-effect lỗi, và test đối chiếu bút toán.
