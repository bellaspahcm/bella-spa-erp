# Deploy RPC via Supabase Dashboard

**Người thực hiện:** Dev Team  
**Thời gian ước tính:** 30-45 phút  
**Ngày:** 2026-06-22  

---

## 📋 CHECKLIST NHANH

- [ ] **Bước 1:** Backup database (5 phút)
- [ ] **Bước 2:** Deploy 2 RPCs lên production (15 phút)
- [ ] **Bước 3:** Test RPCs trên production (10 phút)
- [ ] **Bước 4:** Monitor logs (10 phút)

---

## 🎯 BƯỚC 1: BACKUP DATABASE (5 phút)

### 1.1. Mở Supabase Dashboard

1. Mở trình duyệt, vào: https://supabase.com/dashboard
2. Đăng nhập với tài khoản của bạn
3. Chọn project **Production** (KHÔNG phải staging)

### 1.2. Tạo backup

1. Sidebar → **Settings** → **Database**
2. Scroll xuống section **Backups**
3. Click **"Create backup"** hoặc verify rằng auto-backup đã chạy hôm nay
4. Lưu lại Backup ID: `_______________________`

> ⚠️ **QUAN TRỌNG:** Nếu có vấn đề, bạn sẽ restore từ backup này!

---

## 🎯 BƯỚC 2: DEPLOY 2 RPCs (15 phút)

### 2.1. Mở SQL Editor

1. Sidebar → **SQL Editor**
2. Click **"New query"**

### 2.2. Deploy RPC #1: `rpc_mobile_today_sessions`

**Copy và paste đoạn SQL này vào SQL Editor:**

```sql
-- ============================================================================
-- RPC #1: rpc_mobile_today_sessions
-- Purpose: Fetch today's sessions with denormalized data
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_mobile_today_sessions(
  p_tenant_id UUID,
  p_today DATE,
  p_ktv_id UUID DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  booking_id UUID,
  status TEXT,
  assigned_time TEXT,
  customer_name TEXT,
  baby_name TEXT,
  ktv_name TEXT,
  package_name TEXT,
  completed_sessions INT,
  total_sessions INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sl.id AS session_id,
    sl.booking_id,
    sl.status,
    sl.assigned_time,
    c.name_mother AS customer_name,
    c.name_baby AS baby_name,
    u.full_name AS ktv_name,
    b.package_name,
    b.completed_sessions,
    b.total_sessions
  FROM session_logs sl
  JOIN bookings b ON b.id = sl.booking_id
  JOIN customers c ON c.id = b.customer_id
  LEFT JOIN users u ON u.id = b.assigned_ktv_id
  WHERE
    sl.tenant_id = p_tenant_id
    AND sl.scheduled_date = p_today
    AND sl.status != 'completed'
    AND (p_ktv_id IS NULL OR b.assigned_ktv_id = p_ktv_id)
  ORDER BY sl.assigned_time ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION rpc_mobile_today_sessions TO authenticated;

-- Verify function created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'rpc_mobile_today_sessions';
```

**Click "Run" (hoặc Ctrl+Enter)**

**Kết quả mong đợi:**
```
routine_name                | routine_type
---------------------------|-------------
rpc_mobile_today_sessions  | FUNCTION
```

✅ Nếu thấy 1 row trả về → SUCCESS!  
❌ Nếu có error → DỪNG LẠI, chụp screenshot error, báo team

---

### 2.3. Deploy RPC #2: `rpc_ktv_dashboard_stats`

**Tạo query mới, copy và paste:**

```sql
-- ============================================================================
-- RPC #2: rpc_ktv_dashboard_stats
-- Purpose: Fix Issue #1 - KTV only sees their assigned sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_ktv_dashboard_stats(
  p_tenant_id UUID,
  p_ktv_id UUID,
  p_today DATE
)
RETURNS TABLE (
  total_sessions INT,
  completed_sessions INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INT AS total_sessions,
    COUNT(*) FILTER (WHERE sl.status = 'completed')::INT AS completed_sessions
  FROM session_logs sl
  JOIN bookings b ON b.id = sl.booking_id
  WHERE
    sl.tenant_id = p_tenant_id
    AND sl.scheduled_date = p_today
    AND b.assigned_ktv_id = p_ktv_id;
$$;

GRANT EXECUTE ON FUNCTION rpc_ktv_dashboard_stats TO authenticated;

-- Verify function created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'rpc_ktv_dashboard_stats';
```

**Click "Run"**

**Kết quả mong đợi:**
```
routine_name              | routine_type
-------------------------|-------------
rpc_ktv_dashboard_stats  | FUNCTION
```

✅ Nếu thấy 1 row trả về → SUCCESS!  
❌ Nếu có error → DỪNG LẠI, chụp screenshot error, báo team

---

## 🎯 BƯỚC 3: TEST RPCs (10 phút)

### 3.1. Lấy test data từ production

Trước tiên, lấy IDs thật từ database để test:

```sql
-- Lấy 1 tenant ID
SELECT id, name FROM tenants LIMIT 1;
```

Lưu lại:
- Tenant ID: `_______________________`
- Tenant Name: `_______________________`

```sql
-- Lấy 1 KTV user
SELECT id, full_name, email 
FROM users 
WHERE role = 'ktv' 
LIMIT 1;
```

Lưu lại:
- KTV ID: `_______________________`
- KTV Name: `_______________________`

---

### 3.2. Test RPC #1: `rpc_mobile_today_sessions`

**Test với Admin (NULL ktv_id - thấy tất cả sessions):**

```sql
SELECT * FROM rpc_mobile_today_sessions(
  '<PASTE_TENANT_ID_HERE>'::UUID,
  CURRENT_DATE,
  NULL  -- Admin mode
);
```

**Kết quả mong đợi:**
- Trả về list sessions (hoặc empty array nếu không có sessions hôm nay)
- Có columns: session_id, booking_id, status, customer_name, ktv_name, etc.
- Response time < 500ms (check ở góc dưới SQL Editor)

**Test với KTV (chỉ thấy sessions của mình):**

```sql
SELECT * FROM rpc_mobile_today_sessions(
  '<PASTE_TENANT_ID_HERE>'::UUID,
  CURRENT_DATE,
  '<PASTE_KTV_ID_HERE>'::UUID  -- KTV mode
);
```

**Kết quả mong đợi:**
- Chỉ trả về sessions có `assigned_ktv_id` = KTV ID đó
- Số lượng sessions <= kết quả test Admin ở trên

---

### 3.3. Test RPC #2: `rpc_ktv_dashboard_stats`

```sql
SELECT * FROM rpc_ktv_dashboard_stats(
  '<PASTE_TENANT_ID_HERE>'::UUID,
  '<PASTE_KTV_ID_HERE>'::UUID,
  CURRENT_DATE
);
```

**Kết quả mong đợi:**
```
total_sessions | completed_sessions
---------------|-------------------
           5   |         3
```

- `total_sessions`: Số sessions assigned cho KTV này hôm nay
- `completed_sessions`: Số sessions đã hoàn thành
- `completed_sessions` ≤ `total_sessions` (logic check)
- Nếu KTV không có sessions → `0 | 0` (không phải NULL)

---

### 3.4. Test Cross-KTV Isolation 🔴 **CRITICAL**

**Test với 2 KTV khác nhau để verify không lộ data:**

```sql
-- Lấy 2 KTVs
SELECT id, full_name FROM users WHERE role = 'ktv' LIMIT 2;
```

Lưu lại:
- KTV A ID: `_______________________`
- KTV B ID: `_______________________`

**Test KTV A:**
```sql
SELECT * FROM rpc_ktv_dashboard_stats(
  '<TENANT_ID>'::UUID,
  '<KTV_A_ID>'::UUID,
  CURRENT_DATE
);
```

Kết quả KTV A: `total = _____, completed = _____`

**Test KTV B:**
```sql
SELECT * FROM rpc_ktv_dashboard_stats(
  '<TENANT_ID>'::UUID,
  '<KTV_B_ID>'::UUID,
  CURRENT_DATE
);
```

Kết quả KTV B: `total = _____, completed = _____`

✅ **PASS nếu:** Kết quả khác nhau (mỗi KTV chỉ thấy sessions của mình)  
❌ **FAIL nếu:** Kết quả giống hệt nhau → Data leak! DỪNG LẠI, rollback!

---

## 🎯 BƯỚC 4: MONITOR LOGS (10 phút)

### 4.1. Check Database Logs

1. Sidebar → **Logs** → **Database**
2. Filter: **Last 30 minutes**
3. Tìm kiếm: `rpc_mobile` hoặc `rpc_ktv`

**Tìm:**
- ✅ Không có errors liên quan đến RPCs
- ✅ Query execution time < 500ms
- ⚠️ Có warnings → Note lại nhưng có thể tiếp tục
- ❌ Có errors → DỪNG LẠI, investigate

---

### 4.2. Check Query Performance

1. Sidebar → **Reports** → **Database**
2. Section: **Top Queries by Execution Time**

**Verify:**
- `rpc_mobile_today_sessions` không xuất hiện trong top slow queries
- `rpc_ktv_dashboard_stats` không xuất hiện trong top slow queries

Nếu xuất hiện → Note lại execution time, có thể cần add index sau

---

## ✅ DEPLOYMENT COMPLETE CHECKLIST

- [ ] ✅ RPC #1 `rpc_mobile_today_sessions` created
- [ ] ✅ RPC #2 `rpc_ktv_dashboard_stats` created
- [ ] ✅ Test Admin mode (NULL ktv_id) PASS
- [ ] ✅ Test KTV mode (with ktv_id) PASS
- [ ] ✅ Test Cross-KTV isolation PASS 🔴
- [ ] ✅ No errors in Database Logs
- [ ] ✅ Query performance < 500ms
- [ ] ✅ Backup ID recorded: `_______________________`

---

## 🆘 ROLLBACK PROCEDURE (nếu có vấn đề)

**Nếu gặp lỗi nghiêm trọng:**

### Bước 1: Drop Functions

```sql
-- Xóa 2 functions
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS rpc_ktv_dashboard_stats(UUID, UUID, DATE);

-- Verify đã xóa
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats');
```

**Kết quả mong đợi:** 0 rows (functions đã bị xóa)

---

### Bước 2: Restore from Backup (nếu cần)

1. Dashboard → **Settings** → **Database** → **Backups**
2. Tìm backup ID từ Bước 1.2
3. Click **"Restore"**
4. **⚠️ CHỜ XÁC NHẬN TỪ TEAM LEAD TRƯỚC KHI RESTORE!**

---

## 📞 CONTACTS

**Nếu gặp vấn đề:**
- Technical issues: [Dev Team Lead]
- Production access: [DevOps/Admin]
- Emergency: [CTO]

---

## 📝 POST-DEPLOYMENT NOTES

**Ghi chú sau khi deploy:**

**Deployment time:** `_______________________`  
**Deployed by:** `_______________________`  
**Test results:**
- Admin test: ✅ / ❌
- KTV test: ✅ / ❌
- Cross-KTV isolation: ✅ / ❌
- Performance: `_____ms` (avg)

**Issues encountered:** `_______________________`

**Next steps:** 
- [ ] Update mobile app `.env.local` để point tới production Supabase
- [ ] Test mobile app trên local dev với production RPCs
- [ ] Proceed to device testing (Bước 2 trong checklist)

---

**Document created:** 2026-06-22  
**Status:** Ready for execution  
**Estimated time:** 30-45 phút
