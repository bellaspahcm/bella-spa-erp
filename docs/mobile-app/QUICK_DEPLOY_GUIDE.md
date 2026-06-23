# Quick Deploy Guide - RPC to Production

**⏱️ Thời gian:** 30-45 phút  
**📍 Vị trí:** Supabase Dashboard → SQL Editor  

---

## 🚀 BƯỚC THỰC HIỆN

### 1. Backup (5 phút)

```
Dashboard → Settings → Database → Backups
→ Verify có backup hôm nay
→ Lưu Backup ID: _______________
```

---

### 2. Deploy RPC #1 (7 phút)

**SQL Editor → New Query → Paste:**

```sql
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

-- Verify
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'rpc_mobile_today_sessions';
```

**✅ Verify:** Thấy 1 row `rpc_mobile_today_sessions`

---

### 3. Deploy RPC #2 (7 phút)

**New Query → Paste:**

```sql
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

-- Verify
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'rpc_ktv_dashboard_stats';
```

**✅ Verify:** Thấy 1 row `rpc_ktv_dashboard_stats`

---

### 4. Test (10 phút)

**Get test IDs:**

```sql
-- Get tenant
SELECT id, name FROM tenants LIMIT 1;
-- Lưu: TENANT_ID = _______________

-- Get 2 KTVs
SELECT id, full_name FROM users WHERE role = 'ktv' LIMIT 2;
-- Lưu: KTV_A_ID = _______________
-- Lưu: KTV_B_ID = _______________
```

**Test Admin mode:**

```sql
SELECT * FROM rpc_mobile_today_sessions(
  'PASTE_TENANT_ID'::UUID,
  CURRENT_DATE,
  NULL
);
```

**Test KTV mode:**

```sql
SELECT * FROM rpc_mobile_today_sessions(
  'PASTE_TENANT_ID'::UUID,
  CURRENT_DATE,
  'PASTE_KTV_A_ID'::UUID
);
```

**Test Cross-KTV (CRITICAL):**

```sql
-- KTV A stats
SELECT * FROM rpc_ktv_dashboard_stats(
  'PASTE_TENANT_ID'::UUID,
  'PASTE_KTV_A_ID'::UUID,
  CURRENT_DATE
);
-- Result: total = ____, completed = ____

-- KTV B stats
SELECT * FROM rpc_ktv_dashboard_stats(
  'PASTE_TENANT_ID'::UUID,
  'PASTE_KTV_B_ID'::UUID,
  CURRENT_DATE
);
-- Result: total = ____, completed = ____
```

**✅ PASS:** Kết quả khác nhau  
**❌ FAIL:** Kết quả giống nhau → ROLLBACK!

---

### 5. Monitor (5 phút)

```
Dashboard → Logs → Database → Last 30 minutes
→ Tìm: rpc_mobile, rpc_ktv
→ Verify: No errors
```

```
Dashboard → Reports → Database
→ Check: Query Performance
→ Verify: <500ms
```

---

## ✅ COMPLETION CHECKLIST

- [ ] Backup ID recorded
- [ ] RPC #1 deployed ✅
- [ ] RPC #2 deployed ✅
- [ ] Admin test PASS
- [ ] KTV test PASS
- [ ] Cross-KTV test PASS 🔴
- [ ] No errors in logs
- [ ] Performance <500ms

---

## 🆘 ROLLBACK (if needed)

```sql
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS rpc_ktv_dashboard_stats(UUID, UUID, DATE);
```

---

## 📝 AFTER DEPLOY

1. Update `PHASE_2_EXECUTION_SUMMARY.md` with results
2. Notify team: "✅ RPCs deployed to production"
3. Test mobile app locally with production RPCs
4. Proceed to device testing (Bước 2)

---

**Chi tiết đầy đủ:** `RPC_DEPLOY_VIA_DASHBOARD.md`
