# Giai đoạn 1: Chuyển đổi Chat & Chuẩn hóa Dashboard (Hoàn tất)

Hệ thống Bella Spa ERP đã được nâng cấp lên kiến trúc **Zero-Mock**, loại bỏ các thành phần giả lập và thay thế bằng kết nối cơ sở dữ liệu Supabase thực tế.

## 1. Hệ thống Chat Cơ sở dữ liệu (Persistence)
- **Bảng `chat_messages`**: Đã tạo bảng trong Supabase hỗ trợ đa chi nhánh (`tenant_id`), định danh người gửi (`sender_role`) và trạng thái đọc.
- **Real-time Synchronization**: Sử dụng Supabase Realtime để cập nhật tin nhắn tức thì giữa Nhân viên (KTV/Admin) và Khách hàng.
- **Server Actions**: Các hành động gửi/nhận tin nhắn đã được bảo mật hóa, bắt buộc phân giải `tenant_id` từ session.

## 2. Chuẩn hóa Dashboard & Loại bỏ Hardcoded
- **Loại bỏ Tenant ID mặc định**: Đã chạy SQL migration xóa bỏ ID gán cứng `46c75ad7-...` khỏi 12 bảng chính.
- **Dashboard RPCs**: 
    - `get_dashboard_summary`: Tính toán tổng khách hàng, doanh thu và lịch hẹn thực tế.
    - `get_monthly_performance_v2`: Vẽ biểu đồ hiệu suất dựa trên dữ liệu kinh doanh 6 tháng gần nhất.
    - `get_important_alerts`: Tự động tạo cảnh báo về nợ đọng thanh toán và đánh giá thấp.
- **Graceful Empty States**: Giao diện đã được tinh chỉnh để hiển thị trạng thái trống chuyên nghiệp khi chưa có dữ liệu, thay vì hiển thị số liệu demo 2024/2025.

## 3. Bảo mật & Đa chi nhánh
- **Tenant Isolation**: Mọi truy vấn từ `customer-actions`, `salary-actions`, `dashboard-actions` đều đã được kiểm tra và áp dụng bộ lọc `tenant_id` từ phiên đăng nhập.
- **Session-based resolution**: Loại bỏ hoàn toàn các biến `ensure2026` hoặc ngày tháng gán cứng trong logic nghiệp vụ.

> [!IMPORTANT]
> Toàn bộ dữ liệu hiển thị trên Dashboard hiện tại là **DỮ LIỆU THẬT** từ Supabase. Nếu các chỉ số hiện bằng 0, đó là kết quả chính xác từ cơ sở dữ liệu hiện tại của bạn.

---
**Kế hoạch tiếp theo:**
- **Giai đoạn 2**: Tự động hóa báo cáo tài chính chi tiết.
- **Giai đoạn 3**: Tích hợp thông báo đẩy (Push Notifications) cho tin nhắn mới.
