# Orphaned Revenue Allocation Accounting

## Mục tiêu

Khi gắn một khoản tiền treo vào booking, hệ thống phải chuẩn hóa lại ngữ cảnh kế toán của khoản tiền đó và tạo outbox kế toán tương ứng. Không được chỉ cập nhật `booking_id` rồi để doanh thu ở loại mơ hồ.

## Quyết định triển khai

- Nếu khoản tiền treo đã có loại doanh thu gói (`deposit`, `remaining_payment`, `package_payment`, `package_sale`) thì giữ nguyên loại đó.
- Nếu khoản tiền chưa rõ loại và số tiền nhỏ hơn hoặc bằng mức cọc của booking, phân loại là `deposit`.
- Các khoản còn lại phân loại là `remaining_payment`.
- Khi phân bổ thành công, revenue được cập nhật `booking_id`, `status`, `revenue_type`, `business_event_type`, `accounting_review_status`, và `accounting_metadata`.
- Sau khi update revenue, action enqueue `PACKAGE_SALE` với `referenceType: REVENUE`.
- Nếu outbox thất bại, action rollback revenue về trạng thái tiền treo ban đầu.

## Tiêu chí nghiệm thu

- Khoản cọc chuyển khoản trước rồi mới gắn vào booking được nhận diện là `deposit`.
- Phân bổ tiền treo thành công tạo outbox `PACKAGE_SALE`.
- Outbox thất bại thì revenue quay lại trạng thái chưa gắn booking.
