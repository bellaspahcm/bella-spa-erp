# Safe Finance Confirm Transaction

## Mục tiêu

Nút xác nhận giao dịch trên dashboard tài chính phải hiển thị lỗi rõ ràng khi dữ liệu hoặc điều kiện ghi sổ bị chặn, thay vì làm vỡ Server Components render ở môi trường production.

## Quyết định triển khai

- Engine `src/services/finance/transaction-mutations.ts` vẫn giữ hành vi ném lỗi thật để bảo vệ rollback, outbox kế toán và test hồi quy.
- Public server action `src/services/finance/transactions.ts` bọc riêng `confirmTransaction` và trả về `{ success: false, error }` khi engine thất bại.
- Giao diện `src/app/dashboard/finance/page.tsx` đọc kết quả thất bại này và hiện toast lỗi cho người dùng.

## Tiêu chí nghiệm thu

- Khi xác nhận doanh thu bị lỗi truy vấn, public action trả về `success: false` và giữ nguyên thông điệp lỗi gốc.
- Khi chế độ kế toán chuyên nghiệp chặn thao tác xác nhận thủ công, public action trả về lỗi rõ ràng thay vì reject lên UI.
- Các test engine trực tiếp vẫn xác nhận lỗi được ném ra để không che mất lỗi rollback hoặc side-effect.
