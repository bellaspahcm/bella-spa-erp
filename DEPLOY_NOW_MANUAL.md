# 🚀 DEPLOY REAL ESTATE PERFORMANCE - MANUAL STEPS

## ⚠️ CLI Gặp Vấn Đề

Supabase CLI không hỗ trợ tốt các migration có `RAISE NOTICE` và `DO $$ ... END $$` blocks phức tạp.

**Giải pháp**: Deploy thủ công qua Supabase Dashboard SQL Editor (3 phút)

---

## 📋 BƯỚC DEPLOY (3 phút total)

### BƯỚC 1: Deploy Core Schema (1 phút) ✅ CẦN LÀM TRƯỚC

1. Mở Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new
   ```

2. Copy **TOÀN BỘ** file: `supabase/migrations/20260802150000_real_estate_core_schema.sql`

3. Paste vào SQL Editor → Click **RUN**

4. Chờ ~30 giây, xem output:
   ```
   ✅ REAL ESTATE CORE SCHEMA DEPLOYED SUCCESSFULLY
   Tables: 9 | Enums: 5 | RLS Policies: 9
   ```

5. Nếu có lỗi "already exists" → **OK, bỏ qua** (tables đã tồn tại)

---

### BƯỚC 2: Add Missing Columns (30 giây)

1. Trong cùng SQL Editor, **New Query**

2. Copy file: `scripts/DEPLOY_STEP_1_SCHEMA.sql`

3. Paste → Click **RUN**

4. Xem output:
   ```
   ✅ REAL ESTATE SCHEMA PATCH DEPLOYED
   Enums: 5 | Deleted_at columns: 9
   ✅ Ready for performance indexes deployment!
   ```

---

### BƯỚC 3: Deploy Performance Indexes (2 phút)

1. **New Query** trong SQL Editor

2. Copy file: `scripts/DEPLOY_STEP_2_PERFORMANCE.sql`

3. Paste → Click **RUN**

4. Chờ ~2 phút (indexes build online, không lock tables)

5. Xem output:
   ```
   ✅ REAL ESTATE PERFORMANCE OPTIMIZATION DEPLOYED
   
   📊 Index Statistics:
     • Total Indexes:      47
     • GIN Indexes:        2 (JSONB/Array)
     • Partial Indexes:    35 (WHERE filters)
     • Composite Indexes:  12 (Multi-column/INCLUDE)
   
   ✅ Real Estate module optimization complete!
   ```

---

## ✅ VERIFY (1 phút)

Chạy query này trong SQL Editor:

```sql
-- 1. Check enums
SELECT typname 
FROM pg_type 
WHERE typname IN (
  'product_type', 'lead_state', 'booking_state', 
  'contract_state', 'reservation_status'
);
-- Expected: 5 rows

-- 2. Check deleted_at columns
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%')
  AND column_name = 'deleted_at'
ORDER BY table_name;
-- Expected: 9 rows

-- 3. Check indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
  AND indexname LIKE 'idx_re_%';
-- Expected: 47+

-- 4. Test query performance
EXPLAIN ANALYZE
SELECT * FROM real_estate_products
WHERE tenant_id = 'd4710089-f0bc-4cca-bde4-3904c17c2782'
  AND status = 'available'
  AND deleted_at IS NULL
LIMIT 10;
-- Should use: Index Scan using idx_re_products_tenant_status
```

---

## 🎯 Kết Quả Mong Đợi

**Before**:
- Dashboard load: 5-10s
- Product listing: 2-3s
- Lead pipeline: 3-5s
- Reports: 10-15s

**After** (với 47 indexes):
- Dashboard load: 1-2s **(↓ 70-80%)**
- Product listing: 0.5-1s **(↓ 70%)**
- Lead pipeline: 0.5-1s **(↓ 80%)**
- Reports: 2-3s **(↓ 80%)**

---

## 📚 Files Cheat Sheet

| File | Purpose | Time |
|------|---------|------|
| `supabase/migrations/20260802150000_real_estate_core_schema.sql` | Create tables, enums, RLS | 30s |
| `scripts/DEPLOY_STEP_1_SCHEMA.sql` | Add missing columns (deleted_at, area_m2) | 10s |
| `scripts/DEPLOY_STEP_2_PERFORMANCE.sql` | Create 47 performance indexes | 2 min |

---

## ⚠️ Troubleshooting

### Lỗi: "column already exists"
→ **OK, bỏ qua**. Column đã tồn tại từ lần deploy trước.

### Lỗi: "relation does not exist"
→ Chưa chạy BƯỚC 1. Quay lại chạy core schema migration.

### Lỗi: "check constraint violated"
→ Table có data không hợp lệ. Xem log để biết table nào, fix data trước.

### Index không được dùng (EXPLAIN ANALYZE không thấy)
→ Chạy `ANALYZE` để update statistics:
```sql
ANALYZE real_estate_projects;
ANALYZE real_estate_products;
ANALYZE re_leads;
ANALYZE re_bookings;
-- ... (all Real Estate tables)
```

---

## 🔄 Rollback (nếu cần)

Xóa tất cả indexes:

```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_re_%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname || ' CASCADE';
    RAISE NOTICE 'Dropped: %', r.indexname;
  END LOOP;
END $$;
```

**Không ảnh hưởng data**, chỉ làm chậm queries.

---

## ✅ DONE Checklist

- [ ] BƯỚC 1: Core schema deployed
- [ ] BƯỚC 2: Missing columns added
- [ ] BƯỚC 3: Performance indexes created
- [ ] Verify: All queries passed
- [ ] Test: UI load nhanh hơn

---

**Total Time**: ~3-4 phút  
**Expected Improvement**: 70-80% faster queries  
**Risk**: Low (indexes không ảnh hưởng data)

---

## 💡 Why Manual?

Supabase CLI `db push` có issues với:
- `RAISE NOTICE` statements (phải trong DO block)
- Complex PL/pgSQL blocks
- Migration file naming patterns

→ Supabase Dashboard SQL Editor **reliable hơn** cho complex migrations.

---

🚀 **Sẵn sàng deploy? Chỉ cần 3 lần copy/paste vào SQL Editor!**
