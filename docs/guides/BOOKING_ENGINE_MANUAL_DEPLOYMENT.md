# Booking Engine - Manual Deployment Guide

## ⚠️ TÌNH HUỐNG

Không thể deploy qua Supabase CLI vì:
- Docker Desktop chưa setup (WSL 2 required)
- Local migrations không sync với remote
- Migration history conflicts

→ **GIẢI PHÁP**: Deploy thủ công qua Supabase SQL Editor

---

## 🚀 BƯỚC 1: MỞ SUPABASE SQL EDITOR

1. Truy cập: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Login với tài khoản Supabase
3. Click menu **"SQL Editor"** bên trái
4. Click **"New query"**

---

## 📋 BƯỚC 2: COPY & PASTE MIGRATION

**File**: `supabase/migrations/20260709140000_booking_engine_schema.sql`

**Nội dung**: 14,549 bytes (xem file gốc)

**Hướng dẫn**:
1. Mở file `supabase/migrations/20260709140000_booking_engine_schema.sql`
2. Select All (`Ctrl+A`)
3. Copy (`Ctrl+C`)
4. Paste vào SQL Editor trong Supabase Dashboard
5. Click **"Run"** (hoặc `Ctrl+Enter`)

---

## ✅ BƯỚC 3: VERIFY DEPLOYMENT

Sau khi chạy xong, verify các tables đã được tạo:

### Check Tables:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY table_name;
```

**Expected**: 4 rows

### Check Indexes:
```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY tablename, indexname;
```

**Expected**: 17 rows

### Check RLS Policies:
```sql
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY tablename, policyname;
```

**Expected**: 8 rows (2 per table average)

### Check Functions:
```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'expire_old_waitlist_entries',
  'calculate_waitlist_priority',
  'get_available_capacity'
)
ORDER BY routine_name;
```

**Expected**: 3 rows

---

## 🔧 BƯỚC 4: GENERATE TYPESCRIPT TYPES

Sau khi migration thành công, generate types:

```powershell
# Trong terminal của project
npx supabase gen types typescript --linked > src/types/supabase-generated.ts
```

**Verify**:
```powershell
# Check file size (should be larger after adding 4 new tables)
Get-Item src/types/supabase-generated.ts | Select-Object Length, LastWriteTime
```

---

## 🧪 BƯỚC 5: TEST QUERIES

### Test Waitlist:
```sql
-- Insert test entry
INSERT INTO waitlist (
  tenant_id,
  customer_id,
  package_id,
  preferred_date,
  preferred_time_slot,
  priority_score,
  expires_at
)
SELECT 
  t.id,
  c.id,
  p.id,
  CURRENT_DATE + 3,
  'morning',
  50,
  NOW() + INTERVAL '7 days'
FROM tenants t
CROSS JOIN LATERAL (SELECT id FROM customers WHERE tenant_id = t.id LIMIT 1) c
CROSS JOIN LATERAL (SELECT id FROM packages WHERE tenant_id = t.id LIMIT 1) p
LIMIT 1;

-- Verify
SELECT * FROM waitlist ORDER BY created_at DESC LIMIT 1;
```

### Test Pricing Rules:
```sql
-- Insert test rule
INSERT INTO pricing_rules (
  tenant_id,
  rule_name,
  rule_type,
  condition,
  multiplier,
  priority
)
SELECT 
  id,
  'Test Peak Hour',
  'peak_hour',
  '{"hour_range": [10, 12]}'::jsonb,
  1.15,
  100
FROM tenants
LIMIT 1;

-- Verify
SELECT * FROM pricing_rules ORDER BY created_at DESC LIMIT 1;
```

### Test Capacity Function:
```sql
-- Get capacity for today
SELECT * FROM get_available_capacity(
  (SELECT id FROM tenants LIMIT 1),
  CURRENT_DATE,
  'morning'
);
```

### Test Priority Calculation:
```sql
-- Calculate priority for a customer
SELECT calculate_waitlist_priority(
  (SELECT id FROM customers LIMIT 1),
  (SELECT tenant_id FROM customers LIMIT 1)
);
```

---

## 📊 EXPECTED RESULTS SUMMARY

| Item | Expected |
|------|----------|
| Tables created | 4 |
| Indexes created | 17 |
| RLS policies | 8 |
| Functions | 3 |
| Migration size | 14.5 KB |

---

## 🔄 ROLLBACK (NẾU CẦN)

Nếu có vấn đề, rollback bằng cách DROP tables:

```sql
-- Drop tables (cascades to indexes, policies)
DROP TABLE IF EXISTS booking_events CASCADE;
DROP TABLE IF EXISTS capacity_snapshots CASCADE;
DROP TABLE IF EXISTS pricing_rules CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS expire_old_waitlist_entries();
DROP FUNCTION IF EXISTS calculate_waitlist_priority(UUID, UUID);
DROP FUNCTION IF EXISTS get_available_capacity(UUID, DATE, TEXT);
```

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Opened Supabase SQL Editor
- [ ] Copied migration content
- [ ] Ran migration (no errors)
- [ ] Verified 4 tables created
- [ ] Verified 17 indexes created
- [ ] Verified 8 RLS policies active
- [ ] Verified 3 functions available
- [ ] Generated TypeScript types
- [ ] Ran test queries (all passed)
- [ ] Documented deployment in log

---

## 📝 NEXT STEPS

Sau khi deployment thành công:

1. **Update deployment log**: `docs/BOOKING_ENGINE_PRODUCTION_DEPLOYMENT.md`
2. **Run verification tests**: `npm run test -- booking-engine`
3. **Implement Provider queries**: Update Assignment/Capacity providers với real database calls
4. **Update task tracker**: Mark "Schema Deployment" as complete

---

## 🎯 STATUS

- **Deployment Method**: Manual (SQL Editor)
- **Reason**: CLI conflicts with local migrations
- **Risk**: LOW (additive only, no data affected)
- **Rollback Available**: Yes (DROP tables script above)

---

**Ready to deploy! 🚀**
