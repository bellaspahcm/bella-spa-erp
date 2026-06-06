# Reconciliation Debt Collection Outbox

## Mục tiêu

Thu nợ khách hàng từ trang đối soát tài chính phải tạo dòng tiền và bút toán kế toán đồng bộ. Không được có trường hợp thu tiền thành công nhưng accounting outbox không nhận sự kiện.

## Quyết định triển khai

- `collectDebtPayment` ghi doanh thu công nợ dưới loại `remaining_payment` thay vì `additional`.
- Revenue công nợ mới có metadata kế toán `CUSTOMER_REMAINING_PAYMENT`.
- Sau khi insert revenue thành công, action enqueue sự kiện `PACKAGE_SALE` với `referenceType: REVENUE`.
- Nếu enqueue outbox thất bại, action xóa revenue vừa tạo để tránh lệch dòng tiền và sổ kế toán.
- Lịch sử thu nợ vẫn đọc cả dữ liệu cũ `additional` và dữ liệu mới `remaining_payment`.

## Tiêu chí nghiệm thu

- Thu nợ thành công tạo revenue confirmed và enqueue outbox `PACKAGE_SALE`.
- Outbox thất bại thì revenue vừa tạo bị rollback.
- Chế độ kế toán chuyên nghiệp và kỳ kế toán đóng vẫn chặn thao tác trước khi ghi dữ liệu.
