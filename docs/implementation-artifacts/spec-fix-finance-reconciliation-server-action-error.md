---
title: Fix Finance Reconciliation Server Action Error
type: bugfix
created: 2026-06-06
status: done
area: finance-reconciliation
---

# Intent

Trang Đối soát Tài chính trên production hiển thị toast lỗi "Server Components render" khi một server action ném exception. Message bị Next.js ẩn trong production nên người dùng không biết lỗi nằm ở phần nào.

# Root Cause

Màn hình client gọi nhiều nguồn dữ liệu riêng lẻ, trong đó phần bù trừ chi nhánh dùng action `getInterBranchClearingRecords` có thể `throw`. Khi action này lỗi, Next.js trả về message production bị ẩn thay vì lỗi nghiệp vụ đọc được.

# Change

- Thêm `getInterBranchClearingRecordsResult` để trả `{ success, data, error }` thay vì để lỗi bị ẩn qua Server Action.
- Thêm `getFinancialReconciliationSnapshot` gom dữ liệu công nợ, tiền treo, lịch sử thu nợ và bù trừ chi nhánh.
- Trang `/dashboard/finance/reconciliation` chuyển sang dùng snapshot action.
- Lỗi bù trừ chi nhánh được báo mềm qua `clearing_error`, không làm hỏng bảng công nợ chính.

# Acceptance

- Nếu RPC đối soát tài chính lỗi, trang nhận failure explicit.
- Nếu lịch sử thu nợ lỗi, trang nhận failure explicit.
- Nếu bù trừ chi nhánh lỗi, trang vẫn hiển thị công nợ và lịch sử thu nợ, đồng thời có lỗi tiếng Việt rõ ràng.
- Không còn toast production chung chung "Server Components render" cho luồng tải dữ liệu trang này.
