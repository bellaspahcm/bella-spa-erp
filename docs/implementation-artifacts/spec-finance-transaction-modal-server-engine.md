# Finance Transaction Modal Server Engine

## Mục tiêu

Modal "Ghi nhận thu chi" trên dashboard tài chính phải dùng chung engine ghi giao dịch của hệ thống, thay vì tự ghi trực tiếp từ phía trình duyệt.

## Quyết định triển khai

- Public `recordTransaction` trả về kết quả rõ ràng `{ success: false, error }` cho lỗi dự kiến từ giao diện.
- Engine gốc trong `transaction-mutations.ts` vẫn ném lỗi thật để bảo vệ rollback, outbox kế toán và test side-effect.
- `TransactionModal` gọi `recordTransaction` từ `finance-actions`, không tự lấy phiên đăng nhập, tenant hoặc insert trực tiếp.
- Danh mục "Cọc gói dịch vụ" dùng `deposit` để đi đúng loại doanh thu cọc.

## Tiêu chí nghiệm thu

- Khi kỳ kế toán đóng, modal nhận lỗi rõ ràng và không tạo giao dịch.
- Khi chế độ kế toán chuyên nghiệp chặn ghi thủ công, UI nhận kết quả thất bại thay vì lỗi render.
- Giao dịch đã xác nhận vẫn đi qua engine để tạo metadata kế toán và accounting outbox.
