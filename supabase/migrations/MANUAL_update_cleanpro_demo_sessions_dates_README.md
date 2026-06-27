# Update CleanPro Demo Sessions Dates

## Mục đích
Cập nhật dates cho demo sessions của CleanPro Industrial Services để có:
- ✅ **2 ca đã hoàn thành** (2 ngày trước và 1 ngày trước)
- ✅ **1 ca hôm nay** (in_progress hoặc scheduled)
- ✅ **Các ca sắp tới** (1, 2, 3, 7, 14 ngày sau)

## Cách chạy

### Option 1: Qua Supabase Dashboard (Khuyến nghị)
1. Mở **Supabase Dashboard** → Project của bạn
2. Vào **SQL Editor**
3. Copy toàn bộ nội dung file `MANUAL_update_cleanpro_demo_sessions_dates.sql`
4. Paste vào SQL Editor
5. Click **Run** (hoặc Ctrl+Enter)
6. Xem kết quả trong tab **Results**

### Option 2: Qua CLI
```bash
# Từ root folder của project
npx supabase db execute -f supabase/migrations/MANUAL_update_cleanpro_demo_sessions_dates.sql --local
```

## Kết quả mong đợi

### Sessions Timeline:
```
Session 1: 2 ngày trước  → status: completed
Session 2: 1 ngày trước  → status: completed
Session 3: Hôm nay      → status: in_progress hoặc scheduled
Session 4: Ngày mai     → status: scheduled
Session 5: 2 ngày sau   → status: scheduled
Session 6: 3 ngày sau   → status: scheduled
Session 7: 7 ngày sau   → status: scheduled
Session 8: 14 ngày sau  → status: scheduled
```

### Verification Query:
Sau khi chạy script, verify bằng query này:
```sql
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
)
SELECT 
  sl.session_number,
  sl.assigned_date,
  sl.assigned_date - CURRENT_DATE as days_from_today,
  sl.status,
  b.booking_number,
  c.name_mother as customer_name
FROM public.session_logs sl
JOIN public.bookings b ON b.id = sl.booking_id
JOIN public.customers c ON c.id = b.customer_id
WHERE b.tenant_id = (SELECT id FROM cleanpro_tenant)
ORDER BY sl.assigned_date, sl.session_number;
```

## Notes
- Script sử dụng `CURRENT_DATE` nên dates sẽ luôn relative to hôm nay
- Safe to re-run: Script chỉ update CleanPro tenant data
- Không ảnh hưởng đến Bella Spa hoặc Beauty Spa data
- `booking.completed_sessions` count sẽ tự động được recalculate
