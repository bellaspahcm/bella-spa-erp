# CleanPro Demo Data Seed Scripts

## Tổng quan

Bộ scripts tạo dữ liệu demo cho **Industrial Cleaning Module (CleanPro)** bao gồm:
- 5 khách hàng doanh nghiệp
- 5 nhân viên vệ sinh (NVS/workers)
- 8 hợp đồng dịch vụ (bookings)
- 64 ca làm việc (sessions) với ngày thực tế

## Files

1. **`MANUAL_cleanup_cleanpro_data.sql`** - Xóa toàn bộ dữ liệu CleanPro cũ
2. **`MANUAL_seed_cleanpro_complete_demo_data.sql`** - Tạo dữ liệu demo mới

## Hướng dẫn sử dụng

### Bước 1: Cleanup (Tùy chọn - nếu cần reset)

**Khi nào cần chạy:**
- Khi database đã có dữ liệu CleanPro cũ
- Khi muốn tạo lại dữ liệu demo từ đầu
- Khi số liệu verification không khớp (> 5 customers, > 8 bookings, v.v.)

**Cách chạy:**
1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `MANUAL_cleanup_cleanpro_data.sql`
3. Paste vào SQL Editor
4. Click **Run** (hoặc Ctrl+Enter)
5. Kiểm tra verification query → Tất cả counts phải = **0**

```
customer_count | worker_count | booking_count | total_sessions
---------------|--------------|---------------|---------------
0              | 0            | 0             | 0
```

### Bước 2: Seed Data

**Cách chạy:**
1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `MANUAL_seed_cleanpro_complete_demo_data.sql`
3. Paste vào SQL Editor
4. Click **Run** (hoặc Ctrl+Enter)
5. Kiểm tra kết quả:

**Kết quả mong đợi:**
```
NOTICE:  Successfully created CleanPro demo data:
NOTICE:  - 5 customers
NOTICE:  - 5 workers
NOTICE:  - 8 bookings
NOTICE:  - 64 sessions (2 completed + 1 today + 5 future per booking)
```

**Verification query kết quả:**
```
customer_count | worker_count | booking_count | total_sessions | completed_sessions | today_sessions | future_sessions
---------------|--------------|---------------|----------------|--------------------|-----------------|-----------------
5              | 5            | 8             | 64             | 16                 | 8               | 40
```

### Bước 3: Kiểm tra trên UI

1. Đăng nhập vào CleanPro tenant
2. Vào trang **`/dashboard/bookings`**
3. Chọn **ngày hôm nay** trên timeline ribbon
4. Bạn sẽ thấy **8 sessions** (Session #3 của mỗi booking)
5. Chọn **ngày hôm qua/hôm kia** → thấy completed sessions (màu xanh)
6. Chọn **ngày mai/ngày mốt** → thấy scheduled sessions (màu xám)

## Dữ liệu được tạo

### Customers (5)
1. Công ty TNHH ABC
2. Công ty Cổ phần XYZ
3. Tập đoàn DEF
4. Nhà máy GHI
5. Văn phòng JKL

### Workers/NVS (5)
1. Nguyễn Thị Mai - `mai.nguyen@cleanpro-v2.com`
2. Lê Văn Dũng - `dung.le@cleanpro-v2.com`
3. Trần Thị Lan - `lan.tran@cleanpro-v2.com`
4. Phạm Văn Hùng - `hung.pham@cleanpro-v2.com`
5. Võ Thị Hoa - `hoa.vo@cleanpro-v2.com`

### Bookings (8)
- 4 x Office Basic (12,000,000 VND)
- 4 x Factory Standard (18,000,000 VND)
- Tất cả status: `in_progress`
- Mỗi booking có 8 sessions

### Sessions (64 total)
**Pattern cho mỗi booking:**
- **Session 1:** Completed 2 ngày trước
- **Session 2:** Completed 1 ngày trước
- **Session 3:** Hôm nay (scheduled)
- **Session 4:** Ngày mai
- **Session 5:** 2 ngày sau
- **Session 6:** 3 ngày sau
- **Session 7:** 7 ngày sau
- **Session 8:** 14 ngày sau

**Thời gian ca:**
- Booking 1: 09:00
- Booking 2: 10:00
- Booking 3: 11:00
- Booking 4: 13:00
- Booking 5: 14:00
- Booking 6: 15:00
- Booking 7: 16:00
- Booking 8: 08:00

## Troubleshooting

### Lỗi: "CleanPro tenant not found"
**Nguyên nhân:** Tenant chưa được tạo

**Giải pháp:**
1. Chạy script khởi tạo tenant trong `20260101000000_multi_tenant.sql`
2. Hoặc tạo tenant thủ công trong dashboard

### Lỗi: Verification query không khớp
**Nguyên nhân:** Database đã có dữ liệu cũ

**Giải pháp:**
1. Chạy `MANUAL_cleanup_cleanpro_data.sql` trước
2. Sau đó chạy lại `MANUAL_seed_cleanpro_complete_demo_data.sql`

### Lỗi: "Package not found"
**Nguyên nhân:** Package Office Basic hoặc Factory Standard chưa tồn tại

**Giải pháp:**
1. Kiểm tra bảng `packages` có 2 packages này với `module_key = 'industrial_cleaning'`
2. Nếu chưa có, tạo packages trước khi chạy seed

### Không thấy sessions trong timeline
**Nguyên nhân:** 
- Filter specialty không đúng
- Ngày chọn không đúng

**Giải pháp:**
1. Đảm bảo chọn **ngày hôm nay** (CURRENT_DATE)
2. Industrial Cleaning module tự động set specialty = 'all'
3. Kiểm tra filter không bị lọc nhầm

## Lịch sử thay đổi

- **2026-06-22:** Tạo script lần đầu
- **2026-06-22:** Sửa lỗi INTERVAL syntax
- **2026-06-22:** Sửa lỗi bookings.status constraint (active → in_progress)
- **2026-06-22:** Thêm tenant_id vào session_logs
- **2026-06-22:** Thêm cleanup script

## Ghi chú

- Script sử dụng `DO $$` block nên **không thể rollback** từng phần
- Nếu script fail giữa chừng, phải chạy cleanup và seed lại toàn bộ
- Tất cả dates được tính động dựa trên `CURRENT_DATE` nên luôn relevant
- Completed sessions có `completed_date` set, scheduled sessions có `completed_date = NULL`
