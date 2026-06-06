---
title: Safe Finance Dashboard Snapshot
type: hardening
created: 2026-06-06
status: done
area: finance-dashboard
---

# Intent

Trang Tài chính chính tải nhiều nguồn dữ liệu cùng lúc: tổng quan thu chi, báo cáo P&L tháng và phân tích hiệu quả dịch vụ. Nếu một nguồn server action lỗi, UI trước đây tự xử lý `Promise.allSettled`, nhưng vẫn phải nhận exception từ từng action riêng lẻ và dễ phát sinh toast lỗi chung chung.

# Change

- Thêm `getFinanceDashboardSnapshot(month)` làm lớp đọc an toàn cho trang tài chính.
- Snapshot gọi lại các engine hiện có, không thay đổi công thức P&L, doanh thu, chi phí hay lương KTV.
- Mỗi nguồn lỗi được gom vào `errors`, còn dữ liệu fallback vẫn trả về để UI không sập toàn trang.
- Trang `/dashboard/finance` chuyển sang gọi snapshot thay vì gọi trực tiếp 3 server action riêng.

# Acceptance

- Nếu tất cả nguồn tải thành công, snapshot trả đủ dữ liệu và `success: true`.
- Nếu tổng quan/P&L lỗi, snapshot trả overview rỗng hoặc P&L `null`, kèm message lỗi rõ.
- Nếu phân tích dịch vụ vẫn tải được, UI vẫn có thể hiển thị phần đó dù nguồn khác lỗi.
- Lỗi dữ liệu trang finance không biến thành lỗi Server Components production chung chung.
